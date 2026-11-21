import { fail, str, type Ctx } from '../lib/core'
import { formatMinor } from '../lib/rules/money'
import { renderPdf } from '../lib/pdf'
import { asDownload, getSettings } from '../lib/services'
import { writeCsv, writeWorkbook, XLSX_MIME } from '../lib/spreadsheet'

// Y6 mass balance, M6 sales and client impact, M7 accounting export, T9 Today.

function range(args: { from?: string | null; to?: string | null }) {
  const to = args.to ? new Date(`${str(args.to, 10)}T23:59:59.999Z`) : new Date()
  const from = args.from ? new Date(`${str(args.from, 10)}T00:00:00Z`) : new Date(to.getTime() - 30 * 86_400_000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) fail('Choose a valid date range.')
  return { from, to }
}

const num = (v: any) => (v == null ? 0 : Number(v))

/** Y6: weight in (received containers) vs weight out (assets sold/released, shipped downstream, returned), by category. */
export async function massBalanceReport(context: Ctx, args: { from?: string | null; to?: string | null; facilityId?: string | null; format?: string | null }) {
  const { from, to } = range(args)
  const settings = await getSettings(context.prisma)
  const jobWhere: any = { receivedAt: { gte: from, lte: to } }
  if (args.facilityId) jobWhere.facilityId = args.facilityId
  const containers = await context.prisma.container.findMany({ where: { status: { in: ['received', 'processed'] }, job: jobWhere }, select: { grossWeight: true, tareWeight: true } })
  const inWeight = containers.reduce((s: number, c: any) => s + Math.max(0, num(c.grossWeight) - num(c.tareWeight)), 0)
  const shipments = await context.prisma.outboundShipment.findMany({ where: { status: { in: ['shipped', 'receipt_confirmed', 'closed'] }, shippedAt: { gte: from, lte: to }, ...(args.facilityId ? { facilityId: args.facilityId } : {}) }, include: { vendor: { select: { name: true } }, lines: { include: { category: { select: { name: true } } } } } })
  const byCategory = new Map<string, { category: string; downstream: number; resale: number; returned: number }>()
  const bucket = (k: string) => byCategory.get(k) ?? byCategory.set(k, { category: k, downstream: 0, resale: 0, returned: 0 }).get(k)!
  for (const s of shipments) for (const l of s.lines) bucket(l.category?.name ?? 'Mixed').downstream += num(l.weight)
  const sold = await context.prisma.asset.findMany({ where: { status: { in: ['sold', 'released', 'returned'] }, updatedAt: { gte: from, lte: to }, ...(args.facilityId ? { job: { facilityId: args.facilityId } } : {}) }, select: { status: true, weight: true, category: { select: { name: true } } } })
  for (const a of sold) {
    const b = bucket(a.category?.name ?? 'Mixed')
    if (a.status === 'returned') b.returned += num(a.weight)
    else b.resale += num(a.weight)
  }
  const rows = [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category))
  const outWeight = rows.reduce((s, r) => s + r.downstream + r.resale + r.returned, 0)
  const onHand = await context.prisma.asset.aggregate({ where: { status: { in: ['received', 'audited', 'ready_for_sale', 'allocated', 'recycling', 'on_hold'] } }, _sum: { weight: true } })
  const vendors = shipments.reduce((m: Record<string, number>, s: any) => ({ ...m, [s.vendor?.name ?? '']: (m[s.vendor?.name ?? ''] ?? 0) + s.lines.reduce((x: number, l: any) => x + num(l.weight), 0) }), {})
  const confirmed = shipments.filter((s: any) => s.receiptConfirmedAt)
  const result = {
    from, to, unit: settings.weightUnit,
    inWeight, outWeight, onHandWeight: num(onHand._sum.weight),
    varianceWeight: inWeight - outWeight - num(onHand._sum.weight),
    rows,
    vendors: Object.entries(vendors).map(([name, weight]) => ({ name, weight })),
    shipments: shipments.length,
    receiptsConfirmed: confirmed.length,
    receiptVarianceWeight: confirmed.reduce((s: number, x: any) => s + num(x.receivedWeight) - x.lines.reduce((y: number, l: any) => y + num(l.weight), 0), 0),
  }
  if (args.format === 'xlsx') {
    return { ...result, download: asDownload(`mass-balance-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.xlsx`, XLSX_MIME, writeWorkbook([
      { name: 'Summary', rows: [['From', from.toISOString().slice(0, 10)], ['To', to.toISOString().slice(0, 10)], ['Unit', settings.weightUnit], ['Weight in', inWeight], ['Weight out', outWeight], ['On hand', result.onHandWeight], ['Variance', result.varianceWeight]] },
      { name: 'By category', rows: [['Category', 'Downstream', 'Resale', 'Returned'], ...rows.map((r) => [r.category, r.downstream, r.resale, r.returned])] },
      { name: 'By vendor', rows: [['Vendor', 'Weight'], ...result.vendors.map((v) => [v.name, v.weight])] },
    ])) }
  }
  return { ...result, download: null }
}

