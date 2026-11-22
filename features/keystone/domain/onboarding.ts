import { ROLE_PERMISSIONS, type RolePermission } from '../access'
import { cleanSiteUrl, fail, requestOrigin, requireStaff, str, type Ctx, type Tx } from '../lib/core'
import { getSettings, smtpConfig } from '../lib/services'
import { seedStarterRecords } from './starterRecords'

// §4.11. Seeds everything a recycler needs on day one. Safe to run twice: every
// step looks for what is already there and only adds what is missing.

const ROLES: Array<{ name: string; permissions: RolePermission[] }> = [
  { name: 'Owner', permissions: [...ROLE_PERMISSIONS] },
  { name: 'Sales Manager', permissions: ['canAccessDashboard', 'canManageBuyers', 'canManageLots', 'canAwardLots', 'canViewReports'] },
  { name: 'Client Manager', permissions: ['canAccessDashboard', 'canManageClients', 'canManageJobs', 'canManageSettlements', 'canViewReports'] },
  { name: 'Dispatcher', permissions: ['canAccessDashboard', 'canDispatch', 'canCollect'] },
  { name: 'Driver', permissions: ['canAccessDashboard', 'canCollect'] },
  { name: 'Receiving', permissions: ['canAccessDashboard', 'canReceive'] },
  { name: 'Technician', permissions: ['canAccessDashboard', 'canAuditAssets', 'canSanitize'] },
  { name: 'Compliance', permissions: ['canAccessDashboard', 'canVerifySanitization', 'canIssueCertificates', 'canManageDownstream', 'canViewReports'] },
  { name: 'Accounting', permissions: ['canAccessDashboard', 'canManagePayments', 'canRefund', 'canManageSettlements', 'canViewReports'] },
]

type CategorySeed = { name: string; kind: 'equipment' | 'component' | 'commodity'; r2: string; focus?: boolean; data?: boolean; children?: CategorySeed[] }

const CATEGORIES: CategorySeed[] = [
  { name: 'Laptops', kind: 'equipment', r2: 'Computers', data: true, focus: true },
  { name: 'Desktops', kind: 'equipment', r2: 'Computers', data: true, focus: true },
  { name: 'Servers', kind: 'equipment', r2: 'Computers', data: true, focus: true },
  { name: 'Networking', kind: 'equipment', r2: 'Networking equipment', data: true },
  { name: 'Storage', kind: 'equipment', r2: 'Data storage devices', data: true, focus: true, children: [
    { name: 'Hard drives', kind: 'component', r2: 'Data storage devices', data: true, focus: true },
    { name: 'Solid state drives', kind: 'component', r2: 'Data storage devices', data: true, focus: true },
  ] },
  { name: 'Mobile phones', kind: 'equipment', r2: 'Mobile devices', data: true, focus: true },
  { name: 'Tablets', kind: 'equipment', r2: 'Mobile devices', data: true, focus: true },
  { name: 'Monitors', kind: 'equipment', r2: 'Displays', focus: true },
  { name: 'Printers', kind: 'equipment', r2: 'Imaging equipment', data: true },
  { name: 'Components', kind: 'component', r2: 'Components', children: [
    { name: 'Memory', kind: 'component', r2: 'Components' },
    { name: 'Processors', kind: 'component', r2: 'Components' },
    { name: 'Circuit boards', kind: 'commodity', r2: 'Circuit boards', focus: true },
    { name: 'Power supplies', kind: 'component', r2: 'Components' },
  ] },
  { name: 'Cables and wire', kind: 'commodity', r2: 'Wire and cable' },
  { name: 'Batteries', kind: 'commodity', r2: 'Batteries', focus: true },
  { name: 'CRT', kind: 'commodity', r2: 'CRT devices and glass', focus: true },
  { name: 'Mixed e-scrap', kind: 'commodity', r2: 'Mixed electronics', focus: true },
]

const GRADES = [
  { kind: 'cosmetic', code: 'A', label: 'Grade A', description: 'Like new. No visible marks at arm’s length.' },
  { kind: 'cosmetic', code: 'B', label: 'Grade B', description: 'Light wear: small scratches or scuffs on the lid or base, screen clean.' },
  { kind: 'cosmetic', code: 'C', label: 'Grade C', description: 'Heavy wear: deep scratches, dents, worn keys or small screen marks.' },
  { kind: 'cosmetic', code: 'D', label: 'Grade D', description: 'Damaged: cracked housing or screen, missing parts. Sold for parts.' },
  { kind: 'functional', code: 'F1', label: 'Fully working', description: 'Powers on and passes every test.' },
  { kind: 'functional', code: 'F2', label: 'Working with faults', description: 'Powers on; one or more listed faults (battery, keys, ports).' },
  { kind: 'functional', code: 'F3', label: 'Powers on, untested', description: 'Powers on to BIOS or splash screen; not further tested.' },
  { kind: 'functional', code: 'F4', label: 'Not working', description: 'Does not power on or fails POST. For parts or recycling.' },
] as const

