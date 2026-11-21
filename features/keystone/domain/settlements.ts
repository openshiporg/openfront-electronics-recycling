import { audit, fail, inTransaction, lockRow, nextNumber, str, type Ctx, type Tx } from '../lib/core'
import { formatMinor, settlementTotals } from '../lib/rules/money'
import { renderPdf } from '../lib/pdf'
import { afterCommit, getSettings, notify, organizationUsers, storeFile } from '../lib/services'
import { createInvoice } from './money'

// Client settlement (§3.6): draft -> in_review -> published -> disputed -> paid -> closed.
// There is no "approved" state: staff record a dispute when the client raises one.

type LineInput = { kind: string; description: string; quantity?: number; grossMinor: number; clientShareBps?: number; assetId?: string | null }

async function lockSettlement(tx: Tx, id: string) {
  await lockRow(tx, 'Settlement', id) || fail('Settlement not found.')
  return tx.settlement.findUnique({ where: { id }, include: { lines: true } })
}

async function writeTotals(tx: Tx, id: string) {
  const lines = await tx.settlementLine.findMany({ where: { settlementId: id } })
  const totals = settlementTotals(lines)
  return tx.settlement.update({ where: { id }, data: totals })
}

/** M5 build: proposes lines from the job: service fees from the quote, and the client share of sold assets. */
export async function buildSettlement(context: Ctx, args: { jobId: string }) {
  const staffId = context.session!.itemId
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Job', args.jobId) || fail('Job not found.')
    const job = await tx.job.findUnique({ where: { id: args.jobId } })
    if (!job.pricingModel) fail('The job has no accepted quote.')
    if (!['processing', 'completed', 'received'].includes(job.status)) fail(`${job.jobNumber} is ${job.status.replace(/_/g, ' ')}; settle a job once it is processed.`)
    let settlement = job.settlementId ? await lockSettlement(tx, job.settlementId) : null
    if (settlement && !['draft', 'in_review'].includes(settlement.status)) fail(`Settlement ${settlement.settlementNumber} is ${settlement.status}; it cannot be rebuilt.`)
    if (!settlement) {
      settlement = await tx.settlement.create({ data: { settlementNumber: await nextNumber(tx, 'settlement'), organizationId: job.organizationId, status: 'draft' } })
      await tx.job.update({ where: { id: job.id }, data: { settlementId: settlement.id } })
    }
    await tx.settlementLine.deleteMany({ where: { settlementId: settlement.id, kind: { not: 'adjustment' } } })
    const share = job.pricingModel === 'revenue_share' ? job.revenueShareBps ?? 0 : 0
    const service = await tx.jobServiceLine.findMany({ where: { jobId: job.id } })
    const invoiced = await tx.invoice.count({ where: { jobId: job.id, kind: 'service', status: { not: 'void' } } })
    if (!invoiced) for (const l of service) if ((l.totalMinor ?? 0) > 0) await tx.settlementLine.create({ data: { settlementId: settlement.id, kind: 'service_fee', description: l.description, quantity: l.quantity, grossMinor: l.totalMinor, clientShareBps: 0, clientAmountMinor: 0 } })
    if (job.pricingModel === 'revenue_share') {
      const sold = await tx.asset.findMany({ where: { jobId: job.id, soldPriceMinor: { gt: 0 }, status: { in: ['sold', 'released'] } }, orderBy: { assetNumber: 'asc' } })
      for (const a of sold) await tx.settlementLine.create({ data: { settlementId: settlement.id, kind: 'asset_value', description: `${a.assetNumber} ${[a.manufacturer, a.model].filter(Boolean).join(' ')} ${a.serialNumber ? `S/N ${a.serialNumber}` : ''}`.trim(), assetId: a.id, quantity: 1, grossMinor: a.soldPriceMinor, clientShareBps: share, clientAmountMinor: Math.round((a.soldPriceMinor * share) / 10_000) } })
    }
    if (job.pricingModel === 'buyout' && job.buyoutAmountMinor) {
      await tx.settlementLine.create({ data: { settlementId: settlement.id, kind: 'asset_value', description: 'Agreed buyout for the equipment', quantity: 1, grossMinor: job.buyoutAmountMinor, clientShareBps: 10_000, clientAmountMinor: job.buyoutAmountMinor } })
    }
    const updated = await writeTotals(tx, settlement.id)
    await audit(tx, { actorId: staffId, action: 'settlement.built', entityType: 'Settlement', entityId: settlement.id, after: { netMinor: updated.netMinor } })
    return updated
  })
}

