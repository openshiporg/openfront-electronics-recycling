// Buy side against the real scratch Postgres: job transitions, receiving and seals,
// the sanitisation gate (sale, lot entry, data-bearing flag), certificates and the
// completion block, and manifest import from a real .xlsx file.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, root, uid } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, jobs, proc, lots, sheets, settle, docs, services, XLSX, staffCtx, staffUser, driverUser, driverCtx

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  jobs = require(path.join(root, 'features/keystone/domain/jobs.ts'))
  proc = require(path.join(root, 'features/keystone/domain/process.ts'))
  lots = require(path.join(root, 'features/keystone/domain/lots.ts'))
  sheets = require(path.join(root, 'features/keystone/domain/sheets.ts'))
  settle = require(path.join(root, 'features/keystone/domain/settlements.ts'))
  docs = require(path.join(root, 'features/keystone/domain/documents.ts'))
  services = require(path.join(root, 'features/keystone/lib/services.ts'))
  XLSX = require('xlsx')
  staffUser = await f.staff(ctx.prisma)
  staffCtx = await ctx.as(staffUser.id)
  driverUser = await f.staff(ctx.prisma, ['canAccessDashboard', 'canCollect'])
  driverCtx = await ctx.as(driverUser.id)
})
test.after(async () => { if (ctx) await ctx.disconnect() })

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
const today = () => new Date().toISOString().slice(0, 10)

async function category(name, dataBearing) {
  const slug = `${name.toLowerCase().replace(/\W+/g, '-')}-${uid()}`
  return ctx.prisma.materialCategory.create({ data: { name: `${name} ${uid()}`, slug, kind: 'equipment', dataBearingDefault: dataBearing } })
}

/** A client job driven by the real functions up to `until`: requested | quoted | collected | received. */
async function job(until = 'received', containers = [{ label: 'P01', sealNumber: 'S-1', grossWeight: 200 }], quote = { pricingModel: 'fee_for_service', lines: [{ description: 'Collection', quantity: 1, unitPriceMinor: 15_000, kind: 'pickup' }] }) {
  const org = await ctx.prisma.clientOrganization.create({ data: { name: `Meridian Health ${uid()}`, legalName: 'Meridian Health Partners, Inc.' } })
  const out = await jobs.requestJob(staffCtx, { organizationId: org.id, contactName: 'Laura Chen', contactEmail: 'laura@meridian.example', site: { addressLine1: '1200 Riverside Dr', city: 'Columbus', region: 'OH', postalCode: '43215', countryCode: 'US' }, requestedDates: [today()], hasDataBearing: true, services: ['pickup', 'data_destruction'] })
  const jobId = out.jobId
  if (until === 'requested') return { jobId, org }
  await jobs.quoteJob(staffCtx, { jobId, ...quote })
  if (until === 'quoted') return { jobId, org }
  await jobs.recordJobAcceptance(staffCtx, { jobId, signatureName: 'Laura Chen', note: 'Signed quote returned by email.' })
  await jobs.scheduleJob(staffCtx, { jobId, date: today(), windowStart: '08:00', windowEnd: '10:00', driverId: driverUser.id, vehicle: 'Box truck 2' })
  const labels = containers.map((c) => ({ ...c, label: `${c.label}-${uid()}`, type: 'pallet' }))
  await jobs.collectJob(driverCtx, { jobId, containers: labels, signerName: 'Laura Chen', signature: { filename: 'sig.png', mimeType: 'image/png', base64: PNG } })
  if (until === 'collected') return { jobId, org, labels }
  for (const c of await ctx.prisma.container.findMany({ where: { jobId } })) {
    const plan = labels.find((l) => l.label === c.label)
    await jobs.receiveContainer(staffCtx, { containerId: c.id, receivedSealNumber: plan.sealNumber, grossWeight: plan.grossWeight, tareWeight: 40 })
  }
  return { jobId, org, labels }
}

async function asset(jobId, cat, extra = {}) {
  return proc.auditAsset(staffCtx, { jobId, categoryId: cat.id, manufacturer: 'Dell', model: 'Latitude 5420', serialNumber: `SN${uid()}`, weight: 3.4, ...extra })
}

