import { audit, fail, inTransaction, lockRow, nextNumber, requireBuyer, str, type Ctx } from '../lib/core'
import { applyManifestMapping, detectHeaderRow, MANIFEST_FIELDS, parseMoneyCell, proposeMapping, specKeysOf, specLabel, STORED_ROW_CAP } from '../lib/rules/sheets'
import { asDownload, decodeUpload, getSettings, readFileBytes, storeFile, type FileInput } from '../lib/services'
import * as XLSX from 'xlsx'
import { readWorkbook, writeWorkbook, XLSX_MIME } from '../lib/spreadsheet'
import { placeBidCore } from './lots'

// Manifest import (S6), lot manifest download (U4), bid sheets (U6).
// uploaded -> mapped -> validated -> committed | discarded. Nothing touches a lot until committed.

async function importById(db: any, id: string) {
  const row = await db.manifestImport.findUnique({ where: { id: str(id, 60) } })
  if (!row) fail('Import not found.')
  return row
}

export async function uploadManifest(context: Ctx, args: { file: FileInput; purpose?: string; targetJobId?: string | null }) {
  const decoded = decodeUpload(args.file)
  if (!decoded) fail('Choose a spreadsheet.')
  const sheet = readWorkbook(decoded.bytes)
  const headerRow = detectHeaderRow(sheet.rows)
  const headers = (sheet.rows[headerRow] ?? []).map((h) => String(h ?? '').trim())
  const purpose = args.purpose === 'asset_import' ? 'asset_import' : 'lot_manifest'
  const saved = await context.prisma.manifestMapping.findMany({ orderBy: { updatedAt: 'desc' }, take: 20 })
  const signature = headers.map((h) => h.toLowerCase()).join('|')
  const remembered = saved.find((m: any) => (m.mapping as any)?.signature === signature)
  const mapping = remembered ? (remembered.mapping as any).columns : proposeMapping(headers)
  return inTransaction(context, async (tx) => {
    const file = await storeFile(tx, { ...decoded, purpose: 'manifest_import', uploadedById: context.session!.itemId })
    return tx.manifestImport.create({
      data: { fileId: file.id, originalFilename: decoded.filename, status: 'uploaded', sheetName: sheet.sheetName, sheetNames: sheet.sheetNames, headerRow, headers, mapping, rowCount: Math.max(0, sheet.rows.length - headerRow - 1), purpose, targetJobId: args.targetJobId || null, uploadedById: context.session!.itemId },
    })
  })
}

/** Change the sheet, header row or column mapping. */
export async function mapManifest(context: Ctx, args: { importId: string; sheetName?: string | null; headerRow?: number | null; mapping: Record<string, number>; saveAs?: string | null }) {
  const imp = await importById(context.prisma, args.importId)
  if (['committed', 'discarded'].includes(imp.status)) fail(`This import is ${imp.status}.`)
  const file = await readFileBytes(context.prisma, imp.fileId)
  if (!file) fail('The uploaded file is missing.')
  const sheet = readWorkbook(file.bytes, args.sheetName ?? imp.sheetName)
  const headerRow = args.headerRow != null ? Math.max(0, Math.min(sheet.rows.length - 1, Math.round(args.headerRow))) : sheet.sheetName !== imp.sheetName ? detectHeaderRow(sheet.rows) : imp.headerRow
  const headers = (sheet.rows[headerRow] ?? []).map((h) => String(h ?? '').trim())
  const mapping: Record<string, number> = {}
  for (const [field, index] of Object.entries(args.mapping || {})) {
    if (!(field in MANIFEST_FIELDS)) continue
    const i = Math.round(Number(index))
    if (Number.isInteger(i) && i >= 0 && i < headers.length) mapping[field] = i
  }
  if (!('description' in mapping) && !('model' in mapping) && !('manufacturer' in mapping)) fail('Map at least a description, model or manufacturer column.')
  if (str(args.saveAs, 120)) {
    await context.prisma.manifestMapping.create({ data: { name: str(args.saveAs, 120), mapping: { signature: headers.map((h) => h.toLowerCase()).join('|'), columns: mapping } } })
  }
  return context.prisma.manifestImport.update({ where: { id: imp.id }, data: { status: 'mapped', sheetName: sheet.sheetName, headerRow, headers, mapping, rowCount: Math.max(0, sheet.rows.length - headerRow - 1), rows: [], validCount: null, errorCount: null } })
}