const ACCEPTED = [
  { name: 'Laptops and notebooks', category: 'Laptops', feeType: 'free', feeMinor: 0, notes: 'Batteries may stay in place.' },
  { name: 'Desktop computers', category: 'Desktops', feeType: 'free', feeMinor: 0, notes: '' },
  { name: 'Servers and blade chassis', category: 'Servers', feeType: 'free', feeMinor: 0, notes: 'Racks collected by appointment.' },
  { name: 'Switches, routers and firewalls', category: 'Networking', feeType: 'free', feeMinor: 0, notes: '' },
  { name: 'Hard drives and SSDs', category: 'Storage', feeType: 'per_item', feeMinor: 500, notes: 'Per drive, with a serial-numbered destruction record.' },
  { name: 'Phones and tablets', category: 'Mobile phones', feeType: 'free', feeMinor: 0, notes: '' },
  { name: 'Flat-panel monitors', category: 'Monitors', feeType: 'per_item', feeMinor: 500, notes: '' },
  { name: 'Printers and copiers', category: 'Printers', feeType: 'per_item', feeMinor: 1500, notes: 'Toner removed where possible.' },
  { name: 'CRT monitors and TVs', category: 'CRT', feeType: 'per_weight', feeMinor: 45, notes: 'Charged per pound of gross weight.' },
  { name: 'Loose batteries', category: 'Batteries', feeType: 'per_weight', feeMinor: 120, notes: 'Tape terminals. Charged per pound.' },
  { name: 'Cables and cords', category: 'Cables and wire', feeType: 'free', feeMinor: 0, notes: '' },
  { name: 'Household appliances', category: null, feeType: 'free', feeMinor: 0, notes: 'Not accepted: we take electronics only.', accepted: false },
] as const

const para = (text: string) => ({ type: 'paragraph', children: [{ text }] })
const heading = (text: string) => ({ type: 'heading', level: 3, children: [{ text }] })

const WHOLESALE_TERMS = [
  heading('Wholesale terms of sale'),
  para('All lots are sold as described in the manifest and the grade guide. Quantities and grades are counted and graded in good faith; a variance claim must be opened within the claim window shown on the invoice.'),
  para('A bid is a binding offer that stays open for the bid validity period after the lot closes. The seller may award to any bid, award by line, or decline all bids. A reserve may apply and is not disclosed.'),
  para('Invoices are due within the payment term shown on the invoice. An unpaid award after the grace period is a default: the award is cancelled, a restocking fee is charged and the account receives a strike.'),
  para('Goods are released only after payment is confirmed. The buyer collects or arranges freight within the removal period; storage is charged per pallet per day after that.'),
  para('The buyer is responsible for lawful use, resale and export of the goods and for any licence the destination country requires.'),
]

const SERVICE_TERMS = [
  heading('Recycling and IT asset disposition service terms'),
  para('We collect, transport and process the equipment listed on the quote. Custody passes to us when our driver signs the pickup record and passes back only to the downstream vendor or buyer recorded on the chain-of-custody log.'),
  para('Every data-bearing device is wiped to the stated standard or physically destroyed. A certificate listing every serial number is issued when processing is complete.'),
  para('Where the quote includes revenue share, resale proceeds are shared at the agreed rate on a settlement statement after the goods are sold. Service fees are charged as quoted.'),
  para('Items found on arrival that are not on the quote are processed at the published fee for that item.'),
]

const EXPORT_CLAUSE = 'The buyer will not export these goods to any country where export is prohibited and will obtain every licence needed. Non-working equipment will not be exported for disposal.'

export async function onboardingStatus(context: Ctx) {
  const p = context.prisma
  const [roles, facilities, categories, grades, accepted, providers, settings] = await Promise.all([
    p.role.count(), p.facility.count(), p.materialCategory.count(), p.gradeDefinition.count(), p.acceptedItem.count(), p.paymentProvider.count(), p.storeSettings.findFirst(),
  ])
  const steps = [
    { key: 'roles', label: 'Staff roles', done: roles >= ROLES.length },
    { key: 'settings', label: 'Business details', done: Boolean(settings?.businessName) },
    { key: 'facility', label: 'Facility', done: facilities > 0 },
    { key: 'categories', label: 'Categories', done: categories > 0 },
    { key: 'grades', label: 'Grades', done: grades > 0 },
    { key: 'accepted', label: 'Accepted items', done: accepted > 0 },
    { key: 'terms', label: 'Terms', done: Array.isArray(settings?.wholesaleTerms) && (settings?.wholesaleTerms as any[]).length > 0 },
    { key: 'payments', label: 'Payment providers', done: providers >= 2 },
  ]
  return { complete: steps.every((s) => s.done), steps, cardPayments: Boolean(process.env.STRIPE_SECRET_KEY) }
}

