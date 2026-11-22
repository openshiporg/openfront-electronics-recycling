#!/usr/bin/env node
// Sets up an empty database for a new recycler: creates the owner account (like the
// first-run screen does), runs onboarding, and with --full adds the §4.11 starter
// records through the same domain functions the app uses.
//
//   DATABASE_URL=... node scripts/seed-starter.cjs --full \
//     --owner-email ops@riverbend-itad.com --owner-name "Jordan Hale" \
//     --business "Riverbend ITAD" --out ~/.config/openfront/er-starter-logins.json \
//     [--certification "R2v3|R2-xx-xxxxx|SERI|2028-03-31"]   (only ones actually held)
//
// The owner and starter passwords are written only to --out (mode 600), never to stdout.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const full = args.includes('--full')
function certifications() {
  const out = []
  args.forEach((a, i) => {
    if (a !== '--certification') return
    const [name, certificateNumber, certifyingBody, expiresOn] = String(args[i + 1] || '').split('|').map((x) => x.trim())
    if (!name || !certificateNumber) throw new Error('--certification needs "Name|Number[|Body|Expiry]".')
    out.push({ name, certificateNumber, certifyingBody: certifyingBody || '', expiresOn: expiresOn || null })
  })
  return out
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL.')
  const out = opt('out')
  if (!out) throw new Error('Pass --out <file> for the logins (kept outside the repo).')
  process.env.SESSION_SECRET ||= crypto.randomBytes(32).toString('hex')
  require('tsx/cjs/api').register()
  const { getContext } = require('@keystone-6/core/context')
  const config = require(path.join(root, 'features/keystone/index.ts')).default
  const PrismaModule = require(path.join(root, 'node_modules/.prisma/client'))
  const { ROLE_PERMISSIONS } = require(path.join(root, 'features/keystone/access.ts'))
  const onboarding = require(path.join(root, 'features/keystone/domain/onboarding.ts'))
  const base = getContext({ ...config, db: { ...config.db, url } }, PrismaModule)
  const sudo = base.sudo()

  const business = opt('business', 'Riverbend ITAD')
  const ownerEmail = String(opt('owner-email', 'ops@riverbend-itad.com')).toLowerCase()
  const ownerName = opt('owner-name', 'Jordan Hale')
  let ownerPassword = null
  let owner = await sudo.prisma.user.findUnique({ where: { email: ownerEmail }, include: { role: true } })
  if (!owner) {
    if ((await sudo.prisma.user.count({ where: { kind: 'staff' } })) > 0) throw new Error(`Staff accounts already exist; pass --owner-email of an existing owner.`)
    ownerPassword = opt('owner-password') || `${crypto.randomBytes(9).toString('base64url')}-Ow1`
    const created = await sudo.db.User.createOne({ data: { name: ownerName, email: ownerEmail, password: ownerPassword, kind: 'staff', role: { create: { name: 'Owner', ...Object.fromEntries(ROLE_PERMISSIONS.map((p) => [p, true])) } } } })
    owner = await sudo.prisma.user.findUnique({ where: { id: created.id }, include: { role: true } })
  }
  if (!owner.role?.canManageOnboarding) throw new Error(`${ownerEmail} cannot run onboarding.`)
  const ctx = base.withSession({ itemId: owner.id, listKey: 'User', data: { name: owner.name, email: owner.email, kind: owner.kind, isActive: owner.isActive, role: owner.role } })

  const settings = await sudo.prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
  if (!settings.supportEmail) await sudo.prisma.storeSettings.update({ where: { id: 1 }, data: { supportEmail: ownerEmail } })

  const result = await onboarding.runElectronicsRecyclingOnboarding(ctx, {
    businessName: business,
    legalName: opt('legal-name', `${business} LLC`),
    supportEmail: ownerEmail,
    supportPhone: opt('phone', '(614) 555-0100'),
    timezone: 'America/New_York',
    facility: { name: `${business} Columbus`, code: 'CMH', addressLine1: '2150 Refugee Rd', city: 'Columbus', region: 'OH', postalCode: '43207', countryCode: 'US', phone: '(614) 555-0100' },
    // Only certifications the operator holds, each as --certification "Name|Number|Body|YYYY-MM-DD".
    certifications: certifications(),
    wireInstructions: `Bank: Huntington National Bank\nAccount name: ${business} LLC\nRouting (ACH/wire): 044000024\nAccount: 01234567890\nReference: your invoice number`,
    template: full ? 'full' : 'basic',
    starterPassword: opt('starter-password'),
  })

  const logins = {
    createdAt: new Date().toISOString(),
    owner: { email: ownerEmail, password: ownerPassword ?? '(existing account; unchanged)' },
    starterPassword: result.starter?.password ?? null,
    logins: result.starter?.logins ?? [],
    records: result.starter?.records ?? null,
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  fs.writeFileSync(path.resolve(out), JSON.stringify(logins, null, 2), { mode: 0o600 })
  console.log(JSON.stringify({ counts: result.counts, skipped: result.starter?.skipped ?? false, logins: logins.logins.map((l) => `${l.portal}: ${l.email}${l.status ? ` (${l.status})` : ''}`), records: logins.records, writtenTo: path.resolve(out) }, null, 2))
  await sudo.prisma.$disconnect()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
