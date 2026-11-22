// Money against the real scratch Postgres: award invoices with premium and tax,
// tax exemption, partial payment through a reported then confirmed transfer, the
// refund cap and refund idempotency, and the default flow (strike, restocking
// invoice, runner-up re-award, suspension on the third strike).
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, root } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, lots, money, orders, staffCtx

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  lots = require(path.join(root, 'features/keystone/domain/lots.ts'))
  money = require(path.join(root, 'features/keystone/domain/money.ts'))
  orders = require(path.join(root, 'features/keystone/domain/orders.ts'))
  staffCtx = await ctx.as((await f.staff(ctx.prisma)).id)
})
test.after(async () => { if (ctx) await ctx.disconnect() })

const PREMIUM_BPS = 500
const TAX_BPS = 725

async function withRates(run) {
  const s = await f.settings(ctx.prisma)
  const before = { buyerPremiumBps: s.buyerPremiumBps, salesTaxBps: s.salesTaxBps }
  await ctx.prisma.storeSettings.update({ where: { id: s.id }, data: { buyerPremiumBps: PREMIUM_BPS, salesTaxBps: TAX_BPS } })
  try { return await run() } finally { await ctx.prisma.storeSettings.update({ where: { id: s.id }, data: before }) }
}

/** A closed lot with one bid per buyer (highest first), awarded to the first. */
async function awarded(buyers, amounts, overrides = {}) {
  const lot = await f.lot(ctx.prisma, overrides)
  const bids = []
  for (let i = 0; i < buyers.length; i++) bids.push(await lots.placeBid(await ctx.as(buyers[i].user.id), { lotNumber: lot.lotNumber, amountMinor: amounts[i], idempotencyKey: f.key() }))
  await f.closeLot(ctx.prisma, lot.id, lots.advanceLotClock)
  const [award] = await lots.awardLot(staffCtx, { lotId: lot.id, bidId: bids[0].bidId })
  const invoice = await ctx.prisma.invoice.findUnique({ where: { invoiceNumber: award.invoiceNumber }, include: { lines: true } })
  const order = await ctx.prisma.order.findUnique({ where: { orderNumber: award.orderNumber } })
  return { lot, bids, award, invoice, order }
}

test('award invoice: subtotal, buyer premium and sales tax for a taxable buyer', { skip }, async () => {
  await withRates(async () => {
    const a = await f.buyer(ctx.prisma, { company: { taxStatus: 'taxable' } })
    const { invoice } = await awarded([a], [1_000_000])
    const premium = 1_000_000 * PREMIUM_BPS / 10_000
    const tax = Math.round((1_000_000 + premium) * TAX_BPS / 10_000)
    assert.equal(invoice.subtotalMinor, 1_000_000)
    assert.equal(invoice.lines.find((l) => l.kind === 'premium').totalMinor, premium)
    assert.equal(invoice.lines.find((l) => l.kind === 'tax').totalMinor, tax)
    assert.equal(invoice.totalMinor, 1_000_000 + premium + tax)
    assert.equal(invoice.status, 'open')
  })
})

test('award invoice: a resale-certificate buyer pays no tax and the reason is printed', { skip }, async () => {
  await withRates(async () => {
    const a = await f.buyer(ctx.prisma, { company: { taxStatus: 'exempt_resale' } })
    const { invoice } = await awarded([a], [500_000])
    assert.equal(invoice.lines.some((l) => l.kind === 'tax'), false)
    assert.equal(invoice.totalMinor, 500_000 + 25_000)
    assert.match(invoice.taxExemptReason, /resale/)
  })
})

test('partial payment: a reported transfer is not money; confirmed part payment leaves a balance', { skip }, async () => {
  const a = await f.buyer(ctx.prisma)
  const { invoice, order } = await awarded([a], [300_000])
  const buyerCtx = await ctx.as(a.user.id)
  const reported = await money.reportBankTransfer(buyerCtx, { invoiceNumber: invoice.invoiceNumber, reference: 'FW 88231', date: '2026-11-20', amountMinor: 100_000 })
  let inv = await ctx.prisma.invoice.findUnique({ where: { id: invoice.id } })
  assert.equal(inv.paidMinor, 0, 'reported is not paid')
  assert.equal(inv.status, 'open')
  await money.confirmBankTransfer(staffCtx, { paymentId: reported.id })
  inv = await ctx.prisma.invoice.findUnique({ where: { id: invoice.id } })
  assert.equal(inv.paidMinor, 100_000)
  assert.equal(inv.status, 'partially_paid')
  assert.equal((await ctx.prisma.order.findUnique({ where: { id: order.id } })).status, 'awaiting_payment')
  await assert.rejects(money.confirmBankTransfer(staffCtx, { paymentId: reported.id }), /already confirmed/)
  await money.recordOfflinePayment(staffCtx, { invoiceId: invoice.id, method: 'wire', amountMinor: inv.totalMinor - 100_000, reference: 'FW 88240', paidOn: '2026-11-21' })
  inv = await ctx.prisma.invoice.findUnique({ where: { id: invoice.id } })
  assert.equal(inv.status, 'paid')
  assert.equal((await ctx.prisma.order.findUnique({ where: { id: order.id } })).status, 'paid')
})

