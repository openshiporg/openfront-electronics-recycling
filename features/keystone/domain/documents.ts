import { fail, requireClient, str, type Ctx, type Tx } from '../lib/core'
import { formatMinor } from '../lib/rules/money'
import { renderPdf } from '../lib/pdf'
import { asDownload, getSettings, readFileBytes } from '../lib/services'
import { invoiceForCaller } from './money'
import { orderForBuyer } from './orders'
import { settlementPdf } from './settlements'

// PDF documents built on request from the stored records (invoice, packing list, bill of lading)
// and downloads of stored PDFs (certificates, settlements).

export async function invoicePdf(db: Tx, invoiceId: string) {
  const settings = await getSettings(db)
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { createdAt: 'asc' } }, order: { select: { orderNumber: true } }, job: { select: { jobNumber: true } } } })
  if (!inv) fail('Invoice not found.')
  const cur = inv.currencyCode || settings.currencyCode
  const b: any = inv.billTo ?? {}
  const balance = Math.max(0, inv.totalMinor - inv.paidMinor)
  const blocks: any[] = [
    { kind: 'title', text: inv.status === 'void' ? 'Invoice (void)' : 'Invoice' },
    { kind: 'pairs', pairs: [['Invoice', inv.invoiceNumber], ['Issued', inv.issuedAt ? new Date(inv.issuedAt).toDateString() : ''], ['Due', inv.dueAt ? new Date(inv.dueAt).toDateString() : 'On receipt'], ...(inv.order ? [['Order', inv.order.orderNumber]] : []), ...(inv.job ? [['Job', inv.job.jobNumber]] : []), ['Status', inv.status.replace(/_/g, ' ')]] },
    { kind: 'subtitle', text: 'Bill to' },
    { kind: 'text', text: [b.legalName, b.addressLine1, b.addressLine2, [b.city, b.region, b.postalCode].filter(Boolean).join(' '), b.countryCode, b.taxId ? `Tax ID ${b.taxId}` : ''].filter(Boolean).join('\n') },
    { kind: 'table', headers: ['Description', 'Qty', 'Unit', 'Amount'], widths: [5, 0.8, 1.3, 1.3], align: ['left', 'right', 'right', 'right'], rows: inv.lines.map((l: any) => [l.description, String(Number(l.quantity)), formatMinor(l.unitPriceMinor, cur), formatMinor(l.totalMinor, cur)]) },
    { kind: 'totals', pairs: [['Subtotal', formatMinor(inv.subtotalMinor, cur)], ...(inv.premiumMinor ? [['Buyer premium', formatMinor(inv.premiumMinor, cur)]] : []), ...(inv.freightMinor ? [['Freight', formatMinor(inv.freightMinor, cur)]] : []), ...(inv.feeMinor ? [['Fees', formatMinor(inv.feeMinor, cur)]] : []), ...(inv.otherMinor ? [['Other', formatMinor(inv.otherMinor, cur)]] : []), ['Tax', formatMinor(inv.taxMinor, cur)], ['Total', formatMinor(inv.totalMinor, cur)], ['Paid', formatMinor(inv.paidMinor, cur)], ['Balance due', formatMinor(balance, cur)]] },
  ]
  if (inv.taxExemptReason) blocks.push({ kind: 'text', text: `Tax exempt: ${inv.taxExemptReason}` })
  if (balance > 0 && settings.wireInstructions && inv.status !== 'void') blocks.push({ kind: 'subtitle', text: 'Pay by bank transfer' }, { kind: 'text', text: `${settings.wireInstructions}\nReference: ${inv.invoiceNumber}` })
  return renderPdf({ header: settings.legalName || settings.businessName, headerRight: inv.invoiceNumber, footer: [settings.businessName, settings.supportEmail, settings.supportPhone].filter(Boolean).join(' · '), blocks })
}

/** U10/C5: the invoice PDF for its buyer or client. */
export async function downloadInvoice(context: Ctx, args: { invoiceNumber: string }) {
  const { invoice } = await invoiceForCaller(context, args.invoiceNumber)
  return asDownload(`${invoice.invoiceNumber}.pdf`, 'application/pdf', await invoicePdf(context.prisma, invoice.id))
}

export async function staffInvoicePdf(context: Ctx, args: { invoiceId: string }) {
  const inv = await context.prisma.invoice.findUnique({ where: { id: str(args.invoiceId, 60) }, select: { id: true, invoiceNumber: true } })
  if (!inv) fail('Invoice not found.')
  return asDownload(`${inv.invoiceNumber}.pdf`, 'application/pdf', await invoicePdf(context.prisma, inv.id))
}

