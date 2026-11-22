'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { money } from '../../lib/forms'
import { Notice, Pill, Track } from '../../lib/ui'

type Offer = { bidId: string; bidLineId: string; companyId: string; company: string; unitPriceMinor: number }
type Line = { lotLineId: string; lineNumber: number; description: string; quantity: number; offers: Offer[] }

/**
 * S13 split award: pick one buyer per line (default: the best offer), then award.
 * Lines left on "No award" stay unsold. The server re-checks every pick under the lot lock.
 */
export function AwardGrid({ lotId, lines, reserveMinor }: { lotId: string; lines: Line[]; reserveMinor: number | null }) {
  const router = useRouter()
  const [picks, setPicks] = useState<Record<string, string>>(() => Object.fromEntries(lines.filter((l) => l.offers[0]).map((l) => [l.lotLineId, l.offers[0].bidId])))
  const [override, setOverride] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const total = lines.reduce((sum, l) => {
    const o = l.offers.find((x) => x.bidId === picks[l.lotLineId])
    return sum + (o ? o.unitPriceMinor * l.quantity : 0)
  }, 0)
  const below = reserveMinor !== null && total < reserveMinor
  const award = () => start(async () => {
    setError(null); setDone(null)
    const chosen = Object.entries(picks).filter(([, bidId]) => bidId).map(([lotLineId, bidId]) => ({ lotLineId, bidId }))
    if (!chosen.length) { setError('Choose a buyer on at least one line.'); return }
    const result = await runOperation('awardLot', { lotId, lines: chosen, ...(below ? { confirmBelowReserve: true, reason: override } : {}) })
    if (!result.success) { setError(result.error ?? 'The award was refused.'); return }
    const awards = (result.data as any[]) ?? []
    setDone(`Awarded: ${awards.map((a) => `${a.orderNumber} (${a.invoiceNumber})`).join(', ')}`)
    router.refresh()
  })
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-[6px] border">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-3 py-2">Line</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Award to</th><th className="px-3 py-2 text-right">Line total</th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const o = l.offers.find((x) => x.bidId === picks[l.lotLineId])
              return (
                <tr key={l.lotLineId} className="border-t align-top">
                  <td className="px-3 py-2"><span className="tabular-nums">{l.lineNumber}.</span> {l.description}</td>
                  <td className="px-3 py-2 tabular-nums">{l.quantity}</td>
                  <td className="px-3 py-2">
                    <select aria-label={`Award line ${l.lineNumber}`} className="h-9 w-full min-w-48 rounded-[6px] border bg-background px-2" value={picks[l.lotLineId] ?? ''} onChange={(e) => setPicks({ ...picks, [l.lotLineId]: e.target.value })}>
                      <option value="">No award</option>
                      {l.offers.map((x) => <option key={x.bidLineId} value={x.bidId}>{x.company}: {money(x.unitPriceMinor)} each</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{o ? money(o.unitPriceMinor * l.quantity) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot><tr className="border-t font-medium"><td className="px-3 py-2" colSpan={3}>Total awarded{reserveMinor !== null ? ` (reserve ${money(reserveMinor)})` : ''}</td><td className="px-3 py-2 text-right tabular-nums">{money(total)}</td></tr></tfoot>
        </table>
      </div>
      {below ? (
        <label className="grid gap-1 text-sm">Below reserve: write why you are accepting it
          <input className="h-9 rounded-[6px] border bg-background px-3" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Market moved; client agreed by phone" />
        </label>
      ) : null}
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {done ? <Notice>{done}</Notice> : null}
      <Track><Pill variant="primary" disabled={pending || (below && override.trim().length < 3)} onClick={award}>{pending ? 'Awarding…' : 'Award selected lines'}</Pill></Track>
    </div>
  )
}
