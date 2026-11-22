import { BULK, audit, dbNow, fail, inTransaction, lockRow, nextNumber, str, verificationCode, type Ctx, type Tx } from '../lib/core'
import { erasureResult, erasureTechnique, ERASURE_FIELDS, proposeMapping, detectHeaderRow } from '../lib/rules/sheets'
import { sanitizationAllowsSale, sanitizationStatusFromRecords } from '../lib/rules/lifecycle'
import { afterCommit, asDownload, decodeUpload, getSettings, notify, organizationUsers, siteBase, storeFile, storeUpload, type FileInput } from '../lib/services'
import { readWorkbook, writeWorkbook, XLSX_MIME } from '../lib/spreadsheet'
import { renderPdf } from '../lib/pdf'

// Audit bench, sanitisation, dispositions, holds, certificates, downstream (§3.5).

async function lockAsset(tx: Tx, id: string) {
  await lockRow(tx, 'Asset', id) || fail('Asset not found.')
  return tx.asset.findUnique({ where: { id } })
}

function assertNotHeld(asset: any) {
  if (asset.status === 'on_hold') fail(`${asset.assetNumber} is on hold: ${asset.holdReason || 'release the hold first'}.`)
}

/** R1: record or update an asset on the audit bench (new asset, or an existing one by id). */
export async function auditAsset(context: Ctx, args: { assetId?: string | null; jobId?: string | null; containerId?: string | null; parentId?: string | null; categoryId?: string | null; manufacturer?: string; model?: string; partNumber?: string; serialNumber?: string; clientAssetTag?: string; specs?: Record<string, unknown>; isDataBearing?: boolean | null; storageRemoved?: boolean; cosmeticGradeId?: string | null; functionalGradeId?: string | null; testNotes?: string; weight?: number | null; locationCode?: string; disposition?: string | null; photos?: FileInput[] }) {
  const staffId = context.session!.itemId
  const result = await inTransaction(context, async (tx) => {
    let asset: any
    const category = args.categoryId ? await tx.materialCategory.findUnique({ where: { id: args.categoryId } }) : null
    const specs = Object.fromEntries(Object.entries(args.specs ?? {}).slice(0, 30).map(([k, v]) => [str(k, 40), typeof v === 'number' ? v : str(v, 200)]))
    const common: Record<string, any> = {
      categoryId: args.categoryId ?? undefined,
      manufacturer: args.manufacturer !== undefined ? str(args.manufacturer, 120) : undefined,
      model: args.model !== undefined ? str(args.model, 120) : undefined,
      partNumber: args.partNumber !== undefined ? str(args.partNumber, 120) : undefined,
      serialNumber: args.serialNumber !== undefined ? str(args.serialNumber, 120) : undefined,
      clientAssetTag: args.clientAssetTag !== undefined ? str(args.clientAssetTag, 120) : undefined,
      specs: args.specs ? specs : undefined,
      storageRemoved: args.storageRemoved ?? undefined,
      cosmeticGradeId: args.cosmeticGradeId ?? undefined,
      functionalGradeId: args.functionalGradeId ?? undefined,
      testNotes: args.testNotes !== undefined ? str(args.testNotes, 2000) : undefined,
      weight: args.weight != null ? Math.max(0, Number(args.weight)) : undefined,
      locationCode: args.locationCode !== undefined ? str(args.locationCode, 40) : undefined,
      disposition: args.disposition && ['undecided', 'resale', 'parts', 'recycle', 'return'].includes(args.disposition) ? args.disposition : undefined,
      auditedById: staffId,
      auditedAt: new Date(),
    }
    if (args.assetId) {
      asset = await lockAsset(tx, args.assetId)
      assertNotHeld(asset)
      if (['allocated', 'sold', 'released', 'downstream', 'returned'].includes(asset.status)) fail(`${asset.assetNumber} is ${asset.status}; it cannot be re-audited.`)
      const isDataBearing = args.isDataBearing ?? asset.isDataBearing
      const records = await tx.sanitizationRecord.findMany({ where: { assetId: asset.id } })
      asset = await tx.asset.update({ where: { id: asset.id }, data: { ...common, isDataBearing, sanitizationStatus: sanitizationStatusFromRecords(isDataBearing, records), status: asset.status === 'received' ? 'audited' : asset.status } })
    } else {
      if (!args.jobId) fail('Choose the job the asset came in on.')
      const job = await tx.job.findUnique({ where: { id: args.jobId } })
      if (!job) fail('Job not found.')
      if (!['received', 'processing', 'collected'].includes(job.status)) fail(`${job.jobNumber} is ${job.status.replace(/_/g, ' ')}; audit assets on received jobs.`)
      if (job.status === 'received') await tx.job.update({ where: { id: job.id }, data: { status: 'processing' } })
      const serial = str(args.serialNumber, 120)
      if (serial) {
        const dupe = await tx.asset.findFirst({ where: { jobId: job.id, serialNumber: serial }, select: { assetNumber: true } })
        if (dupe) fail(`Serial ${serial} is already recorded on this job as ${dupe.assetNumber}.`)
      }
      const isDataBearing = args.isDataBearing ?? category?.dataBearingDefault ?? false
      asset = await tx.asset.create({ data: { ...Object.fromEntries(Object.entries(common).filter(([, v]) => v !== undefined)), assetNumber: await nextNumber(tx, 'asset'), jobId: job.id, organizationId: job.organizationId, containerId: args.containerId || null, parentId: args.parentId || null, isDataBearing, sanitizationStatus: isDataBearing ? 'pending' : 'not_required', status: 'audited' } })
      await tx.custodyEvent.create({ data: { jobId: job.id, assetId: asset.id, containerId: args.containerId || null, type: 'audited', actorId: staffId, occurredAt: new Date(), facilityId: job.facilityId } })
    }
    for (const photo of (args.photos ?? []).slice(0, 8)) {
      const stored = await storeUpload(tx, photo, { purpose: 'asset_photo', ownerClientOrganizationId: asset.organizationId, uploadedById: staffId })
      if (stored) await tx.assetPhoto.create({ data: { assetId: asset.id, imageId: stored.id, caption: '' } })
    }
    await audit(tx, { actorId: staffId, action: args.assetId ? 'asset.updated' : 'asset.audited', entityType: 'Asset', entityId: asset.id })
    return asset
  })
  return result
}

