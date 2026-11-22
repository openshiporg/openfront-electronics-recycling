// Onboarding against the real scratch Postgres: the basic template is safe to run
// twice, and the full template (§4.11) builds working starter records through the
// domain functions: clients with sites, jobs at four stages, ~120 audited assets with
// sanitisation records, two certificates, two downstream vendors, four buyers in
// different review states and a published sale event with six lots in every format.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, uid, root } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, onboarding

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  onboarding = require(path.join(root, 'features/keystone/domain/onboarding.ts'))
})
test.after(async () => { if (ctx) await ctx.disconnect() })

const input = (mailbox, extra = {}) => ({
  businessName: 'Riverbend ITAD',
  legalName: 'Riverbend IT Asset Disposition LLC',
  supportEmail: mailbox,
  facility: { name: 'Riverbend Columbus', code: 'CMH', addressLine1: '2150 Refugee Rd', city: 'Columbus', region: 'OH', postalCode: '43207', countryCode: 'US' },
  ...extra,
})

test('basic template: safe to run twice', { skip }, async () => {
  const owner = await f.staff(ctx.prisma)
  const as = await ctx.as(owner.id)
  await onboarding.runElectronicsRecyclingOnboarding(as, input(`ops-${uid()}@riverbend-itad.com`))
  const again = await onboarding.runElectronicsRecyclingOnboarding(as, input(`ops-${uid()}@riverbend-itad.com`))
  assert.equal(Object.keys(again.counts).length, 0, 'second run adds nothing')
  assert.equal(again.starter, undefined)
  const status = await onboarding.onboardingStatus(as)
  assert.equal(status.complete, true)
  assert.equal(again.counts.certifications, undefined, 'no certification unless the operator gives one')
})

test('certifications: created only when ticked with a number', { skip }, async () => {
  const owner = await f.staff(ctx.prisma)
  const as = await ctx.as(owner.id)
  const facility = { name: `Riverbend Dayton ${uid()}`, code: `DAY${uid().slice(0, 4)}`, addressLine1: '75 Valley St', city: 'Dayton', region: 'OH', postalCode: '45402', countryCode: 'US' }
  const before = await ctx.prisma.certification.count()
  await assert.rejects(onboarding.runElectronicsRecyclingOnboarding(as, input('ops@riverbend-itad.com', { facility, certifications: [{ name: 'R2v3', certificateNumber: '' }] })), /certificate number for R2v3/)
  assert.equal(await ctx.prisma.certification.count(), before, 'nothing written when a number is missing')
})