/** Apply the mapping to every row and store each row's result and errors. */
export async function validateManifest(context: Ctx, args: { importId: string }) {
  const imp = await importById(context.prisma, args.importId)
  if (!['uploaded', 'mapped', 'validated'].includes(imp.status)) fail(`This import is ${imp.status}.`)
  const file = await readFileBytes(context.prisma, imp.fileId)
  if (!file) fail('The uploaded file is missing.')
  const sheet = readWorkbook(file.bytes, imp.sheetName)
  const headerRow = imp.headerRow ?? 0
  const headers = sheet.rows[headerRow] ?? []
  const rows = applyManifestMapping(headers, sheet.rows.slice(headerRow + 1), (imp.mapping as any) ?? {}, headerRow + 2)
  if (!rows.length) fail('The sheet has no data rows under the header.')
  if (rows.length > STORED_ROW_CAP) fail(`A manifest can have at most ${STORED_ROW_CAP.toLocaleString()} lines. Split the file.`)
  const valid = rows.filter((r) => r.valid).length
  return context.prisma.manifestImport.update({ where: { id: imp.id }, data: { status: 'validated', rows: rows as any, rowCount: rows.length, validCount: valid, errorCount: rows.length - valid } })
}

/** Commit valid rows: to a new or existing draft lot, or as assets on a job. */
export async function commitManifest(context: Ctx, args: { importId: string; lotId?: string | null; newLotTitle?: string | null; saleEventId?: string | null; categoryId?: string | null; skipInvalid?: boolean }) {
  const staffId = context.session!.itemId
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'ManifestImport', args.importId) || fail('Import not found.')
    const imp = await tx.manifestImport.findUnique({ where: { id: args.importId } })
    if (imp.status !== 'validated') fail(imp.status === 'committed' ? 'This import was already committed.' : 'Validate the import first.')
    const rows = (imp.rows as any[]) ?? []
    const invalid = rows.filter((r) => !r.valid).length
    if (invalid && !args.skipInvalid) fail(`${invalid} row${invalid === 1 ? ' has' : 's have'} errors. Fix the file, or choose to skip them.`)
    const good = rows.filter((r) => r.valid)
    if (!good.length) fail('There are no valid rows to commit.')
    const categories = await tx.materialCategory.findMany({ select: { id: true, name: true, slug: true } })
    const categoryFor = (name: string) => {
      const n = name.trim().toLowerCase()
      return n ? categories.find((c: any) => c.name.toLowerCase() === n || c.slug === n || c.name.toLowerCase().replace(/s$/, '') === n.replace(/s$/, ''))?.id ?? null : null
    }
    if (imp.purpose === 'asset_import') {
      if (!imp.targetJobId) fail('Choose the job these assets belong to.')
      const job = await tx.job.findUnique({ where: { id: imp.targetJobId } })
      if (!job) fail('Job not found.')
      let created = 0
      for (const r of good) {
        const serials: string[] = r.line.serials.length ? r.line.serials : Array(r.line.quantity).fill('')
        for (const serial of serials) {
          const categoryId = categoryFor(r.line.category) || args.categoryId || null
          const cat = categoryId ? categories.find((c: any) => c.id === categoryId) : null
          const dataBearing = cat ? (await tx.materialCategory.findUnique({ where: { id: categoryId }, select: { dataBearingDefault: true } })).dataBearingDefault : false
          await tx.asset.create({ data: { assetNumber: await nextNumber(tx, 'asset'), jobId: job.id, organizationId: job.organizationId, categoryId, manufacturer: r.line.manufacturer, model: r.line.model, partNumber: r.line.partNumber, serialNumber: serial, clientAssetTag: r.line.extra?.['Asset Tag'] ?? '', specs: r.line.specs, isDataBearing: dataBearing, status: 'received', sanitizationStatus: dataBearing ? 'pending' : 'not_required', testNotes: r.line.notes } })
          created++
        }
      }
      await tx.manifestImport.update({ where: { id: imp.id }, data: { status: 'committed' } })
      await audit(tx, { actorId: staffId, action: 'assets.imported', entityType: 'Job', entityId: job.id, after: { created, importId: imp.id } })
      return { importId: imp.id, lotId: null, lotNumber: null, created }
    }
    let lot
    if (args.lotId) {
      await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
      lot = await tx.lot.findUnique({ where: { id: args.lotId } })
      if (lot.status !== 'draft') fail('Manifest lines can only be added to a draft lot.')
    } else {
      const settings = await getSettings(tx)
      const title = str(args.newLotTitle, 200) || imp.originalFilename.replace(/\.[^.]+$/, '')
      lot = await tx.lot.create({ data: { lotNumber: await nextNumber(tx, 'lot'), title, slug: '', status: 'draft', format: settings.defaultBidFormat, bidBasis: settings.defaultBidBasis, awardMode: settings.defaultAwardMode, saleEventId: args.saleEventId || null, categoryId: args.categoryId || null, sourceImportId: imp.id, description: [{ type: 'paragraph', children: [{ text: '' }] }] } })
    }
    const last = await tx.lotLine.findFirst({ where: { lotId: lot.id }, orderBy: { lineNumber: 'desc' }, select: { lineNumber: true } })
    let n = last?.lineNumber ?? 0
    for (const r of good) {
      await tx.lotLine.create({ data: { lotId: lot.id, lineNumber: ++n, categoryId: categoryFor(r.line.category), manufacturer: r.line.manufacturer, model: r.line.model, partNumber: r.line.partNumber, description: r.line.description, specs: r.line.specs, cosmeticGrade: r.line.cosmeticGrade, functionalGrade: r.line.functionalGrade, quantity: r.line.quantity, unit: r.line.unit, serials: r.line.serials, notes: r.line.notes, extra: r.line.extra } })
    }
    await tx.manifestImport.update({ where: { id: imp.id }, data: { status: 'committed' } })
    await audit(tx, { actorId: staffId, action: 'manifest.committed', entityType: 'Lot', entityId: lot.id, after: { lines: good.length, skipped: invalid, importId: imp.id } })
    return { importId: imp.id, lotId: lot.id, lotNumber: lot.lotNumber, created: good.length }
  })
}