export async function addSettlementLine(context: Ctx, args: { settlementId: string; line: LineInput }) {
  return inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId)
    if (!['draft', 'in_review', 'disputed'].includes(s.status)) fail(`Settlement is ${s.status}.`)
    const l = args.line
    const gross = Math.round(Number(l.grossMinor))
    if (!Number.isFinite(gross)) fail('Enter the amount.')
    const kind = ['service_fee', 'asset_value', 'commodity_value', 'adjustment'].includes(l.kind) ? l.kind : 'adjustment'
    const bps = kind === 'service_fee' ? 0 : Math.max(0, Math.min(10_000, Math.round(l.clientShareBps ?? 10_000)))
    await tx.settlementLine.create({ data: { settlementId: s.id, kind, description: str(l.description, 300) || fail('Describe the line.'), quantity: Number(l.quantity ?? 1), grossMinor: gross, clientShareBps: bps, clientAmountMinor: kind === 'service_fee' ? 0 : Math.round((gross * bps) / 10_000), assetId: l.assetId || null } })
    await audit(tx, { actorId: context.session!.itemId, action: 'settlement.line_added', entityType: 'Settlement', entityId: s.id, after: { kind, grossMinor: gross } })
    return writeTotals(tx, s.id)
  })
}

export async function removeSettlementLine(context: Ctx, args: { lineId: string }) {
  return inTransaction(context, async (tx) => {
    const line = await tx.settlementLine.findUnique({ where: { id: str(args.lineId, 60) } })
    if (!line) fail('Line not found.')
    const s = await lockSettlement(tx, line.settlementId)
    if (!['draft', 'in_review', 'disputed'].includes(s.status)) fail(`Settlement is ${s.status}.`)
    await tx.settlementLine.delete({ where: { id: line.id } })
    await audit(tx, { actorId: context.session!.itemId, action: 'settlement.line_removed', entityType: 'Settlement', entityId: s.id, before: { description: line.description, grossMinor: line.grossMinor } })
    return writeTotals(tx, s.id)
  })
}

export async function submitSettlementForReview(context: Ctx, args: { settlementId: string }) {
  return inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId)
    if (s.status !== 'draft') fail(`Settlement is ${s.status}.`)
    if (!s.lines.length) fail('The settlement has no lines.')
    await audit(tx, { actorId: context.session!.itemId, action: 'settlement.in_review', entityType: 'Settlement', entityId: s.id })
    return tx.settlement.update({ where: { id: s.id }, data: { status: 'in_review' } })
  })
}

async function settlementPdf(tx: Tx, s: any) {
  const settings = await getSettings(tx)
  const job = await tx.job.findFirst({ where: { settlementId: s.id } })
  const org = await tx.clientOrganization.findUnique({ where: { id: s.organizationId } })
  const lines = await tx.settlementLine.findMany({ where: { settlementId: s.id }, orderBy: { createdAt: 'asc' } })
  const cur = settings.currencyCode
  return renderPdf({
    header: settings.businessName,
    headerRight: s.settlementNumber,
    footer: `${settings.businessName} · ${settings.supportEmail}`,
    blocks: [
      { kind: 'title', text: 'Settlement statement' },
      { kind: 'pairs', pairs: [['Statement', s.settlementNumber], ['Client', org.legalName || org.name], ['Job', job?.jobNumber ?? ''], ['Pricing', (job?.pricingModel ?? '').replace(/_/g, ' ')], ['Published', s.publishedAt ? new Date(s.publishedAt).toDateString() : 'Draft']] },
      { kind: 'table', headers: ['Description', 'Kind', 'Gross', 'Share', 'To client'], widths: [4, 1.3, 1.2, 0.8, 1.2], align: ['left', 'left', 'right', 'right', 'right'], rows: lines.map((l: any) => [l.description, l.kind.replace(/_/g, ' '), formatMinor(l.grossMinor, cur), l.kind === 'service_fee' ? '' : `${(l.clientShareBps / 100).toFixed(0)}%`, l.kind === 'service_fee' ? `-${formatMinor(l.grossMinor, cur)}` : formatMinor(l.clientAmountMinor, cur)]) },
      { kind: 'totals', pairs: [['Service fees', `-${formatMinor(s.feesTotalMinor, cur)}`], ['Client share', formatMinor(s.clientShareTotalMinor, cur)], [s.netMinor >= 0 ? 'We owe you' : 'You owe us', formatMinor(Math.abs(s.netMinor), cur)]] },
      ...(s.disputeNote ? [{ kind: 'text' as const, text: `Dispute recorded: ${s.disputeNote}` }] : []),
    ],
  })
}