/** M6: lot sales by period, category and buyer. */
export async function salesReport(context: Ctx, args: { from?: string | null; to?: string | null; format?: string | null }) {
  const { from, to } = range(args)
  const settings = await getSettings(context.prisma)
  const awards = await context.prisma.award.findMany({ where: { status: 'active', awardedAt: { gte: from, lte: to } }, include: { lot: { select: { lotNumber: true, title: true, format: true, reserveMinor: true, category: { select: { name: true } } } }, company: { select: { legalName: true } }, order: { select: { orderNumber: true, status: true, invoice: { select: { invoiceNumber: true, totalMinor: true, paidMinor: true, status: true } } } } }, orderBy: { awardedAt: 'asc' } })
  const rows = awards.map((a: any) => ({ awardedAt: a.awardedAt, lotNumber: a.lot.lotNumber, title: a.lot.title, category: a.lot.category?.name ?? '', format: a.lot.format, buyer: a.company.legalName, amountMinor: a.amountMinor, belowReserve: a.isBelowReserve, orderNumber: a.order?.orderNumber ?? '', orderStatus: a.order?.status ?? '', invoiceNumber: a.order?.invoice?.invoiceNumber ?? '', invoiceTotalMinor: a.order?.invoice?.totalMinor ?? 0, paidMinor: a.order?.invoice?.paidMinor ?? 0 }))
  const sum = (key: string) => Object.values(rows.reduce((m: any, r: any) => ({ ...m, [r[key]]: { name: r[key], lots: (m[r[key]]?.lots ?? 0) + 1, amountMinor: (m[r[key]]?.amountMinor ?? 0) + r.amountMinor } }), {}))
  const defaults = await context.prisma.order.count({ where: { status: 'defaulted', updatedAt: { gte: from, lte: to } } })
  const result = { from, to, currencyCode: settings.currencyCode, lots: rows.length, grossMinor: rows.reduce((s: number, r: any) => s + r.amountMinor, 0), invoicedMinor: rows.reduce((s: number, r: any) => s + r.invoiceTotalMinor, 0), collectedMinor: rows.reduce((s: number, r: any) => s + r.paidMinor, 0), defaults, byCategory: sum('category'), byBuyer: sum('buyer'), rows }
  if (args.format === 'xlsx') {
    return { ...result, download: asDownload(`sales-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.xlsx`, XLSX_MIME, writeWorkbook([
      { name: 'Sales', rows: [['Awarded', 'Lot', 'Title', 'Category', 'Format', 'Buyer', 'Award', 'Below reserve', 'Order', 'Order status', 'Invoice', 'Invoice total', 'Paid'], ...rows.map((r: any) => [new Date(r.awardedAt).toISOString().slice(0, 10), r.lotNumber, r.title, r.category, r.format, r.buyer, r.amountMinor / 100, r.belowReserve ? 'Yes' : '', r.orderNumber, r.orderStatus, r.invoiceNumber, r.invoiceTotalMinor / 100, r.paidMinor / 100])] },
      { name: 'By category', rows: [['Category', 'Lots', 'Amount'], ...result.byCategory.map((c: any) => [c.name, c.lots, c.amountMinor / 100])] },
      { name: 'By buyer', rows: [['Buyer', 'Lots', 'Amount'], ...result.byBuyer.map((c: any) => [c.name, c.lots, c.amountMinor / 100])] },
    ])) }
  }
  return { ...result, download: null }
}

