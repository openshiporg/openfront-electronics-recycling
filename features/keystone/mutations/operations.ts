import { GraphQLError } from 'graphql'
import type { RolePermission } from '../access'
import { DomainError, command, requireStaff, toJson, type Ctx } from '../lib/core'
import * as buyers from '../domain/buyers'
import * as documents from '../domain/documents'
import * as files from '../domain/files'
import * as jobs from '../domain/jobs'
import * as lots from '../domain/lots'
import * as money from '../domain/money'
import * as orders from '../domain/orders'
import * as process from '../domain/process'
import * as reads from '../domain/reads'
import * as reports from '../domain/reports'
import * as settlements from '../domain/settlements'
import * as sheets from '../domain/sheets'
import { runElectronicsRecyclingOnboarding, onboardingStatus } from '../domain/onboarding'

/**
 * Every custom operation, in one table.
 * - public: anyone (storefront pages without an account).
 * - account: a signed-in buyer or client; the domain function checks ownership.
 * - staff: a staff role holding at least one of the listed permissions.
 * Queries resolve to JSON; mutations resolve to CommandResult { success, error, data }.
 */
type Access = 'public' | 'account' | RolePermission[]
type Op = { kind: 'query' | 'mutation'; access: Access; run: (context: Ctx, input: any) => Promise<unknown> }

const q = (access: Access, run: Op['run']): Op => ({ kind: 'query', access, run })
const m = (access: Access, run: Op['run']): Op => ({ kind: 'mutation', access, run })

const SELL: RolePermission[] = ['canManageLots']
const AWARD: RolePermission[] = ['canAwardLots']
const BUYERS: RolePermission[] = ['canManageBuyers']
const PAY: RolePermission[] = ['canManagePayments']

