import { list, graphql } from '@keystone-6/core'
import { checkbox, decimal, integer, json, relationship, text, timestamp, virtual } from '@keystone-6/core/fields'

import { anyOf, can, denyAll, staffAccess } from '../access'
import { trackingFields } from './trackingFields'
import { choice, fileRef, readOnly, status, uniqueKey } from './fields'

const moneyRead = ['canManagePayments', 'canRefund', 'canManageSettlements', 'canManageLots', 'canAwardLots', 'canManageClients', 'canViewReports'] as const
export const INVOICE_STATUSES = ['open', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'void'] as const

export const Invoice = list({
  access: staffAccess([...moneyRead], false),
  ui: { hideCreate: true, hideDelete: true, labelField: 'invoiceNumber', listView: { initialColumns: ['invoiceNumber', 'kind', 'buyerCompany', 'clientOrganization', 'status', 'totalMinor', 'paidMinor', 'dueAt'] } },
  fields: {
    invoiceNumber: uniqueKey(),
    kind: choice(['lot_sale', 'service', 'settlement', 'restocking', 'storage'], 'lot_sale'),
    buyerCompany: relationship({ ref: 'BuyerCompany.invoices' }),
    clientOrganization: relationship({ ref: 'ClientOrganization.invoices' }),
    order: relationship({ ref: 'Order.invoice' }),
    job: relationship({ ref: 'Job.invoices' }),
    settlement: relationship({ ref: 'Settlement.invoice' }),
    status: status(INVOICE_STATUSES, 'open'),
    lines: relationship({ ref: 'InvoiceLine.invoice', many: true }),
    subtotalMinor: integer({ defaultValue: 0 }),
    premiumMinor: integer({ defaultValue: 0 }),
    taxMinor: integer({ defaultValue: 0 }),
    freightMinor: integer({ defaultValue: 0 }),
    feeMinor: integer({ defaultValue: 0 }),
    otherMinor: integer({ defaultValue: 0 }),
    totalMinor: integer({ defaultValue: 0 }),
    paidMinor: integer({ defaultValue: 0 }),
    refundedMinor: integer({ defaultValue: 0 }),
    balanceMinor: virtual({
      field: graphql.field({ type: graphql.Int, resolve: (item: any) => Math.max(0, (item.totalMinor ?? 0) - (item.paidMinor ?? 0)) }),
    }),
    currencyCode: text({ defaultValue: 'USD' }),
    issuedAt: timestamp(),
    dueAt: timestamp(),
    isOverdue: checkbox({ defaultValue: false }),
    remindedAt: timestamp(),
    paidAt: timestamp(),
    voidReason: text(),
    waived: checkbox({ defaultValue: false }),
    taxExemptReason: text(),
    billTo: json({ defaultValue: {} }),
    payments: relationship({ ref: 'Payment.invoice', many: true }),
    paymentSessions: relationship({ ref: 'PaymentSession.invoice', many: true }),
    refunds: relationship({ ref: 'Refund.invoice', many: true }),
    pdf: fileRef({ readOnly: true }),
    ...trackingFields,
  },
})

export const InvoiceLine = list({
  access: { operation: { query: anyOf(...moneyRead), create: denyAll, update: denyAll, delete: denyAll } },
  fields: {
    invoice: relationship({ ref: 'Invoice.lines' }),
    kind: choice(['item', 'premium', 'tax', 'freight', 'card_fee', 'storage', 'service', 'adjustment'], 'item'),
    description: text(),
    quantity: decimal({ precision: 12, scale: 3, defaultValue: '1' }),
    unitPriceMinor: integer({ defaultValue: 0 }),
    totalMinor: integer({ defaultValue: 0 }),
    paymentSessionId: text({ ui: { description: 'Card fee lines belong to one payment session.' } }),
    ...trackingFields,
  },
})