export async function discardManifest(context: Ctx, args: { importId: string }) {
  const imp = await importById(context.prisma, args.importId)
  if (imp.status === 'committed') fail('A committed import cannot be discarded.')
  return context.prisma.manifestImport.update({ where: { id: imp.id }, data: { status: 'discarded' } })
}

/** R2: asset import from Excel goes through the same mapper with purpose asset_import. */
export async function importAssets(context: Ctx, args: { file: FileInput; jobId: string }) {
  const job = await context.prisma.job.findUnique({ where: { id: str(args.jobId, 60) } })
  if (!job) fail('Choose the job these assets belong to.')
  return uploadManifest(context, { file: args.file, purpose: 'asset_import', targetJobId: job.id })
}

// ---------------------------------------------------------------- downloads

function manifestRows(lines: any[]) {
  const specKeys = specKeysOf(lines)
  const extraKeys = [...new Set(lines.flatMap((l) => Object.keys(l.extra ?? {})))]
  const header = ['Line', 'Category', 'Manufacturer', 'Model', 'Part number', 'Description', ...specKeys.map(specLabel), 'Cosmetic grade', 'Functional grade', 'Quantity', 'Unit', 'Serials', 'Notes', ...extraKeys]
  const rows = lines.map((l) => [l.lineNumber, l.category?.name ?? '', l.manufacturer, l.model, l.partNumber, l.description, ...specKeys.map((k) => l.specs?.[k] ?? ''), l.cosmeticGrade, l.functionalGrade, l.quantity, l.unit, (Array.isArray(l.serials) ? l.serials : []).join(', '), l.notes, ...extraKeys.map((k) => l.extra?.[k] ?? '')])
  return { header, rows }
}

