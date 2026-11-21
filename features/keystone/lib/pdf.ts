import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

// Plain business documents with pdf-lib: invoices, certificates, packing lists,
// bills of lading, settlement statements and reports.

type Block =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'pairs'; pairs: Array<[string, string]> }
  | { kind: 'table'; headers: string[]; rows: string[][]; widths?: number[]; align?: Array<'left' | 'right'> }
  | { kind: 'totals'; pairs: Array<[string, string]> }
  | { kind: 'space'; size?: number }
  | { kind: 'signature'; label: string; value?: string }

const MARGIN = 48
const PAGE: [number, number] = [612, 792]

/** pdf-lib's standard fonts are WinAnsi; replace anything they cannot draw. */
function safe(text: string) {
  return String(text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?')
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = []
  for (const paragraph of safe(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

function clip(text: string, font: PDFFont, size: number, width: number) {
  let value = safe(text)
  if (font.widthOfTextAtSize(value, size) <= width) return value
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > width) value = value.slice(0, -1)
  return `${value}...`
}

export async function renderPdf(input: { header: string; headerRight?: string; footer?: string; blocks: Block[] }) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const width = PAGE[0] - MARGIN * 2
  let page: PDFPage = doc.addPage(PAGE)
  let y = PAGE[1] - MARGIN
  const grey = rgb(0.4, 0.4, 0.4)

  const header = () => {
    page.drawText(safe(input.header), { x: MARGIN, y, size: 11, font: bold })
    if (input.headerRight) {
      const w = font.widthOfTextAtSize(safe(input.headerRight), 9)
      page.drawText(safe(input.headerRight), { x: PAGE[0] - MARGIN - w, y, size: 9, font, color: grey })
    }
    y -= 14
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE[0] - MARGIN, y }, thickness: 0.5, color: grey })
    y -= 18
  }
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 20) {
      page = doc.addPage(PAGE)
      y = PAGE[1] - MARGIN
      header()
    }
  }
  header()

  for (const block of input.blocks) {
    if (block.kind === 'title') {
      ensure(30)
      page.drawText(safe(block.text), { x: MARGIN, y, size: 18, font: bold })
      y -= 26
    } else if (block.kind === 'subtitle') {
      ensure(22)
      page.drawText(safe(block.text), { x: MARGIN, y, size: 12, font: bold })
      y -= 18
    } else if (block.kind === 'text') {
      for (const line of wrap(block.text, font, 10, width)) {
        ensure(14)
        page.drawText(line, { x: MARGIN, y, size: 10, font })
        y -= 14
      }
      y -= 4
    } else if (block.kind === 'pairs') {
      for (const [label, value] of block.pairs) {
        const lines = wrap(value || '-', font, 10, width - 150)
        ensure(14 * lines.length)
        page.drawText(safe(label), { x: MARGIN, y, size: 9, font: bold, color: grey })
        lines.forEach((line, i) => page.drawText(line, { x: MARGIN + 150, y: y - i * 13, size: 10, font }))
        y -= 13 * lines.length + 3
      }
      y -= 6
    } else if (block.kind === 'table') {
      const count = block.headers.length
      const widths = block.widths ?? Array(count).fill(1)
      const total = widths.reduce((s, w) => s + w, 0)
      const cols = widths.map((w) => (w / total) * width)
      const drawRow = (cells: string[], f: PDFFont, size: number) => {
        let x = MARGIN
        cells.forEach((c, i) => {
          const text = clip(c ?? '', f, size, cols[i] - 6)
          const right = block.align?.[i] === 'right'
          const tw = f.widthOfTextAtSize(text, size)
          page.drawText(text, { x: right ? x + cols[i] - 4 - tw : x, y, size, font: f })
          x += cols[i]
        })
      }
      ensure(30)
      drawRow(block.headers, bold, 8.5)
      y -= 4
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE[0] - MARGIN, y }, thickness: 0.4, color: grey })
      y -= 11
      for (const row of block.rows) {
        if (y - 12 < MARGIN + 20) {
          ensure(40)
          drawRow(block.headers, bold, 8.5)
          y -= 15
        }
        drawRow(row, font, 8.5)
        y -= 12
      }
      y -= 8
    } else if (block.kind === 'totals') {
      for (const [label, value] of block.pairs) {
        ensure(16)
        const isLast = label === block.pairs[block.pairs.length - 1][0]
        const f = isLast ? bold : font
        const vw = f.widthOfTextAtSize(safe(value), 10)
        page.drawText(safe(label), { x: PAGE[0] - MARGIN - 220, y, size: 10, font: f })
        page.drawText(safe(value), { x: PAGE[0] - MARGIN - vw, y, size: 10, font: f })
        y -= 15
      }
      y -= 6
    } else if (block.kind === 'space') {
      y -= block.size ?? 10
    } else if (block.kind === 'signature') {
      ensure(40)
      y -= 16
      page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5 })
      if (block.value) page.drawText(safe(block.value), { x: MARGIN, y: y + 4, size: 10, font })
      y -= 12
      page.drawText(safe(block.label), { x: MARGIN, y, size: 8.5, font, color: grey })
      y -= 14
    }
  }

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const text = safe(`${input.footer ? `${input.footer}   ` : ''}Page ${i + 1} of ${pages.length}`)
    p.drawText(text, { x: MARGIN, y: MARGIN - 20, size: 8, font, color: grey })
  })
  return Buffer.from(await doc.save())
}

export type { Block as PdfBlock }
