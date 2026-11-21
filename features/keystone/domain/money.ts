import { createHash } from 'node:crypto'
import { audit, dbNow, fail, inTransaction, lockRow, nextNumber, str, type Ctx, type Tx } from '../lib/core'
import { cardFee, invoiceStatusFor, invoiceTotals, refundProblem } from '../lib/rules/money'
import { addBusinessDays } from '../lib/rules/time'
import { afterCommit, companyUsers, getSettings, notify, organizationUsers, staffWith } from '../lib/services'
import * as stripe from '../../integrations/payment/stripe'

// Invoices, card sessions, bank transfers and refunds (§3.4). Adapted from the
// Barbershop payment-session flow: the session row is written and locked before
// the processor is called, the processor is called outside the lock with an
// idempotency key, and the answer is applied in a second locked step.

export const OPEN_SESSION = ['pending', 'requires_action', 'unknown']

/** Recompute invoice totals and status from its lines and money (§4.8). */
export async function recalculateInvoice(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } })
  if (!invoice) fail('Invoice not found.')
  const totals = invoiceTotals(invoice.lines.map((l: any) => ({ kind: l.kind, totalMinor: l.totalMinor ?? 0 })))
  const status = invoiceStatusFor({ totalMinor: totals.totalMinor, paidMinor: invoice.paidMinor ?? 0, refundedMinor: invoice.refundedMinor ?? 0, voided: invoice.status === 'void' })
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { ...totals, status, paidAt: status === 'paid' && !invoice.paidAt ? new Date() : invoice.paidAt },
  })
}

export async function createInvoice(tx: Tx, input: {
  kind: 'lot_sale' | 'service' | 'settlement' | 'restocking' | 'storage'
  buyerCompanyId?: string | null
  clientOrganizationId?: string | null
  orderId?: string | null
  jobId?: string | null
  settlementId?: string | null
  lines: Array<{ kind: string; description: string; quantity: number; unitPriceMinor: number; totalMinor: number }>
  billTo: Record<string, unknown>
  taxExemptReason?: string
  dueAt?: Date
}) {
  const settings = await getSettings(tx)
  const now = await dbNow(tx)
  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: await nextNumber(tx, 'invoice'),
      kind: input.kind,
      buyerCompanyId: input.buyerCompanyId ?? null,
      clientOrganizationId: input.clientOrganizationId ?? null,
      orderId: input.orderId ?? null,
      jobId: input.jobId ?? null,
      settlementId: input.settlementId ?? null,
      status: 'open',
      currencyCode: settings.currencyCode,
      issuedAt: now,
      dueAt: input.dueAt ?? addBusinessDays(now, settings.paymentDueBusinessDays, settings.timezone),
      billTo: input.billTo as any,
      taxExemptReason: input.taxExemptReason ?? '',
      lines: { create: input.lines.map((l) => ({ kind: l.kind, description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })) },
    },
  })
  return recalculateInvoice(tx, invoice.id)
}

/** The invoice if the signed-in buyer or client owns it; never another company's. */
export async function invoiceForCaller(context: Ctx, invoiceNumber: string) {
  const session = context.session
  if (!session) fail('Sign in to continue.')
  const user = await context.prisma.user.findUnique({ where: { id: session.itemId }, select: { id: true, kind: true, isActive: true, buyerCompanyId: true, clientOrganizationId: true, email: true } })
  if (!user?.isActive) fail('Your account is not active.')
  const invoice = await context.prisma.invoice.findUnique({ where: { invoiceNumber: str(invoiceNumber, 40) } })
  const owns = invoice && ((user.kind === 'buyer' && user.buyerCompanyId && invoice.buyerCompanyId === user.buyerCompanyId) || (user.kind === 'client' && user.clientOrganizationId && invoice.clientOrganizationId === user.clientOrganizationId))
  if (!owns) fail('Invoice not found.')
  return { invoice, user }
}

async function cardProvider(tx: Tx) {
  const provider = await tx.paymentProvider.findFirst({ where: { code: 'stripe', isInstalled: true } })
  return provider && stripe.stripeConfigured() ? provider : null
}