async function recomputeSanitization(tx: Tx, assetId: string) {
  const asset = await tx.asset.findUnique({ where: { id: assetId } })
  const records = await tx.sanitizationRecord.findMany({ where: { assetId } })
  const status = sanitizationStatusFromRecords(asset.isDataBearing || records.length > 0, records)
  return tx.asset.update({ where: { id: assetId }, data: { sanitizationStatus: status } })
}

const METHODS = ['clear', 'purge', 'destroy']
const TECHNIQUES = ['overwrite', 'block_erase', 'crypto_erase', 'secure_erase', 'degauss', 'shred', 'crush', 'disintegrate']

/** R5: one record per sanitisation; the asset status is recomputed from all its records. */
export async function recordSanitization(context: Ctx, args: { assetIds: string[]; method: string; technique: string; standard?: string; tool?: string; toolVersion?: string; reportReference?: string; result: string; failureReason?: string; witnessName?: string; startedAt?: string | null; completedAt?: string | null; reportFile?: FileInput | null }) {
  const method = METHODS.includes(args.method) ? args.method : fail('Choose clear, purge or destroy.')
  const technique = TECHNIQUES.includes(args.technique) ? args.technique : fail('Choose the technique.')
  const outcome = args.result === 'failed' ? 'failed' : args.result === 'passed' ? 'passed' : fail('Choose passed or failed.')
  if (outcome === 'failed' && !str(args.failureReason, 500)) fail('Write why it failed.')
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort()
  if (!ids.length) fail('Choose at least one asset.')
  const staffId = context.session!.itemId
  return inTransaction(context, async (tx) => {
    const file = args.reportFile ? await storeUpload(tx, args.reportFile, { purpose: 'erasure_report', uploadedById: staffId }) : null
    const completedAt = args.completedAt ? new Date(args.completedAt) : new Date()
    const out = []
    for (const id of ids) {
      const asset = await lockAsset(tx, id)
      assertNotHeld(asset)
      if (['sold', 'released', 'downstream', 'returned'].includes(asset.status)) fail(`${asset.assetNumber} has left our custody.`)
      await tx.sanitizationRecord.create({ data: { assetId: id, method, technique, standard: str(args.standard, 120) || 'NIST SP 800-88 Rev. 1', tool: str(args.tool, 120), toolVersion: str(args.toolVersion, 60), reportReference: str(args.reportReference, 120), reportFileId: file?.id ?? null, startedAt: args.startedAt ? new Date(args.startedAt) : null, completedAt, result: outcome, failureReason: str(args.failureReason, 500), operatorId: staffId, witnessName: str(args.witnessName, 120) } })
      const updated = await recomputeSanitization(tx, id)
      await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: 'sanitized', actorId: staffId, occurredAt: completedAt, notes: `${method} / ${technique}: ${outcome}` } })
      out.push(updated)
    }
    await audit(tx, { actorId: staffId, action: 'sanitization.recorded', entityType: 'Asset', entityId: ids[0], after: { assets: ids.length, method, technique, result: outcome } })
    return out
  }, BULK)
}

