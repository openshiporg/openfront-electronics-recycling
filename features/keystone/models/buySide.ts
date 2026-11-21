import { list, graphql } from '@keystone-6/core'
import { checkbox, calendarDay, decimal, integer, json, relationship, text, timestamp, virtual } from '@keystone-6/core/fields'

import { anyOf, can, denyAll, staffAccess } from '../access'
import { trackingFields } from './trackingFields'
import { addressFields, assignNumber, choice, documentNumber, fileRef, money, readOnly, status, uniqueKey, userRef } from './fields'
import { assertAssetMayChange } from '../lib/assetRules'

export const JOB_STATUSES = ['requested', 'quoted', 'accepted', 'declined', 'scheduled', 'en_route', 'collected', 'received', 'processing', 'completed', 'settled', 'closed', 'cancelled', 'on_hold'] as const
export const ASSET_STATUSES = ['received', 'audited', 'ready_for_sale', 'allocated', 'sold', 'released', 'recycling', 'downstream', 'returned', 'on_hold'] as const
export const SANITIZATION_STATUSES = ['not_required', 'pending', 'passed', 'failed', 'destroyed'] as const
export const SETTLEMENT_STATUSES = ['draft', 'in_review', 'published', 'disputed', 'paid', 'closed'] as const

const jobRead = ['canManageJobs', 'canManageClients', 'canDispatch', 'canCollect', 'canReceive', 'canAuditAssets', 'canSanitize', 'canIssueCertificates', 'canManageSettlements', 'canViewReports'] as const
const processRead = ['canAuditAssets', 'canSanitize', 'canVerifySanitization', 'canIssueCertificates', 'canManageLots', 'canManageJobs', 'canReceive', 'canManageDownstream', 'canViewReports'] as const