export async function paymentOptions(db: Tx, invoice: any) {
  const settings = await getSettings(db)
  const balance = Math.max(0, (invoice.totalMinor ?? 0) - (invoice.paidMinor ?? 0))
  const card = await cardProvider(db)
  const cardAllowed = Boolean(card) && (settings.cardMaxAmountMinor == null || balance <= settings.cardMaxAmountMinor)
  return {
    balanceMinor: balance,
    card: cardAllowed,
    cardFeeBps: settings.cardFeeBps,
    cardFeeMinor: cardFee(balance, settings.cardFeeBps),
    cardUnavailableReason: !card ? 'Card payments are not set up. Pay by bank transfer.' : !cardAllowed ? 'This amount is above the card limit. Pay by bank transfer.' : null,
    publishableKey: cardAllowed ? stripe.stripePublishableKey() : '',
    bankTransfer: true,
    wireInstructions: settings.wireInstructions,
  }
}

function hashKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

async function removeFeeLines(tx: Tx, session: { id: string; invoiceId: string }) {
  await tx.invoiceLine.deleteMany({ where: { invoiceId: session.invoiceId, kind: 'card_fee', paymentSessionId: session.id } })
  await recalculateInvoice(tx, session.invoiceId)
}

export function serializeSession(s: any) {
  return s && { id: s.id, status: s.status, method: s.method, amountMinor: s.amountMinor, feeMinor: s.feeMinor, currencyCode: s.currencyCode, clientSecret: OPEN_SESSION.includes(s.status) ? s.clientSecret : '', providerPaymentId: s.providerPaymentId, lastError: s.lastError }
}

/** Start a card payment, or return the bank instructions (§5.2 U11, U12). */
export async function initiateInvoicePaymentSession(context: Ctx, args: { invoiceNumber: string; method: string; idempotencyKey: string }) {
  const { invoice, user } = await invoiceForCaller(context, args.invoiceNumber)
  const method = args.method === 'card' ? 'card' : 'bank_transfer'
  const key = str(args.idempotencyKey, 200)
  if (key.length < 8) fail('The request key is too short.')
  const keyHash = hashKey(`invoice:${invoice.id}:${method}:${key}`)

  if (method === 'bank_transfer') {
    // Leaving the card path removes its fee: cancel any open card session first.
    await cancelOpenCardSessions(context, invoice.id)
    const fresh = await context.prisma.invoice.findUnique({ where: { id: invoice.id } })
    return { method, session: null, options: await paymentOptions(context.prisma, fresh) }
  }

  const prepared = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Invoice', invoice.id)
    const existing = await tx.paymentSession.findUnique({ where: { idempotencyKeyHash: keyHash } })
    if (existing) return { session: existing, call: false }
    const current = await tx.invoice.findUnique({ where: { id: invoice.id } })
    if (!['open', 'partially_paid'].includes(current.status)) fail('This invoice is not open for payment.')
    const open = await tx.paymentSession.findFirst({ where: { invoiceId: invoice.id, method: 'card', status: { in: OPEN_SESSION } } })
    if (open) {
      if (open.status === 'unknown') fail('A card payment on this invoice is being confirmed. Wait a minute and reload.')
      return { session: open, call: !open.providerPaymentId }
    }
    const provider = await cardProvider(tx)
    if (!provider) fail('Card payments are not set up. Pay by bank transfer.')
    const settings = await getSettings(tx)
    const balance = Math.max(0, (current.totalMinor ?? 0) - (current.paidMinor ?? 0))
    if (balance <= 0) fail('Nothing is owed on this invoice.')
    if (settings.cardMaxAmountMinor != null && balance > settings.cardMaxAmountMinor) fail('This amount is above the card limit. Pay by bank transfer.')
    const fee = cardFee(balance, settings.cardFeeBps)
    const session = await tx.paymentSession.create({
      data: {
        invoiceId: invoice.id,
        paymentProviderId: provider.id,
        method: 'card',
        openKey: `${invoice.id}:card`,
        idempotencyKeyHash: keyHash,
        status: 'pending',
        amountMinor: balance + fee,
        feeMinor: fee,
        currencyCode: current.currencyCode,
        createdById: user.id,
      },
    })
    if (fee > 0) {
      await tx.invoiceLine.create({ data: { invoiceId: invoice.id, kind: 'card_fee', description: `Card processing fee (${settings.cardFeeBps / 100}%)`, quantity: 1, unitPriceMinor: fee, totalMinor: fee, paymentSessionId: session.id } })
      await recalculateInvoice(tx, invoice.id)
    }
    return { session, call: true }
  })

  let session = prepared.session
  if (prepared.call) session = await createIntent(context, session.id, invoice, user.email)
  const fresh = await context.prisma.invoice.findUnique({ where: { id: invoice.id } })
  return { method, session: serializeSession(session), options: await paymentOptions(context.prisma, fresh) }
}