/** R6: import an erasure tool's report (Blancco, WipeDrive, KillDisk, etc. exported to Excel or CSV). */
export async function importErasureReport(context: Ctx, args: { file: FileInput; tool?: string; commit?: boolean; importId?: string | null }) {
  const staffId = context.session!.itemId
  if (args.importId && args.commit) return commitErasureImport(context, args.importId)
  const decoded = decodeUpload(args.file)
  if (!decoded) fail('Choose the erasure report.')
  const sheet = readWorkbook(decoded.bytes)
  const headerRow = detectHeaderRow(sheet.rows, ERASURE_FIELDS)
  const headers = sheet.rows[headerRow] ?? []
  const map = proposeMapping(headers, ERASURE_FIELDS)
  if (map.serial == null) fail('The report has no serial number column.')
  if (map.result == null) fail('The report has no result or status column.')
  const parsed = sheet.rows.slice(headerRow + 1).map((r, i) => [r, i] as const).filter(([r]) => r.some((c) => String(c ?? '').trim())).map(([r, i]) => {
    const serial = String(r[map.serial] ?? '').trim()
    const result = erasureResult(r[map.result])
    const technique = erasureTechnique(map.method != null ? r[map.method] : '')
    return { row: headerRow + i + 2, serial, result, resultText: String(r[map.result] ?? ''), method: technique.method, technique: technique.technique, standard: map.method != null ? String(r[map.method] ?? '') : '', startedAt: map.startedAt != null ? String(r[map.startedAt] ?? '') : '', completedAt: map.completedAt != null ? String(r[map.completedAt] ?? '') : '', reportReference: map.reportReference != null ? String(r[map.reportReference] ?? '') : '', toolVersion: map.toolVersion != null ? String(r[map.toolVersion] ?? '') : '' }
  })
  const serials = [...new Set(parsed.map((p) => p.serial).filter(Boolean))]
  const assets = await context.prisma.asset.findMany({ where: { serialNumber: { in: serials }, status: { notIn: ['sold', 'released', 'downstream', 'returned'] } }, select: { id: true, assetNumber: true, serialNumber: true, jobId: true } })
  const bySerial = new Map<string, any[]>()
  for (const a of assets) bySerial.set(a.serialNumber, [...(bySerial.get(a.serialNumber) ?? []), a])
  const rows = parsed.map((p) => {
    const matches = bySerial.get(p.serial) ?? []
    const problem = !p.serial ? 'No serial' : p.result == null ? `Unknown result "${p.resultText}"` : !matches.length ? 'No asset with this serial' : matches.length > 1 ? `Serial matches ${matches.length} assets` : null
    return { ...p, assetId: matches.length === 1 ? matches[0].id : null, assetNumber: matches.length === 1 ? matches[0].assetNumber : '', problem }
  })
  const matched = rows.filter((r) => !r.problem).length
  return inTransaction(context, async (tx) => {
    const file = await storeFile(tx, { ...decoded, purpose: 'erasure_report', uploadedById: staffId })
    return tx.erasureImport.create({ data: { fileId: file.id, originalFilename: decoded.filename, tool: str(args.tool, 120), status: 'validated', rowCount: rows.length, matchedCount: matched, unmatched: rows.filter((r) => r.problem).slice(0, 500), rows: rows.slice(0, 5000), uploadedById: staffId } })
  })
}

async function commitErasureImport(context: Ctx, importId: string) {
  const staffId = context.session!.itemId
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'ErasureImport', importId) || fail('Import not found.')
    const imp = await tx.erasureImport.findUnique({ where: { id: importId } })
    if (imp.status !== 'validated') fail(`This import is ${imp.status}.`)
    const rows = ((imp.rows as any[]) ?? []).filter((r) => !r.problem && r.assetId)
    if (!rows.length) fail('No rows matched an asset.')
    const ids = [...new Set(rows.map((r) => r.assetId as string))].sort()
    for (const id of ids) await lockRow(tx, 'Asset', id)
    for (const r of rows) {
      const parseDate = (v: string) => {
        const d = v ? new Date(v) : null
        return d && !Number.isNaN(d.getTime()) ? d : null
      }
      await tx.sanitizationRecord.create({ data: { assetId: r.assetId, method: r.method, technique: r.technique, standard: r.standard || 'NIST SP 800-88 Rev. 1', tool: imp.tool, toolVersion: r.toolVersion, reportReference: r.reportReference, reportFileId: imp.fileId, startedAt: parseDate(r.startedAt), completedAt: parseDate(r.completedAt) ?? new Date(), result: r.result, failureReason: r.result === 'failed' ? r.resultText : '', operatorId: staffId, importBatchId: imp.id } })
    }
    for (const id of ids) await recomputeSanitization(tx, id)
    await audit(tx, { actorId: staffId, action: 'erasure_import.committed', entityType: 'ErasureImport', entityId: imp.id, after: { records: rows.length } })
    return tx.erasureImport.update({ where: { id: imp.id }, data: { status: 'committed' } })
  })
}

