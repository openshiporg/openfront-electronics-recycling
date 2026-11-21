import * as XLSX from 'xlsx'
import { fail } from './core'
import { MAX_SHEET_BYTES, MAX_SHEET_ROWS, neutralizeRows } from './rules/sheets'

/** Reads .xlsx, .xls or .csv. Cached cell values only; formulas are never evaluated. */
export function readWorkbook(bytes: Buffer, sheetName?: string | null) {
  if (bytes.length > MAX_SHEET_BYTES) fail('Spreadsheets must be 10 MB or smaller.')
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(bytes, { type: 'buffer', cellFormula: false, cellHTML: false, cellDates: true, sheetRows: MAX_SHEET_ROWS + 25, dense: true })
  } catch {
    fail('This file could not be read as a spreadsheet. Use .xlsx, .xls or .csv.')
  }
  const sheetNames = workbook.SheetNames
  if (!sheetNames.length) fail('The spreadsheet has no sheets.')
  const name = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0]
  const sheet = workbook.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false, dateNF: 'yyyy-mm-dd hh:mm' })
  if (rows.length > MAX_SHEET_ROWS + 20) fail(`Spreadsheets can have at most ${MAX_SHEET_ROWS.toLocaleString()} rows.`)
  return { sheetNames, sheetName: name, rows: rows.map((r) => (Array.isArray(r) ? r : [])) }
}

/** Writes one or more sheets to .xlsx with formula injection neutralised. */
export function writeWorkbook(sheets: Array<{ name: string; rows: unknown[][]; widths?: number[] }>) {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(neutralizeRows(sheet.rows))
    if (sheet.widths) ws['!cols'] = sheet.widths.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31))
  }
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

export function writeCsv(rows: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet(neutralizeRows(rows))
  return Buffer.from(XLSX.utils.sheet_to_csv(ws), 'utf8')
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