async function createIntent(context: Ctx, sessionId: string, invoice: any, email: string) {
  const session = await context.prisma.paymentSession.findUnique({ where: { id: sessionId } })
  try {
    const result = await stripe.createPaymentFunction({
      amount: session.amountMinor,
      currency: session.currencyCode,
      description: `Invoice ${invoice.invoiceNumber}`,
      idempotencyKey: `payment-session-${session.id}`,
      metadata: { invoiceNumber: invoice.invoiceNumber, paymentSessionId: session.id },
      customerEmail: email,
    } as any)
    return context.prisma.paymentSession.update({ where: { id: session.id }, data: { providerPaymentId: result.id, clientSecret: result.clientSecret ?? '', status: result.status === 'captured' ? 'pending' : result.status } })
  } catch (error) {
    if (error instanceof stripe.StripeUnknownOutcome) {
      return context.prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'unknown', lastError: error.message } })
    }
    return inTransaction(context, async (tx) => {
      await lockRow(tx, 'Invoice', session.invoiceId)
      const updated = await tx.paymentSession.update({ where: { id: session.id }, data: { status: 'failed', openKey: null, lastError: String((error as Error).message).slice(0, 300) } })
      await removeFeeLines(tx, session)
      return updated
    }).then((s) => {
      fail(`The card payment could not start: ${s.lastError}`)
    })
  }
}

async function cancelOpenCardSessions(context: Ctx, invoiceId: string) {
  const open = await context.prisma.paymentSession.findMany({ where: { invoiceId, method: 'card', status: { in: ['pending', 'requires_action'] } } })
  for (const s of open) {
    if (s.providerPaymentId) {
      // Ask Stripe first: a payment that already went through is applied, not cancelled.
      try {
        const status = await stripe.getPaymentStatusFunction({ paymentId: s.providerPaymentId } as any)
        if (status.status === 'captured' || status.status === 'requires_action') {
          await applyIntentResult(context, s.id, status)
          if (status.status === 'requires_action') fail('A card payment on this invoice is still being processed.')
          continue
        }
        await stripe.cancelPayment(s.providerPaymentId)
      } catch (error) {
        if ((error as any)?.name === 'DomainError') throw error
        fail('The open card payment could not be cancelled. Try again in a minute.')
      }
    }
    await inTransaction(context, async (tx) => {
      await lockRow(tx, 'Invoice', invoiceId)
      await lockRow(tx, 'PaymentSession', s.id)
      const current = await tx.paymentSession.findUnique({ where: { id: s.id } })
      if (!['pending', 'requires_action'].includes(current.status)) return
      await tx.paymentSession.update({ where: { id: s.id }, data: { status: 'canceled', openKey: null, canceledAt: new Date() } })
      await removeFeeLines(tx, s)
    })
  }
}

/**
 * Applies Stripe's answer to a session once: from the browser return, the staff
 * "Check payment" action or the webhook. Keyed by the intent id.
 */