export const ClientOrganization = list({
  access: staffAccess([...jobRead, 'canManagePayments'], 'canManageClients', { delete: false }),
  ui: { listView: { initialColumns: ['name', 'industry', 'status', 'accountManager', 'billingEmail'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    legalName: text(),
    industry: text(),
    billingEmail: text(),
    ...addressFields(),
    taxId: text(),
    status: choice(['prospect', 'active', 'inactive'], 'prospect'),
    defaultPricingModel: choice(['fee_for_service', 'revenue_share', 'buyout'], 'fee_for_service'),
    defaultRevenueShareBps: integer({ validation: { min: 0, max: 10000 } }),
    accountManager: relationship({ ref: 'User' }),
    users: relationship({ ref: 'User.clientOrganization', many: true }),
    sites: relationship({ ref: 'ClientSite.organization', many: true }),
    jobs: relationship({ ref: 'Job.organization', many: true }),
    invoices: relationship({ ref: 'Invoice.clientOrganization', many: true }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    ...trackingFields,
  },
})

export const ClientSite = list({
  access: staffAccess([...jobRead], 'canManageClients'),
  ui: { listView: { initialColumns: ['name', 'organization', 'city', 'contactName', 'hasDock'] } },
  fields: {
    organization: relationship({ ref: 'ClientOrganization.sites' }),
    name: text({ validation: { isRequired: true } }),
    ...addressFields(),
    contactName: text(),
    contactPhone: text(),
    hasDock: checkbox({ defaultValue: false }),
    needsLiftgate: checkbox({ defaultValue: false }),
    accessNotes: text({ ui: { displayMode: 'textarea' } }),
    hours: text(),
    jobs: relationship({ ref: 'Job.site', many: true }),
    ...trackingFields,
  },
})

function sumDecimal(values: Array<{ toString(): string } | null | undefined>) {
  return values.reduce<number>((sum, v) => sum + (v == null ? 0 : Number(v.toString())), 0)
}

export const Job = list({
  access: staffAccess([...jobRead], ['canManageJobs', 'canManageClients', 'canDispatch'], { delete: false }),
  hooks: { resolveInput: assignNumber('job', 'jobNumber') },
  ui: { labelField: 'jobNumber', listView: { initialColumns: ['jobNumber', 'type', 'status', 'organization', 'scheduledDate', 'driver'] } },
  fields: {
    jobNumber: documentNumber(),
    type: choice(['pickup', 'drop_off'], 'pickup'),
    status: status(JOB_STATUSES, 'requested'),
    holdFromStatus: text({ ...readOnly }),
    organization: relationship({ ref: 'ClientOrganization.jobs' }),
    site: relationship({ ref: 'ClientSite.jobs' }),
    facility: relationship({ ref: 'Facility' }),
    requestedBy: userRef({ readOnly: true }),
    contactName: text(),
    contactEmail: text(),
    contactPhone: text(),
    siteAddress: json({ ui: { description: 'Address given on the request (snapshot).' } }),
    accessDetails: json({ defaultValue: {} }),
    requestedDates: json({ defaultValue: [] }),
    hasDataBearing: checkbox({ defaultValue: false }),
    servicesRequested: json({ defaultValue: [] }),
    estimateLines: relationship({ ref: 'JobEstimateLine.job', many: true }),
    photos: relationship({ ref: 'JobPhoto.job', many: true }),
    pricingModel: choice(['fee_for_service', 'revenue_share', 'buyout']),
    revenueShareBps: integer({ validation: { min: 0, max: 10000 } }),
    buyoutAmountMinor: integer({ validation: { min: 0 } }),
    serviceLines: relationship({ ref: 'JobServiceLine.job', many: true }),
    quoteSentAt: timestamp({ ...readOnly }),
    quoteAcceptedAt: timestamp({ ...readOnly }),
    quoteAcceptedBy: userRef({ readOnly: true }),
    quoteSignatureName: text({ ...readOnly }),
    quoteTermsVersion: text({ ...readOnly }),
    declineReason: text({ ...readOnly }),
    cancelReason: text({ ...readOnly }),
    scheduledDate: calendarDay(),
    windowStart: text({ ui: { description: 'HH:MM' } }),
    windowEnd: text({ ui: { description: 'HH:MM' } }),
    driver: relationship({ ref: 'User' }),
    vehicle: text(),
    collectedAt: timestamp({ ...readOnly }),
    clientSignerName: text({ ...readOnly }),
    clientSignature: fileRef({ readOnly: true }),
    receivedAt: timestamp({ ...readOnly }),
    completedAt: timestamp({ ...readOnly }),
    containers: relationship({ ref: 'Container.job', many: true }),
    assets: relationship({ ref: 'Asset.job', many: true }),
    commodityLines: relationship({ ref: 'CommodityLine.job', many: true }),
    custodyEvents: relationship({ ref: 'CustodyEvent.job', many: true, ...readOnly }),
    certificates: relationship({ ref: 'Certificate.job', many: true, ...readOnly }),
    settlement: relationship({ ref: 'Settlement.job', ...readOnly }),
    invoices: relationship({ ref: 'Invoice.job', many: true, ...readOnly }),
    dockAppointments: relationship({ ref: 'DockAppointment.job', many: true }),
    internalNotes: text({ ui: { displayMode: 'textarea' } }),
    totalWeight: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item, _args, context) {
          const containers = await context.prisma.container.findMany({ where: { jobId: item.id }, select: { grossWeight: true, tareWeight: true } })
          return containers.reduce((sum: number, c: any) => sum + Math.max(0, Number(c.grossWeight ?? 0) - Number(c.tareWeight ?? 0)), 0)
        },
      }),
    }),
    assetCount: virtual({
      field: graphql.field({ type: graphql.Int, resolve: (item, _a, context) => context.prisma.asset.count({ where: { jobId: item.id } }) }),
    }),
    dataBearingCount: virtual({
      field: graphql.field({ type: graphql.Int, resolve: (item, _a, context) => context.prisma.asset.count({ where: { jobId: item.id, isDataBearing: true } }) }),
    }),
    sanitizedCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve: (item, _a, context) => context.prisma.asset.count({ where: { jobId: item.id, isDataBearing: true, sanitizationStatus: { in: ['passed', 'destroyed'] } } }),
      }),
    }),
    ...trackingFields,
  },
})

export const JobEstimateLine = list({
  access: staffAccess([...jobRead], ['canManageJobs', 'canManageClients']),
  fields: {
    job: relationship({ ref: 'Job.estimateLines' }),
    category: relationship({ ref: 'MaterialCategory' }),
    quantity: integer({ defaultValue: 1, validation: { min: 0 } }),
    unit: choice(['units', 'pallets', 'lb', 'kg'], 'units'),
    notes: text(),
    ...trackingFields,
  },
})