/** R7: a second person checks a sample. Self-verification is refused. */
export async function verifySanitization(context: Ctx, args: { recordId: string; note?: string; confirmed: boolean }) {
  const staffId = context.session!.itemId
  return inTransaction(context, async (tx) => {
    const record = await tx.sanitizationRecord.findUnique({ where: { id: str(args.recordId, 60) } })
    if (!record) fail('Record not found.')
    if (record.operatorId === staffId) fail('A record must be verified by someone other than the operator.')
    if (record.verifiedById) fail('This record is already verified.')
    await lockRow(tx, 'Asset', record.assetId)
    // Records are append-only; verification is stored on the record through raw SQL-free prisma update of the verification fields only.
    const updated = await tx.sanitizationRecord.update({ where: { id: record.id }, data: { verifiedById: staffId, verifiedAt: new Date(), verificationNote: `${args.confirmed ? 'Confirmed' : 'Not confirmed'}${args.note ? `: ${str(args.note, 500)}` : ''}` } })
    if (!args.confirmed) {
      await tx.sanitizationRecord.create({ data: { assetId: record.assetId, method: record.method, technique: record.technique, standard: record.standard, tool: 'Verification', result: 'failed', failureReason: `Verification sample failed: ${str(args.note, 500) || 'data found'}`, operatorId: staffId, completedAt: new Date() } })
      await recomputeSanitization(tx, record.assetId)
    }
    await audit(tx, { actorId: staffId, action: args.confirmed ? 'sanitization.verified' : 'sanitization.verification_failed', entityType: 'SanitizationRecord', entityId: record.id, reason: str(args.note, 500) })
    return updated
  })
}

/** Pick a verification sample: the configured share of unverified passed records, at random. */
export async function sanitizationSample(context: Ctx, args: { limit?: number }) {
  const settings = await getSettings(context.prisma)
  const pool = await context.prisma.sanitizationRecord.findMany({ where: { verifiedById: null, result: 'passed', tool: { not: 'Verification' } }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 2000 })
  const want = Math.min(args.limit ?? 50, Math.max(pool.length ? 1 : 0, Math.ceil((pool.length * settings.sanitizationVerificationSampleBps) / 10_000)))
  const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, want).map((r: any) => r.id)
  return context.prisma.sanitizationRecord.findMany({ where: { id: { in: picked } }, include: { asset: { select: { id: true, assetNumber: true, serialNumber: true, manufacturer: true, model: true } }, operator: { select: { name: true } } } })
}

/** R8: disposition; ready_for_sale checks sanitisation. */
export async function setAssetDisposition(context: Ctx, args: { assetIds: string[]; disposition: string }) {
  const disposition = ['resale', 'parts', 'recycle', 'return', 'undecided'].includes(args.disposition) ? args.disposition : fail('Choose resale, parts, recycle or return.')
  const staffId = context.session!.itemId
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort()
  if (!ids.length) fail('Choose at least one asset.')
  return inTransaction(context, async (tx) => {
    const out = []
    for (const id of ids) {
      const asset = await lockAsset(tx, id)
      assertNotHeld(asset)
      if (!['received', 'audited', 'ready_for_sale', 'recycling'].includes(asset.status)) fail(`${asset.assetNumber} is ${asset.status}; its disposition cannot change.`)
      let status = asset.status
      if (disposition === 'resale' || disposition === 'parts') {
        if (!sanitizationAllowsSale(asset)) fail(`${asset.assetNumber} has not passed sanitisation; it cannot be sold.`)
        status = 'ready_for_sale'
      } else if (disposition === 'recycle') status = 'recycling'
      else if (disposition === 'return') status = 'returned'
      else status = asset.status === 'ready_for_sale' || asset.status === 'recycling' ? 'audited' : asset.status
      const updated = await tx.asset.update({ where: { id }, data: { disposition, status } })
      if (status !== asset.status) await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: status === 'returned' ? 'returned_to_client' : 'moved', actorId: staffId, occurredAt: new Date(), notes: `Disposition ${disposition}` } })
      out.push(updated)
    }
    await audit(tx, { actorId: staffId, action: 'asset.disposition', entityType: 'Asset', entityId: ids[0], after: { assets: ids.length, disposition } })
    return out
  }, BULK)
}

export async function placeAssetHold(context: Ctx, args: { assetIds: string[]; reason: string }) {
  const reason = str(args.reason, 500) || fail('Write the reason for the hold.')
  const staffId = context.session!.itemId
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort()
  return inTransaction(context, async (tx) => {
    const out = []
    for (const id of ids) {
      const asset = await lockAsset(tx, id)
      if (asset.status === 'on_hold') continue
      if (['sold', 'released', 'downstream', 'returned'].includes(asset.status)) fail(`${asset.assetNumber} has left our custody.`)
      if (asset.status === 'allocated') fail(`${asset.assetNumber} is on a lot; take it off the lot first.`)
      out.push(await tx.asset.update({ where: { id }, data: { status: 'on_hold', holdFromStatus: asset.status, holdReason: reason } }))
      await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: 'hold_placed', actorId: staffId, occurredAt: new Date(), notes: reason } })
    }
    await audit(tx, { actorId: staffId, action: 'asset.hold', entityType: 'Asset', entityId: ids[0] ?? '', after: { assets: out.length }, reason })
    return out
  }, BULK)
}