export async function applyIntentResult(context: Pick<Ctx, 'prisma'> & Partial<Ctx>, sessionId: string, result: { status: string; amountReceived?: number; amount?: number; error?: string | null }) {
  const outcome = await inTransaction(context as Ctx, async (tx) => {
    const session = await tx.paymentSession.findUnique({ where: { id: sessionId } })
    if (!session) fail('Payment session not found.')
    await lockRow(tx, 'Invoice', session.invoiceId)
    await lockRow(tx, 'PaymentSession', session.id)
    const current = await tx.paymentSession.findUnique({ where: { id: sessionId } })
    if (['captured', 'failed', 'canceled'].includes(current.status)) return { session: current, changed: false }
    if (result.status === 'captured') {
      const amount = result.amountReceived ?? current.amountMinor
      await tx.payment.create({
        data: { invoiceId: current.invoiceId, sessionId: current.id, method: 'card', amountMinor: amount, status: 'captured', providerReference: current.providerPaymentId, paidOn: new Date().toISOString().slice(0, 10), confirmedAt: new Date() },
      })
      const updated = await tx.paymentSession.update({ where: { id: current.id }, data: { status: 'captured', capturedAt: new Date(), openKey: null } })
      await addPaid(tx, current.invoiceId, amount)
      await audit(tx, { action: 'payment.captured', entityType: 'Invoice', entityId: current.invoiceId, after: { amountMinor: amount, paymentSessionId: current.id } })
      return { session: updated, changed: true }
    }
    if (result.status === 'canceled' || (result.status === 'pending' && result.error)) {
      const updated = await tx.paymentSession.update({ where: { id: current.id }, data: { status: result.status === 'canceled' ? 'canceled' : 'failed', openKey: null, lastError: result.error ?? '' } })
      await removeFeeLines(tx, current)
      return { session: updated, changed: true }
    }
    if (result.status === 'requires_action' && current.status !== 'requires_action') {
      return { session: await tx.paymentSession.update({ where: { id: current.id }, data: { status: 'requires_action' } }), changed: true }
    }
    if (current.status === 'unknown' && result.status === 'pending') {
      return { session: await tx.paymentSession.update({ where: { id: current.id }, data: { status: 'pending' } }), changed: true }
    }
    return { session: current, changed: false }
  })
  afterCommit(context as Ctx)
  return outcome.session
}

/** Adds money to an invoice and runs what follows full payment. */
async function addPaid(tx: Tx, invoiceId: string, amountMinor: number) {
  const before = await tx.invoice.findUnique({ where: { id: invoiceId } })
  await tx.invoice.update({ where: { id: invoiceId }, data: { paidMinor: (before.paidMinor ?? 0) + amountMinor } })
  const after = await recalculateInvoice(tx, invoiceId)
  if (after.status === 'paid' && before.status !== 'paid') await onInvoicePaid(tx, after)
}

async function onInvoicePaid(tx: Tx, invoice: any) {
  await tx.invoice.update({ where: { id: invoice.id }, data: { isOverdue: false } })
  if (invoice.orderId) {
    const order = await tx.order.findUnique({ where: { id: invoice.orderId } })
    if (order?.status === 'awaiting_payment') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'paid' } })
      await audit(tx, { action: 'order.paid', entityType: 'Order', entityId: order.id })
      await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'order_paid', title: `Payment received for ${order.orderNumber}`, body: `We have your payment for order ${order.orderNumber}. Tell us how the goods will leave on the order page.`, link: `/buyer/orders/${order.orderNumber}` })
    }
  }
  if (invoice.settlementId) {
    const settlement = await tx.settlement.findUnique({ where: { id: invoice.settlementId } })
    if (settlement?.status === 'published') await tx.settlement.update({ where: { id: settlement.id }, data: { status: 'paid', paidAt: new Date(), payoutMethod: 'credit', payoutReference: `Invoice ${invoice.invoiceNumber}` } })
  }
  const userIds = invoice.buyerCompanyId ? await companyUsers(tx, invoice.buyerCompanyId) : invoice.clientOrganizationId ? await organizationUsers(tx, invoice.clientOrganizationId) : []
  await notify(tx, { userIds, type: 'invoice_paid', title: `Invoice ${invoice.invoiceNumber} is paid`, body: `Thank you. Invoice ${invoice.invoiceNumber} is paid in full.`, link: invoice.buyerCompanyId ? `/buyer/invoices/${invoice.invoiceNumber}` : `/client/invoices/${invoice.invoiceNumber}`, dedupeKey: `invoice-paid:${invoice.id}` })
}