test('job transitions: the state machine refuses out-of-order steps with a plain reason', { skip }, async () => {
  const { jobId } = await job('requested')
  await assert.rejects(jobs.scheduleJob(staffCtx, { jobId, date: today(), windowStart: '08:00', windowEnd: '10:00', driverId: driverUser.id }), /requested cannot be moved to scheduled/)
  await assert.rejects(jobs.collectJob(driverCtx, { jobId, containers: [{ label: `X-${uid()}` }], signerName: 'Laura Chen', signature: { filename: 'sig.png', mimeType: 'image/png', base64: PNG } }), /cannot be moved to collected/)
  // Through the GraphQL command wrapper the same refusal is a readable error, not "Something went wrong".
  const out = await staffCtx.graphql.raw({ query: 'mutation($i: JSON) { scheduleJob(input: $i) { success error } }', variables: { i: { jobId, date: today(), windowStart: '08:00', windowEnd: '10:00', driverId: driverUser.id } } })
  assert.equal(out.data.scheduleJob.success, false)
  assert.match(out.data.scheduleJob.error, /cannot be moved to scheduled/)
  await jobs.quoteJob(staffCtx, { jobId, pricingModel: 'fee_for_service', lines: [{ description: 'Collection', quantity: 1, unitPriceMinor: 10_000, kind: 'pickup' }] })
  assert.equal((await ctx.prisma.job.findUnique({ where: { id: jobId } })).status, 'quoted')
  await jobs.cancelJob(staffCtx, { jobId, reason: 'Client moved the refresh to next quarter.' })
  assert.equal((await ctx.prisma.job.findUnique({ where: { id: jobId } })).status, 'cancelled')
  await assert.rejects(jobs.quoteJob(staffCtx, { jobId, pricingModel: 'fee_for_service', lines: [{ description: 'x', quantity: 1, unitPriceMinor: 1, kind: 'pickup' }] }), /cancelled cannot be moved/)
})

test('receiving: a seal mismatch is an exception and holds the job at collected; matching seals receive it', { skip }, async () => {
  const { jobId } = await job('collected', [{ label: 'P01', sealNumber: 'S-100', grossWeight: 210 }, { label: 'P02', sealNumber: 'S-101', grossWeight: 180 }])
  const [a, b] = await ctx.prisma.container.findMany({ where: { jobId }, orderBy: { label: 'asc' } })
  await jobs.receiveContainer(staffCtx, { containerId: a.id, receivedSealNumber: 'S-999', grossWeight: 210, tareWeight: 40 })
  const bad = await ctx.prisma.container.findUnique({ where: { id: a.id } })
  assert.match(bad.sealException, /does not match/)
  assert.equal(await ctx.prisma.custodyEvent.count({ where: { containerId: a.id, type: 'seal_exception' } }), 1)
  await jobs.receiveContainer(staffCtx, { containerId: b.id, receivedSealNumber: 'S-101', grossWeight: 180, tareWeight: 40 })
  assert.equal((await ctx.prisma.job.findUnique({ where: { id: jobId } })).status, 'collected', 'one container still in exception')
  await assert.rejects(jobs.receiveContainer(staffCtx, { containerId: b.id, receivedSealNumber: 'S-101', grossWeight: 180 }), /already received/)
  await jobs.resolveSealException(staffCtx, { containerId: a.id, resolution: 'Driver replaced a torn seal at the client; photo on the collection record.' })
  assert.equal((await ctx.prisma.job.findUnique({ where: { id: jobId } })).status, 'received')
})