async function lotForBuyerDownload(context: Ctx, lotNumber: string) {
  const { companyId } = await requireBuyer(context)
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: companyId }, select: { status: true } })
  const settings = await getSettings(context.prisma)
  if (company.status !== 'approved' && settings.publicLotVisibility !== 'full') fail('Your company must be approved to see manifests.')
  const lot = await context.prisma.lot.findUnique({ where: { lotNumber: str(lotNumber, 40) }, include: { lines: { orderBy: { lineNumber: 'asc' }, include: { category: { select: { name: true } } } } } })
  if (!lot || !['scheduled', 'open', 'closed', 'awarded', 'completed'].includes(lot.status)) fail('Lot not found.')
  return { lot, companyId }
}

export async function downloadLotManifest(context: Ctx, args: { lotNumber: string }) {
  const { lot } = await lotForBuyerDownload(context, args.lotNumber)
  const { header, rows } = manifestRows(lot.lines)
  const bytes = writeWorkbook([{ name: 'Manifest', rows: [[`${lot.lotNumber}: ${lot.title}`], [], header, ...rows] }])
  return asDownload(`${lot.lotNumber}-manifest.xlsx`, XLSX_MIME, bytes)
}

export async function staffLotManifest(context: Ctx, args: { lotId: string }) {
  const lot = await context.prisma.lot.findUnique({ where: { id: str(args.lotId, 60) }, include: { lines: { orderBy: { lineNumber: 'asc' }, include: { category: { select: { name: true } } } } } })
  if (!lot) fail('Lot not found.')
  const { header, rows } = manifestRows(lot.lines)
  return asDownload(`${lot.lotNumber}-manifest.xlsx`, XLSX_MIME, writeWorkbook([{ name: 'Manifest', rows: [header, ...rows] }]))
}

/** The bid sheet: the manifest with a Unit price column. Line ids are in a hidden-in-plain-sight first column. */
function bidSheetRows(lot: any, currency: string) {
  const specKeys = specKeysOf(lot.lines)
  const header = ['Line ID (do not edit)', 'Line', 'Manufacturer', 'Model', 'Description', ...specKeys.map(specLabel), 'Grade', 'Quantity', `Unit price (${currency})`, 'Line total']
  const qty = XLSX.utils.encode_col(5 + specKeys.length + 1)
  const price = XLSX.utils.encode_col(5 + specKeys.length + 2)
  const rows = lot.lines.map((l: any, i: number) => [l.id, l.lineNumber, l.manufacturer, l.model, l.description, ...specKeys.map((k) => l.specs?.[k] ?? ''), [l.cosmeticGrade, l.functionalGrade].filter(Boolean).join(' / '), l.quantity, '', { t: 'n', f: `${qty}${i + 4}*${price}${i + 4}` }])
  return { rows: [[`${lot.lotNumber}: ${lot.title}. Enter a unit price per line you want; leave the others empty.`], [], header, ...rows], specCount: specKeys.length }
}

export async function downloadBidSheet(context: Ctx, args: { lotNumber: string }) {
  const { lot } = await lotForBuyerDownload(context, args.lotNumber)
  if (lot.bidBasis !== 'per_line') fail('This lot is bid as a whole; enter one amount.')
  const settings = await getSettings(context.prisma)
  const { rows, specCount } = bidSheetRows(lot, settings.currencyCode || 'USD')
  // Formulas in our own sheet are fine: the template is ours. Imported cells are never evaluated.
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 28 }, { wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 40 }, ...Array.from({ length: specCount }, () => ({ wch: 14 })), { wch: 12 }, { wch: 9 }, { wch: 16 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bid sheet')
  return asDownload(`${lot.lotNumber}-bid-sheet.xlsx`, XLSX_MIME, Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })))
}