export async function releaseAssetHold(context: Ctx, args: { assetIds: string[]; note?: string }) {
  const staffId = context.session!.itemId
  const ids = [...new Set((args.assetIds ?? []).map((i) => str(i, 60)))].sort()
  return inTransaction(context, async (tx) => {
    const out = []
    for (const id of ids) {
      const asset = await lockAsset(tx, id)
      if (asset.status !== 'on_hold') continue
      out.push(await tx.asset.update({ where: { id }, data: { status: asset.holdFromStatus || 'audited', holdFromStatus: '', holdReason: '' } }))
      await tx.custodyEvent.create({ data: { assetId: id, jobId: asset.jobId, type: 'hold_released', actorId: staffId, occurredAt: new Date(), notes: str(args.note, 500) } })
    }
    await audit(tx, { actorId: staffId, action: 'asset.hold_released', entityType: 'Asset', entityId: ids[0] ?? '', after: { assets: out.length }, reason: str(args.note, 500) })
    return out
  }, BULK)
}

/** R3: export assets to Excel (also used to send a client their asset list). */
export async function exportAssets(context: Ctx, args: { jobId?: string | null; organizationId?: string | null; search?: string | null; status?: string | null; forClient?: boolean }) {
  const where: any = {}
  if (args.jobId) where.jobId = args.jobId
  if (args.organizationId) where.organizationId = args.organizationId
  if (args.status) where.status = args.status
  if (args.search) where.OR = [{ serialNumber: { contains: str(args.search, 120), mode: 'insensitive' } }, { clientAssetTag: { contains: str(args.search, 120), mode: 'insensitive' } }, { assetNumber: { contains: str(args.search, 120), mode: 'insensitive' } }]
  const assets = await context.prisma.asset.findMany({ where, take: 20_000, orderBy: { assetNumber: 'asc' }, include: { category: { select: { name: true } }, job: { select: { jobNumber: true } }, organization: { select: { name: true } }, cosmeticGrade: { select: { label: true } }, functionalGrade: { select: { label: true } }, sanitizationRecords: { orderBy: { completedAt: 'desc' }, take: 1 } } })
  const header = ['Asset', 'Job', 'Client', 'Client tag', 'Category', 'Manufacturer', 'Model', 'Serial', 'Data bearing', 'Sanitisation', 'Method', 'Completed', 'Cosmetic', 'Functional', 'Status', 'Disposition', ...(args.forClient ? [] : ['Location', 'Sold price'])]
  const rows = assets.map((a: any) => {
    const r = a.sanitizationRecords[0]
    return [a.assetNumber, a.job?.jobNumber ?? '', a.organization?.name ?? '', a.clientAssetTag, a.category?.name ?? '', a.manufacturer, a.model, a.serialNumber, a.isDataBearing ? 'Yes' : 'No', a.sanitizationStatus.replace(/_/g, ' '), r ? `${r.method} / ${r.technique}` : '', r?.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : '', a.cosmeticGrade?.label ?? '', a.functionalGrade?.label ?? '', a.status.replace(/_/g, ' '), a.disposition, ...(args.forClient ? [] : [a.locationCode, a.soldPriceMinor != null ? a.soldPriceMinor / 100 : ''])]
  })
  const name = args.jobId ? (assets[0]?.job?.jobNumber ?? 'job') : 'assets'
  return asDownload(`${name}-assets.xlsx`, XLSX_MIME, writeWorkbook([{ name: 'Assets', rows: [header, ...rows] }]))
}

// ---------------------------------------------------------------- certificates (Y2)

async function certificatePdf(tx: Tx, cert: any, context?: Pick<Ctx, 'req' | 'session'>) {
  const settings = await getSettings(tx)
  const s = cert.snapshot
  const base = await siteBase(tx, context)
  const blocks: any[] = [
    { kind: 'title', text: cert.type === 'data_destruction' ? 'Certificate of Data Destruction' : 'Certificate of Recycling' },
    { kind: 'pairs', pairs: [['Certificate', cert.certificateNumber], ['Verification code', cert.verificationCode], ['Verify at', `${base}/verify/${cert.verificationCode}`], ['Issued', new Date(cert.issuedAt).toUTCString()], ['Client', s.client.name], ['Job', s.job.jobNumber], ['Collected', s.job.collectedAt ? new Date(s.job.collectedAt).toDateString() : '-'], ['Facility', s.facility ?? '-']] },
  ]
  if (cert.replacesNumber) blocks.push({ kind: 'text', text: `This certificate replaces ${cert.replacesNumber}, which was revoked.` })
  if (cert.type === 'data_destruction') {
    blocks.push({ kind: 'text', text: `${settings.legalName || settings.businessName} certifies that the data-bearing devices listed below, received from the client named above under chain of custody, were sanitised according to NIST SP 800-88 Rev. 1 as recorded.` })
    blocks.push({ kind: 'table', headers: ['Asset', 'Type', 'Manufacturer / model', 'Serial', 'Method', 'Technique', 'Result', 'Date'], widths: [1.1, 1, 2, 1.6, 0.8, 1, 0.8, 1], rows: s.assets.map((a: any) => [a.assetNumber, a.category, `${a.manufacturer} ${a.model}`.trim(), a.serialNumber, a.method, a.technique, a.result, a.completedAt ? a.completedAt.slice(0, 10) : '']) })
    blocks.push({ kind: 'pairs', pairs: [['Devices', String(s.assets.length)], ['Destroyed', String(s.assets.filter((a: any) => a.method === 'destroy').length)], ['Purged or cleared', String(s.assets.filter((a: any) => a.method !== 'destroy').length)]] })
  } else {
    blocks.push({ kind: 'text', text: `${settings.legalName || settings.businessName} certifies that the electronic equipment received from the client named above was reused, resold or recycled responsibly, and that no material was sent to landfill or to a vendor not approved for it.` })
    blocks.push({ kind: 'table', headers: ['Category', 'Weight', 'Units'], widths: [3, 1, 1], align: ['left', 'right', 'right'], rows: s.categories.map((c: any) => [c.name, `${c.weight.toFixed(1)} ${settings.weightUnit}`, String(c.units)]) })
    blocks.push({ kind: 'pairs', pairs: [['Total weight', `${s.totalWeight.toFixed(1)} ${settings.weightUnit}`], ['Units for reuse', String(s.reuseUnits)], ['Units recycled', String(s.recycleUnits)]] })
  }
  if (s.certifications?.length) blocks.push({ kind: 'text', text: `Certifications held: ${s.certifications.join(', ')}` })
  blocks.push({ kind: 'signature', label: `Issued by ${s.issuedBy}`, value: s.issuedBy })
  return renderPdf({ header: settings.businessName, headerRight: cert.certificateNumber, footer: `Verify this certificate with code ${cert.verificationCode}`, blocks })
}

