// Spreadsheet rules shared by manifest import, bid sheets, erasure reports and
// exports. Pure: the SheetJS calls live in lib/spreadsheet.ts.

export const MAX_SHEET_BYTES = 10 * 1024 * 1024
export const MAX_SHEET_ROWS = 20_000
export const STORED_ROW_CAP = 5_000

/** Lot line fields a manifest column can map to, with the words that suggest them. */
export const MANIFEST_FIELDS: Record<string, string[]> = {
  lineNumber: ['line', 'line #', 'line no', 'item #', '#'],
  category: ['category', 'type', 'product type', 'class'],
  manufacturer: ['manufacturer', 'make', 'brand', 'mfr', 'oem'],
  model: ['model', 'model name', 'model number', 'model #'],
  partNumber: ['part number', 'part #', 'p/n', 'pn', 'sku', 'mpn'],
  description: ['description', 'desc', 'item', 'item description', 'product'],
  serial: ['serial', 'serial number', 'serial #', 's/n', 'sn', 'service tag'],
  // Spec columns: our exports write the plain label ("RAM (GB)"); older files used the key ("ramGb"). Both import.
  cpu: ['cpu', 'processor', 'proc'],
  ramGb: ['ram', 'memory', 'ram gb', 'memory gb', 'ram (gb)', 'ramgb'],
  storageGb: ['storage', 'hdd', 'ssd', 'drive', 'storage gb', 'hdd size', 'storage (gb)', 'storagegb'],
  storageType: ['storage type', 'drive type', 'storagetype'],
  screenIn: ['screen', 'screen size', 'display', 'screen (in)', 'screenin'],
  cosmeticGrade: ['cosmetic', 'cosmetic grade', 'grade', 'condition'],
  functionalGrade: ['functional', 'functional grade', 'test result', 'tested', 'status'],
  quantity: ['qty', 'quantity', 'units', 'count', 'pcs'],
  unit: ['uom', 'unit'],
  weight: ['weight', 'lbs', 'weight lb'],
  notes: ['notes', 'comments', 'remarks'],
  assetTag: ['asset tag', 'client tag', 'tag'],
}

/** Plain column names for the spec keys stored on lines and assets. */
export const SPEC_LABELS: Record<string, string> = { cpu: 'Processor', ramGb: 'RAM (GB)', storageGb: 'Storage (GB)', storageType: 'Storage type', screenIn: 'Screen (in)' }

/** "ramGb" -> "RAM (GB)"; an unknown key "batteryHealth" -> "Battery health". */
export function specLabel(key: string) {
  if (SPEC_LABELS[key]) return SPEC_LABELS[key]
  const words = key.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : key
}

/** The spec keys used across these lines, known keys first in a fixed order, then the rest as found. */
export function specKeysOf(lines: Array<{ specs?: unknown }>) {
  const found = new Set(lines.flatMap((l) => (l.specs && typeof l.specs === 'object' ? Object.keys(l.specs as object) : [])))
  return [...Object.keys(SPEC_LABELS).filter((k) => found.has(k)), ...[...found].filter((k) => !(k in SPEC_LABELS))]
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, ' ')

/** The header row is the first row in the first 20 where most cells match known names. */
export function detectHeaderRow(rows: unknown[][], fields: Record<string, string[]> = MANIFEST_FIELDS) {
  const vocabulary = new Set(Object.values(fields).flat())
  let best = { index: 0, score: -1 }
  rows.slice(0, 20).forEach((row, index) => {
    const cells = row.map(normalize).filter(Boolean)
    if (cells.length < 2) return
    const known = cells.filter((cell) => vocabulary.has(cell)).length
    const textual = cells.filter((cell) => !/^[\d.,$-]+$/.test(cell)).length
    const score = known * 3 + textual / Math.max(1, cells.length)
    if (score > best.score) best = { index, score }
  })
  return best.index
}