test('sanitisation gate: a data-bearing asset cannot be sold or lotted until it passes; a failed wipe keeps it blocked', { skip }, async () => {
  const { jobId } = await job()
  const laptops = await category('Laptops', true)
  const monitors = await category('Monitors', false)
  const drive = await asset(jobId, laptops)
  const screen = await asset(jobId, monitors, { model: 'P2419H' })
  assert.equal(drive.isDataBearing, true)
  assert.equal(drive.sanitizationStatus, 'pending')
  assert.equal(screen.sanitizationStatus, 'not_required')

  await assert.rejects(proc.setAssetDisposition(staffCtx, { assetIds: [drive.id], disposition: 'resale' }), /has not passed sanitisation/)
  await proc.setAssetDisposition(staffCtx, { assetIds: [screen.id], disposition: 'resale' })

  await proc.recordSanitization(staffCtx, { assetIds: [drive.id], method: 'clear', technique: 'overwrite', result: 'failed', failureReason: 'Bad sectors; stopped at 61%.' })
  assert.equal((await ctx.prisma.asset.findUnique({ where: { id: drive.id } })).sanitizationStatus, 'failed')
  await assert.rejects(proc.setAssetDisposition(staffCtx, { assetIds: [drive.id], disposition: 'resale' }), /has not passed sanitisation/)

  // Lot entry checks again, under the asset lock (status forced to bypass the disposition step).
  await ctx.prisma.asset.update({ where: { id: drive.id }, data: { status: 'ready_for_sale' } })
  await assert.rejects(lots.createLotFromAssets(staffCtx, { assetIds: [drive.id, screen.id], title: `Mixed ${uid()}` }), /has not passed sanitisation/)
  assert.equal((await ctx.prisma.asset.findUnique({ where: { id: screen.id } })).lotLineId, null, 'nothing allocated when one asset fails')
  await ctx.prisma.asset.update({ where: { id: drive.id }, data: { status: 'audited' } })

  await proc.recordSanitization(staffCtx, { assetIds: [drive.id], method: 'purge', technique: 'crypto_erase', tool: 'Blancco Drive Eraser', result: 'passed' })
  assert.equal((await ctx.prisma.asset.findUnique({ where: { id: drive.id } })).sanitizationStatus, 'passed')
  await proc.setAssetDisposition(staffCtx, { assetIds: [drive.id], disposition: 'resale' })
  const lot = await lots.createLotFromAssets(staffCtx, { assetIds: [drive.id, screen.id], title: `Mixed ${uid()}` })
  assert.equal(lot.status, 'draft')

  // Once on a lot, clearing the data-bearing flag to dodge the rule is refused by the list hook too.
  const fresh = await asset(jobId, laptops)
  await ctx.prisma.asset.update({ where: { id: fresh.id }, data: { status: 'ready_for_sale' } })
  await assert.rejects(ctx.sudo.db.Asset.updateOne({ where: { id: fresh.id }, data: { storageRemoved: false, isDataBearing: true } }), /sanitisation rule/)
})

test('concurrency: two sanitisation records at once on one asset both land and the status is recomputed', { skip }, async () => {
  const { jobId } = await job()
  const laptops = await category('Laptops', true)
  const a = await asset(jobId, laptops)
  await Promise.all([
    proc.recordSanitization(staffCtx, { assetIds: [a.id], method: 'clear', technique: 'overwrite', result: 'failed', failureReason: 'Timed out.', completedAt: new Date(Date.now() - 60_000).toISOString() }),
    proc.recordSanitization(staffCtx, { assetIds: [a.id], method: 'destroy', technique: 'shred', result: 'passed', witnessName: 'Laura Chen', completedAt: new Date().toISOString() }),
  ])
  assert.equal(await ctx.prisma.sanitizationRecord.count({ where: { assetId: a.id } }), 2)
  assert.equal((await ctx.prisma.asset.findUnique({ where: { id: a.id } })).sanitizationStatus, 'destroyed', 'latest record wins')
})