/** Buyer or client returns from the card form; we ask Stripe, never trust the browser. */
export async function completeInvoicePayment(context: Ctx, args: { invoiceNumber: string; paymentSessionId: string }) {
  const { invoice } = await invoiceForCaller(context, args.invoiceNumber)
  const session = await context.prisma.paymentSession.findUnique({ where: { id: str(args.paymentSessionId, 60) } })
  if (!session || session.invoiceId !== invoice.id) fail('Payment not found.')
  return { session: serializeSession(await checkSession(context, session)), invoice: await context.prisma.invoice.findUnique({ where: { id: invoice.id } }) }
}

async function checkSession(context: Ctx, session: any) {
  if (!session.providerPaymentId) {
    if (session.status === 'unknown') {
      const ageMs = Date.now() - new Date(session.createdAt).getTime()
      if (ageMs > 10 * 60_000) return applyIntentResult(context, session.id, { status: 'canceled', error: 'Stripe never confirmed the payment was created.' })
    }
    return session
  }
  try {
    const status = await stripe.getPaymentStatusFunction({ paymentId: session.providerPaymentId } as any)
    return applyIntentResult(context, session.id, status)
  } catch (error) {
    if (error instanceof stripe.StripeUnknownOutcome) return session
    throw error
  }
}

/** Clock: settle sessions whose create call had an unknown outcome. */
export async function cancelStaleUnknownSessions(context: Pick<Ctx, 'prisma'>) {
  const stale = await context.prisma.paymentSession.findMany({ where: { status: 'unknown', createdAt: { lte: new Date(Date.now() - 10 * 60_000) } }, take: 25 })
  for (const s of stale) await checkSession(context as Ctx, s).catch((error) => console.error('[clock] payment session', s.id, error))
}

/** Staff "Check payment" (M3). */
export async function checkPaymentSession(context: Ctx, args: { paymentSessionId: string }) {
  const session = await context.prisma.paymentSession.findUnique({ where: { id: str(args.paymentSessionId, 60) } })
  if (!session) fail('Payment session not found.')
  return serializeSession(await checkSession(context, session))
}

/** Signed Stripe webhook, already verified; each event id is applied once. */
export async function applyStripeEvent(context: Pick<Ctx, 'prisma'>, event: { eventId: string; eventType: string; intent: any }) {
  if (!event.intent?.id || !String(event.eventType).startsWith('payment_intent.')) return 'ignored'
  let session = await context.prisma.paymentSession.findFirst({ where: { providerPaymentId: event.intent.id } })
  // The create call may have timed out before we stored the intent id; the intent carries our session id.
  const metaId = typeof event.intent.metadata?.paymentSessionId === 'string' ? event.intent.metadata.paymentSessionId : ''
  if (!session && metaId) {
    const bySession = await context.prisma.paymentSession.findUnique({ where: { id: metaId } })
    if (bySession && !bySession.providerPaymentId && bySession.amountMinor === event.intent.amount) {
      session = await context.prisma.paymentSession.update({ where: { id: bySession.id }, data: { providerPaymentId: event.intent.id } })
    }
  }
  if (!session) return 'no_session'
  await applyIntentResult(context, session.id, { status: stripe.intentStatus(event.intent), amountReceived: event.intent.amount_received, error: event.intent.last_payment_error?.message ?? null })
  return 'applied'
}

/** U12: the payer reports a wire or ACH. Only `confirmed` counts as paid. */
export async function reportBankTransfer(context: Ctx, args: { invoiceNumber: string; reference: string; date: string; amountMinor: number }) {
  const { invoice, user } = await invoiceForCaller(context, args.invoiceNumber)
  const amount = Math.round(Number(args.amountMinor))
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter the amount you sent.')
  const reference = str(args.reference, 120)
  if (!reference) fail('Enter the bank reference.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(args.date, 10))) fail('Enter the date you sent it.')
  await cancelOpenCardSessions(context, invoice.id)
  const payment = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Invoice', invoice.id)
    const current = await tx.invoice.findUnique({ where: { id: invoice.id } })
    if (!['open', 'partially_paid'].includes(current.status)) fail('This invoice is not open for payment.')
    const created = await tx.payment.create({ data: { invoiceId: invoice.id, method: 'wire', amountMinor: amount, status: 'reported', bankReference: reference, paidOn: str(args.date, 10), reportedById: user.id, reportedAt: new Date() } })
    await notify(tx, { userIds: await staffWith(tx, 'canManagePayments'), type: 'transfer_reported', title: `Transfer reported on ${current.invoiceNumber}`, body: `${user.email} reported a transfer of ${(amount / 100).toFixed(2)} with reference ${reference}. Confirm it against the bank statement.`, link: '/dashboard/platform/payments' })
    await audit(tx, { actorId: user.id, action: 'payment.reported', entityType: 'Invoice', entityId: invoice.id, after: { amountMinor: amount, reference } })
    return created
  })
  afterCommit(context)
  return payment
}

