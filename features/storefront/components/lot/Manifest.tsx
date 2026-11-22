'use client'

import { useMemo, useState } from 'react'
import { specText } from '../../lib/format'

type Line = { id: string; lineNumber: number; category: string; manufacturer: string; model: string; partNumber: string; description: string; specs: Record<string, unknown>; cosmeticGrade: string; functionalGrade: string; quantity: number; unit: string; serials: string[]; notes: string }


/** U3: the full manifest. Serial numbers fold away per line. */
const SORTS: Record<string, (a: Line, b: Line) => number> = {
  line: (a, b) => a.lineNumber - b.lineNumber,
  qty: (a, b) => b.quantity - a.quantity || a.lineNumber - b.lineNumber,
  item: (a, b) => itemName(a).localeCompare(itemName(b)) || a.lineNumber - b.lineNumber,
  grade: (a, b) => (a.cosmeticGrade || '~').localeCompare(b.cosmeticGrade || '~') || a.lineNumber - b.lineNumber,
}

function itemName(l: Line) {
  return [l.manufacturer, l.model].filter(Boolean).join(' ') || l.description
}

export function Manifest({ lines }: { lines: Line[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('line')
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const hay = (l: Line) => [l.lineNumber, l.category, l.manufacturer, l.model, l.partNumber, l.description, specText(l.specs), l.cosmeticGrade, l.functionalGrade, l.notes, ...l.serials].join(' ').toLowerCase()
    return lines.filter((l) => words.every((w) => hay(l).includes(w))).sort(SORTS[sort])
  }, [lines, q, sort])
  const matchedSerial = (l: Line) => q.trim().length >= 3 ? l.serials.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase())) : []
  return (
    <div style={{ display: 'grid', gap: 12 }}>
    {lines.length > 1 || lines.some((l) => l.serials.length) ? (
      <div className="ar-row" style={{ alignItems: 'end' }}>
        <label className="ar-field"><span>Search the manifest</span><input className="ar-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Model, spec, grade or serial number" /></label>
        <label className="ar-field"><span>Sort by</span>
          <select className="ar-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="line">Line number</option><option value="qty">Quantity, most first</option><option value="item">Item name</option><option value="grade">Cosmetic grade</option>
          </select>
        </label>
      </div>
    ) : null}
    {q ? <p className="ar-small ar-muted" role="status">{shown.length} of {lines.length} lines match.</p> : null}
    <div className="ar-table-wrap">
      <table className="ar-table">
        <thead>
          <tr><th scope="col">Line</th><th scope="col">Item</th><th scope="col">Specs</th><th scope="col">Grade</th><th scope="col" className="ar-num">Qty</th></tr>
        </thead>
        <tbody>
          {shown.map((l) => (
            <tr key={l.id}>
              <td data-label="Line">{l.lineNumber}</td>
              <td data-label="Item">
                <strong>{itemName(l)}</strong>
                {(l.manufacturer || l.model) && l.description && l.description !== [l.manufacturer, l.model].filter(Boolean).join(' ') ? <div className="ar-small ar-muted">{l.description}</div> : null}
                {l.notes ? <div className="ar-small ar-muted">{l.notes}</div> : null}
                {matchedSerial(l).length ? <div className="ar-small" style={{ color: 'var(--ar-yellow)' }}>Serial {matchedSerial(l).slice(0, 3).join(', ')}{matchedSerial(l).length > 3 ? '…' : ''}</div> : null}
                {l.serials.length ? (
                  <details className="ar-small" style={{ marginTop: 4 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--ar-yellow)' }}>{l.serials.length} serial numbers</summary>
                    <p className="ar-muted" style={{ wordBreak: 'break-all', marginTop: 4 }}>{l.serials.join(', ')}</p>
                  </details>
                ) : null}
              </td>
              <td data-label="Specs" className="ar-small">{specText(l.specs) || '—'}</td>
              <td data-label="Grade">{[l.cosmeticGrade, l.functionalGrade].filter(Boolean).join(' / ') || '—'}</td>
              <td data-label="Qty" className="ar-num">{l.quantity} {l.unit && l.unit !== 'each' ? l.unit : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {q && !shown.length ? <p className="ar-muted">No line matches “{q}”.</p> : null}
    </div>
  )
}