export const OPERATIONS: Record<string, Op> = {
  // ---------------- public storefront (§5.1)
  storefrontSettings: q('public', (c) => reads.storefrontSettings(c)),
  publicLots: q('public', (c, i) => reads.publicLots(c, i ?? {})),
  publicLot: q('public', (c, i) => reads.publicLot(c, i)),
  publicSaleEvents: q('public', (c) => reads.publicSaleEvents(c)),
  publicCertifications: q('public', (c) => reads.publicCertifications(c)),
  publicAcceptedItems: q('public', (c) => reads.publicAcceptedItems(c)),
  publicFacilities: q('public', (c) => reads.publicFacilities(c)),
  publicGradeGuide: q('public', (c) => reads.publicGradeGuide(c)),
  publicCategories: q('public', (c) => reads.publicCategories(c)),
  verifyCertificate: q('public', (c, i) => process.verifyCertificate(c, i)),
  submitPickupRequest: m('public', (c, i) => jobs.submitPickupRequest(c, i)),
  registerBuyer: m('public', (c, i) => buyers.registerBuyer(c, i)),

  // ---------------- buyer account (§5.2)
  myBuyerCompany: q('account', (c) => reads.myBuyerCompany(c)),
  buyerLots: q('account', (c, i) => reads.buyerLots(c, i ?? {})),
  buyerLot: q('account', (c, i) => reads.buyerLot(c, i)),
  myBids: q('account', (c, i) => reads.myBids(c, i ?? {})),
  myInvoices: q('account', (c) => reads.myInvoices(c)),
  myInvoice: q('account', (c, i) => reads.myInvoice(c, i)),
  myOrders: q('account', (c) => reads.myOrders(c)),
  myOrder: q('account', (c, i) => reads.myOrder(c, i)),
  saveBuyerApplication: m('account', (c, i) => buyers.saveBuyerApplication(c, i)),
  uploadBuyerDocument: m('account', (c, i) => buyers.uploadBuyerDocument(c, i)),
  submitBuyerApplication: m('account', (c, i) => buyers.submitBuyerApplication(c, i)),
  replyToBuyerMessage: m('account', (c, i) => buyers.replyToBuyerMessage(c, i)),
  acceptWholesaleTerms: m('account', (c, i) => buyers.acceptWholesaleTerms(c, i)),
  downloadLotManifest: m('account', (c, i) => sheets.downloadLotManifest(c, i)),
  downloadBidSheet: m('account', (c, i) => sheets.downloadBidSheet(c, i)),
  checkBidSheet: m('account', (c, i) => sheets.checkBidSheet(c, i)),
  // Old name, kept until the storefront calls checkBidSheet.
  previewBidSheet: m('account', (c, i) => sheets.checkBidSheet(c, i)),
  placeBid: m('account', (c, i) => lots.placeBid(c, i)),
  placeBidFromSheet: m('account', (c, i) => sheets.placeBidFromSheet(c, i)),
  withdrawBid: m('account', (c, i) => lots.withdrawBid(c, i)),
  buyNow: m('account', (c, i) => lots.buyNow(c, i)),
  setOrderRelease: m('account', (c, i) => orders.setOrderRelease(c, i)),
  downloadOrderDocument: m('account', (c, i) => documents.downloadOrderDocument(c, i)),
  downloadInvoice: m('account', (c, i) => documents.downloadInvoice(c, i)),
  initiateInvoicePaymentSession: m('account', (c, i) => money.initiateInvoicePaymentSession(c, i)),
  completeInvoicePayment: m('account', (c, i) => money.completeInvoicePayment(c, i)),
  reportBankTransfer: m('account', (c, i) => money.reportBankTransfer(c, i)),

  // ---------------- client account (§5.3)
  myJobs: q('account', (c) => reads.myJobs(c)),
  myJob: q('account', (c, i) => reads.myJob(c, i)),
  acceptJobQuote: m('account', (c, i) => jobs.acceptJobQuote(c, i)),
  declineJobQuote: m('account', (c, i) => jobs.declineJobQuote(c, i)),
  downloadCertificate: m('account', (c, i) => documents.downloadCertificate(c, i)),
  downloadSettlement: m('account', (c, i) => documents.downloadSettlement(c, i)),
  // requestJob is both: a client asks (account) and staff creates one for a caller (K2); the domain decides.
  requestJob: m('account', (c, i) => jobs.requestJob(c, i)),

  // ---------------- platform: Today
  todaySummary: q(['canAccessDashboard'], (c) => reports.todaySummary(c)),

  // ---------------- platform: Sell
  reviewBuyerApplication: m(BUYERS, (c, i) => buyers.reviewBuyerApplication(c, i)),
  reviewBuyerDocument: m(BUYERS, (c, i) => buyers.reviewBuyerDocument(c, i)),
  messageBuyer: m(BUYERS, (c, i) => buyers.messageBuyer(c, i)),
  suspendBuyer: m(BUYERS, (c, i) => buyers.suspendBuyer(c, i)),
  reinstateBuyer: m(BUYERS, (c, i) => buyers.reinstateBuyer(c, i)),
  uploadManifest: m(SELL, (c, i) => sheets.uploadManifest(c, i)),
  mapManifest: m(SELL, (c, i) => sheets.mapManifest(c, i)),
  validateManifest: m(SELL, (c, i) => sheets.validateManifest(c, i)),
  commitManifest: m(SELL, (c, i) => sheets.commitManifest(c, i)),
  discardManifest: m(SELL, (c, i) => sheets.discardManifest(c, i)),
  staffLotManifest: m(['canManageLots', 'canAwardLots', 'canViewReports'], (c, i) => sheets.staffLotManifest(c, i)),
  createLotFromAssets: m(SELL, (c, i) => lots.createLotFromAssets(c, i)),
  removeAssetsFromLot: m(SELL, (c, i) => lots.removeAssetsFromLot(c, i)),
  publishLot: m(SELL, (c, i) => lots.publishLot(c, i)),
  publishSaleEvent: m(SELL, (c, i) => lots.publishSaleEvent(c, i)),
  postLotAddendum: m(SELL, (c, i) => lots.postLotAddendum(c, i)),
  extendLotClose: m(SELL, (c, i) => lots.extendLotClose(c, i)),
  cancelLot: m(SELL, (c, i) => lots.cancelLot(c, i)),
  lotBidBoard: q(['canManageLots', 'canAwardLots'], (c, i) => lots.lotBidBoard(c, i)),
  placeBidForBuyer: m(SELL, (c, i) => lots.placeBidForBuyer(c, i)),
  awardLot: m(AWARD, (c, i) => lots.awardLot(c, i)),
  declineLotBids: m(AWARD, (c, i) => lots.declineLotBids(c, i)),
  relistLot: m(SELL, (c, i) => lots.relistLot(c, i)),
  reAwardToRunnerUp: m(AWARD, (c, i) => lots.reAwardToRunnerUp(c, i)),
  markOrderReady: m(['canManageLots', 'canReceive'], (c, i) => orders.markOrderReady(c, i)),
  releaseOrder: m(['canManageLots', 'canReceive'], (c, i) => orders.releaseOrder(c, i)),
  defaultOrder: m(SELL, (c, i) => orders.defaultOrder(c, i)),
  waiveRestockingFee: m(SELL, (c, i) => orders.waiveRestockingFee(c, i)),
  cancelOrder: m(SELL, (c, i) => orders.cancelOrder(c, i)),
  staffOrderDocument: m(['canManageLots', 'canReceive', 'canManagePayments'], (c, i) => documents.staffOrderDocument(c, i)),
  bookDockAppointment: m(['canManageLots', 'canReceive', 'canDispatch'], (c, i) => orders.bookDockAppointment(c, i)),
  setDockAppointmentStatus: m(['canManageLots', 'canReceive', 'canDispatch'], (c, i) => orders.setDockAppointmentStatus(c, i)),
  dockDay: q(['canManageLots', 'canReceive', 'canDispatch'], (c, i) => orders.dockDay(c, i)),
  openClaim: m(SELL, (c, i) => orders.openClaim(c, i)),
  resolveClaim: m(SELL, (c, i) => orders.resolveClaim(c, i)),

  // ---------------- platform: Collect
  quoteJob: m(['canManageJobs'], (c, i) => jobs.quoteJob(c, i)),
  recordJobAcceptance: m(['canManageJobs'], (c, i) => jobs.recordJobAcceptance(c, i)),
  staffRequestJob: m(['canManageJobs', 'canManageClients'], (c, i) => jobs.requestJob(c, i)),
  cancelJob: m(['canManageJobs'], (c, i) => jobs.cancelJob(c, i)),
  setJobHold: m(['canManageJobs'], (c, i) => jobs.setJobHold(c, i)),
  invoiceJob: m(['canManageJobs', 'canManagePayments'], (c, i) => jobs.invoiceJob(c, i)),
  scheduleJob: m(['canDispatch'], (c, i) => jobs.scheduleJob(c, i)),
  startJobRoute: m(['canCollect', 'canDispatch', 'canReceive'], (c, i) => jobs.startJobRoute(c, i)),
  collectJob: m(['canCollect', 'canDispatch', 'canReceive'], (c, i) => jobs.collectJob(c, i)),
  receiveContainer: m(['canReceive'], (c, i) => jobs.receiveContainer(c, i)),
  resolveSealException: m(['canReceive', 'canIssueCertificates'], (c, i) => jobs.resolveSealException(c, i)),

  // ---------------- platform: Process
  startProcessing: m(['canAuditAssets', 'canManageJobs'], (c, i) => jobs.startProcessing(c, i)),
  auditAsset: m(['canAuditAssets'], (c, i) => process.auditAsset(c, i)),
  importAssets: m(['canAuditAssets'], (c, i) => sheets.importAssets(c, i)),
  exportAssets: m(['canAuditAssets', 'canManageClients', 'canViewReports', 'canIssueCertificates'], (c, i) => process.exportAssets(c, i ?? {})),
  recordSanitization: m(['canSanitize'], (c, i) => process.recordSanitization(c, i)),
  importErasureReport: m(['canSanitize'], (c, i) => process.importErasureReport(c, i)),
  verifySanitization: m(['canVerifySanitization'], (c, i) => process.verifySanitization(c, i)),
  sanitizationSample: q(['canVerifySanitization'], (c, i) => process.sanitizationSample(c, i ?? {})),
  setAssetDisposition: m(['canAuditAssets', 'canManageLots'], (c, i) => process.setAssetDisposition(c, i)),
  placeAssetHold: m(['canAuditAssets', 'canIssueCertificates'], (c, i) => process.placeAssetHold(c, i)),
  releaseAssetHold: m(['canAuditAssets', 'canIssueCertificates'], (c, i) => process.releaseAssetHold(c, i)),

  // ---------------- platform: Comply
  completeJob: m(['canIssueCertificates'], (c, i) => jobs.completeJob(c, i)),
  closeJob: m(['canManageJobs', 'canManageSettlements'], (c, i) => jobs.closeJob(c, i)),
  issueCertificate: m(['canIssueCertificates'], (c, i) => process.issueCertificate(c, i)),
  revokeCertificate: m(['canIssueCertificates'], (c, i) => process.revokeCertificate(c, i)),
  shipOutbound: m(['canManageDownstream'], (c, i) => process.shipOutbound(c, i)),
  confirmOutboundReceipt: m(['canManageDownstream'], (c, i) => process.confirmOutboundReceipt(c, i)),
  massBalanceReport: q(['canManageDownstream', 'canIssueCertificates', 'canViewReports'], (c, i) => reports.massBalanceReport(c, i ?? {})),
  attachFile: m(['canManageLots', 'canManageSettings', 'canIssueCertificates', 'canManageDownstream'], (c, i) => files.attachFile(c, i)),
  staffDownloadFile: m(['canIssueCertificates', 'canManageSettlements', 'canManageClients', 'canViewReports'], (c, i) => documents.staffDownloadFile(c, i)),

  // ---------------- platform: Money
  staffInvoicePdf: m(['canManagePayments', 'canManageLots', 'canManageSettlements', 'canViewReports'], (c, i) => documents.staffInvoicePdf(c, i)),
  addInvoiceLine: m(['canManagePayments', 'canManageLots'], (c, i) => money.addInvoiceLine(c, i)),
  voidInvoice: m(PAY, (c, i) => money.voidInvoice(c, i)),
  confirmBankTransfer: m(PAY, (c, i) => money.confirmBankTransfer(c, i)),
  rejectBankTransfer: m(PAY, (c, i) => money.rejectBankTransfer(c, i)),
  recordOfflinePayment: m(PAY, (c, i) => money.recordOfflinePayment(c, i)),
  checkPaymentSession: m(PAY, (c, i) => money.checkPaymentSession(c, i)),
  refundPayment: m(['canRefund'], (c, i) => money.refundPayment(c, i)),
  buildSettlement: m(['canManageSettlements'], (c, i) => settlements.buildSettlement(c, i)),
  addSettlementLine: m(['canManageSettlements'], (c, i) => settlements.addSettlementLine(c, i)),
  removeSettlementLine: m(['canManageSettlements'], (c, i) => settlements.removeSettlementLine(c, i)),
  submitSettlementForReview: m(['canManageSettlements'], (c, i) => settlements.submitSettlementForReview(c, i)),
  publishSettlement: m(['canManageSettlements'], (c, i) => settlements.publishSettlement(c, i)),
  recordSettlementDispute: m(['canManageSettlements'], (c, i) => settlements.recordSettlementDispute(c, i)),
  recordSettlementPayout: m(['canManageSettlements', 'canManagePayments'], (c, i) => settlements.recordSettlementPayout(c, i)),
  salesReport: q(['canViewReports'], (c, i) => reports.salesReport(c, i ?? {})),
  clientImpactReport: q(['canViewReports', 'canManageClients'], (c, i) => reports.clientImpactReport(c, i)),
  accountingExport: m(['canViewReports', 'canManagePayments'], (c, i) => reports.accountingExport(c, i ?? {})),

  // ---------------- platform: Settings
  onboardingStatus: q(['canManageOnboarding', 'canManageSettings'], (c) => onboardingStatus(c)),
  runElectronicsRecyclingOnboarding: m(['canManageOnboarding'], (c, i) => runElectronicsRecyclingOnboarding(c, i ?? {})),
}