test('certificates: blocked until every data-bearing asset passes; issue, verify, revoke, reissue; job completion needs both', { skip }, async () => {
  const { jobId } = await job()
  const laptops = await category('Laptops', true)
  const monitors = await category('Monitors', false)
  const a = await asset(jobId, laptops)
  const b = await asset(jobId, laptops)
  const m = await asset(jobId, monitors)
  await proc.recordSanitization(staffCtx, { assetIds: [a.id], method: 'purge', technique: 'crypto_erase', result: 'passed' })
  await assert.rejects(proc.issueCertificate(staffCtx, { jobId, type: 'data_destruction' }), /1 data-bearing asset is not yet sanitised/)
  await assert.rejects(jobs.completeJob(staffCtx, { jobId }), /sanitis|certificate/i)
  await proc.recordSanitization(staffCtx, { assetIds: [b.id], method: 'destroy', technique: 'shred', result: 'passed' })
  await proc.setAssetDisposition(staffCtx, { assetIds: [a.id, b.id, m.id], disposition: 'recycle' })

  const cert = await proc.issueCertificate(staffCtx, { jobId, type: 'data_destruction' })
  const stored = await ctx.prisma.certificate.findUnique({ where: { id: cert.id } })
  assert.equal(stored.snapshot.assets.length, 2, 'lists every data-bearing serial')
  assert.ok(stored.pdfId)
  await assert.rejects(proc.issueCertificate(staffCtx, { jobId, type: 'data_destruction' }), /already issued. Revoke and reissue/)
  const v = await proc.verifyCertificate(ctx.base, { code: stored.verificationCode })
  assert.equal(v.status, 'issued')
  assert.equal(v.certificateNumber, stored.certificateNumber)

  await assert.rejects(jobs.completeJob(staffCtx, { jobId }), /recycling certificate/)
  await proc.issueCertificate(staffCtx, { jobId, type: 'recycling' })
  await proc.revokeCertificate(staffCtx, { certificateId: cert.id, reason: 'Wrong serial on line 2.', reissue: true })
  const all = await ctx.prisma.certificate.findMany({ where: { jobId, type: 'data_destruction' }, orderBy: { createdAt: 'asc' } })
  assert.deepEqual(all.map((c) => c.status), ['revoked', 'issued'])
  assert.equal(all[1].replacesId, cert.id)
  assert.equal((await proc.verifyCertificate(ctx.base, { code: stored.verificationCode })).status, 'revoked')

  await jobs.completeJob(staffCtx, { jobId })
  assert.equal((await ctx.prisma.job.findUnique({ where: { id: jobId } })).status, 'completed')
})

test('sanitisation gate on a direct list write: updateAsset cannot make an unsanitised data-bearing asset ready for sale or put it on a lot', { skip }, async () => {
  const { jobId } = await job()
  const laptops = await category('Laptops', true)
  const a = await asset(jobId, laptops)
  const lot = await f.lot(ctx.prisma, { status: 'draft' })
  assert.equal(a.sanitizationStatus, 'pending')
  // 1. GraphQL updateAsset as a staff member with every permission: status and lotLine are not writable fields.
  const gql = (query, variables) => staffCtx.graphql.raw({ query, variables })
  const viaStatus = await gql('mutation($id: ID!) { updateAsset(where: { id: $id }, data: { status: ready_for_sale }) { id status } }', { id: a.id })
  assert.ok(viaStatus.errors?.length, 'status is refused by the API')
  const viaLine = await gql('mutation($id: ID!, $line: ID!) { updateAsset(where: { id: $id }, data: { lotLine: { connect: { id: $line } } }) { id } }', { id: a.id, line: lot.lines[0].id })
  assert.ok(viaLine.errors?.length, 'lotLine is refused by the API')
  // 2. The same writes through sudo (field access off) still hit the validate hook.
  await assert.rejects(ctx.sudo.db.Asset.updateOne({ where: { id: a.id }, data: { status: 'ready_for_sale' } }), /has not passed sanitisation/)
  await assert.rejects(ctx.sudo.db.Asset.updateOne({ where: { id: a.id }, data: { lotLine: { connect: { id: lot.lines[0].id } } } }), /has not passed sanitisation/)
  await assert.rejects(ctx.sudo.db.Asset.createOne({ data: { job: { connect: { id: jobId } }, isDataBearing: true, sanitizationStatus: 'pending', status: 'ready_for_sale', serialNumber: `SN${uid()}` } }), /has not passed sanitisation/)
  const after = await ctx.prisma.asset.findUnique({ where: { id: a.id } })
  assert.equal(after.status, 'audited')
  assert.equal(after.lotLineId, null)
  // 3. Once it passes, the same sudo write is allowed: the hook blocks the rule, not the field.
  await proc.recordSanitization(staffCtx, { assetIds: [a.id], method: 'purge', technique: 'crypto_erase', result: 'passed' })
  await ctx.sudo.db.Asset.updateOne({ where: { id: a.id }, data: { status: 'ready_for_sale' } })
  assert.equal((await ctx.prisma.asset.findUnique({ where: { id: a.id } })).status, 'ready_for_sale')
})