/** Reads a filled bid sheet back. Lines are matched by the line id column, then by line number. */
export function parseBidSheet(rows: unknown[][], lot: { lines: Array<{ id: string; lineNumber: number; quantity: number; description: string }> }) {
  const headerIndex = rows.findIndex((r) => r.some((c) => String(c ?? '').toLowerCase().startsWith('unit price')))
  if (headerIndex < 0) fail('This is not our bid sheet: there is no "Unit price" column. Download the bid sheet for this lot.')
  const header = rows[headerIndex].map((c) => String(c ?? '').toLowerCase())
  const idCol = header.findIndex((h) => h.startsWith('line id'))
  const numCol = header.findIndex((h) => h === 'line')
  const priceCol = header.findIndex((h) => h.startsWith('unit price'))
  const byId = new Map(lot.lines.map((l) => [l.id, l]))
  const byNumber = new Map(lot.lines.map((l) => [l.lineNumber, l]))
  const lines: Array<{ lotLineId: string; unitPriceMinor: number }> = []
  const problems: string[] = []
  rows.slice(headerIndex + 1).forEach((row, i) => {
    const raw = row[priceCol]
    if (raw == null || String(raw).trim() === '') return
    const line = (idCol >= 0 && byId.get(String(row[idCol] ?? '').trim())) || (numCol >= 0 && byNumber.get(Number(row[numCol])))
    if (!line) {
      problems.push(`Row ${headerIndex + i + 2}: the line is not on this lot.`)
      return
    }
    const price = parseMoneyCell(raw)
    if (price == null) {
      problems.push(`Line ${line.lineNumber}: "${String(raw)}" is not a price.`)
      return
    }
    if (price > 0) lines.push({ lotLineId: line.id, unitPriceMinor: price })
  })
  return { lines, problems }
}

export async function checkBidSheet(context: Ctx, args: { lotNumber: string; file: FileInput }) {
  const { lot } = await lotForBuyerDownload(context, args.lotNumber)
  if (lot.bidBasis !== 'per_line') fail('This lot is bid as a whole.')
  const decoded = decodeUpload(args.file)
  if (!decoded) fail('Choose your filled bid sheet.')
  const { rows } = readWorkbook(decoded.bytes)
  const parsed = parseBidSheet(rows, lot)
  const byId = new Map(lot.lines.map((l: any) => [l.id, l]))
  const checkedLines = parsed.lines.map((l) => {
    const line: any = byId.get(l.lotLineId)
    return { lotLineId: l.lotLineId, lineNumber: line.lineNumber, description: line.description, quantity: line.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.unitPriceMinor * line.quantity }
  })
  return { lines: checkedLines, problems: parsed.problems, totalMinor: checkedLines.reduce((s, l) => s + l.totalMinor, 0) }
}

/** Confirmed bid sheet: stored with the bid for the record, then placed as a bid_sheet bid. */
export async function placeBidFromSheet(context: Ctx, args: { lotNumber: string; file: FileInput; idempotencyKey: string }) {
  const { companyId, user } = await requireBuyer(context)
  const checked = await checkBidSheet(context, args)
  if (checked.problems.length) fail(checked.problems[0])
  if (!checked.lines.length) fail('The sheet has no prices.')
  const decoded = decodeUpload(args.file)!
  const stored = await storeFile(context.prisma, { ...decoded, purpose: 'bid_sheet', ownerBuyerCompanyId: companyId, uploadedById: user.id })
  return placeBidCore(context, { lotNumber: args.lotNumber, lines: checked.lines.map((l) => ({ lotLineId: l.lotLineId, unitPriceMinor: l.unitPriceMinor })), idempotencyKey: args.idempotencyKey, companyId, userId: user.id, source: 'bid_sheet', sheetFileId: stored.id })
}
