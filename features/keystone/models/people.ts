import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { checkbox, integer, json, password, relationship, select, text, timestamp, calendarDay } from '@keystone-6/core/fields'
import { document } from '@keystone-6/fields-document'

import { ROLE_PERMISSIONS, can, denyAll, hasPermission, isSignedIn, permissions, rules, staffAccess } from '../access'
import { trackingFields } from './trackingFields'
import { addressFields, choice, fileRef, money, readOnly } from './fields'

export const User = list({
  access: {
    operation: {
      ...allOperations(isSignedIn),
      create: anyPeopleManager,
      delete: permissions.canManageUsers,
    },
    filter: { query: rules.canReadPeople, update: rules.canUpdatePeople },
    item: { create: portalUserCreate },
  },
  ui: {
    hideCreate: (args) => !permissions.canManageUsers(args),
    hideDelete: (args) => !permissions.canManageUsers(args),
    listView: { initialColumns: ['name', 'email', 'kind', 'role', 'buyerCompany', 'clientOrganization', 'isActive'] },
    itemView: {
      defaultFieldMode: ({ session, item }) =>
        hasPermission(session, 'canManageUsers') || session?.itemId === item?.id ? 'edit' : 'read',
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) => hasPermission(session, 'canManageUsers') || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    phone: text(),
    role: relationship({
      ref: 'Role.assignedTo',
      access: { create: permissions.canManageUsers, update: permissions.canManageUsers },
    }),
    kind: select({
      type: 'enum',
      options: [
        { label: 'Staff', value: 'staff' },
        { label: 'Buyer', value: 'buyer' },
        { label: 'Client', value: 'client' },
      ],
      defaultValue: 'staff',
      validation: { isRequired: true },
      access: { create: anyPeopleManager, update: permissions.canManageUsers },
    }),
    buyerCompany: relationship({
      ref: 'BuyerCompany.users',
      access: { create: anyBuyerManager, update: anyBuyerManager },
    }),
    buyerRole: select({
      type: 'enum',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Bidder', value: 'bidder' },
      ],
      access: { create: anyBuyerManager, update: anyBuyerManager },
    }),
    clientOrganization: relationship({
      ref: 'ClientOrganization.users',
      access: { create: anyClientManager, update: anyClientManager },
    }),
    clientRole: select({
      type: 'enum',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Viewer', value: 'viewer' },
      ],
      access: { create: anyClientManager, update: anyClientManager },
    }),
    isActive: checkbox({ defaultValue: true, access: { create: permissions.canManageUsers, update: anyPeopleManager } }),
    acceptedTermsVersion: text({ ...readOnly }),
    acceptedTermsAt: timestamp({ ...readOnly }),
    notificationPrefs: json({ defaultValue: {} }),
    onboardingStatus: select({
      type: 'enum',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
      access: { create: permissions.canManageOnboarding, update: permissions.canManageOnboarding },
    }),
    passwordResetToken: password({ access: { read: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' } } }),
    passwordResetIssuedAt: timestamp({ access: { read: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' } } }),
    passwordResetRedeemedAt: timestamp({ access: { read: denyAll, update: denyAll }, ui: { itemView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' } } }),
    ...trackingFields,
  },
})

function anyBuyerManager(args: { session?: any }) {
  return hasPermission(args.session, 'canManageUsers') || hasPermission(args.session, 'canManageBuyers')
}
function anyClientManager(args: { session?: any }) {
  return hasPermission(args.session, 'canManageUsers') || hasPermission(args.session, 'canManageClients')
}
function anyPeopleManager(args: { session?: any }) {
  return anyBuyerManager(args) || anyClientManager(args)
}
/** S3/T1: a buyer or client manager may add only a portal user of that kind, tied to a company or organisation, with no staff role. */
function portalUserCreate({ session, inputData }: { session?: any; inputData: any }) {
  if (hasPermission(session, 'canManageUsers')) return true
  if (inputData.role) return false
  if (inputData.kind === 'buyer') return hasPermission(session, 'canManageBuyers') && Boolean(inputData.buyerCompany) && !inputData.clientOrganization
  if (inputData.kind === 'client') return hasPermission(session, 'canManageClients') && Boolean(inputData.clientOrganization) && !inputData.buyerCompany
  return false
}

const permissionFields = Object.fromEntries(
  ROLE_PERMISSIONS.map((permission) => [permission, checkbox({ defaultValue: false })])
)

export const Role = list({
  access: {
    operation: {
      query: isSignedIn,
      create: permissions.canManageUsers,
      update: permissions.canManageUsers,
      delete: permissions.canManageUsers,
    },
  },
  ui: {
    hideCreate: (args) => !permissions.canManageUsers(args),
    hideDelete: (args) => !permissions.canManageUsers(args),
    listView: { initialColumns: ['name', 'assignedTo'] },
  },
  fields: {
    name: text({ validation: { isRequired: true }, isIndexed: 'unique' }),
    ...permissionFields,
    assignedTo: relationship({ ref: 'User.role', many: true, ui: { itemView: { fieldMode: 'read' } } }),
    ...trackingFields,
  },
})

const settingsAccess = {
  operation: {
    query: can('canAccessDashboard'),
    create: can('canManageSettings'),
    update: can('canManageSettings'),
    delete: denyAll,
  },
}

export const StoreSettings = list({
  isSingleton: true,
  access: settingsAccess,
  graphql: { plural: 'StoreSettingsItems' },
  fields: {
    businessName: text({ validation: { isRequired: true }, defaultValue: 'Electronics Recycling' }),
    legalName: text(),
    logo: fileRef(),
    tagline: text(),
    supportEmail: text(),
    supportPhone: text(),
    timezone: text({ defaultValue: 'America/New_York', validation: { isRequired: true } }),
    currencyCode: text({ defaultValue: 'USD', validation: { isRequired: true } }),
    weightUnit: choice(['lb', 'kg'], 'lb'),
    publicLotVisibility: choice(['teaser', 'full', 'hidden'], 'teaser'),
    defaultBidFormat: choice(['sealed_bid', 'open_auction', 'fixed_price'], 'sealed_bid'),
    defaultBidBasis: choice(['lot_total', 'per_line'], 'lot_total'),
    defaultAwardMode: choice(['manual', 'auto'], 'manual'),
    softCloseWindowMinutes: integer({ defaultValue: 3, validation: { isRequired: true, min: 0 } }),
    softCloseExtensionMinutes: integer({ defaultValue: 3, validation: { isRequired: true, min: 0 } }),
    softCloseMaxExtensions: integer({ defaultValue: 20, validation: { isRequired: true, min: 0 } }),
    bidValidityBusinessDays: integer({ defaultValue: 3, validation: { isRequired: true, min: 0 } }),
    buyerPremiumBps: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    salesTaxBps: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    cardFeeBps: integer({ defaultValue: 300, validation: { isRequired: true, min: 0 } }),
    cardMaxAmountMinor: integer({ validation: { min: 0 }, ui: { description: 'Largest invoice payable by card. Empty means no cap.' } }),
    paymentDueBusinessDays: integer({ defaultValue: 2, validation: { isRequired: true, min: 0 } }),
    paymentGraceBusinessDays: integer({ defaultValue: 2, validation: { isRequired: true, min: 0 } }),
    restockingFeeBps: integer({ defaultValue: 1500, validation: { isRequired: true, min: 0 } }),
    strikesBeforeSuspension: integer({ defaultValue: 3, validation: { isRequired: true, min: 1 } }),
    removalBusinessDays: integer({ defaultValue: 5, validation: { isRequired: true, min: 0 } }),
    storageFeePerPalletPerDayMinor: money({ defaultValue: 2000 }),
    claimWindowBusinessDays: integer({ defaultValue: 5, validation: { isRequired: true, min: 0 } }),
    claimVarianceBps: integer({ defaultValue: 500, validation: { isRequired: true, min: 0 } }),
    defaultClientRevenueShareBps: integer({ defaultValue: 7000, validation: { isRequired: true, min: 0, max: 10000 } }),
    sanitizationVerificationSampleBps: integer({ defaultValue: 500, validation: { isRequired: true, min: 0, max: 10000 } }),
    wireInstructions: text({ ui: { displayMode: 'textarea', description: 'Shown only to a buyer or client with an open invoice.' } }),
    wholesaleTerms: document({ formatting: true, links: true }),
    wholesaleTermsVersion: text({ defaultValue: '1' }),
    serviceTerms: document({ formatting: true, links: true }),
    serviceTermsVersion: text({ defaultValue: '1' }),
    exportClause: text({ ui: { displayMode: 'textarea' } }),
    smtpHost: text(),
    smtpPort: integer(),
    smtpUser: text(),
    smtpPassword: text({ access: { read: denyAll }, ui: { itemView: { fieldMode: 'edit' }, listView: { fieldMode: 'hidden' } } }),
    smtpFrom: text(),
    storefrontUrl: text({ ui: { description: 'Public address of the site, used in email links.' } }),
    ...trackingFields,
  },
})

export const Facility = list({
  access: staffAccess('canAccessDashboard', 'canManageSettings'),
  ui: { listView: { initialColumns: ['name', 'code', 'city', 'acceptsDropOff', 'isActive'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    ...addressFields(),
    phone: text(),
    hours: json({ defaultValue: {}, ui: { description: 'Per weekday, e.g. {"mon":"08:00-17:00"}' } }),
    acceptsDropOff: checkbox({ defaultValue: true }),
    dockSlotMinutes: integer({ defaultValue: 30, validation: { isRequired: true, min: 5 } }),
    dockSlotsPerWindow: integer({ defaultValue: 2, validation: { isRequired: true, min: 1 } }),
    pickupInstructions: text({ ui: { displayMode: 'textarea', description: 'Shown to a buyer only after their order is paid.' } }),
    isActive: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const Certification = list({
  access: staffAccess('canAccessDashboard', ['canManageSettings', 'canManageDownstream']),
  ui: { listView: { initialColumns: ['name', 'certificateNumber', 'certifyingBody', 'expiresOn', 'isPublic'] } },
  fields: {
    name: select({ type: 'string', options: ['R2v3', 'e-Stewards', 'NAID AAA', 'ISO 14001', 'ISO 45001', 'ISO 9001', 'ISO 27001', 'RIOS', 'Other'].map((value) => ({ label: value, value })), defaultValue: 'R2v3', validation: { isRequired: true } }),
    otherName: text({ ui: { description: 'When the name is Other.' } }),
    certificateNumber: text(),
    certifyingBody: text(),
    facility: relationship({ ref: 'Facility' }),
    issuedOn: calendarDay(),
    expiresOn: calendarDay(),
    document: fileRef(),
    isPublic: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const MaterialCategory = list({
  access: staffAccess('canAccessDashboard', 'canManageSettings'),
  ui: { labelField: 'name', listView: { initialColumns: ['name', 'kind', 'parent', 'r2Category', 'isFocusMaterial', 'dataBearingDefault'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    kind: choice(['equipment', 'component', 'commodity'], 'equipment'),
    parent: relationship({ ref: 'MaterialCategory.children' }),
    children: relationship({ ref: 'MaterialCategory.parent', many: true }),
    r2Category: text(),
    isFocusMaterial: checkbox({ defaultValue: false }),
    dataBearingDefault: checkbox({ defaultValue: false }),
    sortOrder: integer({ defaultValue: 0 }),
    isActive: checkbox({ defaultValue: true }),
    ...trackingFields,
  },
})

export const GradeDefinition = list({
  access: staffAccess('canAccessDashboard', 'canManageSettings'),
  ui: { labelField: 'label', listView: { initialColumns: ['kind', 'code', 'label', 'sortOrder'] } },
  fields: {
    kind: choice(['cosmetic', 'functional'], 'cosmetic'),
    code: text({ validation: { isRequired: true } }),
    label: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: 'textarea' } }),
    sortOrder: integer({ defaultValue: 0 }),
    ...trackingFields,
  },
})

export const AcceptedItem = list({
  access: staffAccess('canAccessDashboard', 'canManageSettings'),
  ui: { listView: { initialColumns: ['name', 'category', 'accepted', 'feeType', 'feeMinor'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    category: relationship({ ref: 'MaterialCategory' }),
    accepted: checkbox({ defaultValue: true }),
    feeType: choice(['free', 'per_item', 'per_weight'], 'free'),
    feeMinor: money(),
    notes: text(),
    sortOrder: integer({ defaultValue: 0 }),
    ...trackingFields,
  },
})

/**
 * Every uploaded or generated file (buyer documents, manifests, erasure reports,
 * photos, invoice and certificate PDFs). Bytes are kept in Postgres so uploads work
 * on any deployment with no storage service to configure. Served only through
 * /api/files/[id], which checks who may read it.
 */
export const StoredFile = list({
  access: {
    operation: { query: can('canAccessDashboard'), create: denyAll, update: denyAll, delete: can('canManageSettings') },
  },
  ui: { labelField: 'filename', hideCreate: true, listView: { initialColumns: ['filename', 'mimeType', 'sizeBytes', 'purpose', 'visibility', 'createdAt'] } },
  fields: {
    filename: text({ validation: { isRequired: true } }),
    mimeType: text({ validation: { isRequired: true } }),
    sizeBytes: integer({ validation: { isRequired: true, min: 0 } }),
    sha256: text({ validation: { isRequired: true } }),
    purpose: text({ validation: { isRequired: true } }),
    visibility: choice(['public', 'private'], 'private'),
    ownerBuyerCompanyId: text(),
    ownerClientOrganizationId: text(),
    uploadedBy: relationship({ ref: 'User' }),
    data: text({
      db: { nativeType: 'Text' },
      access: { read: denyAll, create: denyAll, update: denyAll },
      ui: { itemView: { fieldMode: 'hidden' }, listView: { fieldMode: 'hidden' }, createView: { fieldMode: 'hidden' } },
    }),
    ...trackingFields,
  },
})

export const peopleLists = { User, Role, StoreSettings, Facility, Certification, MaterialCategory, GradeDefinition, AcceptedItem, StoredFile }