/** M6: weight collected, units reused, weight recycled for one client (PDF or Excel). */
export async function clientImpactReport(context: Ctx, args: { organizationId: string; from?: string | null; to?: string | null; format?: string | null }) {
  const { from, to } = range({ from: args.from ?? '2000-01-01', to: args.to })
  const org = await context.prisma.clientOrganization.findUnique({ where: { id: str(args.organizationId, 60) } })
  if (!org) fail('Choose the client.')
  const settings = await getSettings(context.prisma)
  const jobs = await context.prisma.job.findMany({ where: { organizationId: org.id, collectedAt: { gte: from, lte: to } }, include: { containers: { select: { grossWeight: true, tareWeight: true, status: true } }, assets: { select: { disposition: true, status: true, weight: true, isDataBearing: true, sanitizationStatus: true } }, commodityLines: { select: { weight: true } } } })
  const collected = jobs.reduce((s: number, j: any) => s + j.containers.filter((c: any) => c.status !== 'missing').reduce((x: number, c: any) => x + Math.max(0, num(c.grossWeight) - num(c.tareWeight)), 0), 0)
  const assets = jobs.flatMap((j: any) => j.assets)
  const reusedUnits = assets.filter((a: any) => ['resale', 'parts'].includes(a.disposition)).length
  const reusedWeight = assets.filter((a: any) => ['resale', 'parts'].includes(a.disposition)).reduce((s: number, a: any) => s + num(a.weight), 0)
  const recycledWeight = assets.filter((a: any) => a.disposition === 'recycle').reduce((s: number, a: any) => s + num(a.weight), 0) + jobs.reduce((s: number, j: any) => s + j.commodityLines.reduce((x: number, l: any) => x + num(l.weight), 0), 0)
  const result = { organization: org.name, from, to, unit: settings.weightUnit, jobs: jobs.length, collectedWeight: collected, units: assets.length, reusedUnits, reusedWeight, recycledWeight, dataBearing: assets.filter((a: any) => a.isDataBearing).length, sanitized: assets.filter((a: any) => ['passed', 'destroyed'].includes(a.sanitizationStatus)).length, landfillWeight: 0 }
  const name = `${org.name.replace(/[^A-Za-z0-9]+/g, '-')}-impact`
  if (args.format === 'xlsx') return { ...result, download: asDownload(`${name}.xlsx`, XLSX_MIME, writeWorkbook([{ name: 'Impact', rows: [['Client', org.name], ['Period', `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`], ['Jobs', result.jobs], [`Weight collected (${settings.weightUnit})`, collected], ['Units processed', result.units], ['Units reused', reusedUnits], [`Weight reused (${settings.weightUnit})`, reusedWeight], [`Weight recycled (${settings.weightUnit})`, recycledWeight], ['Data-bearing devices', result.dataBearing], ['Devices sanitised', result.sanitized], ['Sent to landfill', 0]] }])) }
  if (args.format === 'pdf') {
    const pdf = await renderPdf({ header: settings.businessName, headerRight: 'Impact report', footer: settings.businessName, blocks: [
      { kind: 'title', text: `Environmental impact: ${org.name}` },
      { kind: 'subtitle', text: `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}` },
      { kind: 'pairs', pairs: [['Jobs', String(result.jobs)], ['Weight collected', `${collected.toFixed(1)} ${settings.weightUnit}`], ['Units processed', String(result.units)], ['Units reused', String(reusedUnits)], ['Weight reused', `${reusedWeight.toFixed(1)} ${settings.weightUnit}`], ['Weight recycled', `${recycledWeight.toFixed(1)} ${settings.weightUnit}`], ['Data-bearing devices sanitised', `${result.sanitized} of ${result.dataBearing}`], ['Sent to landfill', `0 ${settings.weightUnit}`]] },
      { kind: 'text', text: 'Figures come from the weights recorded at receiving and on the audit bench, and from outbound shipments to approved downstream vendors.' },
    ] })
    return { ...result, download: asDownload(`${name}.pdf`, 'application/pdf', pdf) }
  }
  return { ...result, download: null }
}

