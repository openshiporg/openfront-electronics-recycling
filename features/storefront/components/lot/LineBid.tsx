'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { DownloadButton } from './DownloadButton'
import { newKey } from './BidPanel'
import { placeBidAction, placeBidFromSheetAction, checkBidSheetAction } from '../../lib/actions/lots'
import { money, toMinor } from '../../lib/format'

type Line = { id: string; lineNumber: number; manufacturer: string; model: string; description: string; cosmeticGrade: string; functionalGrade: string; quantity: number }
type Sheet = { filename: string; mimeType: string; base64: string }

function readFile(file: File): Promise<Sheet> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ filename: file.name, mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: String(r.result).split(',')[1] ?? '' })
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(file)
  })
}

/** U6: a unit price per line, a running total, and the Excel bid sheet both ways. */
export function LineBid({ lotNumber, lines, currency, open, mayBid, myLines }: { lotNumber: string; lines: Line[]; currency: string; open: boolean; mayBid: boolean; myLines: Array<{ lotLineId: string; unitPriceMinor: number }> }) {
  const router = useRouter()
  const initial = Object.fromEntries(myLines.map((l) => [l.lotLineId, (l.unitPriceMinor / 100).toFixed(2)]))
  const [prices, setPrices] = useState<Record<string, string>>(initial)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [sheet, setSheet] = useState<null | { file: Sheet; preview: { lines: any[]; problems: string[]; totalMinor: number } }>(null)
  const key = useRef(newKey())

  const parsed = useMemo(() => lines.map((l) => {
    const text = prices[l.id]?.trim() ?? ''
    const unit = text ? toMinor(text) : null
    return { line: l, text, unit, bad: Boolean(text) && (unit == null || unit < 0) }
  }), [lines, prices])
  const priced = parsed.filter((p) => p.unit && p.unit > 0)
  const total = priced.reduce((s, p) => s + (p.unit as number) * p.line.quantity, 0)
  const bad = parsed.filter((p) => p.bad)
  const editable = open && mayBid

  async function submit() {
    setBusy(true); setError(''); setOk('')
    const r = await placeBidAction({ lotNumber, lines: priced.map((p) => ({ lotLineId: p.line.id, unitPriceMinor: p.unit as number })), idempotencyKey: key.current })
    setBusy(false); setConfirming(false); key.current = newKey()
    if (!r.ok) { setError(r.error); return }
    setOk(`Your sealed bid of ${money(r.data.amountMinor, currency)} across ${priced.length} ${priced.length === 1 ? 'line' : 'lines'} is in.`)
    router.refresh()
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setError(''); setOk(''); setSheet(null)
    if (file.size > 10 * 1024 * 1024) { setError('That file is over 10 MB.'); return }
    setBusy(true)
    try {
      const f = await readFile(file)
      const r = await checkBidSheetAction(lotNumber, f)
      if (!r.ok) setError(r.error)
      else setSheet({ file: f, preview: r.data })
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  async function submitSheet() {
    if (!sheet) return
    setBusy(true); setError('')
    const r = await placeBidFromSheetAction(lotNumber, sheet.file, key.current)
    setBusy(false); key.current = newKey()
    if (!r.ok) { setError(r.error); return }
    setOk(`Your bid sheet is in: ${money(r.data.amountMinor, currency)} across ${sheet.preview.lines.length} lines.`)
    setPrices(Object.fromEntries(sheet.preview.lines.map((l: any) => [l.lotLineId, (l.unitPriceMinor / 100).toFixed(2)])))
    setSheet(null)
    router.refresh()
  }

  return (
    <section className="ar-panel" id="line-bid" aria-labelledby="line-bid-title" style={{ scrollMarginTop: 16 }}>
      <div className="ar-panel-head">
        <h2 id="line-bid-title">{editable ? 'Bid line by line' : 'Manifest'}</h2>
        <div className="ar-actions">
          <DownloadButton kind="manifest" lotNumber={lotNumber} label="Manifest (Excel)" />
          {editable ? <DownloadButton kind="bidSheet" lotNumber={lotNumber} label="Bid sheet (Excel)" /> : null}
        </div>
      </div>
      {editable ? <p className="ar-small ar-muted" style={{ marginBottom: 12 }}>Enter a unit price on each line you want and leave the rest empty. Or fill in the bid sheet in Excel and upload it below.</p> : null}
      <div className="ar-table-wrap">
        <table className="ar-table">
          <thead><tr><th scope="col">Line</th><th scope="col">Item</th><th scope="col">Grade</th><th scope="col" className="ar-num">Qty</th>{editable || myLines.length ? <><th scope="col">Unit price</th><th scope="col" className="ar-num">Line total</th></> : null}</tr></thead>
          <tbody>
            {parsed.map(({ line, text, unit, bad: isBad }) => (
              <tr key={line.id}>
                <td data-label="Line">{line.lineNumber}</td>
                <td data-label="Item"><strong>{[line.manufacturer, line.model].filter(Boolean).join(' ') || line.description}</strong>{(line.manufacturer || line.model) && line.description && line.description !== [line.manufacturer, line.model].filter(Boolean).join(' ') ? <div className="ar-small ar-muted">{line.description}</div> : null}</td>
                <td data-label="Grade">{[line.cosmeticGrade, line.functionalGrade].filter(Boolean).join(' / ') || '—'}</td>
                <td data-label="Qty" className="ar-num">{line.quantity}</td>
                {editable || myLines.length ? (
                  <>
                    <td data-label="Unit price" className={editable ? 'ar-td-input' : undefined}>
                      {editable ? (
                        <input className="ar-input ar-num" style={{ minWidth: 110, borderColor: isBad ? 'var(--ar-red)' : undefined }} inputMode="decimal" aria-label={`Unit price for line ${line.lineNumber}`} aria-invalid={isBad} value={text} onChange={(e) => { setConfirming(false); setPrices((p) => ({ ...p, [line.id]: e.target.value })) }} placeholder="—" />
                      ) : <span className="ar-num">{unit ? money(unit, currency) : '—'}</span>}
                    </td>
                    <td data-label="Line total" className="ar-num">{unit && unit > 0 ? money(unit * line.quantity, currency) : '—'}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? <div className="ar-notice ar-notice-err" role="alert" style={{ marginTop: 12 }}><p className="ar-small">{error}</p></div> : null}
      {ok ? <div className="ar-notice ar-notice-ok" role="status" style={{ marginTop: 12 }}><p className="ar-small"><strong>{ok}</strong> It stays sealed. You can change it until the lot closes.</p></div> : null}

      {editable ? (
        <>
          <div className="ar-total-bar">
            <div><span className="ar-kicker">Your total</span> <span className="ar-big ar-num" style={{ fontSize: 24 }}>{money(total, currency)}</span> <span className="ar-small ar-muted">{priced.length} of {lines.length} lines priced</span></div>
            {confirming ? (
              <div className="ar-actions">
                <span className="ar-small">Binding if you win. Replaces any earlier bid.</span>
                <button type="button" className="ar-btn ar-btn-primary" disabled={busy} onClick={submit}>{busy ? 'Placing…' : 'Confirm bid'}</button>
                <button type="button" className="ar-btn ar-btn-ghost" onClick={() => setConfirming(false)}>Change</button>
              </div>
            ) : (
              <button type="button" className="ar-btn ar-btn-primary" disabled={!priced.length || bad.length > 0} onClick={() => { setError(''); setOk(''); setConfirming(true) }}>{bad.length ? `Fix line ${bad[0].line.lineNumber}` : 'Review bid'}</button>
            )}
          </div>

          <div className="ar-panel" style={{ marginTop: 16, background: 'transparent' }}>
            <h3 style={{ fontSize: 16, display: 'flex', gap: 8, alignItems: 'center' }}><FileSpreadsheet size={18} aria-hidden="true" /> Upload a filled bid sheet</h3>
            <p className="ar-small ar-muted" style={{ margin: '6px 0 10px' }}>We read the unit price column and show you what we found before anything is placed.</p>
            <label className="ar-btn ar-btn-ghost ar-btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={16} aria-hidden="true" /> {busy && !sheet ? 'Reading…' : 'Choose .xlsx file'}
              <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="ar-sr" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {sheet ? (
              <div className="ar-confirm" style={{ marginTop: 12 }}>
                <p><strong>{sheet.file.filename}</strong>: {sheet.preview.lines.length} lines priced, total <strong className="ar-num">{money(sheet.preview.totalMinor, currency)}</strong>.</p>
                {sheet.preview.problems.length ? <ul className="ar-small" style={{ color: 'var(--ar-red)', margin: 0, paddingLeft: 18 }}>{sheet.preview.problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
                <div className="ar-actions">
                  <button type="button" className="ar-btn ar-btn-primary" disabled={busy || sheet.preview.problems.length > 0 || !sheet.preview.lines.length} onClick={submitSheet}>{busy ? 'Placing…' : 'Place this bid'}</button>
                  <button type="button" className="ar-btn ar-btn-ghost" onClick={() => setSheet(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