/** Proposes field -> column index from the header names. */
export function proposeMapping(headers: unknown[], fields: Record<string, string[]> = MANIFEST_FIELDS) {
  const mapping: Record<string, number> = {}
  const used = new Set<number>()
  const names = headers.map(normalize)
  for (const [field, words] of Object.entries(fields)) {
    const exact = names.findIndex((name, i) => !used.has(i) && words.includes(name))
    if (exact >= 0) {
      mapping[field] = exact
      used.add(exact)
    }
  }
  for (const [field, words] of Object.entries(fields)) {
    if (field in mapping) continue
    const partial = names.findIndex((name, i) => !used.has(i) && name && words.some((w) => w.length > 2 && name.includes(w)))
    if (partial >= 0) {
      mapping[field] = partial
      used.add(partial)
    }
  }
  return mapping
}

export type ManifestRow = {
  rowNumber: number
  valid: boolean
  errors: string[]
  /** Set when staff corrected the row by hand in the preview (editManifestRow). */
  edited?: boolean
  line: {
    lineNumber: number | null
    category: string
    manufacturer: string
    model: string
    partNumber: string
    description: string
    serials: string[]
    specs: Record<string, string | number>
    cosmeticGrade: string
    functionalGrade: string
    quantity: number
    unit: string
    notes: string
    extra: Record<string, string>
  }
}

const cell = (row: unknown[], index: number | undefined) => (index == null || index < 0 ? '' : String(row[index] ?? '').trim())

const NO_IDENTITY = 'The row has no description, model or manufacturer.'

/** The checks every manifest line must pass, from a file or corrected by hand. */
export function manifestLineErrors(line: { quantity: number; description: string; model: string; manufacturer: string }, quantityText?: string) {
  const errors: string[] = []
  if (!Number.isInteger(line.quantity) || line.quantity < 0) errors.push(`Quantity "${quantityText ?? line.quantity}" is not a whole number.`)
  else if (line.quantity === 0) errors.push('Quantity is zero.')
  if (!line.description && !line.model && !line.manufacturer) errors.push(NO_IDENTITY)
  return errors
}

const text = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max)

/**
 * A row corrected by hand in the preview: the typed fields replace the row's, anything not sent
 * is kept, and the row is checked with the same rules as a row read from the file.
 */
export function correctManifestRow(row: ManifestRow, input: Record<string, unknown>): ManifestRow {
  const before = row.line
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k)
  const pick = (k: keyof ManifestRow['line'], max?: number) => (has(k) ? text(input[k], max) : (before[k] as string))
  const serials = has('serials')
    ? (Array.isArray(input.serials) ? input.serials : String(input.serials ?? '').split(/[,;\n]+/)).map((s) => text(s, 120)).filter(Boolean)
    : before.serials
  const qtyText = has('quantity') ? text(input.quantity, 40).replace(/,/g, '') : ''
  const quantity = has('quantity') ? (qtyText ? Number(qtyText) : serials.length || 1) : before.quantity
  const unitRaw = has('unit') ? text(input.unit, 20).toLowerCase() : before.unit
  const unit = ['lb', 'lbs', 'pound', 'pounds'].includes(unitRaw) ? 'lb' : ['kg', 'kgs'].includes(unitRaw) ? 'kg' : 'each'
  const manufacturer = pick('manufacturer', 120)
  const model = pick('model', 120)
  const typedDescription = pick('description')
  const line = {
    ...before,
    category: pick('category', 120),
    manufacturer,
    model,
    partNumber: pick('partNumber', 120),
    description: typedDescription || [manufacturer, model].filter(Boolean).join(' '),
    serials,
    cosmeticGrade: pick('cosmeticGrade', 40),
    functionalGrade: pick('functionalGrade', 40),
    quantity: Number.isFinite(quantity) ? quantity : NaN,
    unit,
    notes: pick('notes', 2000),
  }
  const errors = manifestLineErrors({ quantity: line.quantity, description: typedDescription, model, manufacturer }, has('quantity') ? qtyText : undefined)
  if (Number.isNaN(line.quantity)) line.quantity = 0
  return { rowNumber: row.rowNumber, valid: errors.length === 0, errors, edited: true, line }
}