async function certificateSnapshot(tx: Tx, job: any, type: string, issuedBy: string) {
  const org = await tx.clientOrganization.findUnique({ where: { id: job.organizationId } })
  const facility = job.facilityId ? await tx.facility.findUnique({ where: { id: job.facilityId } }) : null
  const certifications = await tx.certification.findMany({ where: { isPublic: true, OR: [{ facilityId: null }, { facilityId: job.facilityId }], AND: [{ OR: [{ expiresOn: null }, { expiresOn: { gt: new Date() } }] }] }, select: { name: true, otherName: true } })
  const base = { client: { name: org.legalName || org.name }, job: { jobNumber: job.jobNumber, collectedAt: job.collectedAt }, facility: facility ? `${facility.name}, ${facility.city}` : null, issuedBy, certifications: certifications.map((c: any) => (c.name === 'Other' ? c.otherName : c.name)) }
  if (type === 'data_destruction') {
    const assets = await tx.asset.findMany({ where: { jobId: job.id, isDataBearing: true }, include: { category: { select: { name: true } }, sanitizationRecords: { orderBy: { completedAt: 'desc' } } }, orderBy: { assetNumber: 'asc' } })
    return {
      ...base,
      assets: assets.map((a: any) => {
        const ok = a.sanitizationRecords.find((r: any) => r.result === 'passed')
        return { assetNumber: a.assetNumber, category: a.category?.name ?? '', manufacturer: a.manufacturer, model: a.model, serialNumber: a.serialNumber, method: ok?.method ?? '', technique: ok?.technique ?? '', result: a.sanitizationStatus, completedAt: ok?.completedAt ? new Date(ok.completedAt).toISOString() : null }
      }),
    }
  }
  const assets = await tx.asset.findMany({ where: { jobId: job.id }, include: { category: { select: { name: true } } } })
  const commodities = await tx.commodityLine.findMany({ where: { jobId: job.id }, include: { category: { select: { name: true } } } })
  const cats = new Map<string, { name: string; weight: number; units: number }>()
  for (const a of assets) {
    const k = a.category?.name ?? 'Equipment'
    const c = cats.get(k) ?? { name: k, weight: 0, units: 0 }
    c.weight += Number(a.weight ?? 0)
    c.units += 1
    cats.set(k, c)
  }
  for (const l of commodities) {
    const k = l.category?.name ?? 'Mixed e-scrap'
    const c = cats.get(k) ?? { name: k, weight: 0, units: 0 }
    c.weight += Number(l.weight ?? 0)
    cats.set(k, c)
  }
  const categories = [...cats.values()]
  return { ...base, categories, totalWeight: categories.reduce((s, c) => s + c.weight, 0), reuseUnits: assets.filter((a: any) => ['resale', 'parts'].includes(a.disposition)).length, recycleUnits: assets.filter((a: any) => a.disposition === 'recycle').length }
}