export const PaymentProvider = list({
  access: staffAccess(['canManagePayments', 'canManageSettings'], ['canManageSettings', 'canManagePayments'], { delete: false }),
  ui: { listView: { initialColumns: ['name', 'code', 'isInstalled'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({
      isIndexed: 'unique',
      validation: { isRequired: true, match: { regex: /^pp_[a-zA-Z0-9-_]+$/, explanation: 'Payment provider code must start with "pp_".' } },
    }),
    isInstalled: checkbox({ defaultValue: true }),
    credentials: json({ defaultValue: {}, access: { read: denyAll, create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    metadata: json({ defaultValue: {} }),
    createPaymentFunction: text({ defaultValue: 'manual', validation: { isRequired: true } }),
    capturePaymentFunction: text({ defaultValue: 'manual', validation: { isRequired: true } }),
    refundPaymentFunction: text({ defaultValue: 'manual', validation: { isRequired: true } }),
    getPaymentStatusFunction: text({ defaultValue: 'manual', validation: { isRequired: true } }),
    generatePaymentLinkFunction: text({ defaultValue: 'manual', validation: { isRequired: true } }),
    handleWebhookFunction: text({ defaultValue: 'manual', validation: { isRequired: true } }),
    paymentSessions: relationship({ ref: 'PaymentSession.paymentProvider', many: true, ...readOnly }),
    ...trackingFields,
  },
})

export const PaymentSession = list({
  access: { operation: { query: anyOf('canManagePayments', 'canRefund'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ['invoice', 'method', 'status', 'amountMinor', 'providerPaymentId', 'createdAt'] } },
  fields: {
    invoice: relationship({ ref: 'Invoice.paymentSessions' }),
    paymentProvider: relationship({ ref: 'PaymentProvider.paymentSessions' }),
    method: choice(['card', 'bank_transfer'], 'card'),
    openKey: uniqueKey({ hidden: true }),
    idempotencyKeyHash: uniqueKey({ hidden: true }),
    status: choice(['pending', 'requires_action', 'captured', 'failed', 'canceled', 'unknown'], 'pending'),
    amountMinor: integer({ defaultValue: 0 }),
    feeMinor: integer({ defaultValue: 0 }),
    currencyCode: text({ defaultValue: 'USD' }),
    providerPaymentId: text({ isIndexed: true }),
    clientSecret: text({ access: { read: denyAll }, ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' } } }),
    capturedAt: timestamp(),
    canceledAt: timestamp(),
    lastError: text(),
    createdBy: relationship({ ref: 'User' }),
    metadata: json({ defaultValue: {} }),
    payment: relationship({ ref: 'Payment.session' }),
    ...trackingFields,
  },
})

export const PaymentWebhookEvent = list({
  access: { operation: { query: can('canManagePayments'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ['providerCode', 'providerEventId', 'eventType', 'processedAt'] } },
  fields: {
    replayKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: denyAll } }),
    providerCode: text({ validation: { isRequired: true } }),
    providerEventId: text({ validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true } }),
    payloadHash: text({ validation: { isRequired: true }, access: { read: denyAll } }),
    processedAt: timestamp({ validation: { isRequired: true } }),
    outcome: text(),
    ...trackingFields,
  },
})

export const Payment = list({
  access: { operation: { query: anyOf(...moneyRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ['invoice', 'method', 'amountMinor', 'status', 'bankReference', 'reportedAt', 'confirmedAt'] } },
  fields: {
    invoice: relationship({ ref: 'Invoice.payments' }),
    session: relationship({ ref: 'PaymentSession.payment' }),
    method: choice(['card', 'ach', 'wire', 'cheque', 'cash'], 'wire'),
    amountMinor: integer({ defaultValue: 0 }),
    status: choice(['reported', 'confirmed', 'rejected', 'captured', 'refunded', 'partially_refunded'], 'reported'),
    providerReference: uniqueKey(),
    bankReference: text(),
    paidOn: text(),
    reportedBy: relationship({ ref: 'User' }),
    reportedAt: timestamp(),
    confirmedBy: relationship({ ref: 'User' }),
    confirmedAt: timestamp(),
    rejectionReason: text(),
    refundedMinor: integer({ defaultValue: 0 }),
    refunds: relationship({ ref: 'Refund.payment', many: true }),
    ...trackingFields,
  },
})

export const Refund = list({
  access: { operation: { query: anyOf(...moneyRead), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, listView: { initialColumns: ['invoice', 'payment', 'amountMinor', 'status', 'reason', 'createdAt'] } },
  fields: {
    payment: relationship({ ref: 'Payment.refunds' }),
    invoice: relationship({ ref: 'Invoice.refunds' }),
    amountMinor: integer({ defaultValue: 0 }),
    reason: text(),
    status: choice(['pending', 'succeeded', 'failed', 'unknown'], 'pending'),
    providerReference: text(),
    method: choice(['card', 'wire', 'ach', 'cheque', 'cash'], 'card'),
    createdBy: relationship({ ref: 'User' }),
    claim: relationship({ ref: 'Claim.refund' }),
    idempotencyKey: uniqueKey({ hidden: true }),
    ...trackingFields,
  },
})

export const Notification = list({
  access: { operation: { query: can('canAccessDashboard'), create: denyAll, update: denyAll, delete: can('canManageSettings') } },
  ui: { hideCreate: true, listView: { initialColumns: ['createdAt', 'user', 'type', 'title', 'emailStatus'] } },
  fields: {
    user: relationship({ ref: 'User' }),
    type: text({ validation: { isRequired: true } }),
    title: text({ validation: { isRequired: true } }),
    body: text({ ui: { displayMode: 'textarea' } }),
    link: text(),
    readAt: timestamp(),
    emailStatus: choice(['not_sent', 'queued', 'sent', 'failed', 'skipped'], 'not_sent'),
    emailError: text(),
    dedupeKey: uniqueKey(),
    ...trackingFields,
  },
})

export const AuditEvent = list({
  access: { operation: { query: anyOf('canViewReports', 'canManageSettings', 'canIssueCertificates'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['occurredAt', 'actorLabel', 'action', 'entityType', 'entityId', 'reason'] } },
  fields: {
    actor: relationship({ ref: 'User' }),
    actorLabel: text(),
    action: text({ validation: { isRequired: true } }),
    entityType: text({ validation: { isRequired: true } }),
    entityId: text({ isIndexed: true }),
    before: json(),
    after: json(),
    reason: text(),
    ipAddress: text(),
    occurredAt: timestamp({ defaultValue: { kind: 'now' }, validation: { isRequired: true } }),
    ...trackingFields,
  },
})

export const CommandReceipt = list({
  access: { operation: { query: can('canViewReports'), create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, listView: { initialColumns: ['eventKey', 'eventType', 'aggregateType', 'occurredAt'] } },
  fields: {
    eventKey: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    eventType: text({ validation: { isRequired: true } }),
    schemaVersion: integer({ validation: { isRequired: true }, defaultValue: 1 }),
    aggregateType: text({ validation: { isRequired: true } }),
    aggregateId: text({ validation: { isRequired: true } }),
    payload: json({ access: { read: can('canManageSettings') } }),
    result: json({ access: { read: can('canManageSettings') } }),
    actorId: text(),
    payloadHash: text({ validation: { isRequired: true } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    ...trackingFields,
  },
})

export const moneyLists = { Invoice, InvoiceLine, PaymentProvider, PaymentSession, PaymentWebhookEvent, Payment, Refund, Notification, AuditEvent, CommandReceipt }