/** M7: invoices, payments and refunds for the period, as CSV in a QuickBooks/Xero-importable shape. */
export async function accountingExport(context: Ctx, args: { from?: string | null; to?: string | null; kind?: string | null }) {
  const { from, to } = range(args)
  const what = ['invoices', 'payments', 'refunds'].includes(String(args.kind)) ? String(args.kind) : 'invoices'
  if (what === 'invoices') {
    const rows = await context.prisma.invoice.findMany({ where: { issuedAt: { gte: from, lte: to } }, include: { buyerCompany: { select: { legalName: true } }, clientOrganization: { select: { name: true } }, lines: true }, orderBy: { issuedAt: 'asc' } })
    const out: unknown[][] = [['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Kind', 'Status', 'ItemDescription', 'ItemKind', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'Currency']]
    for (const i of rows) for (const l of i.lines) out.push([i.invoiceNumber, i.buyerCompany?.legalName ?? i.clientOrganization?.name ?? '', i.issuedAt?.toISOString().slice(0, 10), i.dueAt?.toISOString().slice(0, 10) ?? '', i.kind, i.status, l.description, l.kind, Number(l.quantity), (l.unitPriceMinor / 100).toFixed(2), (l.totalMinor / 100).toFixed(2), i.currencyCode])
    return asDownload(`invoices-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, 'text/csv', writeCsv(out))
  }
  if (what === 'payments') {
    const rows = await context.prisma.payment.findMany({ where: { status: { in: ['confirmed', 'captured', 'refunded', 'partially_refunded'] }, OR: [{ confirmedAt: { gte: from, lte: to } }, { AND: [{ confirmedAt: null }, { createdAt: { gte: from, lte: to } }] }] }, include: { invoice: { select: { invoiceNumber: true, currencyCode: true, buyerCompany: { select: { legalName: true } }, clientOrganization: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } })
    return asDownload(`payments-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, 'text/csv', writeCsv([['Date', 'InvoiceNo', 'Customer', 'Method', 'Reference', 'Amount', 'Refunded', 'Currency'], ...rows.map((p: any) => [(p.confirmedAt ?? p.createdAt).toISOString().slice(0, 10), p.invoice?.invoiceNumber ?? '', p.invoice?.buyerCompany?.legalName ?? p.invoice?.clientOrganization?.name ?? '', p.method, p.providerReference || p.bankReference, (p.amountMinor / 100).toFixed(2), (p.refundedMinor / 100).toFixed(2), p.invoice?.currencyCode ?? 'USD'])]))
  }
  const rows = await context.prisma.refund.findMany({ where: { status: 'succeeded', createdAt: { gte: from, lte: to } }, include: { invoice: { select: { invoiceNumber: true } } }, orderBy: { createdAt: 'asc' } })
  return asDownload(`refunds-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv`, 'text/csv', writeCsv([['Date', 'InvoiceNo', 'Method', 'Reference', 'Amount', 'Reason'], ...rows.map((r: any) => [r.createdAt.toISOString().slice(0, 10), r.invoice?.invoiceNumber ?? '', r.method, r.providerReference, (r.amountMinor / 100).toFixed(2), r.reason])]))
}