test('settlement: build from sold assets, review, publish with a PDF the client downloads, staff records a dispute, republish, pay out', { skip }, async () => {
  const { jobId, org } = await job('received', undefined, { pricingModel: 'revenue_share', revenueShareBps: 7000, lines: [{ description: 'Drive shredding', quantity: 4, unitPriceMinor: 1_000, kind: 'shred' }] })
  const monitors = await category('Monitors', false)
  const m1 = await asset(jobId, monitors, { model: 'P2419H' })
  const m2 = await asset(jobId, monitors, { model: 'P2419H' })
  await proc.setAssetDisposition(staffCtx, { assetIds: [m1.id, m2.id], disposition: 'resale' })
  const draft = await lots.createLotFromAssets(staffCtx, { assetIds: [m1.id, m2.id], title: `Monitors ${uid()}` })
  await ctx.prisma.lot.update({ where: { id: draft.id }, data: { closesAt: new Date(Date.now() + 3_600_000) } })
  await lots.publishLot(staffCtx, { lotId: draft.id })
  const { user: buyerUser } = await f.buyer(ctx.prisma)
  const bid = await lots.placeBid(await ctx.as(buyerUser.id), { lotNumber: draft.lotNumber, amountMinor: 17_300, idempotencyKey: f.key() })
  await f.closeLot(ctx.prisma, draft.id, lots.advanceLotClock)
  await lots.awardLot(staffCtx, { lotId: draft.id, bidId: bid.bidId })
  const won = await ctx.prisma.notification.findFirst({ where: { userId: buyerUser.id, type: 'lot_won' } })
  assert.match(won.body, /for \$\d{1,3}(,\d{3})*\.\d{2} is due/, 'invoice amount in the store currency')

  const built = await settle.buildSettlement(staffCtx, { jobId })
  const lines = await ctx.prisma.settlementLine.findMany({ where: { settlementId: built.id }, orderBy: { createdAt: 'asc' } })
  assert.deepEqual(lines.map((l) => l.kind).sort(), ['asset_value', 'asset_value', 'service_fee'])
  assert.equal(lines.filter((l) => l.kind === 'asset_value').reduce((s, l) => s + l.grossMinor, 0), 17_300, 'the sold price of the job\'s assets')
  assert.equal(built.clientShareTotalMinor, lines.filter((l) => l.kind === 'asset_value').reduce((s, l) => s + l.clientAmountMinor, 0))
  assert.equal(built.feesTotalMinor, 4_000)
  assert.equal(built.netMinor, built.clientShareTotalMinor - 4_000)
  const adjusted = await settle.addSettlementLine(staffCtx, { settlementId: built.id, line: { kind: 'adjustment', description: 'Pallet return credit', grossMinor: 2_500 } })
  assert.equal(adjusted.netMinor, built.netMinor + 2_500)

  await settle.submitSettlementForReview(staffCtx, { settlementId: built.id })
  const client = await ctx.prisma.user.create({ data: { name: `Laura Chen ${uid()}`, email: `client-${uid()}@meridian.example`, password: 'x'.repeat(60), kind: 'client', clientRole: 'admin', clientOrganizationId: org.id, isActive: true } })
  const clientCtx = await ctx.as(client.id)
  await assert.rejects(docs.downloadSettlement(clientCtx, { settlementNumber: built.settlementNumber }), /not found/, 'not visible before publish')
  const published = await settle.publishSettlement(staffCtx, { settlementId: built.id })
  assert.equal(published.status, 'published')
  const pdf = await docs.downloadSettlement(clientCtx, { settlementNumber: built.settlementNumber })
  assert.equal(pdf.mimeType, 'application/pdf')
  assert.equal(Buffer.from(pdf.base64, 'base64').subarray(0, 5).toString(), '%PDF-')
  const notice = await ctx.prisma.notification.findFirst({ where: { userId: client.id, type: 'settlement_published' } })
  assert.match(notice.body, /We owe you \$\d/, 'net in the store currency')
  const other = await ctx.prisma.clientOrganization.create({ data: { name: `Other ${uid()}` } })
  const stranger = await ctx.prisma.user.create({ data: { name: 'Other client', email: `other-${uid()}@example.com`, password: 'x'.repeat(60), kind: 'client', clientRole: 'admin', clientOrganizationId: other.id, isActive: true } })
  await assert.rejects(docs.downloadSettlement(await ctx.as(stranger.id), { settlementNumber: built.settlementNumber }), /not found/, 'another client cannot read it')

  await assert.rejects(settle.recordSettlementDispute(staffCtx, { settlementId: built.id, note: '' }), /Write what the client disputes/)
  const disputed = await settle.recordSettlementDispute(staffCtx, { settlementId: built.id, note: 'Client says one monitor was theirs to keep.' })
  assert.equal(disputed.status, 'disputed')
  assert.equal(disputed.disputeRecordedById, staffUser.id)
  await assert.rejects(settle.recordSettlementPayout(staffCtx, { settlementId: built.id, method: 'ach', reference: 'ACH 1' }), /Resolve the dispute/)
  const audit = await ctx.prisma.auditEvent.findFirst({ where: { entityId: built.id, action: 'settlement.disputed' } })
  assert.equal(audit.reason, 'Client says one monitor was theirs to keep.')
  assert.ok((await docs.downloadSettlement(clientCtx, { settlementNumber: built.settlementNumber })).base64, 'still downloadable while disputed')

  await settle.removeSettlementLine(staffCtx, { lineId: (await ctx.prisma.settlementLine.findFirst({ where: { settlementId: built.id, kind: 'adjustment' } })).id })
  const again = await settle.publishSettlement(staffCtx, { settlementId: built.id })
  assert.equal(again.status, 'published')
  assert.notEqual(again.pdfId, published.pdfId, 'a new statement PDF')
  const paid = await settle.recordSettlementPayout(staffCtx, { settlementId: built.id, method: 'ach', reference: 'ACH 20261122' })
  assert.equal(paid.status, 'paid')
})