/** Publish: the client sees it; a negative net raises an invoice for the client. */
export async function publishSettlement(context: Ctx, args: { settlementId: string }) {
  const result = await inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId)
    if (!['draft', 'in_review', 'disputed'].includes(s.status)) fail(`Settlement is ${s.status}.`)
    if (!s.lines.length) fail('The settlement has no lines.')
    const now = new Date()
    let updated = await tx.settlement.update({ where: { id: s.id }, data: { status: 'published', publishedAt: now } })
    const pdf = await settlementPdf(tx, updated)
    const file = await storeFile(tx, { filename: `${s.settlementNumber}.pdf`, mimeType: 'application/pdf', bytes: pdf, purpose: 'settlement', ownerClientOrganizationId: s.organizationId, uploadedById: context.session!.itemId })
    updated = await tx.settlement.update({ where: { id: s.id }, data: { pdfId: file.id } })
    const job = await tx.job.findFirst({ where: { settlementId: s.id } })
    if (updated.netMinor < 0) {
      const existing = await tx.invoice.findFirst({ where: { settlementId: s.id, status: { not: 'void' } } })
      if (existing) {
        if (existing.paidMinor > 0) fail(`Invoice ${existing.invoiceNumber} has payments; refund before republishing.`)
        await tx.invoice.update({ where: { id: existing.id }, data: { status: 'void', voidReason: 'Settlement republished', settlementId: null } })
      }
      const org = await tx.clientOrganization.findUnique({ where: { id: s.organizationId } })
      await createInvoice(tx, { kind: 'settlement', clientOrganizationId: org.id, jobId: job?.id ?? null, settlementId: s.id, lines: [{ kind: 'service', description: `Settlement ${s.settlementNumber}${job ? ` for ${job.jobNumber}` : ''}`, quantity: 1, unitPriceMinor: -updated.netMinor, totalMinor: -updated.netMinor }], billTo: { legalName: org.legalName || org.name, addressLine1: org.addressLine1, city: org.city, region: org.region, postalCode: org.postalCode, countryCode: org.countryCode, email: org.billingEmail } })
    }
    if (job && job.status === 'completed') await tx.job.update({ where: { id: job.id }, data: { status: 'settled' } })
    await notify(tx, { userIds: await organizationUsers(tx, s.organizationId), type: 'settlement_published', title: `Settlement ${s.settlementNumber} is ready`, body: updated.netMinor >= 0 ? `We owe you ${formatMinor(updated.netMinor)}. Reply to this email if anything looks wrong.` : `The balance due is ${formatMinor(-updated.netMinor)}; an invoice is on your account.`, link: job ? `/client/jobs/${job.jobNumber}` : '/client' })
    await audit(tx, { actorId: context.session!.itemId, action: 'settlement.published', entityType: 'Settlement', entityId: s.id, after: { netMinor: updated.netMinor } })
    return updated
  })
  afterCommit(context)
  return result
}

/** The client disputes by email or phone; staff records it and the statement returns to editing. */
export async function recordSettlementDispute(context: Ctx, args: { settlementId: string; note: string }) {
  const note = str(args.note, 2000) || fail('Write what the client disputes.')
  return inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId)
    if (s.status !== 'published') fail('Only a published settlement can be disputed.')
    await audit(tx, { actorId: context.session!.itemId, action: 'settlement.disputed', entityType: 'Settlement', entityId: s.id, reason: note })
    return tx.settlement.update({ where: { id: s.id }, data: { status: 'disputed', disputeNote: note, disputeRecordedById: context.session!.itemId } })
  })
}

/** Payout to the client when we owe them (net >= 0). Negative balances close through invoice payment. */
export async function recordSettlementPayout(context: Ctx, args: { settlementId: string; method: string; reference: string }) {
  const method = ['cheque', 'ach', 'wire', 'credit'].includes(args.method) ? args.method : fail('Choose cheque, ACH, wire or credit.')
  const reference = str(args.reference, 120) || fail('Enter the payout reference.')
  const result = await inTransaction(context, async (tx) => {
    const s = await lockSettlement(tx, args.settlementId)
    if (s.status !== 'published') fail(s.status === 'disputed' ? 'Resolve the dispute and republish first.' : `Settlement is ${s.status}.`)
    if (s.netMinor < 0) fail('The client owes this balance; it closes when their invoice is paid.')
    const updated = await tx.settlement.update({ where: { id: s.id }, data: { status: 'paid', payoutMethod: method, payoutReference: reference, paidAt: new Date() } })
    await notify(tx, { userIds: await organizationUsers(tx, s.organizationId), type: 'settlement_paid', title: `Settlement ${s.settlementNumber} paid`, body: `${formatMinor(s.netMinor)} sent by ${method} (${reference}).`, link: '/client' })
    await audit(tx, { actorId: context.session!.itemId, action: 'settlement.paid', entityType: 'Settlement', entityId: s.id, after: { method, reference, netMinor: s.netMinor } })
    return updated
  })
  afterCommit(context)
  return result
}

export { settlementPdf }