async function orderDocumentPdf(db: Tx, orderId: string, kind: 'packing_list' | 'bill_of_lading') {
  const settings = await getSettings(db)
  const order = await db.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { lineNumber: 'asc' } }, company: true, lot: { include: { facility: true } } } })
  const f = order.lot?.facility
  const from = f ? [f.name, f.addressLine1, [f.city, f.region, f.postalCode].filter(Boolean).join(' '), f.countryCode].filter(Boolean).join('\n') : settings.businessName
  const to = [order.company.legalName, order.company.addressLine1, [order.company.city, order.company.region, order.company.postalCode].filter(Boolean).join(' '), order.company.countryCode].filter(Boolean).join('\n')
  const units = order.lines.reduce((s: number, l: any) => s + (l.quantity ?? 0), 0)
  const head: any[] = [
    { kind: 'title', text: kind === 'packing_list' ? 'Packing list' : 'Bill of lading' },
    { kind: 'pairs', pairs: [['Order', order.orderNumber], ['Lot', order.lot?.lotNumber ?? ''], ['Pallets', String(order.palletCount ?? '')], ['Weight', order.weight != null ? `${Number(order.weight)} ${settings.weightUnit}` : ''], ['Units', String(units)], ...(order.billOfLading ? [['B/L number', order.billOfLading]] : []), ...(order.carrierName ? [['Carrier', `${order.carrierName} ${order.carrierReference}`.trim()]] : []), ...(order.destinationCountry ? [['Destination country', order.destinationCountry]] : [])] },
    { kind: 'subtitle', text: 'Ship from' }, { kind: 'text', text: from },
    { kind: 'subtitle', text: 'Ship to / buyer' }, { kind: 'text', text: to },
  ]
  if (kind === 'packing_list') {
    head.push({ kind: 'table', headers: ['Line', 'Description', 'Grade', 'Qty', 'Serials'], widths: [0.5, 3, 1, 0.6, 3.5], align: ['left', 'left', 'left', 'right', 'left'], rows: order.lines.map((l: any) => [String(l.lineNumber ?? ''), l.description, l.grade, String(l.quantity ?? ''), (Array.isArray(l.serials) ? l.serials : []).join(', ')]) })
  } else {
    head.push({ kind: 'table', headers: ['Handling units', 'Description of goods', 'Weight'], widths: [1.2, 4, 1.2], align: ['left', 'left', 'right'], rows: [[`${order.palletCount ?? ''} pallet(s)`, `Used electronic equipment (${units} units), ${order.lot?.title ?? ''}`, order.weight != null ? `${Number(order.weight)} ${settings.weightUnit}` : '']] })
    if (settings.exportClause && order.destinationCountry && order.destinationCountry !== 'US') head.push({ kind: 'text', text: settings.exportClause })
    head.push({ kind: 'signature', label: 'Shipper' }, { kind: 'signature', label: `Carrier / driver${order.driverName ? `: ${order.driverName}` : ''}` })
  }
  return { pdf: await renderPdf({ header: settings.businessName, headerRight: order.orderNumber, footer: settings.businessName, blocks: head }), order }
}

/** U14: packing list (serials) or bill of lading for the buyer's own order. */
export async function downloadOrderDocument(context: Ctx, args: { orderNumber: string; kind: string }) {
  const { order } = await orderForBuyer(context, args.orderNumber)
  if (!['paid', 'ready_for_release', 'released', 'completed'].includes(order.status)) fail('Documents are available once the order is paid.')
  const kind = args.kind === 'bill_of_lading' ? 'bill_of_lading' : 'packing_list'
  const { pdf } = await orderDocumentPdf(context.prisma, order.id, kind)
  return asDownload(`${order.orderNumber}-${kind.replace(/_/g, '-')}.pdf`, 'application/pdf', pdf)
}

export async function staffOrderDocument(context: Ctx, args: { orderId: string; kind: string }) {
  const kind = args.kind === 'bill_of_lading' ? 'bill_of_lading' : 'packing_list'
  const { pdf, order } = await orderDocumentPdf(context.prisma, str(args.orderId, 60), kind)
  return asDownload(`${order.orderNumber}-${kind.replace(/_/g, '-')}.pdf`, 'application/pdf', pdf)
}

async function storedPdf(db: Tx, fileId: string | null, name: string) {
  if (!fileId) fail('The document is not ready.')
  const file = await readFileBytes(db, fileId)
  if (!file) fail('The document is missing.')
  return asDownload(name, file.mimeType, file.bytes)
}

/** C4 certificate download for the job's own client. */
export async function downloadCertificate(context: Ctx, args: { certificateNumber: string }) {
  const { organizationId } = await requireClient(context)
  const cert = await context.prisma.certificate.findUnique({ where: { certificateNumber: str(args.certificateNumber, 40) } })
  if (!cert || cert.organizationId !== organizationId) fail('Certificate not found.')
  return storedPdf(context.prisma, cert.pdfId, `${cert.certificateNumber}${cert.status === 'revoked' ? '-REVOKED' : ''}.pdf`)
}

export async function downloadSettlement(context: Ctx, args: { settlementNumber: string }) {
  const { organizationId } = await requireClient(context)
  const s = await context.prisma.settlement.findUnique({ where: { settlementNumber: str(args.settlementNumber, 40) } })
  if (!s || s.organizationId !== organizationId || !['published', 'disputed', 'paid', 'closed'].includes(s.status)) fail('Settlement not found.')
  return storedPdf(context.prisma, s.pdfId, `${s.settlementNumber}.pdf`)
}

export async function staffDownloadFile(context: Ctx, args: { kind: string; id: string }) {
  if (args.kind === 'certificate') {
    const c = await context.prisma.certificate.findUnique({ where: { id: str(args.id, 60) } })
    if (!c) fail('Certificate not found.')
    return storedPdf(context.prisma, c.pdfId, `${c.certificateNumber}.pdf`)
  }
  if (args.kind === 'settlement') {
    const s = await context.prisma.settlement.findUnique({ where: { id: str(args.id, 60) } })
    if (!s) fail('Settlement not found.')
    if (!s.pdfId) {
      return asDownload(`${s.settlementNumber}-draft.pdf`, 'application/pdf', await settlementPdf(context.prisma, s))
    }
    return storedPdf(context.prisma, s.pdfId, `${s.settlementNumber}.pdf`)
  }
  fail('Unknown document.')
}
