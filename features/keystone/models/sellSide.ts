import { list, graphql } from '@keystone-6/core'
import { checkbox, calendarDay, decimal, integer, json, relationship, text, timestamp, virtual } from '@keystone-6/core/fields'
import { document } from '@keystone-6/fields-document'

import { anyOf, can, denyAll, hasPermission, staffAccess } from '../access'
import { trackingFields } from './trackingFields'
import { addressFields, assignNumber, choice, documentNumber, fileRef, readOnly, status, uniqueKey, userRef } from './fields'
import { lotLineMayChange, validateLotInput } from '../lib/lotRules'

export const BUYER_STATUSES = ['draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'suspended', 'closed'] as const
export const LOT_STATUSES = ['draft', 'scheduled', 'open', 'closed', 'awarded', 'completed', 'unsold', 'cancelled'] as const
export const BID_STATUSES = ['active', 'superseded', 'withdrawn', 'won', 'partially_won', 'lost', 'void', 'defaulted', 'expired'] as const
export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'ready_for_release', 'released', 'completed', 'defaulted', 'cancelled'] as const

const sellRead = ['canManageBuyers', 'canManageLots', 'canAwardLots', 'canManagePayments', 'canViewReports', 'canDispatch'] as const

export const BuyerCompany = list({
  access: staffAccess([...sellRead], 'canManageBuyers', { delete: false }),
  ui: { labelField: 'legalName', listView: { initialColumns: ['legalName', 'tradingName', 'countryCode', 'status', 'taxStatus', 'strikes', 'spendLimitMinor'] } },
  fields: {
    legalName: text({ validation: { isRequired: true } }),
    tradingName: text(),
    ...addressFields(),
    phone: text(),
    website: text(),
    taxId: text(),
    businessType: choice(['refurbisher', 'reseller', 'exporter', 'recycler', 'broker', 'other']),
    categoriesOfInterest: relationship({ ref: 'MaterialCategory', many: true }),
    monthlySpendBand: choice(['under_5k', 'from_5k_to_25k', 'from_25k_to_100k', 'over_100k']),
    destinationCountries: json({ defaultValue: [] }),
    status: status(BUYER_STATUSES, 'draft'),
    statusReason: text({ ...readOnly }),
    taxStatus: choice(['taxable', 'exempt_resale', 'export'], 'taxable'),
    spendLimitMinor: integer({ validation: { min: 0 }, ui: { description: 'Bids plus unpaid awards may not exceed this. Empty means no limit.' } }),
    strikes: integer({ defaultValue: 0, ...readOnly }),
    approvedAt: timestamp({ ...readOnly }),
    approvedBy: userRef({ readOnly: true }),
    submittedAt: timestamp({ ...readOnly }),
    rejectedAt: timestamp({ ...readOnly }),
    termsVersionAccepted: text({ ...readOnly }),
    termsAcceptedAt: timestamp({ ...readOnly }),
    users: relationship({ ref: 'User.buyerCompany', many: true }),
    documents: relationship({ ref: 'BuyerDocument.company', many: true }),
    messages: relationship({ ref: 'BuyerMessage.company', many: true }),
    bids: relationship({ ref: 'Bid.company', many: true, ...readOnly }),
    orders: relationship({ ref: 'Order.company', many: true, ...readOnly }),
    invoices: relationship({ ref: 'Invoice.buyerCompany', many: true, ...readOnly }),
    internalNotes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

export const BuyerDocument = list({
  access: staffAccess([...sellRead], 'canManageBuyers'),
  ui: { listView: { initialColumns: ['company', 'type', 'state', 'expiresOn', 'status'] } },
  fields: {
    company: relationship({ ref: 'BuyerCompany.documents' }),
    type: choice(['resale_certificate', 'export_license', 'business_registration', 'w9', 'r2_certificate', 'other'], 'resale_certificate'),
    file: fileRef(),
    state: text({ ui: { description: 'Issuing US state, for a resale certificate.' } }),
    expiresOn: calendarDay(),
    status: choice(['submitted', 'accepted', 'rejected'], 'submitted'),
    reviewNote: text(),
    uploadedBy: relationship({ ref: 'User' }),
    expiryHandledAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

export const BuyerMessage = list({
  access: staffAccess([...sellRead], 'canManageBuyers', { update: false, delete: false }),
  ui: { listView: { initialColumns: ['company', 'author', 'fromStaff', 'createdAt'] } },
  fields: {
    company: relationship({ ref: 'BuyerCompany.messages' }),
    author: relationship({ ref: 'User' }),
    body: text({ validation: { isRequired: true }, ui: { displayMode: 'textarea' } }),
    fromStaff: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const SaleEvent = list({
  access: staffAccess([...sellRead], 'canManageLots', { delete: false }),
  ui: { labelField: 'title', listView: { initialColumns: ['title', 'opensAt', 'closesAt', 'status', 'announcementSentAt'] } },
  fields: {
    title: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    opensAt: timestamp({ validation: { isRequired: true } }),
    closesAt: timestamp({ validation: { isRequired: true } }),
    status: status(['draft', 'published', 'closed'], 'draft'),
    lots: relationship({ ref: 'Lot.saleEvent', many: true }),
    announcementSentAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

/** Lot fields that may not change once the lot has left draft. */
export const LOT_FROZEN_FIELDS = ['format', 'bidBasis', 'reserveMinor', 'openingBidMinor', 'bidIncrementMinor', 'fixedPriceMinor', 'opensAt', 'awardMode', 'saleEvent'] as const

export const Lot = list({
  access: {
    operation: { query: anyOf(...sellRead), create: can('canManageLots'), update: can('canManageLots'), delete: can('canManageLots') },
    item: { delete: ({ item }) => item.status === 'draft' },
  },
  ui: { labelField: 'lotNumber', listView: { initialColumns: ['lotNumber', 'title', 'status', 'format', 'bidBasis', 'closesAt', 'bidCount'] } },
  hooks: { resolveInput: assignNumber('lot', 'lotNumber'), validate: { create: validateLotInput as any, update: validateLotInput as any } },
  fields: {
    lotNumber: documentNumber(),
    title: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: true }),
    saleEvent: relationship({ ref: 'SaleEvent.lots' }),
    category: relationship({ ref: 'MaterialCategory' }),
    description: document({ formatting: true, links: true }),
    conditionSummary: text({ ui: { displayMode: 'textarea' } }),
    facility: relationship({ ref: 'Facility' }),
    status: status(LOT_STATUSES, 'draft'),
    format: choice(['sealed_bid', 'open_auction', 'fixed_price'], 'sealed_bid'),
    bidBasis: choice(['lot_total', 'per_line'], 'lot_total'),
    awardMode: choice(['manual', 'auto'], 'manual'),
    opensAt: timestamp(),
    closesAt: timestamp(),
    originalClosesAt: timestamp({ ...readOnly }),
    extensionCount: integer({ defaultValue: 0, ...readOnly }),
    openingBidMinor: integer({ validation: { min: 0 } }),
    reserveMinor: integer({ validation: { min: 0 }, access: { read: anyOf('canManageLots', 'canAwardLots') } }),
    bidIncrementMinor: integer({ validation: { min: 0 } }),
    fixedPriceMinor: integer({ validation: { min: 0 } }),
    currentAmountMinor: integer({ ...readOnly, access: { create: denyAll, update: denyAll, read: ({ session, item }) => item.format !== 'sealed_bid' || hasPermission(session, 'canSeeSealedBidAmountsBeforeClose') || !['open', 'scheduled'].includes(String(item.status)) } }),
    bidCount: integer({ defaultValue: 0, ...readOnly }),
    unitCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        async resolve(item, _a, context) {
          const result = await context.prisma.lotLine.aggregate({ where: { lotId: item.id, unit: 'each' }, _sum: { quantity: true } })
          return Number(result._sum.quantity ?? 0)
        },
      }),
    }),
    palletCount: integer({ validation: { min: 0 } }),
    weight: decimal({ precision: 12, scale: 2 }),
    dimensions: text(),
    shippingTerms: choice(['buyer_arranged', 'seller_quoted', 'pickup_only'], 'buyer_arranged'),
    exportAllowed: checkbox({ defaultValue: true }),
    warrantyDays: integer({ defaultValue: 0, validation: { min: 0 } }),
    lines: relationship({ ref: 'LotLine.lot', many: true }),
    images: relationship({ ref: 'LotImage.lot', many: true }),
    bids: relationship({ ref: 'Bid.lot', many: true, ...readOnly }),
    awards: relationship({ ref: 'Award.lot', many: true, ...readOnly }),
    addenda: relationship({ ref: 'LotAddendum.lot', many: true, ...readOnly }),
    relistedFrom: relationship({ ref: 'Lot', ...readOnly }),
    cancelReason: text({ ...readOnly }),
    sourceImport: relationship({ ref: 'ManifestImport.lot', ...readOnly }),
    publishedAt: timestamp({ ...readOnly }),
    closedAt: timestamp({ ...readOnly }),
    reminder24SentAt: timestamp({ ...readOnly }),
    reminder2SentAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

export const LotLine = list({
  access: {
    operation: { query: anyOf(...sellRead), create: can('canManageLots'), update: can('canManageLots'), delete: can('canManageLots') },
  },
  hooks: { validate: { create: lotLineMayChange as any, update: lotLineMayChange as any, delete: lotLineMayChange as any } },
  ui: { listView: { initialColumns: ['lot', 'lineNumber', 'manufacturer', 'model', 'description', 'quantity', 'functionalGrade'] } },
  fields: {
    lot: relationship({ ref: 'Lot.lines' }),
    lineNumber: integer({ validation: { isRequired: true, min: 1 }, defaultValue: 1 }),
    category: relationship({ ref: 'MaterialCategory' }),
    manufacturer: text(),
    model: text(),
    partNumber: text(),
    description: text(),
    specs: json({ defaultValue: {} }),
    cosmeticGrade: text(),
    functionalGrade: text(),
    quantity: integer({ defaultValue: 1, validation: { isRequired: true, min: 0 } }),
    unit: choice(['each', 'lb', 'kg'], 'each'),
    serials: json({ defaultValue: [] }),
    notes: text(),
    assets: relationship({ ref: 'Asset.lotLine', many: true, ...readOnly }),
    extra: json({ defaultValue: {} }),
    ...trackingFields,
  },
})

export const LotImage = list({
  access: staffAccess([...sellRead], 'canManageLots'),
  fields: {
    lot: relationship({ ref: 'Lot.images' }),
    image: fileRef(),
    caption: text(),
    sortOrder: integer({ defaultValue: 0 }),
    ...trackingFields,
  },
})

export const LotAddendum = list({
  access: { operation: { query: anyOf(...sellRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true },
  fields: {
    lot: relationship({ ref: 'Lot.addenda' }),
    body: text({ ui: { displayMode: 'textarea' } }),
    postedBy: relationship({ ref: 'User' }),
    postedAt: timestamp({ defaultValue: { kind: 'now' } }),
    ...trackingFields,
  },
})

export const ManifestImport = list({
  access: { operation: { query: can('canManageLots'), create: denyAll, update: denyAll, delete: can('canManageLots') } },
  ui: { hideCreate: true, listView: { initialColumns: ['originalFilename', 'status', 'rowCount', 'validCount', 'errorCount', 'lot', 'createdAt'] } },
  fields: {
    file: fileRef(),
    originalFilename: text(),
    status: status(['uploaded', 'mapped', 'validated', 'committed', 'discarded'], 'uploaded'),
    sheetName: text(),
    sheetNames: json({ defaultValue: [] }),
    headerRow: integer({ defaultValue: 1 }),
    headers: json({ defaultValue: [] }),
    mapping: json({ defaultValue: {} }),
    rowCount: integer({ defaultValue: 0 }),
    validCount: integer({ defaultValue: 0 }),
    errorCount: integer({ defaultValue: 0 }),
    rows: json({ defaultValue: [] }),
    lot: relationship({ ref: 'Lot.sourceImport' }),
    purpose: choice(['lot_manifest', 'asset_import'], 'lot_manifest'),
    targetJob: relationship({ ref: 'Job' }),
    uploadedBy: relationship({ ref: 'User' }),
    ...trackingFields,
  },
})

export const ManifestMapping = list({
  access: staffAccess('canManageLots', 'canManageLots'),
  fields: {
    name: text({ validation: { isRequired: true } }),
    mapping: json({ defaultValue: {} }),
    ...trackingFields,
  },
})

export const Bid = list({
  access: { operation: { query: anyOf('canManageLots', 'canAwardLots', 'canViewReports'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['lot', 'company', 'amountMinor', 'status', 'source', 'submittedAt'] } },
  fields: {
    lot: relationship({ ref: 'Lot.bids' }),
    company: relationship({ ref: 'BuyerCompany.bids' }),
    placedBy: relationship({ ref: 'User' }),
    amountMinor: integer({
      validation: { isRequired: true },
      defaultValue: 0,
      access: { read: async ({ session, item, context }) => {
        if (hasPermission(session, 'canSeeSealedBidAmountsBeforeClose')) return true
        const lot = await (context as any).prisma.lot.findUnique({ where: { id: item.lotId }, select: { format: true, status: true } })
        return !(lot?.format === 'sealed_bid' && ['open', 'scheduled'].includes(lot?.status))
      } },
    }),
    status: choice(BID_STATUSES, 'active'),
    activeKey: uniqueKey({ hidden: true }),
    submittedAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
    source: choice(['web', 'bid_sheet', 'staff_entry'], 'web'),
    staffNote: text(),
    sheetFile: fileRef(),
    lines: relationship({ ref: 'BidLine.bid', many: true }),
    idempotencyKey: uniqueKey({ hidden: true }),
    requestHash: text({ access: { read: denyAll }, ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    ipAddress: text(),
    userAgent: text(),
    supersedes: relationship({ ref: 'Bid' }),
    ...trackingFields,
  },
})

export const BidLine = list({
  access: { operation: { query: anyOf('canManageLots', 'canAwardLots'), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    bid: relationship({ ref: 'Bid.lines' }),
    lotLine: relationship({ ref: 'LotLine' }),
    unitPriceMinor: integer({ defaultValue: 0 }),
    quantity: integer({ defaultValue: 0 }),
    status: choice(['active', 'won', 'lost'], 'active'),
    ...trackingFields,
  },
})

export const Award = list({
  access: { operation: { query: anyOf('canManageLots', 'canAwardLots', 'canManagePayments', 'canViewReports'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ['lot', 'company', 'amountMinor', 'status', 'isBelowReserve', 'awardedAt'] } },
  fields: {
    lot: relationship({ ref: 'Lot.awards' }),
    bid: relationship({ ref: 'Bid' }),
    company: relationship({ ref: 'BuyerCompany' }),
    awardedBy: relationship({ ref: 'User' }),
    awardedAt: timestamp(),
    amountMinor: integer({ defaultValue: 0 }),
    isBelowReserve: checkbox({ defaultValue: false }),
    overrideReason: text(),
    status: choice(['active', 'defaulted', 'cancelled'], 'active'),
    activeLotKey: uniqueKey({ hidden: true }),
    lines: relationship({ ref: 'AwardLine.award', many: true }),
    order: relationship({ ref: 'Order.award' }),
    ...trackingFields,
  },
})

export const AwardLine = list({
  access: { operation: { query: anyOf('canManageLots', 'canAwardLots'), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    award: relationship({ ref: 'Award.lines' }),
    lotLine: relationship({ ref: 'LotLine' }),
    activeLotLineKey: uniqueKey({ hidden: true }),
    bidLine: relationship({ ref: 'BidLine' }),
    quantity: integer({ defaultValue: 0 }),
    unitPriceMinor: integer({ defaultValue: 0 }),
    totalMinor: integer({ defaultValue: 0 }),
    ...trackingFields,
  },
})

export const Order = list({
  access: staffAccess([...sellRead], ['canManageLots', 'canDispatch', 'canManagePayments'], { create: false, delete: false }),
  ui: { labelField: 'orderNumber', listView: { initialColumns: ['orderNumber', 'company', 'lot', 'status', 'paymentDueAt', 'releaseMethod', 'preferredPickupDate'] } },
  fields: {
    orderNumber: documentNumber(),
    company: relationship({ ref: 'BuyerCompany.orders', ...readOnly }),
    award: relationship({ ref: 'Award.order', ...readOnly }),
    lot: relationship({ ref: 'Lot', ...readOnly }),
    status: status(ORDER_STATUSES, 'awaiting_payment'),
    invoice: relationship({ ref: 'Invoice.order', ...readOnly }),
    lines: relationship({ ref: 'OrderLine.order', many: true, ...readOnly }),
    paymentDueAt: timestamp(),
    readyAt: timestamp({ ...readOnly }),
    removalDueAt: timestamp(),
    releaseMethod: choice(['pickup', 'freight']),
    preferredPickupDate: calendarDay(),
    dockAppointment: relationship({ ref: 'DockAppointment.order' }),
    carrierName: text(),
    carrierReference: text(),
    freightPickupDate: calendarDay(),
    destinationCountry: text(),
    exportAcknowledgedAt: timestamp({ ...readOnly }),
    releaseDetailsSetAt: timestamp({ ...readOnly }),
    palletCount: integer({ validation: { min: 0 } }),
    weight: decimal({ precision: 12, scale: 2 }),
    dimensions: text(),
    billOfLading: text({ ...readOnly }),
    releasedAt: timestamp({ ...readOnly }),
    releasedBy: userRef({ readOnly: true }),
    driverName: text(),
    driverSignature: fileRef({ readOnly: true }),
    claimWindowEndsAt: timestamp({ ...readOnly }),
    claims: relationship({ ref: 'Claim.order', many: true, ...readOnly }),
    restockingInvoice: relationship({ ref: 'Invoice', ...readOnly }),
    runnerUpOfferedAt: timestamp({ ...readOnly }),
    cancelReason: text({ ...readOnly }),
    ...trackingFields,
  },
})

export const OrderLine = list({
  access: { operation: { query: anyOf(...sellRead), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    order: relationship({ ref: 'Order.lines' }),
    lineNumber: integer({ defaultValue: 1 }),
    description: text(),
    manufacturer: text(),
    model: text(),
    specs: json({ defaultValue: {} }),
    grade: text(),
    quantity: integer({ defaultValue: 0 }),
    unit: text({ defaultValue: 'each' }),
    unitPriceMinor: integer({ defaultValue: 0 }),
    totalMinor: integer({ defaultValue: 0 }),
    serials: json({ defaultValue: [] }),
    sourceLotLineId: text(),
    ...trackingFields,
  },
})

export const DockAppointment = list({
  access: staffAccess([...sellRead, 'canManageJobs', 'canReceive'], false),
  ui: { hideCreate: true, listView: { initialColumns: ['startsAt', 'facility', 'order', 'job', 'driverName', 'status'] } },
  fields: {
    facility: relationship({ ref: 'Facility' }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp({ validation: { isRequired: true } }),
    order: relationship({ ref: 'Order.dockAppointment' }),
    job: relationship({ ref: 'Job.dockAppointments' }),
    driverName: text(),
    vehicle: text(),
    notes: text(),
    status: choice(['booked', 'arrived', 'done', 'cancelled', 'no_show'], 'booked'),
    ...trackingFields,
  },
})

export const Claim = list({
  access: staffAccess([...sellRead], false),
  ui: { hideCreate: true, labelField: 'claimNumber', listView: { initialColumns: ['claimNumber', 'order', 'company', 'reason', 'status', 'requestedAmountMinor', 'approvedAmountMinor'] } },
  fields: {
    claimNumber: uniqueKey(),
    order: relationship({ ref: 'Order.claims' }),
    company: relationship({ ref: 'BuyerCompany' }),
    openedBy: relationship({ ref: 'User' }),
    reason: choice(['shortage', 'wrong_item', 'misgraded', 'dead_on_arrival', 'damage', 'other'], 'shortage'),
    description: text({ ui: { displayMode: 'textarea' } }),
    lines: json({ defaultValue: [] }),
    photos: relationship({ ref: 'ClaimPhoto.claim', many: true }),
    requestedAmountMinor: integer({ defaultValue: 0 }),
    status: choice(['submitted', 'under_review', 'approved', 'denied', 'resolved'], 'submitted'),
    resolution: choice(['refund', 'partial_refund', 'return_and_refund', 'denied']),
    approvedAmountMinor: integer(),
    resolutionNote: text(),
    resolvedBy: relationship({ ref: 'User' }),
    resolvedAt: timestamp(),
    refund: relationship({ ref: 'Refund.claim' }),
    ...trackingFields,
  },
})

export const ClaimPhoto = list({
  access: staffAccess([...sellRead], 'canManageLots'),
  fields: {
    claim: relationship({ ref: 'Claim.photos' }),
    image: fileRef(),
    caption: text(),
    ...trackingFields,
  },
})

export const sellSideLists = {
  BuyerCompany, BuyerDocument, BuyerMessage, SaleEvent, Lot, LotLine, LotImage, LotAddendum, ManifestImport, ManifestMapping,
  Bid, BidLine, Award, AwardLine, Order, OrderLine, DockAppointment, Claim, ClaimPhoto,
}