test('no Stripe keys at all: the invoice offers bank transfer, says card is not set up, and every invoice read and download works', { skip }, async () => {
  const STRIPE = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']
  const saved = Object.fromEntries(STRIPE.map((k) => [k, process.env[k]]))
  for (const k of STRIPE) delete process.env[k]
  // The Stripe provider row is installed (onboarding adds it); only the keys are missing.
  if (!(await ctx.prisma.paymentProvider.findFirst({ where: { code: 'stripe', isInstalled: true } }))) {
    await ctx.prisma.paymentProvider.create({ data: { code: 'stripe', name: 'Card (Stripe)', isInstalled: true, createPaymentFunction: 'stripe', capturePaymentFunction: 'stripe', refundPaymentFunction: 'stripe', getPaymentStatusFunction: 'stripe', generatePaymentLinkFunction: 'stripe', handleWebhookFunction: 'stripe' } })
  }
  try {
    const a = await f.buyer(ctx.prisma)
    const { invoice } = await awarded([a], [250_000])
    const buyerCtx = await ctx.as(a.user.id)
    const reads = require(path.join(root, 'features/keystone/domain/reads.ts'))
    const docs = require(path.join(root, 'features/keystone/domain/documents.ts'))
    const page = await reads.myInvoice(buyerCtx, { invoiceNumber: invoice.invoiceNumber })
    const o = page.paymentOptions
    assert.equal(o.card, false)
    assert.equal(o.bankTransfer, true)
    assert.equal(o.cardUnavailableReason, 'Card payments are not set up. Pay by bank transfer.')
    assert.equal(o.publishableKey, '')
    assert.ok(o.wireInstructions === null || typeof o.wireInstructions === 'string')
    assert.equal(o.balanceMinor, invoice.totalMinor)
    // Choosing card fails with the same plain reason, not an error page; transfer works end to end.
    await assert.rejects(money.initiateInvoicePaymentSession(buyerCtx, { invoiceNumber: invoice.invoiceNumber, method: 'card', idempotencyKey: f.key() }), { message: 'Card payments are not set up. Pay by bank transfer.' })
    await money.initiateInvoicePaymentSession(buyerCtx, { invoiceNumber: invoice.invoiceNumber, method: 'bank_transfer', idempotencyKey: f.key() })
    const pdf = await docs.downloadInvoice(buyerCtx, { invoiceNumber: invoice.invoiceNumber })
    assert.equal(Buffer.from(pdf.base64, 'base64').subarray(0, 5).toString(), '%PDF-')
    await docs.staffInvoicePdf(staffCtx, { invoiceId: invoice.id })
    const reported = await money.reportBankTransfer(buyerCtx, { invoiceNumber: invoice.invoiceNumber, reference: 'FW 51002', date: '2026-11-22', amountMinor: invoice.totalMinor })
    await money.confirmBankTransfer(staffCtx, { paymentId: reported.id })
    assert.equal((await ctx.prisma.invoice.findUnique({ where: { id: invoice.id } })).status, 'paid')
    // The same path through GraphQL: a plain refusal in the result, never an error.
    const gql = await buyerCtx.graphql.raw({ query: 'query($i: JSON) { myInvoice(input: $i) }', variables: { i: { invoiceNumber: invoice.invoiceNumber } } })
    assert.equal(gql.errors, undefined)
  } finally {
    for (const k of STRIPE) if (saved[k] !== undefined) process.env[k] = saved[k]
  }
})

test('refund cap and idempotency: one key refunds once; never more than was received', { skip }, async () => {
  const a = await f.buyer(ctx.prisma)
  const { invoice } = await awarded([a], [200_000])
  const payment = await money.recordOfflinePayment(staffCtx, { invoiceId: invoice.id, method: 'wire', amountMinor: invoice.totalMinor, reference: 'FW 1', paidOn: '2026-11-21' })
  const key = f.key()
  const first = await money.refundPayment(staffCtx, { paymentId: payment.id, amountMinor: 50_000, reason: 'Two units short', idempotencyKey: key })
  const again = await money.refundPayment(staffCtx, { paymentId: payment.id, amountMinor: 50_000, reason: 'Two units short', idempotencyKey: key })
  assert.equal(again.id, first.id)
  await assert.rejects(money.refundPayment(staffCtx, { paymentId: payment.id, amountMinor: 60_000, reason: 'x', idempotencyKey: key }), /different amount/)
  await assert.rejects(money.refundPayment(staffCtx, { paymentId: payment.id, amountMinor: invoice.totalMinor, reason: 'Too much', idempotencyKey: f.key() }), /At most/)
  const p = await ctx.prisma.payment.findUnique({ where: { id: payment.id } })
  assert.equal(p.refundedMinor, 50_000)
  assert.equal(p.status, 'partially_refunded')
  const inv = await ctx.prisma.invoice.findUnique({ where: { id: invoice.id } })
  assert.equal(inv.refundedMinor, 50_000)
  assert.equal(inv.status, 'partially_refunded')
})