export const JobServiceLine = list({
  access: staffAccess([...jobRead], ['canManageJobs', 'canManageClients']),
  ui: { listView: { initialColumns: ['job', 'kind', 'description', 'quantity', 'unitPriceMinor', 'totalMinor'] } },
  hooks: {
    resolveInput: async ({ resolvedData, item }) => {
      const quantity = Number((resolvedData.quantity ?? item?.quantity ?? 1).toString())
      const unit = Number(resolvedData.unitPriceMinor ?? item?.unitPriceMinor ?? 0)
      return { ...resolvedData, totalMinor: Math.round(quantity * unit) }
    },
  },
  fields: {
    job: relationship({ ref: 'Job.serviceLines' }),
    description: text({ validation: { isRequired: true } }),
    quantity: decimal({ precision: 12, scale: 3, defaultValue: '1', validation: { isRequired: true } }),
    unitPriceMinor: money(),
    totalMinor: integer({ defaultValue: 0, ...readOnly }),
    kind: choice(['pickup', 'audit', 'wipe', 'shred', 'recycling_fee', 'other'], 'other'),
    ...trackingFields,
  },
})

export const JobPhoto = list({
  access: staffAccess([...jobRead], ['canManageJobs', 'canCollect', 'canReceive']),
  fields: {
    job: relationship({ ref: 'Job.photos' }),
    image: fileRef(),
    caption: text(),
    stage: choice(['request', 'collection', 'receiving'], 'request'),
    ...trackingFields,
  },
})

export const Container = list({
  access: staffAccess([...jobRead], ['canCollect', 'canReceive', 'canManageJobs'], { delete: false }),
  ui: { labelField: 'label', listView: { initialColumns: ['label', 'job', 'type', 'sealNumber', 'status', 'grossWeight', 'tareWeight'] } },
  fields: {
    job: relationship({ ref: 'Job.containers' }),
    label: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    type: choice(['pallet', 'gaylord', 'box', 'cage', 'tote'], 'pallet'),
    sealNumber: text(),
    receivedSealNumber: text({ ...readOnly }),
    sealVerified: checkbox({ defaultValue: false, ...readOnly }),
    sealException: text({ ...readOnly }),
    sealExceptionResolution: text({ ...readOnly }),
    itemCountDeclared: integer({ validation: { min: 0 } }),
    grossWeight: decimal({ precision: 12, scale: 2 }),
    tareWeight: decimal({ precision: 12, scale: 2 }),
    netWeight: virtual({
      field: graphql.field({
        type: graphql.Float,
        resolve: (item: any) => (item.grossWeight == null ? null : Math.max(0, Number(item.grossWeight) - Number(item.tareWeight ?? 0))),
      }),
    }),
    status: status(['collected', 'received', 'processed', 'missing', 'unexpected'], 'collected'),
    locationCode: text(),
    assets: relationship({ ref: 'Asset.container', many: true }),
    custodyEvents: relationship({ ref: 'CustodyEvent.container', many: true, ...readOnly }),
    ...trackingFields,
  },
})