/** M2: confirm a reported transfer against the bank statement. */
export async function confirmBankTransfer(context: Ctx, args: { paymentId: string; bankReference?: string; paidOn?: string; amountMinor?: number }) {
  const staffId = context.session!.itemId
  const result = await inTransaction(context, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: str(args.paymentId, 60) } })
    if (!payment) fail('Payment not found.')
    await lockRow(tx, 'Invoice', payment.invoiceId)
    await lockRow(tx, 'Payment', payment.id)
    const current = await tx.payment.findUnique({ where: { id: payment.id } })
    if (current.status !== 'reported') fail(`This payment is already ${current.status}.`)
    const amount = args.amountMinor != null ? Math.round(Number(args.amountMinor)) : current.amountMinor
    if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter the amount received.')
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'confirmed', amountMinor: amount, bankReference: str(args.bankReference, 120) || current.bankReference, paidOn: str(args.paidOn, 10) || current.paidOn, confirmedById: staffId, confirmedAt: new Date() } })
    await addPaid(tx, payment.invoiceId, amount)
    await audit(tx, { actorId: staffId, action: 'payment.confirmed', entityType: 'Payment', entityId: payment.id, before: { status: 'reported', amountMinor: current.amountMinor }, after: { status: 'confirmed', amountMinor: amount } })
    return updated
  })
  afterCommit(context)
  return result
}

export async function rejectBankTransfer(context: Ctx, args: { paymentId: string; reason: string }) {
  const reason = str(args.reason, 500)
  if (!reason) fail('Write why the transfer is rejected.')
  const staffId = context.session!.itemId
  const result = await inTransaction(context, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: str(args.paymentId, 60) }, include: { invoice: true } })
    if (!payment) fail('Payment not found.')
    await lockRow(tx, 'Payment', payment.id)
    const current = await tx.payment.findUnique({ where: { id: payment.id } })
    if (current.status !== 'reported') fail(`This payment is already ${current.status}.`)
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: 'rejected', rejectionReason: reason, confirmedById: staffId, confirmedAt: new Date() } })
    const inv = payment.invoice
    const userIds = inv.buyerCompanyId ? await companyUsers(tx, inv.buyerCompanyId) : await organizationUsers(tx, inv.clientOrganizationId)
    await notify(tx, { userIds, type: 'transfer_rejected', title: `Transfer on ${inv.invoiceNumber} not matched`, body: `We could not match the transfer you reported (reference ${current.bankReference}): ${reason}`, link: inv.buyerCompanyId ? `/buyer/invoices/${inv.invoiceNumber}` : `/client/invoices/${inv.invoiceNumber}` })
    await audit(tx, { actorId: staffId, action: 'payment.rejected', entityType: 'Payment', entityId: payment.id, reason })
    return updated
  })
  afterCommit(context)
  return result
}