/** Applies a mapping to data rows, marking each valid or with its errors. */
export function applyManifestMapping(headers: unknown[], dataRows: unknown[][], mapping: Record<string, number>, firstRowNumber: number): ManifestRow[] {
  const mappedColumns = new Set(Object.values(mapping))
  const out: ManifestRow[] = []
  dataRows.forEach((row, i) => {
    if (!row.some((v) => String(v ?? '').trim())) return
    const errors: string[] = []
    const qtyText = cell(row, mapping.quantity)
    const serialText = cell(row, mapping.serial)
    const serials = serialText ? serialText.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : []
    let quantity = qtyText ? Number(qtyText.replace(/,/g, '')) : serials.length || 1
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      errors.push(`Quantity "${qtyText}" is not a whole number.`)
      quantity = 0
    }
    const description = cell(row, mapping.description)
    const model = cell(row, mapping.model)
    const manufacturer = cell(row, mapping.manufacturer)
    if (!errors.length) errors.push(...manifestLineErrors({ quantity, description, model, manufacturer }))
    else if (!description && !model && !manufacturer) errors.push(NO_IDENTITY)
    const unitRaw = cell(row, mapping.unit).toLowerCase()
    const unit = ['lb', 'lbs', 'pound', 'pounds'].includes(unitRaw) ? 'lb' : ['kg', 'kgs'].includes(unitRaw) ? 'kg' : 'each'
    const specs: Record<string, string | number> = {}
    for (const key of ['cpu', 'ramGb', 'storageGb', 'storageType', 'screenIn']) {
      const value = cell(row, mapping[key])
      if (value) specs[key] = /Gb$|In$/.test(key) && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value
    }
    const extra: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (mappedColumns.has(index)) return
      const value = cell(row, index)
      if (value) extra[String(header || `Column ${index + 1}`).trim()] = value
    })
    const lineNumberText = cell(row, mapping.lineNumber)
    out.push({
      rowNumber: firstRowNumber + i,
      valid: errors.length === 0,
      errors,
      line: {
        lineNumber: lineNumberText && /^\d+$/.test(lineNumberText) ? Number(lineNumberText) : null,
        category: cell(row, mapping.category),
        manufacturer,
        model,
        partNumber: cell(row, mapping.partNumber),
        description: description || [manufacturer, model].filter(Boolean).join(' '),
        serials,
        specs,
        cosmeticGrade: cell(row, mapping.cosmeticGrade),
        functionalGrade: cell(row, mapping.functionalGrade),
        quantity,
        unit,
        notes: cell(row, mapping.notes),
        extra,
      },
    })
  })
  return out
}

/** Stops formula injection on export: a cell starting with = + - @ is prefixed with '. */
export function neutralizeCell(value: unknown) {
  if (typeof value !== 'string') return value
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function neutralizeRows(rows: unknown[][]) {
  return rows.map((row) => row.map(neutralizeCell))
}

/** Parses a money cell such as "$1,250.50" into minor units. */
export function parseMoneyCell(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null
  const text = String(value).replace(/[$,\s]/g, '')
  if (!text) return null
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text) * 100)
}

/** Erasure report columns. */
export const ERASURE_FIELDS: Record<string, string[]> = {
  serial: ['serial', 'serial number', 'drive serial', 'disk serial', 's/n', 'sn', 'serialnumber', 'hdd serial', 'drive serial number'],
  result: ['result', 'status', 'erasure status', 'outcome', 'erasure result', 'state'],
  method: ['method', 'erasure method', 'standard', 'erasure standard', 'algorithm', 'wipe method'],
  startedAt: ['start', 'started', 'start time', 'erasure start', 'started at'],
  completedAt: ['end', 'finished', 'end time', 'completed', 'erasure end', 'completed at', 'date'],
  reportReference: ['report', 'report id', 'report uuid', 'certificate', 'job id', 'uuid'],
  toolVersion: ['version', 'software version', 'tool version'],
}

/** Interprets an erasure tool's result cell. */
export function erasureResult(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase()
  if (/^(pass|passed|success|successful|erased|completed|ok|verified)/.test(text)) return 'passed'
  if (/^(fail|failed|error|aborted|incomplete|not erased)/.test(text)) return 'failed'
  return null
}

/** Picks a technique for an erasure tool's method text. */
export function erasureTechnique(value: unknown) {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('crypto')) return { method: 'purge', technique: 'crypto_erase' }
  if (text.includes('secure erase') || text.includes('sanitize') || text.includes('purge')) return { method: 'purge', technique: 'secure_erase' }
  if (text.includes('block')) return { method: 'purge', technique: 'block_erase' }
  return { method: 'clear', technique: 'overwrite' }
}