test('link base: saved site address first, else the origin of a staff request, never a buyer\'s Host header', { skip }, async () => {
  const s = await f.settings(ctx.prisma)
  const saved = s.storefrontUrl
  const staffReq = { headers: { host: 'staff.recycler.example', 'x-forwarded-proto': 'https' } }
  const buyerReq = { headers: { host: 'evil.example' } }
  try {
    await ctx.prisma.storeSettings.update({ where: { id: 1 }, data: { storefrontUrl: '' } })
    const staffSession = staffCtx.session
    const { user } = await f.buyer(ctx.prisma)
    const buyerSession = (await ctx.as(user.id)).session
    assert.equal(await services.siteBase(ctx.prisma, { req: staffReq, session: staffSession }), 'https://staff.recycler.example')
    assert.equal(await services.siteBase(ctx.prisma, { req: buyerReq, session: buyerSession }), 'https://staff.recycler.example', 'a buyer request does not move it')
    assert.equal(await services.siteBase(ctx.prisma, { req: buyerReq, session: null }), 'https://staff.recycler.example', 'nor an anonymous one')
    assert.equal(await services.siteBase(ctx.prisma), 'https://staff.recycler.example', 'the clock and email sender use the last staff origin')
    await ctx.sudo.db.StoreSettings.updateOne({ where: { id: '1' }, data: { storefrontUrl: 'recycle.riverbend.example/some/path' } })
    assert.equal((await ctx.prisma.storeSettings.findUnique({ where: { id: 1 } })).storefrontUrl, 'https://recycle.riverbend.example', 'saved as an origin')
    assert.equal(await services.siteBase(ctx.prisma, { req: staffReq, session: staffSession }), 'https://recycle.riverbend.example', 'the saved address wins')
    await assert.rejects(ctx.sudo.db.StoreSettings.updateOne({ where: { id: '1' }, data: { storefrontUrl: 'not a url at all' } }), /https:\/\/your-domain/)
  } finally {
    await ctx.prisma.storeSettings.update({ where: { id: 1 }, data: { storefrontUrl: saved } })
  }
})

function xlsx(rows) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Manifest')
  return { filename: 'manifest.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }).toString('base64') }
}