/** T9: counts and short lists of what needs doing now, scoped to the caller's permissions. */
export async function todaySummary(context: Ctx) {
  const role: any = context.session?.data?.role ?? {}
  const p = context.prisma
  const now = new Date()
  const in24 = new Date(now.getTime() + 86_400_000)
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const out: Record<string, any> = {}
  const tasks: Array<{ key: string; label: string; count: number; href: string }> = []
  const add = (key: string, label: string, count: number, href: string) => { if (count) tasks.push({ key, label, count, href }) }
  if (role.canManageBuyers) add('buyers', 'Buyer applications to review', await p.buyerCompany.count({ where: { status: { in: ['submitted', 'under_review'] } } }), '/dashboard/platform/buyers')
  if (role.canManageBuyers) add('documents', 'Buyer documents to check', await p.buyerDocument.count({ where: { status: 'submitted' } }), '/dashboard/platform/buyers?tab=documents')
  if (role.canAwardLots) add('award', 'Closed lots to award', await p.lot.count({ where: { status: 'closed' } }), '/dashboard/platform/lots?status=closed')
  if (role.canManageLots) add('closing', 'Lots closing in 24 hours', await p.lot.count({ where: { status: 'open', closesAt: { lte: in24 } } }), '/dashboard/platform/lots?status=open')
  if (role.canManageLots) add('unsold', 'Unsold lots to relist', await p.lot.count({ where: { status: 'unsold' } }), '/dashboard/platform/lots?status=unsold')
  if (role.canManagePayments) add('transfers', 'Reported transfers to confirm', await p.payment.count({ where: { status: 'reported' } }), '/dashboard/platform/payments')
  if (role.canManagePayments) add('unknown', 'Card payments with an unknown result', await p.paymentSession.count({ where: { status: 'unknown' } }), '/dashboard/platform/payments?tab=unknown')
  if (role.canManagePayments) add('overdue', 'Overdue invoices', await p.invoice.count({ where: { isOverdue: true, status: { in: ['open', 'partially_paid'] } } }), '/dashboard/platform/invoices?tab=overdue')
  if (role.canManageLots || role.canReceive) add('ready', 'Paid orders to prepare', await p.order.count({ where: { status: 'paid' } }), '/dashboard/platform/orders?status=paid')
  if (role.canManageLots || role.canReceive) add('dock', 'Dock appointments today', await p.dockAppointment.count({ where: { status: 'booked', startsAt: { gte: dayStart, lt: dayEnd } } }), '/dashboard/platform/dock')
  if (role.canManageLots) add('claims', 'Open claims', await p.claim.count({ where: { status: { in: ['submitted', 'under_review'] } } }), '/dashboard/platform/claims')
  if (role.canManageJobs) add('requests', 'Pickup requests to quote', await p.job.count({ where: { status: 'requested' } }), '/dashboard/platform/jobs?status=requested')
  if (role.canDispatch) add('dispatch', 'Accepted jobs to schedule', await p.job.count({ where: { status: 'accepted' } }), '/dashboard/platform/dispatch')
  if (role.canCollect) add('stops', 'My stops today', await p.job.count({ where: { driverId: context.session?.itemId, status: { in: ['scheduled', 'en_route'] }, scheduledDate: { lte: dayEnd } } }), '/dashboard/platform/driver')
  if (role.canReceive) add('inbound', 'Containers to receive', await p.container.count({ where: { status: 'collected', job: { status: 'collected' } } }), '/dashboard/platform/receiving')
  if (role.canReceive || role.canIssueCertificates) add('seals', 'Seal exceptions', await p.container.count({ where: { sealException: { not: '' }, sealExceptionResolution: '' } }), '/dashboard/platform/receiving?tab=exceptions')
  if (role.canSanitize) add('sanitize', 'Data-bearing assets awaiting sanitisation', await p.asset.count({ where: { isDataBearing: true, sanitizationStatus: { in: ['pending', 'failed'] }, status: { not: 'on_hold' } } }), '/dashboard/platform/sanitization')
  if (role.canVerifySanitization) add('verify', 'Sanitisation records not yet sampled', await p.sanitizationRecord.count({ where: { verifiedById: null, result: 'passed' } }), '/dashboard/platform/sanitization?tab=verify')
  if (role.canIssueCertificates) add('complete', 'Jobs in processing', await p.job.count({ where: { status: 'processing' } }), '/dashboard/platform/jobs?status=processing')
  if (role.canManageSettlements) add('settle', 'Completed jobs to settle', await p.job.count({ where: { status: 'completed', OR: [{ settlementId: null }, { settlement: { status: { in: ['draft', 'in_review', 'disputed'] } } }] } }), '/dashboard/platform/settlements')
  if (role.canManageDownstream) add('vendors', 'Vendor reviews due', await p.downstreamVendor.count({ where: { status: 'approved', reviewDueOn: { lte: in24 } } }), '/dashboard/platform/downstream')
  if (role.canManageDownstream) add('receipts', 'Outbound receipts to confirm', await p.outboundShipment.count({ where: { status: 'shipped' } }), '/dashboard/platform/outbound')
  out.tasks = tasks
  if (role.canManageLots || role.canAwardLots) {
    out.closingSoon = (await p.lot.findMany({ where: { status: 'open' }, orderBy: { closesAt: 'asc' }, take: 6, select: { id: true, lotNumber: true, title: true, closesAt: true, format: true, bidCount: true } })).map((l: any) => ({ ...l, bidCount: l.bidCount }))
  }
  if (role.canManagePayments || role.canViewReports) {
    const paid = await p.payment.aggregate({ where: { status: { in: ['confirmed', 'captured'] }, createdAt: { gte: dayStart } }, _sum: { amountMinor: true } })
    out.collectedTodayMinor = paid._sum.amountMinor ?? 0
  }
  return out
}

export { formatMinor }