export async function issueCertificate(context: Ctx, args: { jobId: string; type: string; replacesId?: string | null }) {
  const type = ['data_destruction', 'recycling'].includes(args.type) ? args.type : fail('Choose data destruction or recycling.')
  const staff = await context.prisma.user.findUnique({ where: { id: context.session!.itemId }, select: { name: true } })
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Job', args.jobId) || fail('Job not found.')
    const job = await tx.job.findUnique({ where: { id: args.jobId } })
    if (!['received', 'processing', 'completed', 'settled', 'closed'].includes(job.status)) fail('Certificates are issued once the job is processed.')
    if (type === 'data_destruction') {
      const open = await tx.asset.count({ where: { jobId: job.id, isDataBearing: true, sanitizationStatus: { notIn: ['passed', 'destroyed'] } } })
      if (open) fail(`${open} data-bearing asset${open === 1 ? ' is' : 's are'} not yet sanitised.`)
      const total = await tx.asset.count({ where: { jobId: job.id, isDataBearing: true } })
      if (!total) fail('This job has no data-bearing assets.')
    }
    let replaces = null
    if (args.replacesId) {
      await lockRow(tx, 'Certificate', args.replacesId)
      replaces = await tx.certificate.findUnique({ where: { id: args.replacesId } })
      if (!replaces || replaces.jobId !== job.id || replaces.type !== type) fail('The certificate being replaced does not match.')
      if (replaces.status !== 'revoked') fail('Revoke the old certificate first.')
    } else {
      const live = await tx.certificate.findFirst({ where: { jobId: job.id, type, status: 'issued' } })
      if (live) fail(`${live.certificateNumber} is already issued. Revoke and reissue to correct it.`)
    }
    const snapshot = await certificateSnapshot(tx, job, type, staff?.name ?? 'Staff')
    const cert = await tx.certificate.create({ data: { certificateNumber: await nextNumber(tx, 'certificate'), type, jobId: job.id, organizationId: job.organizationId, issuedAt: await dbNow(tx), issuedById: context.session!.itemId, verificationCode: verificationCode(), snapshot, status: 'issued', replacesId: replaces?.id ?? null } })
    const pdf = await certificatePdf(tx, { ...cert, replacesNumber: replaces?.certificateNumber }, context)
    const file = await storeFile(tx, { filename: `${cert.certificateNumber}.pdf`, mimeType: 'application/pdf', bytes: pdf, purpose: 'certificate', ownerClientOrganizationId: job.organizationId, uploadedById: context.session!.itemId })
    const updated = await tx.certificate.update({ where: { id: cert.id }, data: { pdfId: file.id } })
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'certificate_issued', title: `${cert.certificateNumber} for ${job.jobNumber}`, body: `Your ${type === 'data_destruction' ? 'data destruction' : 'recycling'} certificate is ready to download.`, link: `/client/jobs/${job.jobNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'certificate.issued', entityType: 'Certificate', entityId: cert.id, after: { type, jobId: job.id, replaces: replaces?.certificateNumber } })
    return updated
  }, BULK)
  afterCommit(context)
  return result
}

/**
 * Rebuilds a certificate's snapshot and PDF from the records as they stand. Only for
 * a certificate nobody has received yet (the starter seed, after it sets the history's
 * dates); a correction after issue is revoke and reissue.
 */
export async function rerenderCertificate(tx: Tx, certificateId: string) {
  const cert = await tx.certificate.findUnique({ where: { id: certificateId }, include: { issuedBy: { select: { name: true } }, replaces: { select: { certificateNumber: true } } } })
  if (!cert) fail('Certificate not found.')
  const job = await tx.job.findUnique({ where: { id: cert.jobId } })
  const snapshot = await certificateSnapshot(tx, job, cert.type, cert.issuedBy?.name ?? 'Staff')
  const pdf = await certificatePdf(tx, { ...cert, snapshot, replacesNumber: cert.replaces?.certificateNumber })
  const old = cert.pdfId
  const file = await storeFile(tx, { filename: `${cert.certificateNumber}.pdf`, mimeType: 'application/pdf', bytes: pdf, purpose: 'certificate', ownerClientOrganizationId: job.organizationId, uploadedById: cert.issuedById })
  await tx.certificate.update({ where: { id: cert.id }, data: { snapshot, pdfId: file.id } })
  if (old) await tx.storedFile.delete({ where: { id: old } })
}

export async function revokeCertificate(context: Ctx, args: { certificateId: string; reason: string; reissue?: boolean }) {
  const reason = str(args.reason, 500) || fail('Write why the certificate is revoked.')
  const revoked = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Certificate', args.certificateId) || fail('Certificate not found.')
    const cert = await tx.certificate.findUnique({ where: { id: args.certificateId } })
    if (cert.status !== 'issued') fail('This certificate is already revoked.')
    await audit(tx, { actorId: context.session!.itemId, action: 'certificate.revoked', entityType: 'Certificate', entityId: cert.id, reason })
    return tx.certificate.update({ where: { id: cert.id }, data: { status: 'revoked', revokedReason: reason, revokedAt: new Date() } })
  })
  if (args.reissue) return issueCertificate(context, { jobId: revoked.jobId, type: revoked.type, replacesId: revoked.id })
  return revoked
}

/** P8: public lookup by code. */
export async function verifyCertificate(context: Ctx, args: { code: string }) {
  const code = str(args.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 12) return null
  const cert = await context.prisma.certificate.findUnique({ where: { verificationCode: code } })
  if (!cert) return null
  const replacement = cert.status === 'revoked' ? await context.prisma.certificate.findFirst({ where: { replacesId: cert.id }, select: { certificateNumber: true, verificationCode: true, status: true } }) : null
  const s: any = cert.snapshot ?? {}
  return {
    certificateNumber: cert.certificateNumber,
    type: cert.type,
    status: cert.status,
    issuedAt: cert.issuedAt,
    revokedAt: cert.revokedAt,
    revokedReason: cert.status === 'revoked' ? cert.revokedReason : '',
    clientName: s.client?.name ?? '',
    jobNumber: s.job?.jobNumber ?? '',
    deviceCount: Array.isArray(s.assets) ? s.assets.length : null,
    totalWeight: s.totalWeight ?? null,
    facility: s.facility ?? '',
    replacedBy: replacement ? { certificateNumber: replacement.certificateNumber, verificationCode: replacement.verificationCode } : null,
  }
}

// ---------------------------------------------------------------- downstream (Y5)

export async function shipOutbound(context: Ctx, args: { shipmentId: string; carrier?: string; billOfLading?: string; shippedAt?: string | null }) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'OutboundShipment', args.shipmentId) || fail('Shipment not found.')
    const shipment = await tx.outboundShipment.findUnique({ where: { id: args.shipmentId }, include: { vendor: { include: { approvedCategories: { select: { id: true, name: true } } } }, lines: { include: { category: true, assets: { select: { id: true, assetNumber: true, status: true, sanitizationStatus: true, isDataBearing: true, storageRemoved: true, jobId: true } }, commodityLines: { select: { id: true } } } } } })
    if (shipment.status !== 'draft') fail('This shipment has already shipped.')
    if (!shipment.lines.length) fail('Add at least one line.')
    const vendor = shipment.vendor
    if (!vendor) fail('Choose the downstream vendor.')
    if (vendor.status !== 'approved') fail(`${vendor.name} is ${vendor.status}; ship only to an approved vendor.`)
    if (vendor.reviewDueOn && new Date(vendor.reviewDueOn) < new Date()) fail(`${vendor.name}'s approval review is overdue.`)
    const approved = new Set(vendor.approvedCategories.map((c: any) => c.id))
    const notApproved = shipment.lines.filter((l: any) => l.categoryId && !approved.has(l.categoryId))
    if (notApproved.length) fail(`${vendor.name} is not approved for ${notApproved.map((l: any) => l.category?.name).join(', ')}.`)
    for (const l of shipment.lines) for (const a of l.assets) {
      if (!['recycling', 'audited'].includes(a.status)) fail(`${a.assetNumber} is ${a.status}; only assets set to recycle can ship downstream.`)
      if (a.isDataBearing && !['passed', 'destroyed'].includes(a.sanitizationStatus) && !a.storageRemoved) fail(`${a.assetNumber} has not been sanitised.`)
    }
    const now = args.shippedAt ? new Date(args.shippedAt) : await dbNow(tx)
    const assetIds = shipment.lines.flatMap((l: any) => l.assets.map((a: any) => a.id))
    await tx.asset.updateMany({ where: { id: { in: assetIds } }, data: { status: 'downstream' } })
    for (const l of shipment.lines) for (const a of l.assets) await tx.custodyEvent.create({ data: { assetId: a.id, jobId: a.jobId, type: 'shipped_downstream', actorId: context.session!.itemId, occurredAt: now, facilityId: shipment.facilityId, notes: `${shipment.shipmentNumber} to ${vendor.name}` } })
    await audit(tx, { actorId: context.session!.itemId, action: 'outbound.shipped', entityType: 'OutboundShipment', entityId: shipment.id, after: { vendor: vendor.name, assets: assetIds.length } })
    return tx.outboundShipment.update({ where: { id: shipment.id }, data: { status: 'shipped', shippedAt: now, carrier: str(args.carrier, 120) || shipment.carrier, billOfLading: str(args.billOfLading, 120) || shipment.billOfLading } })
  })
  return result
}