/**
 * A refusal ("This page is for buyer accounts.", "Order not found.") reaches the
 * caller as its own message with code REFUSED; GraphQL Yoga would otherwise mask
 * a plain Error as "Unexpected error.". Anything else is logged and reported plainly.
 */
export function queryError(name: string, error: unknown) {
  if (error instanceof GraphQLError) return error
  if (error instanceof DomainError || (error as Error)?.name === 'RuleError') return new GraphQLError((error as Error).message, { extensions: { code: 'REFUSED' } })
  console.error(`[query ${name}]`, error)
  return new GraphQLError('Something went wrong loading this. Try again.', { extensions: { code: 'INTERNAL' } })
}

function guard(op: Op, context: Ctx) {
  if (Array.isArray(op.access)) requireStaff(context, ...op.access)
}

export function buildResolvers() {
  const Query: Record<string, any> = {}
  const Mutation: Record<string, any> = {}
  for (const [name, op] of Object.entries(OPERATIONS)) {
    if (op.kind === 'query') {
      // Queries throw a GraphQL error on refusal (no partial data to show).
      Query[name] = async (_root: unknown, args: { input?: unknown }, context: Ctx) => {
        try {
          guard(op, context)
          return toJson(await op.run(context, args.input ?? {}))
        } catch (error) {
          throw queryError(name, error)
        }
      }
    } else {
      Mutation[name] = async (_root: unknown, args: { input?: unknown }, context: Ctx) => {
        const result = await command(async () => {
          guard(op, context)
          return toJson(await op.run(context, args.input ?? {}))
        })
        return result
      }
    }
  }
  return { Query, Mutation }
}

export function buildTypeDefs() {
  const queries = Object.entries(OPERATIONS).filter(([, o]) => o.kind === 'query').map(([n]) => `    ${n}(input: JSON): JSON`)
  const mutations = Object.entries(OPERATIONS).filter(([, o]) => o.kind === 'mutation').map(([n]) => `    ${n}(input: JSON): CommandResult!`)
  return `
  type CommandResult {
    success: Boolean!
    error: String
    data: JSON
  }
  type Query {
    redirectToInit: Boolean
${queries.join('\n')}
  }
  type Mutation {
${mutations.join('\n')}
  }
`
}