test('full template: starter records through the domain functions', { skip, timeout: 900_000 }, async () => {
  const owner = await f.staff(ctx.prisma)
  const as = await ctx.as(owner.id)
  const mailbox = `ops-${uid()}@riverbend-itad.com`
  const s = await f.settings(ctx.prisma)
  await ctx.prisma.storeSettings.update({ where: { id: s.id }, data: { supportEmail: mailbox } })
  const out = await onboarding.runElectronicsRecyclingOnboarding(as, input(mailbox, { template: 'full', starterPassword: 'Riverbend-start-2026' }))
  const { starter } = out
  assert.equal(starter.password, 'Riverbend-start-2026')
  const byPortal = (p) => starter.logins.filter((l) => l.portal === p)
  assert.equal(byPortal('buyer').length, 4)
  assert.equal(byPortal('client').length, 3)
  assert.deepEqual(byPortal('buyer').map((b) => b.status).sort(), ['approved', 'approved', 'needs_info', 'submitted'])

  const p = ctx.prisma
  const orgs = await p.clientOrganization.findMany({ where: { users: { some: { email: { in: byPortal('client').map((c) => c.email) } } } }, include: { sites: true, jobs: true } })
  assert.equal(orgs.length, 3)
  assert.ok(orgs.every((o) => o.sites.length >= 1))
  const jobs = orgs.flatMap((o) => o.jobs)
  assert.deepEqual(jobs.map((j) => j.status).sort(), ['completed', 'processing', 'quoted', 'scheduled'])
  const jobIds = jobs.map((j) => j.id)
  assert.ok((await p.container.count({ where: { jobId: { in: jobIds } } })) >= 5)
  const assets = await p.asset.findMany({ where: { jobId: { in: jobIds } }, select: { sanitizationStatus: true, isDataBearing: true, status: true } })
  assert.ok(assets.length >= 110 && assets.length <= 130, `about 120 assets (${assets.length})`)
  assert.ok(assets.some((a) => a.sanitizationStatus === 'pending'), 'some drives still to wipe on the processing job')
  assert.ok(assets.some((a) => a.sanitizationStatus === 'destroyed'))
  assert.ok((await p.sanitizationRecord.count({ where: { asset: { jobId: { in: jobIds } } } })) >= 90)
  assert.equal(await p.certificate.count({ where: { jobId: { in: jobIds }, status: 'issued' } }), 2)

  const event = await p.saleEvent.findFirst({ where: { lots: { some: { lotNumber: starter.records.saleEvent.lots[0].lotNumber } } }, include: { lots: true } })
  assert.equal(event.status, 'published')
  assert.equal(event.lots.length, 6)
  const kinds = event.lots.map((l) => `${l.format}/${l.bidBasis}/${l.status}`).sort()
  assert.ok(kinds.includes('fixed_price/lot_total/open'))
  assert.ok(kinds.includes('open_auction/lot_total/open'))
  assert.ok(kinds.includes('sealed_bid/per_line/open'))
  assert.ok(kinds.includes('sealed_bid/lot_total/closed'), 'one closed lot with bids waiting for an award')
  assert.ok(kinds.some((k) => /sealed_bid\/lot_total\/(awarded|completed)/.test(k)), 'one awarded lot')
  const order = await p.order.findUnique({ where: { orderNumber: starter.records.paidOrder.orderNumber } })
  assert.equal(order.status, 'paid')
  const invoice = await p.invoice.findUnique({ where: { invoiceNumber: starter.records.paidOrder.invoiceNumber } })
  assert.equal(invoice.status, 'paid')

  // A believable history: nothing in the future, each step after the one before.
  const now = Date.now()
  const job1 = jobs.find((j) => j.status === 'completed')
  const t = (d) => new Date(d).getTime()
  assert.ok(t(job1.createdAt) < t(job1.quoteSentAt) && t(job1.quoteSentAt) < t(job1.quoteAcceptedAt) && t(job1.quoteAcceptedAt) < t(job1.collectedAt) && t(job1.collectedAt) < t(job1.receivedAt) && t(job1.receivedAt) < t(job1.completedAt), 'job 1 steps in order')
  assert.ok(t(job1.completedAt) < now - 2 * 86_400_000, 'job 1 completed days ago')
  assert.ok(t(job1.collectedAt) - t(job1.createdAt) > 3 * 86_400_000, 'job 1 history spans days, not minutes')
  const asked = (job1.requestedDates ?? []).map((d) => t(`${d}T23:59:59Z`))
  assert.ok(asked.length && asked.every((d) => d < t(job1.completedAt)), 'dates asked come before completion')
  assert.ok(asked.some((d) => d >= t(job1.createdAt)), 'dates asked come after the request')
  assert.ok(Math.abs(t(job1.scheduledDate) - t(job1.collectedAt)) < 36 * 3_600_000, 'collected on the scheduled day')
  const custody = await p.custodyEvent.findMany({ where: { jobId: job1.id }, orderBy: { occurredAt: 'asc' } })
  const firstOf = (type) => t(custody.find((c) => c.type === type).occurredAt)
  assert.ok(firstOf('collected') < firstOf('seal_verified') && firstOf('seal_verified') < firstOf('audited') && firstOf('audited') < firstOf('sanitized'), 'custody chain in order')
  const certs = await p.certificate.findMany({ where: { jobId: job1.id } })
  assert.ok(certs.every((c) => t(c.issuedAt) > firstOf('sanitized') && t(c.issuedAt) <= t(job1.completedAt)), 'certificates after the wipes, before completion')
  assert.ok(certs.every((c) => c.snapshot.job.collectedAt && Math.abs(t(c.snapshot.job.collectedAt) - t(job1.collectedAt)) < 1000), 'certificate shows the real collection date')
  const award = await p.award.findUnique({ where: { orderId: order.id } })
  const lot6 = await p.lot.findUnique({ where: { id: order.lotId } })
  const payment = await p.payment.findFirst({ where: { invoiceId: invoice.id } })
  assert.ok(t(lot6.closedAt) <= t(award.awardedAt) && t(award.awardedAt) <= t(invoice.issuedAt) + 1000 && t(invoice.issuedAt) < t(invoice.paidAt), 'closed, awarded, invoiced, paid')
  assert.ok(t(invoice.dueAt) > t(invoice.issuedAt) && t(invoice.paidAt) < now, 'due after issue; paid in the past')
  assert.ok(Math.abs(t(`${payment.paidOn}T12:00:00Z`) - t(invoice.paidAt)) < 36 * 3_600_000, 'paid on the day the money was recorded')
  const future = await p.auditEvent.count({ where: { occurredAt: { gt: new Date(now) } } })
  assert.equal(future, 0, 'no audit event in the future')
  assert.equal(await p.certification.count({ where: { facility: { code: 'CMH' }, certificateNumber: '' } }), 0, 'no certification without a number')

  // No placeholder wording anywhere in the starter data.
  const text = JSON.stringify(starter) + JSON.stringify(event) + JSON.stringify(orgs)
  assert.doesNotMatch(text, /\b(demo|sample|sandbox|mock|dummy|lorem|test data|fake)\b/i)

  const second = await onboarding.runElectronicsRecyclingOnboarding(as, input(mailbox, { template: 'full' }))
  assert.equal(second.starter.skipped, true, 'second full run does not duplicate records')
})