/** M2: record a cheque, cash or a transfer nobody reported, straight as confirmed. */
export async function recordOfflinePayment(context: Ctx, args: { invoiceId: string; method: string; amountMinor: number; reference: string; paidOn: string }) {
  const method = ['cheque', 'cash', 'wire', 'ach'].includes(args.method) ? args.method : fail('Choose cheque, cash, wire or ACH.')
  const amount = Math.round(Number(args.amountMinor))
  if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter the amount received.')
  const staffId = context.session!.itemId
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Invoice', args.invoiceId) || fail('Invoice not found.')
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } })
    if (!['open', 'partially_paid'].includes(invoice.status)) fail('This invoice is not open for payment.')
    const payment = await tx.payment.create({ data: { invoiceId: invoice.id, method, amountMinor: amount, status: 'confirmed', bankReference: str(args.reference, 120), paidOn: str(args.paidOn, 10) || new Date().toISOString().slice(0, 10), reportedById: staffId, reportedAt: new Date(), confirmedById: staffId, confirmedAt: new Date() } })
    await addPaid(tx, invoice.id, amount)
    await audit(tx, { actorId: staffId, action: 'payment.recorded', entityType: 'Invoice', entityId: invoice.id, after: { method, amountMinor: amount } })
    return payment
  })
  afterCommit(context)
  return result
}

/**
 * M4: refund. The refundable balance is reserved under the payment lock before
 * Stripe is called, so two refunds can never exceed what was captured.
 */
export async function refundPayment(context: Ctx, args: { paymentId: string; amountMinor: number; reason: string; idempotencyKey: string; claimId?: string | null }) {
  const staffId = context.session!.itemId
  const key = str(args.idempotencyKey, 200)
  if (key.length < 8) fail('The request key is too short.')
  const reason = str(args.reason, 500)
  if (!reason) fail('Write the reason for the refund.')
  const reserved = await inTransaction(context, async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: str(args.paymentId, 60) } })
    if (!payment) fail('Payment not found.')
    await lockRow(tx, 'Invoice', payment.invoiceId)
    await lockRow(tx, 'Payment', payment.id)
    const replay = await tx.refund.findUnique({ where: { idempotencyKey: `${payment.id}:${key}` } })
    if (replay) {
      if (replay.amountMinor !== Math.round(Number(args.amountMinor))) fail('This refund was already sent with a different amount.')
      return { refund: replay, payment, call: false }
    }
    const current = await tx.payment.findUnique({ where: { id: payment.id } })
    if (!['captured', 'confirmed', 'partially_refunded'].includes(current.status)) fail('Only a received payment can be refunded.')
    const amount = Math.round(Number(args.amountMinor))
    const problem = refundProblem({ capturedMinor: current.amountMinor ?? 0, alreadyRefundedMinor: current.refundedMinor ?? 0, requestedMinor: amount })
    if (problem) fail(problem)
    const refundedMinor = (current.refundedMinor ?? 0) + amount
    await tx.payment.update({ where: { id: current.id }, data: { refundedMinor, status: refundedMinor >= current.amountMinor ? 'refunded' : 'partially_refunded' } })
    const isCard = current.method === 'card'
    const refund = await tx.refund.create({ data: { paymentId: current.id, invoiceId: current.invoiceId, amountMinor: amount, reason, status: isCard ? 'pending' : 'succeeded', method: isCard ? 'card' : ['wire', 'ach', 'cheque', 'cash'].includes(current.method) ? current.method : 'wire', createdById: staffId, idempotencyKey: `${current.id}:${key}` } })
    if (!isCard) await applyRefundToInvoice(tx, current.invoiceId, amount)
    if (args.claimId) await tx.claim.update({ where: { id: args.claimId }, data: { refundId: refund.id } })
    await audit(tx, { actorId: staffId, action: 'refund.created', entityType: 'Payment', entityId: current.id, after: { amountMinor: amount, method: refund.method }, reason })
    return { refund, payment: current, call: isCard }
  })
  if (!reserved.call) return reserved.refund
  try {
    const result = await stripe.refundPaymentFunction({ paymentId: reserved.payment.providerReference, amount: reserved.refund.amountMinor, idempotencyKey: `refund-${reserved.refund.id}` } as any)
    return inTransaction(context, async (tx) => {
      await lockRow(tx, 'Invoice', reserved.payment.invoiceId)
      const ok = ['succeeded', 'pending'].includes(result.status)
      const updated = await tx.refund.update({ where: { id: reserved.refund.id }, data: { status: ok ? 'succeeded' : 'failed', providerReference: result.id } })
      if (ok) await applyRefundToInvoice(tx, reserved.payment.invoiceId, reserved.refund.amountMinor)
      else await releaseRefundReservation(tx, reserved.payment.id, reserved.refund.amountMinor)
      return updated
    })
  } catch (error) {
    if (error instanceof stripe.StripeUnknownOutcome) {
      return context.prisma.refund.update({ where: { id: reserved.refund.id }, data: { status: 'unknown' } })
    }
    await inTransaction(context, async (tx) => {
      await lockRow(tx, 'Payment', reserved.payment.id)
      await tx.refund.update({ where: { id: reserved.refund.id }, data: { status: 'failed', providerReference: String((error as Error).message).slice(0, 200) } })
      await releaseRefundReservation(tx, reserved.payment.id, reserved.refund.amountMinor)
    })
    fail(`Stripe refused the refund: ${(error as Error).message}`)
  }
}