export const CustodyEvent = list({
  access: { operation: { query: anyOf(...jobRead, 'canManageLots', 'canManageDownstream'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['occurredAt', 'type', 'job', 'container', 'asset', 'actorName', 'signerName'] } },
  fields: {
    job: relationship({ ref: 'Job.custodyEvents' }),
    container: relationship({ ref: 'Container.custodyEvents' }),
    asset: relationship({ ref: 'Asset.custodyEvents' }),
    type: choice(['collected', 'handed_to_carrier', 'received', 'seal_verified', 'seal_exception', 'moved', 'audited', 'sanitized', 'verified', 'allocated', 'released_to_buyer', 'shipped_downstream', 'returned_to_client', 'hold_placed', 'hold_released'], 'moved'),
    actor: relationship({ ref: 'User' }),
    actorName: text(),
    occurredAt: timestamp({ validation: { isRequired: true }, defaultValue: { kind: 'now' } }),
    facility: relationship({ ref: 'Facility' }),
    locationText: text(),
    signerName: text(),
    signature: fileRef(),
    notes: text(),
    ...trackingFields,
  },
})

export const Asset = list({
  access: staffAccess([...processRead], ['canAuditAssets', 'canManageLots'], { delete: false }),
  ui: { labelField: 'assetNumber', listView: { initialColumns: ['assetNumber', 'serialNumber', 'manufacturer', 'model', 'status', 'sanitizationStatus', 'disposition', 'job'] } },
  hooks: {
    resolveInput: assignNumber('asset', 'assetNumber'),
    validate: {
      update: async (args) => assertAssetMayChange(args as any),
      create: async (args) => assertAssetMayChange(args as any),
    },
  },
  fields: {
    assetNumber: documentNumber(),
    job: relationship({ ref: 'Job.assets' }),
    container: relationship({ ref: 'Container.assets' }),
    organization: relationship({ ref: 'ClientOrganization', ...readOnly }),
    parent: relationship({ ref: 'Asset.children' }),
    children: relationship({ ref: 'Asset.parent', many: true }),
    category: relationship({ ref: 'MaterialCategory' }),
    manufacturer: text(),
    model: text(),
    partNumber: text(),
    serialNumber: text({ isIndexed: true }),
    clientAssetTag: text({ isIndexed: true }),
    specs: json({ defaultValue: {} }),
    isDataBearing: checkbox({ defaultValue: false }),
    cosmeticGrade: relationship({ ref: 'GradeDefinition' }),
    functionalGrade: relationship({ ref: 'GradeDefinition' }),
    testNotes: text({ ui: { displayMode: 'textarea' } }),
    weight: decimal({ precision: 12, scale: 2 }),
    photos: relationship({ ref: 'AssetPhoto.asset', many: true }),
    status: status(ASSET_STATUSES, 'received'),
    holdFromStatus: text({ ...readOnly }),
    sanitizationStatus: status(SANITIZATION_STATUSES, 'not_required'),
    disposition: select_disposition(),
    holdReason: text({ ...readOnly }),
    storageRemoved: checkbox({ defaultValue: false }),
    fairMarketValueMinor: integer({ validation: { min: 0 } }),
    lotLine: relationship({ ref: 'LotLine.assets', ...readOnly }),
    soldPriceMinor: integer({ validation: { min: 0 }, ...readOnly }),
    outboundLine: relationship({ ref: 'OutboundShipmentLine.assets', ...readOnly }),
    sanitizationRecords: relationship({ ref: 'SanitizationRecord.asset', many: true, ...readOnly }),
    custodyEvents: relationship({ ref: 'CustodyEvent.asset', many: true, ...readOnly }),
    locationCode: text(),
    auditedBy: userRef({ readOnly: true }),
    auditedAt: timestamp({ ...readOnly }),
    ...trackingFields,
  },
})

function select_disposition() {
  return status(['undecided', 'resale', 'parts', 'recycle', 'return', 'hold'], 'undecided')
}

export const AssetPhoto = list({
  access: staffAccess([...processRead], ['canAuditAssets']),
  fields: {
    asset: relationship({ ref: 'Asset.photos' }),
    image: fileRef(),
    caption: text(),
    ...trackingFields,
  },
})

export const SanitizationRecord = list({
  access: { operation: { query: anyOf(...processRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['asset', 'method', 'technique', 'tool', 'result', 'operator', 'verifiedBy', 'completedAt'] } },
  fields: {
    asset: relationship({ ref: 'Asset.sanitizationRecords' }),
    method: choice(['clear', 'purge', 'destroy'], 'purge'),
    technique: choice(['overwrite', 'block_erase', 'crypto_erase', 'secure_erase', 'degauss', 'shred', 'crush', 'disintegrate'], 'overwrite'),
    standard: text({ defaultValue: 'NIST SP 800-88' }),
    tool: text(),
    toolVersion: text(),
    reportReference: text(),
    reportFile: fileRef(),
    startedAt: timestamp(),
    completedAt: timestamp(),
    result: choice(['passed', 'failed'], 'passed'),
    failureReason: text(),
    operator: relationship({ ref: 'User' }),
    verifiedBy: relationship({ ref: 'User' }),
    verifiedAt: timestamp(),
    verificationNote: text(),
    witnessName: text(),
    importBatch: relationship({ ref: 'ErasureImport.records' }),
    ...trackingFields,
  },
})

export const ErasureImport = list({
  access: { operation: { query: anyOf(...processRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ['createdAt', 'tool', 'status', 'rowCount', 'matchedCount', 'uploadedBy'] } },
  fields: {
    file: fileRef(),
    originalFilename: text(),
    tool: text(),
    status: status(['uploaded', 'validated', 'committed', 'discarded'], 'uploaded'),
    rowCount: integer({ defaultValue: 0 }),
    matchedCount: integer({ defaultValue: 0 }),
    unmatched: json({ defaultValue: [] }),
    rows: json({ defaultValue: [] }),
    records: relationship({ ref: 'SanitizationRecord.importBatch', many: true }),
    uploadedBy: relationship({ ref: 'User' }),
    ...trackingFields,
  },
})

export const CommodityLine = list({
  access: staffAccess([...processRead], ['canAuditAssets', 'canReceive', 'canManageDownstream']),
  ui: { listView: { initialColumns: ['job', 'category', 'weight', 'outboundLine', 'notes'] } },
  fields: {
    job: relationship({ ref: 'Job.commodityLines' }),
    category: relationship({ ref: 'MaterialCategory' }),
    weight: decimal({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: '0' }),
    notes: text(),
    outboundLine: relationship({ ref: 'OutboundShipmentLine.commodityLines', ...readOnly }),
    ...trackingFields,
  },
})

export const Certificate = list({
  access: { operation: { query: anyOf(...jobRead, 'canVerifySanitization'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, labelField: 'certificateNumber', listView: { initialColumns: ['certificateNumber', 'type', 'job', 'organization', 'status', 'issuedAt'] } },
  fields: {
    certificateNumber: uniqueKey(),
    type: choice(['data_destruction', 'recycling'], 'data_destruction'),
    job: relationship({ ref: 'Job.certificates' }),
    organization: relationship({ ref: 'ClientOrganization' }),
    issuedAt: timestamp(),
    issuedBy: relationship({ ref: 'User' }),
    verificationCode: text({ isIndexed: 'unique', db: { isNullable: true }, access: { read: can('canIssueCertificates'), create: denyAll, update: denyAll } }),
    snapshot: json(),
    pdf: fileRef(),
    status: choice(['issued', 'revoked'], 'issued'),
    revokedReason: text(),
    revokedAt: timestamp(),
    replaces: relationship({ ref: 'Certificate' }),
    ...trackingFields,
  },
})

export const Settlement = list({
  access: staffAccess(['canManageSettlements', 'canManageClients', 'canManagePayments', 'canViewReports'], 'canManageSettlements', { create: false, delete: false }),
  ui: { labelField: 'settlementNumber', listView: { initialColumns: ['settlementNumber', 'job', 'organization', 'status', 'netMinor', 'publishedAt'] } },
  fields: {
    settlementNumber: documentNumber(),
    job: relationship({ ref: 'Job.settlement', ...readOnly }),
    organization: relationship({ ref: 'ClientOrganization', ...readOnly }),
    status: status(SETTLEMENT_STATUSES, 'draft'),
    lines: relationship({ ref: 'SettlementLine.settlement', many: true, ...readOnly }),
    feesTotalMinor: integer({ defaultValue: 0, ...readOnly }),
    clientShareTotalMinor: integer({ defaultValue: 0, ...readOnly }),
    netMinor: integer({ defaultValue: 0, ...readOnly, ui: { ...readOnly.ui, description: 'Positive: owed to the client. Negative: owed by the client.' } }),
    publishedAt: timestamp({ ...readOnly }),
    disputeNote: text({ ...readOnly }),
    disputeRecordedBy: userRef({ readOnly: true }),
    invoice: relationship({ ref: 'Invoice.settlement', ...readOnly }),
    payoutMethod: choice(['cheque', 'ach', 'wire', 'credit']),
    payoutReference: text({ ...readOnly }),
    paidAt: timestamp({ ...readOnly }),
    pdf: fileRef({ readOnly: true }),
    ...trackingFields,
  },
})

export const SettlementLine = list({
  access: { operation: { query: anyOf('canManageSettlements', 'canManageClients', 'canManagePayments', 'canViewReports'), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    settlement: relationship({ ref: 'Settlement.lines' }),
    kind: choice(['service_fee', 'asset_value', 'commodity_value', 'adjustment'], 'service_fee'),
    description: text(),
    asset: relationship({ ref: 'Asset' }),
    quantity: decimal({ precision: 12, scale: 3, defaultValue: '1' }),
    grossMinor: integer({ defaultValue: 0 }),
    clientShareBps: integer({ defaultValue: 0 }),
    clientAmountMinor: integer({ defaultValue: 0 }),
    ...trackingFields,
  },
})

export const DownstreamVendor = list({
  access: staffAccess(['canManageDownstream', 'canIssueCertificates', 'canViewReports'], 'canManageDownstream'),
  ui: { listView: { initialColumns: ['name', 'countryCode', 'status', 'approvedOn', 'reviewDueOn'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    ...addressFields(),
    contactName: text(),
    contactEmail: text(),
    certifications: json({ defaultValue: [], ui: { description: '[{ "name": "R2v3", "number": "…", "expiresOn": "2027-06-30" }]' } }),
    approvedCategories: relationship({ ref: 'MaterialCategory', many: true }),
    status: choice(['pending', 'approved', 'suspended'], 'pending'),
    approvedOn: calendarDay(),
    reviewDueOn: calendarDay(),
    dueDiligenceFile: fileRef(),
    notes: text({ ui: { displayMode: 'textarea' } }),
    shipments: relationship({ ref: 'OutboundShipment.vendor', many: true }),
    ...trackingFields,
  },
})

export const OutboundShipment = list({
  access: staffAccess(['canManageDownstream', 'canViewReports'], 'canManageDownstream', { delete: false }),
  hooks: { resolveInput: assignNumber('shipment', 'shipmentNumber') },
  ui: { labelField: 'shipmentNumber', listView: { initialColumns: ['shipmentNumber', 'vendor', 'status', 'shippedAt', 'carrier', 'receivedWeight'] } },
  fields: {
    shipmentNumber: documentNumber(),
    vendor: relationship({ ref: 'DownstreamVendor.shipments' }),
    facility: relationship({ ref: 'Facility' }),
    status: status(['draft', 'shipped', 'receipt_confirmed', 'closed'], 'draft'),
    shippedAt: timestamp({ ...readOnly }),
    carrier: text(),
    billOfLading: text(),
    lines: relationship({ ref: 'OutboundShipmentLine.shipment', many: true }),
    totalWeight: virtual({
      field: graphql.field({
        type: graphql.Float,
        async resolve(item, _a, context) {
          const lines = await context.prisma.outboundShipmentLine.findMany({ where: { shipmentId: item.id }, select: { weight: true } })
          return sumDecimal(lines.map((l: any) => l.weight))
        },
      }),
    }),
    receivedWeight: decimal({ precision: 12, scale: 2, ...readOnly }),
    receiptConfirmedAt: timestamp({ ...readOnly }),
    receiptDocument: fileRef({ readOnly: true }),
    destinationCountry: text(),
    ...trackingFields,
  },
})

export const OutboundShipmentLine = list({
  access: staffAccess(['canManageDownstream', 'canViewReports'], 'canManageDownstream'),
  fields: {
    shipment: relationship({ ref: 'OutboundShipment.lines' }),
    category: relationship({ ref: 'MaterialCategory' }),
    weight: decimal({ precision: 12, scale: 2, defaultValue: '0', validation: { isRequired: true } }),
    containerCount: integer({ defaultValue: 0 }),
    assets: relationship({ ref: 'Asset.outboundLine', many: true }),
    commodityLines: relationship({ ref: 'CommodityLine.outboundLine', many: true }),
    ...trackingFields,
  },
})

export const buySideLists = {
  ClientOrganization, ClientSite, Job, JobEstimateLine, JobServiceLine, JobPhoto, Container, CustodyEvent,
  Asset, AssetPhoto, SanitizationRecord, ErasureImport, CommodityLine, Certificate, Settlement, SettlementLine,
  DownstreamVendor, OutboundShipment, OutboundShipmentLine,
}