/**
 * Plain status of the outside services, for Settings (item 5). No secrets: only what is set and where.
 * Nothing in the product waits on email; without SMTP, notifications stay in each person's in-app list.
 */
export async function serviceStatus(context: Ctx) {
  const settings = await getSettings(context.prisma)
  const smtp = smtpConfig(settings)
  const fromEnv = Boolean(process.env.SMTP_HOST)
  const missing: string[] = []
  if (!smtp) missing.push('host')
  else {
    if (!smtp.from) missing.push('from address')
    if (smtp.user && !smtp.pass) missing.push('password')
  }
  const [skipped, failed, sent] = await Promise.all([
    context.prisma.notification.count({ where: { emailStatus: 'skipped' } }),
    context.prisma.notification.count({ where: { emailStatus: 'failed' } }),
    context.prisma.notification.count({ where: { emailStatus: 'sent' } }),
  ])
  return {
    email: {
      configured: Boolean(smtp) && missing.length === 0,
      source: smtp ? (fromEnv ? 'environment' : 'settings') : null,
      host: smtp?.host ?? null,
      port: smtp?.port ?? null,
      from: smtp?.from || null,
      missing,
      notificationsNotEmailed: skipped,
      notificationsFailed: failed,
      notificationsEmailed: sent,
    },
    cards: {
      configured: Boolean(process.env.STRIPE_SECRET_KEY),
      publishableKey: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY),
      webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      mode: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : process.env.STRIPE_SECRET_KEY ? 'test keys' : null,
    },
    storefrontUrl: settings.storefrontUrl || null,
  }
}

type OnboardingInput = {
  businessName?: string; legalName?: string; supportEmail?: string; supportPhone?: string; timezone?: string; weightUnit?: string
  facility?: { name?: string; code?: string; addressLine1?: string; city?: string; region?: string; postalCode?: string; countryCode?: string; phone?: string }
  certifications?: Array<{ name: string; certificateNumber?: string; certifyingBody?: string; expiresOn?: string | null }>
  wireInstructions?: string
  /** Public site address for links in email and PDFs; defaults to the address onboarding is run from. */
  storefrontUrl?: string
  /** 'basic' (default): settings, roles and catalogue. 'full': also the §4.11 starter records. */
  template?: 'basic' | 'full'
  /** Password for the starter logins (full template). Generated when omitted; returned once. */
  starterPassword?: string
}

