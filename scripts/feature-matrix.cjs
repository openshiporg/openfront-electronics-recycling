// Writes docs/FEATURE-MATRIX.md: every §5 row of the dissertation, the GraphQL
// operation(s) that carry it, their input shape (read from the domain function
// signatures, so the document cannot drift from the code), and the page.
// Run: node scripts/feature-matrix.cjs
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

const sigs = {}
const dir = path.join(root, 'features/keystone/domain')
for (const f of fs.readdirSync(dir)) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8')
  for (const m of src.matchAll(/export async function (\w+)\(context: Ctx(?:, (?:args|input|a): ([^)]*?(?:\}|\w|>)))?\)/g)) sigs[m[1]] = (m[2] || '').replace(/\s+/g, ' ').trim()
  for (const m of src.matchAll(/^(?:export )?type (\w+) = (\{[\s\S]*?\n\})/gm)) {
    sigs[`type:${m[1]}`] = m[2].replace(/\/\*\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean)
      .map((l, i, all) => (i === 0 || i === all.length - 1 || /[;{,]$/.test(l) ? l : `${l};`)).join(' ').replace(/; \}/g, ' }')
  }
  for (const m of src.matchAll(/^(?:export )?type (\w+) = (\{[^\n]*\})$/gm)) sigs[`type:${m[1]}`] = m[2]
}
const opsSrc = fs.readFileSync(path.join(root, 'features/keystone/mutations/operations.ts'), 'utf8')
const OPS = {}
for (const line of opsSrc.split('\n')) {
  const m = line.match(/^\s+(\w+): ([qm])\((.*?), \(c(?:, i)?\) => (?:\w+\.)?(\w+)\(/)
  if (m) OPS[m[1]] = { kind: m[2] === 'q' ? 'query' : 'mutation', access: m[3].replace(/'/g, ''), fn: m[4] }
}
const schema = fs.readFileSync(path.join(root, 'schema.graphql'), 'utf8')

function inputOf(op) {
  const o = OPS[op]
  if (!o) throw new Error(`Unknown operation ${op}`)
  let s = sigs[o.fn]
  if (s && s.startsWith('Record<')) s = 'see note'
  if (s === undefined) throw new Error(`No domain signature for ${op} (${o.fn})`)
  if (!s) return '{}'
  s = s.replace(/\b(BidArgs|RequestInput|OnboardingInput|LineInput)\b/g, (t) => sigs[`type:${t}`] ?? t)
  return s
}
const LIST_OPS = (lists) => {
  for (const l of lists) if (!new RegExp(`^type ${l} \\{`, 'm').test(schema)) throw new Error(`No list ${l}`)
  return lists.map((l) => `Keystone list ops on \`${l}\``).join(', ')
}

// [id, task, ops[], lists[], route, note]
const ROWS = [
  ['§5.1 Storefront: public (no account)'],
  ['P1', 'Home', ['storefrontSettings', 'publicLots', 'publicCertifications'], [], '/'],
  ['P2', 'Recycle with us: services, accepted items with fees, locations and hours', ['publicAcceptedItems', 'publicFacilities'], [], '/recycle'],
  ['P3', 'Request a pickup or drop-off (creates a job and an account)', ['submitPickupRequest'], [], '/request-pickup'],
  ['P4', 'Browse lots, grouped by sale', ['publicLots', 'publicSaleEvents'], [], '/lots'],
  ['P5', 'Lot page in teaser form', ['publicLot'], [], '/lots/[lotNumber]'],
  ['P6', 'How buying works, rules from settings, grading guide', ['storefrontSettings', 'publicGradeGuide'], [], '/buyers'],
  ['P7', 'Apply as a buyer', ['registerBuyer', 'saveBuyerApplication', 'uploadBuyerDocument', 'submitBuyerApplication'], [], '/buyers/apply', 'saveBuyerApplication input: { legalName?, tradingName?, addressLine1?, addressLine2?, city?, region?, postalCode?, countryCode?, phone?, website?, taxId?, businessType?, monthlySpendBand?, destinationCountries?: string[], categoryIds?: string[] }'],
  ['P8', 'Verify a certificate by code', ['verifyCertificate'], [], '/verify, /verify/[code]'],
  ['P9', 'Terms (wholesale and service)', ['storefrontSettings'], [], '/terms'],
  ['P10', 'Sign in, sign up, reset password', [], [], '/signin, /signup, /reset-password', 'Keystone auth: `authenticateUserWithPassword(email, password)`, `sendUserPasswordResetLink(email)`, `redeemUserPasswordResetToken(email, token, password)`; sign-up is `registerBuyer` or `submitPickupRequest`.'],
  ['§5.2 Storefront: buyer account'],
  ['U1', 'Account home', ['myBuyerCompany', 'replyToBuyerMessage', 'myBids', 'myInvoices', 'myOrders'], [], '/buyer'],
  ['U2', 'Lots with prices and filters', ['buyerLots'], [], '/lots'],
  ['U3', 'Lot page with the full manifest', ['buyerLot'], [], '/lots/[lotNumber]'],
  ['U4', 'Download the manifest as Excel', ['downloadLotManifest'], [], '/lots/[lotNumber]'],
  ['U5', 'Sealed lot-total bid; revise or withdraw before close', ['placeBid', 'withdrawBid'], [], '/lots/[lotNumber]'],
  ['U6', 'Bid by line online, or by bid sheet: download, upload, review, confirm', ['downloadBidSheet', 'checkBidSheet', 'placeBid'], [], '/lots/[lotNumber]', '`previewBidSheet` is kept as an alias of `checkBidSheet` until the storefront switches.'],
  ['U7', 'Open auction with soft close', ['placeBid', 'buyerLot'], [], '/lots/[lotNumber]'],
  ['U8', 'Buy now on a fixed-price lot', ['buyNow'], [], '/lots/[lotNumber]'],
  ['U9', 'My bids', ['myBids'], [], '/buyer/bids'],
  ['U10', 'Invoices and invoice page with PDF', ['myInvoices', 'myInvoice', 'downloadInvoice'], [], '/buyer/invoices, /buyer/invoices/[invoiceNumber]'],
  ['U11', 'Pay by card', ['initiateInvoicePaymentSession', 'completeInvoicePayment'], [], '/buyer/invoices/[invoiceNumber]'],
  ['U12', 'Pay by wire or ACH, report the transfer', ['reportBankTransfer'], [], '/buyer/invoices/[invoiceNumber]'],
  ['U13', 'Orders: timeline, pickup address once paid, release details, destination', ['myOrders', 'myOrder', 'setOrderRelease'], [], '/buyer/orders, /buyer/orders/[orderNumber]'],
  ['U14', 'Packing list and bill of lading', ['downloadOrderDocument'], [], '/buyer/orders/[orderNumber]'],
  ['U15', 'Accept new terms when the version changes', ['acceptWholesaleTerms'], [], 'prompted before the next bid'],
  ['§5.3 Storefront: client account'],
  ['C1', 'Jobs list and request another pickup', ['myJobs', 'requestJob'], [], '/client'],
  ['C2', 'Job page: timeline, custody, containers, weights', ['myJob'], [], '/client/jobs/[jobNumber]'],
  ['C3', 'Accept the quote by typed name, or decline', ['acceptJobQuote', 'declineJobQuote'], [], '/client/jobs/[jobNumber]'],
  ['C4', 'Certificates and settlement statement PDFs', ['myJob', 'downloadCertificate', 'downloadSettlement'], [], '/client/jobs/[jobNumber]'],
  ['C5', 'Invoices; pay by card or transfer', ['myInvoices', 'myInvoice', 'downloadInvoice', 'initiateInvoicePaymentSession', 'completeInvoicePayment', 'reportBankTransfer'], [], '/client/invoices, /client/invoices/[invoiceNumber]'],
  ['§5.4 Platform pages (staff). Sidebar group in brackets; every route is under /dashboard/platform/'],
  ['S1', '[Sell] Buyer applications: read documents, approve, reject, ask for more', ['reviewBuyerApplication', 'reviewBuyerDocument', 'messageBuyer'], [], 'buyers, buyers/[id]'],
  ['S2', '[Sell] Buyer record: tax status, spend limit, strikes, suspend, reinstate, notes', ['suspendBuyer', 'reinstateBuyer'], ['BuyerCompany'], 'buyers/[id]'],
  ['S3', '[Sell] Buyer users: add, remove, admin or bidder', [], ['User'], 'buyers/[id]', 'Create with `kind: buyer` and `buyerCompany.connect`; a buyer manager cannot create staff or client users.'],
  ['S4', '[Sell] Buyer category interests', [], ['BuyerCompany'], 'buyers/[id]', 'Field `categoriesOfInterest` (set).'],
  ['S5', '[Sell] Buyer documents: accept, reject, expiry', ['reviewBuyerDocument'], [], 'buyers/[id]'],
  ['S6', '[Sell] Manifest import: upload, map, preview, commit', ['uploadManifest', 'mapManifest', 'validateManifest', 'commitManifest', 'discardManifest'], [], 'manifest-imports'],
  ['S7', '[Sell] Build a lot from inventory', ['createLotFromAssets'], [], 'inventory'],
  ['S8', '[Sell] Lot editor: details, photos, format, basis, reserve, terms', ['attachFile'], ['Lot', 'LotLine', 'LotImage'], 'lots, lots/[id]', 'Photos: `attachFile { target: "lot_image", id: lotId, file, caption }`.'],
  ['S9', '[Sell] Sale events: create, add lots, publish, announce', ['publishSaleEvent', 'publishLot'], ['SaleEvent'], 'sale-events'],
  ['S10', '[Sell] Open lot: addendum, extend close, cancel', ['postLotAddendum', 'extendLotClose', 'cancelLot'], [], 'lots/[id]'],
  ['S11', '[Sell] Bid board: count before close, full table after', ['lotBidBoard'], [], 'lots/[id]', 'Sealed amounts before close only with `canSeeSealedBidAmountsBeforeClose`.'],
  ['S12', '[Sell] Enter a bid for a buyer who phoned or emailed', ['placeBidForBuyer'], [], 'lots/[id]', 'Recorded with `Bid.source = staff_entry` and the note.'],
  ['S13', '[Sell] Award whole lot, split by line, below reserve with override, decline all', ['awardLot', 'declineLotBids'], [], 'lots/[id]'],
  ['S14', '[Sell] Relist; re-award to the runner-up', ['relistLot', 'reAwardToRunnerUp'], [], 'lots/[id]'],
  ['S15', '[Sell] Orders board', [], ['Order'], 'orders'],
  ['S16', '[Sell] Order: pallets and weight, freight or storage lines, mark ready', ['addInvoiceLine', 'markOrderReady', 'staffOrderDocument', 'staffInvoicePdf'], [], 'orders/[id]'],
  ['S17', '[Sell] Dock calendar: book, move, cancel', ['dockDay', 'bookDockAppointment', 'setDockAppointmentStatus'], [], 'dock', 'Move = `bookDockAppointment` with `appointmentId`. Slots are the facility hours cut into `dockSlotMinutes`, in the store time zone.'],
  ['S18', '[Sell] Release: driver, bill of lading, signature', ['releaseOrder'], [], 'orders/[id]'],
  ['S19', '[Sell] Claims: record with photos, approve, deny, refund', ['openClaim', 'resolveClaim'], [], 'claims'],
  ['S20', '[Sell] Default an order; waive the restocking fee', ['defaultOrder', 'waiveRestockingFee', 'cancelOrder'], [], 'orders/[id]'],
  ['K1', '[Collect] Requests: review, quote, send', ['quoteJob', 'recordJobAcceptance'], [], 'jobs, jobs/[id]'],
  ['K2', '[Collect] Create a job for a client who phoned', ['staffRequestJob'], [], 'jobs', 'Same input as `requestJob`, plus `organizationId` and `siteId`.'],
  ['K3', '[Collect] Cancel or hold a job', ['cancelJob', 'setJobHold'], ['Job'], 'jobs/[id]'],
  ['K4', '[Collect] Dispatch: date, window, driver, vehicle', ['scheduleJob'], [], 'dispatch, jobs/[id]'],
  ['K5', '[Collect] Driver view (phone): stops, containers, seals, photos, signature', ['startJobRoute', 'collectJob'], [], 'driver'],
  ['K6', '[Collect] Receiving: scan, check seal, weigh', ['receiveContainer'], [], 'receiving'],
  ['K7', '[Collect] Seal exceptions', ['resolveSealException'], [], 'receiving'],
  ['K8', '[Collect] Drop-off appointments', ['bookDockAppointment', 'collectJob'], [], 'dock, receiving', 'Drop-offs are dated on dispatch; receiving records the handover with `collectJob`.'],
  ['R1', '[Process] Audit bench: asset, pulled drives, grades, photos', ['auditAsset'], [], 'audit', 'Pulled drives: `auditAsset` with `parentId`.'],
  ['R2', '[Process] Import assets from Excel', ['importAssets', 'mapManifest', 'validateManifest', 'commitManifest'], [], 'audit, assets', 'Uses the manifest mapper (`purpose: asset_import`).'],
  ['R3', '[Process] Asset search by serial or tag; Excel export, client list', ['exportAssets'], ['Asset'], 'assets'],
  ['R4', '[Process] Commodity lines by weight', [], ['CommodityLine'], 'jobs/[id]'],
  ['R5', '[Process] Record sanitisation', ['recordSanitization'], [], 'sanitization'],
  ['R6', '[Process] Import an erasure report', ['importErasureReport'], [], 'sanitization', 'Check with `{ file, tool }`, then commit with `{ importId, commit: true }`.'],
  ['R7', '[Process] Verify a sample', ['sanitizationSample', 'verifySanitization'], [], 'sanitization'],
  ['R8', '[Process] Disposition; holds', ['setAssetDisposition', 'placeAssetHold', 'releaseAssetHold'], [], 'assets'],
  ['R9', '[Process] Inventory ready for sale', ['createLotFromAssets'], ['Asset'], 'inventory'],
  ['Y1', '[Comply] Complete a job', ['startProcessing', 'completeJob', 'closeJob'], [], 'jobs/[id]'],
  ['Y2', '[Comply] Issue, revoke and reissue certificates', ['issueCertificate', 'revokeCertificate', 'staffDownloadFile'], [], 'certificates, jobs/[id]', 'PDF: `staffDownloadFile { kind: "certificate", id }`.'],
  ['Y3', '[Comply] Custody log', [], ['CustodyEvent'], 'custody'],
  ['Y4', '[Comply] Downstream vendors and approvals', ['attachFile'], ['DownstreamVendor'], 'downstream', 'Due diligence: `attachFile { target: "vendor_due_diligence", id: vendorId, file }`.'],
  ['Y5', '[Comply] Outbound shipments; confirm receipt', ['shipOutbound', 'confirmOutboundReceipt'], ['OutboundShipment', 'OutboundShipmentLine'], 'outbound'],
  ['Y6', '[Comply] Mass balance', ['massBalanceReport'], [], 'mass-balance', '`format: "xlsx"` adds a download.'],
  ['Y7', '[Comply] Audit log', [], ['AuditEvent'], 'audit-log', 'Read-only.'],
  ['Y8', "[Comply] The company's own certifications", ['attachFile'], ['Certification'], 'certifications', 'Document: `attachFile { target: "certification_document", id, file }`.'],
  ['M1', '[Money] Invoices: all kinds, PDF, void', ['staffInvoicePdf', 'voidInvoice'], ['Invoice'], 'invoices'],
  ['M2', '[Money] Confirm or reject a transfer; record a cheque', ['confirmBankTransfer', 'rejectBankTransfer', 'recordOfflinePayment'], [], 'payments'],
  ['M3', '[Money] Check a card payment with an unknown result', ['checkPaymentSession'], [], 'payments'],
  ['M4', '[Money] Refund', ['refundPayment'], [], 'payments'],
  ['M5', '[Money] Settlements: build, review, publish, dispute, payout', ['buildSettlement', 'addSettlementLine', 'removeSettlementLine', 'submitSettlementForReview', 'publishSettlement', 'recordSettlementDispute', 'recordSettlementPayout', 'staffDownloadFile'], [], 'settlements'],
  ['M6', '[Money] Sales and client impact reports, PDF or Excel', ['salesReport', 'clientImpactReport'], [], 'reports'],
  ['M7', '[Money] Accounting export', ['accountingExport'], [], 'export'],
  ['T1', '[Clients] Organisations, sites and users', [], ['ClientOrganization', 'ClientSite', 'User'], 'clients, clients/[id]', 'Client users: `kind: client`, `clientOrganization.connect`.'],
  ['T2', '[Collect] Pickup enquiries from the site', [], ['Job'], 'jobs', 'Website requests land in the "To quote" tab.'],
  ['T3', '[Settings] Store settings, terms, bank instructions, email', ['serviceStatus', 'attachFile'], ['StoreSettings'], 'settings', 'Email status is `serviceStatus.email`; nothing is gated on SMTP. Logo: `attachFile { target: "logo", file }`.'],
  ['T4', '[Settings] Facilities, hours, dock capacity', [], ['Facility'], 'facilities'],
  ['T5', '[Settings] Categories, grades, accepted items and fees', [], ['MaterialCategory', 'GradeDefinition', 'AcceptedItem'], 'catalog'],
  ['T6', '[Settings] Team and roles', [], ['User', 'Role'], 'team'],
  ['T7', '[Settings] Payment providers', ['serviceStatus'], ['PaymentProvider'], 'payment-providers', 'Card keys are server environment only; `serviceStatus.cards` says what is set.'],
  ['T8', '[Settings] Onboarding', ['onboardingStatus', 'runElectronicsRecyclingOnboarding'], [], 'onboarding'],
  ['T9', '[Today] What needs doing now', ['todaySummary'], [], 'today'],
]

const esc = (s) => String(s).replace(/\|/g, '\\|')
let md = `# Feature matrix

Every row of the dissertation §5, the GraphQL operation(s) behind it, and the page.
All custom operations take one \`input: JSON\` argument and are checked on the server
(\`features/keystone/mutations/operations.ts\`). Queries return JSON; mutations return
\`{ success, error, data }\`. "List ops" are the generated Keystone CRUD operations
(\`create<List>\`, \`update<List>\`, \`delete<List>\`, \`<lists>\`), guarded by list access.
\`FileInput\` is \`{ filename, mimeType, base64 }\`. Money is integer minor units (\`…Minor\`), rates are basis points (\`…Bps\`).

Generated by \`node scripts/feature-matrix.cjs\` from the domain signatures; do not edit by hand.

`
let ids = 0
for (const row of ROWS) {
  if (row.length === 1) { md += `\n## ${row[0]}\n\n| Row | Task | Operation | Kind | Input | Route |\n|---|---|---|---|---|---|\n`; continue }
  const [id, task, ops, lists, route, note] = row
  ids++
  const cells = ops.map((op) => [`\`${op}\``, OPS[op].kind, `\`${esc(inputOf(op))}\``])
  if (lists.length) cells.push([LIST_OPS(lists), 'list', ''])
  if (!cells.length) cells.push(['', '', ''])
  cells.forEach((c, i) => {
    const r = route.startsWith('/') || route.startsWith('prompted') ? route : route.split(', ').map((x) => `/dashboard/platform/${x}`).join(', ')
    md += `| ${i ? '' : id} | ${i ? '' : esc(task)} | ${c[0]} | ${c[1]} | ${c[2]} | ${i ? '' : esc(r)} |\n`
  })
  if (note) md += `| | | ${esc(note)} | | | |\n`
}
md += `\n${ids} rows.\n`
module.exports = { ROWS, OPS, render: () => md }
if (require.main === module) {
  fs.writeFileSync(path.join(root, 'docs/FEATURE-MATRIX.md'), md)
  console.log(`docs/FEATURE-MATRIX.md: ${ids} rows`)
}