async function releaseRefundReservation(tx: Tx, paymentId: string, amount: number) {
  const p = await tx.payment.findUnique({ where: { id: paymentId } })
  const refundedMinor = Math.max(0, (p.refundedMinor ?? 0) - amount)
  await tx.payment.update({ where: { id: paymentId }, data: { refundedMinor, status: refundedMinor === 0 ? (p.method === 'card' ? 'captured' : 'confirmed') : 'partially_refunded' } })
}

async function applyRefundToInvoice(tx: Tx, invoiceId: string, amount: number) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } })
  await tx.invoice.update({ where: { id: invoiceId }, data: { refundedMinor: (invoice.refundedMinor ?? 0) + amount } })
  await recalculateInvoice(tx, invoiceId)
}

/** Staff: add a freight, storage or adjustment line to an open invoice (S16). */
export async function addInvoiceLine(context: Ctx, args: { invoiceId: string; kind: string; description: string; quantity?: number; unitPriceMinor: number }) {
  const kind = ['freight', 'storage', 'adjustment', 'service'].includes(args.kind) ? args.kind : fail('Choose freight, storage, service or adjustment.')
  const unit = Math.round(Number(args.unitPriceMinor))
  const quantity = Math.max(1, Math.round(Number(args.quantity ?? 1)))
  if (!Number.isSafeInteger(unit) || (kind !== 'adjustment' && unit <= 0)) fail('Enter an amount.')
  const description = str(args.description, 200) || (kind === 'freight' ? 'Freight' : kind === 'storage' ? 'Storage' : 'Adjustment')
  const staffId = context.session!.itemId
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Invoice', args.invoiceId) || fail('Invoice not found.')
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } })
    if (!['open', 'partially_paid'].includes(invoice.status)) fail('Lines can only be added to an unpaid invoice.')
    const open = await tx.paymentSession.count({ where: { invoiceId: invoice.id, status: { in: OPEN_SESSION } } })
    if (open) fail('A card payment is in progress on this invoice. Wait for it to finish.')
    await tx.invoiceLine.create({ data: { invoiceId: invoice.id, kind, description, quantity, unitPriceMinor: unit, totalMinor: unit * quantity } })
    await audit(tx, { actorId: staffId, action: 'invoice.line_added', entityType: 'Invoice', entityId: invoice.id, after: { kind, description, totalMinor: unit * quantity } })
    return recalculateInvoice(tx, invoice.id)
  })
}

/** Staff: void an unpaid invoice (M1). */
export async function voidInvoice(context: Ctx, args: { invoiceId: string; reason: string }) {
  const reason = str(args.reason, 500) || fail('Write why the invoice is void.')
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Invoice', args.invoiceId) || fail('Invoice not found.')
    const invoice = await tx.invoice.findUnique({ where: { id: args.invoiceId } })
    if ((invoice.paidMinor ?? 0) > 0) fail('This invoice has payments. Refund them before voiding.')
    if (invoice.status === 'void') return invoice
    await tx.paymentSession.updateMany({ where: { invoiceId: invoice.id, status: { in: ['pending', 'requires_action'] } }, data: { status: 'canceled', openKey: null } })
    await audit(tx, { actorId: context.session!.itemId, action: 'invoice.void', entityType: 'Invoice', entityId: invoice.id, reason })
    return tx.invoice.update({ where: { id: invoice.id }, data: { status: 'void', voidReason: reason, isOverdue: false } })
  })
}