test('manifest import: header found under a title block, columns proposed, row errors shown, formulas neutralised, commit makes lines', { skip }, async () => {
  const file = xlsx([
    ['Bluewater ITAD - lot manifest'],
    ['Prepared 2026-11-20'],
    [],
    ['Line #', 'Make', 'Model', 'Description', 'Qty', 'Grade', 'Serial Number'],
    [1, 'Dell', 'Latitude 5420', 'i5, 16 GB, 256 GB', 24, 'B', ''],
    [2, 'HP', 'EliteDesk 800 G6', '=HYPERLINK("http://x","click")', 12, 'A', ''],
    [3, 'Lenovo', 'T480', 'No battery', 'ten', 'C', ''],
    [4, '', '', '', 5, '', ''],
  ])
  const imp = await sheets.uploadManifest(staffCtx, { file })
  assert.equal(imp.headerRow, 3)
  assert.equal(imp.mapping.manufacturer, 1)
  assert.equal(imp.mapping.quantity, 4)
  const checked = await sheets.validateManifest(staffCtx, { importId: imp.id })
  assert.equal(checked.rowCount, 4)
  assert.equal(checked.validCount, 2)
  const rows = checked.rows
  assert.equal(rows[2].rowNumber, 7, 'row numbers match the sheet')
  assert.match(rows[2].errors.join(' '), /not a whole number/)
  assert.match(rows[3].errors.join(' '), /no description, model or manufacturer/)
  await assert.rejects(sheets.commitManifest(staffCtx, { importId: imp.id, newLotTitle: `Manifest ${uid()}` }), /2 rows have errors/)
  // S6: fix the bad quantity in the preview; the fix survives a re-check of the file and is audited.
  await assert.rejects(sheets.editManifestRow(staffCtx, { importId: imp.id, rowNumber: 99, line: { quantity: '1' } }), /Row 99 is not in this import/)
  const edit = await sheets.editManifestRow(staffCtx, { importId: imp.id, rowNumber: 7, line: { quantity: '10' } })
  assert.deepEqual([edit.row.valid, edit.row.edited, edit.validCount, edit.errorCount], [true, true, 3, 1])
  const rechecked = await sheets.validateManifest(staffCtx, { importId: imp.id })
  assert.equal(rechecked.validCount, 3, 'the hand correction is kept when the file is checked again')
  const log = await ctx.prisma.auditEvent.findFirst({ where: { action: 'manifest.row_corrected', entityId: imp.id } })
  assert.equal(log.before.line.quantity, 0)
  assert.equal(log.after.line.quantity, 10)
  const gql = await (await ctx.as((await f.buyer(ctx.prisma)).user.id)).graphql.raw({ query: 'mutation($i: JSON) { editManifestRow(input: $i) { success error } }', variables: { i: { importId: imp.id, rowNumber: 7, line: { quantity: '1' } } } })
  assert.ok(gql.errors?.length || gql.data?.editManifestRow?.success === false, 'a buyer cannot edit an import')
  const done = await sheets.commitManifest(staffCtx, { importId: imp.id, newLotTitle: `Manifest ${uid()}`, skipInvalid: true })
  const lines = await ctx.prisma.lotLine.findMany({ where: { lotId: done.lotId }, orderBy: { lineNumber: 'asc' } })
  assert.deepEqual(lines.map((l) => [l.manufacturer, l.quantity]), [['Dell', 24], ['HP', 12], ['Lenovo', 10]])
  await assert.rejects(sheets.editManifestRow(staffCtx, { importId: imp.id, rowNumber: 7, line: { quantity: '2' } }), /committed/)
  await assert.rejects(sheets.commitManifest(staffCtx, { importId: imp.id, skipInvalid: true }), /already committed/)
  // Formula text is kept as text, and neutralised when the manifest goes back out to buyers.
  assert.match(lines[1].description, /^=HYPERLINK/)
  const out = await sheets.staffLotManifest(staffCtx, { lotId: done.lotId })
  const wb = XLSX.read(Buffer.from(out.base64, 'base64'), { type: 'buffer', cellFormula: true })
  const cells = Object.values(wb.Sheets[wb.SheetNames[0]]).filter((c) => c && typeof c === 'object' && 'v' in c)
  assert.ok(cells.every((c) => !c.f), 'no formula cells in the export')
  assert.ok(cells.some((c) => String(c.v).startsWith("'=HYPERLINK")), 'formula text is neutralised on export')
})

test('manifest import: an oversized file is refused before it is parsed', { skip }, async () => {
  const big = { filename: 'big.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: Buffer.alloc(10 * 1024 * 1024 + 10, 65).toString('base64') }
  await assert.rejects(sheets.uploadManifest(staffCtx, { file: big }), /10 MB or smaller|too large/i)
})
