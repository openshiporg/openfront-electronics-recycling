// Buy side against the real scratch Postgres: job transitions, receiving and seals,
// the sanitisation gate (sale, lot entry, data-bearing flag), certificates and the
// completion block, and manifest import from a real .xlsx file.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, root, uid } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, jobs, proc, lots, sheets, XLSX, staffCtx, staffUser, driverUser, driverCtx

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  jobs = require(path.join(root, 'features/keystone/domain/jobs.ts'))
  proc = require(path.join(root, 'features/keystone/domain/process.ts'))
  lots = require(path.join(root, 'features/keystone/domain/lots.ts'))
  sheets = require(path.join(root, 'features/keystone/domain/sheets.ts'))
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
async function job(until = 'received', containers = [{ label: 'P01', sealNumber: 'S-1', grossWeight: 200 }]) {
  const org = await ctx.prisma.clientOrganization.create({ data: { name: `Meridian Health ${uid()}`, legalName: 'Meridian Health Partners, Inc.' } })
  const out = await jobs.requestJob(staffCtx, { organizationId: org.id, contactName: 'Laura Chen', contactEmail: 'laura@meridian.example', site: { addressLine1: '1200 Riverside Dr', city: 'Columbus', region: 'OH', postalCode: '43215', countryCode: 'US' }, requestedDates: [today()], hasDataBearing: true, services: ['pickup', 'data_destruction'] })
  const jobId = out.jobId
  if (until === 'requested') return { jobId, org }
  await jobs.quoteJob(staffCtx, { jobId, pricingModel: 'fee_for_service', lines: [{ description: 'Collection', quantity: 1, unitPriceMinor: 15_000, kind: 'pickup' }] })
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
  const done = await sheets.commitManifest(staffCtx, { importId: imp.id, newLotTitle: `Manifest ${uid()}`, skipInvalid: true })
  const lines = await ctx.prisma.lotLine.findMany({ where: { lotId: done.lotId }, orderBy: { lineNumber: 'asc' } })
  assert.deepEqual(lines.map((l) => [l.manufacturer, l.quantity]), [['Dell', 24], ['HP', 12]])
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