export async function runElectronicsRecyclingOnboarding(context: Ctx, input: OnboardingInput) {
  const session = requireStaff(context, 'canManageOnboarding')
  const businessName = str(input.businessName, 200)
  if (!businessName) fail('Enter the business name.')
  const f = input.facility ?? {}
  const hasFacility = (await context.prisma.facility.count()) > 0
  if (!hasFacility && (!str(f.addressLine1) || !str(f.city) || !str(f.postalCode))) fail('Enter the facility address.')
  const counts: Record<string, number> = {}
  const startedAt = new Date()

  await context.prisma.$transaction(async (tx: Tx) => {
    // 1. Roles
    for (const role of ROLES) {
      const flags = Object.fromEntries(ROLE_PERMISSIONS.map((p) => [p, role.permissions.includes(p)]))
      const existing = await tx.role.findFirst({ where: { name: role.name } })
      if (!existing) { await tx.role.create({ data: { name: role.name, ...flags } }); counts.roles = (counts.roles ?? 0) + 1 }
    }
    // 2. Store settings
    const settings = await getSettings(tx)
    await tx.storeSettings.update({
      where: { id: settings.id },
      data: {
        businessName, legalName: str(input.legalName, 200) || businessName,
        // Links in email and PDFs: what staff typed, else what is saved, else the address onboarding was run from.
        storefrontUrl: cleanSiteUrl(input.storefrontUrl) || cleanSiteUrl(settings.storefrontUrl) || requestOrigin(context),
        supportEmail: str(input.supportEmail, 200) || settings.supportEmail, supportPhone: str(input.supportPhone, 40) || settings.supportPhone,
        timezone: str(input.timezone, 60) || settings.timezone || 'America/Chicago',
        weightUnit: input.weightUnit === 'kg' ? 'kg' : 'lb',
        wireInstructions: str(input.wireInstructions, 2000) || settings.wireInstructions,
        ...(Array.isArray(settings.wholesaleTerms) && (settings.wholesaleTerms as any[]).length ? {} : { wholesaleTerms: WHOLESALE_TERMS, wholesaleTermsVersion: '2026-1' }),
        ...(Array.isArray(settings.serviceTerms) && (settings.serviceTerms as any[]).length ? {} : { serviceTerms: SERVICE_TERMS, serviceTermsVersion: '2026-1' }),
        exportClause: settings.exportClause || EXPORT_CLAUSE,
      },
    })
    // 3. Facility
    let facility = await tx.facility.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!facility) {
      facility = await tx.facility.create({
        data: {
          name: str(f.name, 200) || `${businessName} main facility`, code: (str(f.code, 12) || 'MAIN').toUpperCase(),
          addressLine1: str(f.addressLine1, 200), city: str(f.city, 120), region: str(f.region, 120), postalCode: str(f.postalCode, 20), countryCode: (str(f.countryCode, 2) || 'US').toUpperCase(), phone: str(f.phone, 40),
          hours: { mon: '07:30-16:30', tue: '07:30-16:30', wed: '07:30-16:30', thu: '07:30-16:30', fri: '07:30-15:00', sat: null, sun: null },
          acceptsDropOff: true, dockSlotMinutes: 60, dockSlotsPerWindow: 2,
          pickupInstructions: 'Check in at the dock office with your order number. Bring a pallet jack if your truck has no liftgate.',
        },
      })
      counts.facilities = 1
    }
    // 4. Categories
    const bySlug = new Map<string, string>()
    let order = 0
    const addCategory = async (c: CategorySeed, parentId: string | null) => {
      const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      let row = await tx.materialCategory.findFirst({ where: { slug } })
      if (!row) {
        row = await tx.materialCategory.create({ data: { name: c.name, slug, kind: c.kind, r2Category: c.r2, isFocusMaterial: Boolean(c.focus), dataBearingDefault: Boolean(c.data), sortOrder: (order += 10), parentId } })
        counts.categories = (counts.categories ?? 0) + 1
      }
      bySlug.set(c.name, row.id)
      for (const child of c.children ?? []) await addCategory(child, row.id)
    }
    for (const c of CATEGORIES) await addCategory(c, null)
    // 5. Grades
    let g = 0
    for (const grade of GRADES) {
      g += 10
      if (!(await tx.gradeDefinition.findFirst({ where: { kind: grade.kind, code: grade.code } }))) {
        await tx.gradeDefinition.create({ data: { ...grade, sortOrder: g } })
        counts.grades = (counts.grades ?? 0) + 1
      }
    }
    // 6. Accepted items
    let a = 0
    for (const item of ACCEPTED) {
      a += 10
      if (await tx.acceptedItem.findFirst({ where: { name: item.name } })) continue
      await tx.acceptedItem.create({ data: { name: item.name, categoryId: item.category ? bySlug.get(item.category) ?? null : null, accepted: (item as any).accepted ?? true, feeType: item.feeType, feeMinor: item.feeMinor, notes: item.notes, sortOrder: a } })
      counts.acceptedItems = (counts.acceptedItems ?? 0) + 1
    }
    // 7. Certifications: only the ones the operator ticked, each with the number they typed.
    for (const cert of input.certifications ?? []) {
      const name = str(cert.name, 40)
      if (!name) continue
      if (!str(cert.certificateNumber, 80)) fail(`Enter the certificate number for ${name}, or untick it.`)
      if (await tx.certification.findFirst({ where: { name, facilityId: facility.id } })) continue
      await tx.certification.create({ data: { name, certificateNumber: str(cert.certificateNumber, 80), certifyingBody: str(cert.certifyingBody, 120), facilityId: facility.id, expiresOn: cert.expiresOn ? new Date(cert.expiresOn) : null, isPublic: true } })
      counts.certifications = (counts.certifications ?? 0) + 1
    }
    // 8. Payment providers
    const providers = [
      { code: 'manual', name: 'Bank transfer', fn: 'manual' },
      { code: 'stripe', name: 'Card (Stripe)', fn: 'stripe' },
    ]
    for (const p of providers) {
      if (await tx.paymentProvider.findFirst({ where: { code: p.code } })) continue
      await tx.paymentProvider.create({ data: { code: p.code, name: p.name, isInstalled: true, createPaymentFunction: p.fn, capturePaymentFunction: p.fn, refundPaymentFunction: p.fn, getPaymentStatusFunction: p.fn, generatePaymentLinkFunction: p.fn, handleWebhookFunction: p.fn } })
      counts.paymentProviders = (counts.paymentProviders ?? 0) + 1
    }
    await tx.user.update({ where: { id: session.itemId }, data: { onboardingStatus: 'completed' } })
  }, { timeout: 60_000 })

  if (input.template !== 'full') return { counts }
  if (input.starterPassword && String(input.starterPassword).length < 10) fail('Use a starter password of at least 10 characters.')
  const settings = await getSettings(context.prisma)
  const starter = await seedStarterRecords(context, { businessName, supportEmail: settings.supportEmail, password: input.starterPassword, since: startedAt })
  return { counts, starter }
}