export async function confirmOutboundReceipt(context: Ctx, args: { shipmentId: string; receivedWeight: number; receipt?: FileInput | null; close?: boolean }) {
  const weight = Number(args.receivedWeight)
  if (!Number.isFinite(weight) || weight <= 0) fail("Enter the weight on the vendor's receipt.")
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'OutboundShipment', args.shipmentId) || fail('Shipment not found.')
    const shipment = await tx.outboundShipment.findUnique({ where: { id: args.shipmentId } })
    if (shipment.status === 'receipt_confirmed' && args.close) return tx.outboundShipment.update({ where: { id: shipment.id }, data: { status: 'closed' } })
    if (shipment.status !== 'shipped') fail('Confirm receipt once the shipment has shipped.')
    const file = await storeUpload(tx, args.receipt, { purpose: 'downstream_receipt', uploadedById: context.session!.itemId })
    await audit(tx, { actorId: context.session!.itemId, action: 'outbound.receipt_confirmed', entityType: 'OutboundShipment', entityId: shipment.id, after: { receivedWeight: weight } })
    return tx.outboundShipment.update({ where: { id: shipment.id }, data: { status: args.close ? 'closed' : 'receipt_confirmed', receivedWeight: weight, receiptConfirmedAt: new Date(), receiptDocumentId: file?.id ?? shipment.receiptDocumentId } })
  })
}
