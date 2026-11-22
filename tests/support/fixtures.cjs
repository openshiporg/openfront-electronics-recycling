// Fixture builders for the database tests. Each call makes fresh rows with unique
// names, so tests never depend on one another or on earlier runs.
const { uid } = require('./db.cjs')

const ALL_PERMISSIONS = [
  'canAccessDashboard', 'canManageSettings', 'canManageUsers', 'canManageBuyers', 'canManageLots', 'canAwardLots', 'canSeeSealedBidAmountsBeforeClose',
  'canManageClients', 'canManageJobs', 'canDispatch', 'canCollect', 'canReceive', 'canAuditAssets', 'canSanitize', 'canVerifySanitization',
  'canIssueCertificates', 'canManageDownstream', 'canManagePayments', 'canRefund', 'canManageSettlements', 'canViewReports', 'canManageOnboarding',
]

async function settings(prisma) {
  return prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
}

async function staff(prisma, permissions = ALL_PERMISSIONS) {
  const id = uid()
  const role = await prisma.role.create({ data: { name: `Staff ${id}`, ...Object.fromEntries(permissions.map((p) => [p, true])) } })
  return prisma.user.create({ data: { name: `Staff ${id}`, email: `staff-${id}@recycler.example`, password: 'x'.repeat(60), kind: 'staff', roleId: role.id, isActive: true } })
}

/** An approved buyer company with one admin user who accepted the current terms. */
async function buyer(prisma, overrides = {}) {
  const s = await settings(prisma)
  const id = uid()
  const company = await prisma.buyerCompany.create({ data: { legalName: `Northgate Refurbishing ${id} LLC`, status: 'approved', countryCode: 'US', taxStatus: 'exempt_resale', ...overrides.company } })
  const user = await prisma.user.create({
    data: { name: `Dana Ruiz ${id}`, email: `buyer-${id}@northgate.example`, password: 'x'.repeat(60), kind: 'buyer', buyerRole: 'admin', buyerCompanyId: company.id, isActive: true, acceptedTermsVersion: s.wholesaleTermsVersion, ...overrides.user },
  })
  return { company, user }
}

async function nextNumber(prisma, kind, prefix) {
  const [{ n }] = await prisma.$queryRawUnsafe(`SELECT nextval('"${kind}_number_seq"')::int AS n`)
  return `${prefix}-${n}`
}

/**
 * A lot with lines. Default: sealed, lot total, open now and closing in an hour.
 * lines: [{ quantity, description }]
 */
async function lot(prisma, overrides = {}) {
  const id = uid()
  const lotNumber = await nextNumber(prisma, 'lot', 'LT')
  const now = Date.now()
  const lines = overrides.lines ?? [{ quantity: 40, description: 'Dell Latitude 5420, i5-1145G7, 16 GB, 256 GB SSD, Grade B' }, { quantity: 10, description: 'Lenovo ThinkPad T14 Gen 2, i5, 16 GB, Grade C' }]
  const { lines: _l, ...rest } = overrides
  return prisma.lot.create({
    data: {
      lotNumber,
      title: `Business laptops ${id}`,
      slug: `business-laptops-${id}`,
      status: 'open',
      format: 'sealed_bid',
      bidBasis: 'lot_total',
      opensAt: new Date(now - 3_600_000),
      closesAt: new Date(now + 3_600_000),
      ...rest,
      lines: { create: lines.map((l, i) => ({ lineNumber: i + 1, quantity: l.quantity, description: l.description, manufacturer: l.manufacturer ?? '', model: l.model ?? '' })) },
    },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

/** Moves a lot's close into the past and runs the clock so it closes. */
async function closeLot(prisma, lotId, advanceLotClock) {
  await prisma.lot.update({ where: { id: lotId }, data: { closesAt: new Date(Date.now() - 1000) } })
  await advanceLotClock({ prisma }, lotId)
  return prisma.lot.findUnique({ where: { id: lotId } })
}

const key = () => `key-${uid()}${uid()}`

module.exports = { ALL_PERMISSIONS, settings, staff, buyer, lot, closeLot, key, nextNumber }