test('race: two refunds at once on one payment cannot together exceed it', { skip }, async () => {
  const a = await f.buyer(ctx.prisma)
  const { invoice } = await awarded([a], [100_000])
  const payment = await money.recordOfflinePayment(staffCtx, { invoiceId: invoice.id, method: 'wire', amountMinor: invoice.totalMinor, reference: 'FW 2', paidOn: '2026-11-21' })
  const share = Math.ceil(invoice.totalMinor * 0.6)
  const results = await Promise.allSettled([
    money.refundPayment(staffCtx, { paymentId: payment.id, amountMinor: share, reason: 'Claim A', idempotencyKey: f.key() }),
    money.refundPayment(staffCtx, { paymentId: payment.id, amountMinor: share, reason: 'Claim B', idempotencyKey: f.key() }),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /At most/)
  assert.equal((await ctx.prisma.payment.findUnique({ where: { id: payment.id } })).refundedMinor, share)
})

test('default flow: strike, restocking invoice, runner-up re-award, suspension on the third strike', { skip }, async () => {
  const s = await f.settings(ctx.prisma)
  const saved = { restockingFeeBps: s.restockingFeeBps, strikesBeforeSuspension: s.strikesBeforeSuspension, paymentGraceBusinessDays: s.paymentGraceBusinessDays }
  await ctx.prisma.storeSettings.update({ where: { id: s.id }, data: { restockingFeeBps: 1500, strikesBeforeSuspension: 3, paymentGraceBusinessDays: 0 } })
  try {
    const late = await f.buyer(ctx.prisma)
    const runner = await f.buyer(ctx.prisma)
    const overdue = async (orderId) => ctx.prisma.order.update({ where: { id: orderId }, data: { paymentDueAt: new Date(Date.now() - 10 * 86_400_000) } })

    const first = await awarded([late, runner], [400_000, 380_000])
    await assert.rejects(orders.defaultOrder(staffCtx, { orderId: first.order.id }), /grace period/)
    await overdue(first.order.id)
    const out = await orders.defaultOrder(staffCtx, { orderId: first.order.id, reason: 'Unpaid after reminders' })
    assert.equal(out.strikes, 1)
    assert.equal(out.suspended, false)
    const restocking = await ctx.prisma.invoice.findUnique({ where: { invoiceNumber: out.restockingInvoiceNumber } })
    assert.equal(restocking.kind, 'restocking')
    assert.equal(restocking.totalMinor, 60_000, '15% of the award')
    assert.equal((await ctx.prisma.invoice.findUnique({ where: { id: first.invoice.id } })).status, 'void')
    assert.equal((await ctx.prisma.lot.findUnique({ where: { id: first.lot.id } })).status, 'unsold')

    // Runner-up offer: the second bid is still valid inside the bid validity window.
    const reaward = await lots.reAwardToRunnerUp(staffCtx, { lotId: first.lot.id })
    const award = await ctx.prisma.award.findUnique({ where: { id: reaward.awardId } })
    assert.equal(award.companyId, runner.company.id)
    assert.equal(award.amountMinor, 380_000)

    for (const n of [2, 3]) {
      const next = await awarded([late], [100_000 * n])
      await overdue(next.order.id)
      const r = await orders.defaultOrder(staffCtx, { orderId: next.order.id, waiveFee: n === 2 })
      assert.equal(r.strikes, n)
      assert.equal(r.suspended, n === 3)
      if (n === 2) assert.equal(r.restockingInvoiceNumber, null, 'fee waived')
    }
    assert.equal((await ctx.prisma.buyerCompany.findUnique({ where: { id: late.company.id } })).status, 'suspended')
    const lot = await f.lot(ctx.prisma)
    await assert.rejects(lots.placeBid(await ctx.as(late.user.id), { lotNumber: lot.lotNumber, amountMinor: 1000, idempotencyKey: f.key() }), /must be approved/)
  } finally {
    await ctx.prisma.storeSettings.update({ where: { id: s.id }, data: saved })
  }
})
