'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setReleaseAction } from '../../lib/actions/buyer'

type Release = { method: string | null; preferredPickupDate: string | null; driverName: string; carrierName: string; carrierReference: string; destinationCountry: string; exportAcknowledgedAt: string | null; setAt: string | null }

const COUNTRIES: Array<[string, string]> = [['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['GB', 'United Kingdom'], ['AE', 'United Arab Emirates'], ['IN', 'India'], ['HK', 'Hong Kong'], ['NG', 'Nigeria'], ['GH', 'Ghana'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['PL', 'Poland'], ['BR', 'Brazil'], ['PK', 'Pakistan'], ['VN', 'Vietnam']]

/** U13: one form for how the goods leave, and where they are going. */
export function ReleaseForm({ orderNumber, release, exportAllowed, exportClause, shippingTerms }: { orderNumber: string; release: Release; exportAllowed: boolean; exportClause: string; shippingTerms: string }) {
  const router = useRouter()
  const [method, setMethod] = useState<'pickup' | 'freight'>(release.method === 'freight' ? 'freight' : shippingTerms === 'pickup_only' ? 'pickup' : (release.method as any) || 'pickup')
  const [v, setV] = useState({ preferredDate: release.preferredPickupDate ? String(release.preferredPickupDate).slice(0, 10) : '', driverName: release.driverName || '', carrierName: release.carrierName || '', carrierReference: release.carrierReference || '', destinationCountry: release.destinationCountry || 'US', exportAcknowledged: Boolean(release.exportAcknowledgedAt) })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const exporting = v.destinationCountry !== 'US'
  return (
    <form className="ar-panel ar-form" onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setMsg(null)
      const r = await setReleaseAction({ orderNumber, method, preferredDate: v.preferredDate || undefined, driverName: v.driverName, carrierName: v.carrierName, carrierReference: v.carrierReference, destinationCountry: v.destinationCountry, exportAcknowledged: v.exportAcknowledged })
      setBusy(false)
      if (r.ok) { setMsg({ ok: true, text: 'Saved. We get the pallets ready and confirm by email.' }); router.refresh() }
      else setMsg({ ok: false, text: r.error })
    }}>
      <h2>How it leaves</h2>
      {release.setAt ? <p className="ar-small ar-muted">You told us already; change it here until it is collected.</p> : <p className="ar-small ar-muted">Tell us now so the pallets are ready when you arrive.</p>}
      <div className="ar-choice" role="radiogroup" aria-label="Collection method">
        <label><input type="radio" name="method" checked={method === 'pickup'} onChange={() => setMethod('pickup')} /><span>Own pickup<br /><small className="ar-muted">Your truck at our dock</small></span></label>
        <label><input type="radio" name="method" checked={method === 'freight'} disabled={shippingTerms === 'pickup_only'} onChange={() => setMethod('freight')} /><span>Freight<br /><small className="ar-muted">{shippingTerms === 'pickup_only' ? 'Not for this lot' : 'Your carrier collects'}</small></span></label>
      </div>
      {method === 'pickup' ? (
        <>
          <label className="ar-field"><span>Driver name</span><input className="ar-input" value={v.driverName} onChange={(e) => setV({ ...v, driverName: e.target.value })} required maxLength={120} /></label>
          <label className="ar-field"><span>Preferred date</span><input className="ar-input" type="date" value={v.preferredDate} onChange={(e) => setV({ ...v, preferredDate: e.target.value })} /></label>
        </>
      ) : (
        <>
          <label className="ar-field"><span>Carrier</span><input className="ar-input" value={v.carrierName} onChange={(e) => setV({ ...v, carrierName: e.target.value })} required maxLength={120} /></label>
          <label className="ar-field"><span>Carrier reference (PRO or booking)</span><input className="ar-input" value={v.carrierReference} onChange={(e) => setV({ ...v, carrierReference: e.target.value })} maxLength={120} /></label>
          <label className="ar-field"><span>Pickup date</span><input className="ar-input" type="date" value={v.preferredDate} onChange={(e) => setV({ ...v, preferredDate: e.target.value })} /></label>
        </>
      )}
      <label className="ar-field"><span>Where the goods end up</span>
        <select className="ar-select" value={v.destinationCountry} onChange={(e) => setV({ ...v, destinationCountry: e.target.value })}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
      </label>
      {exporting ? (
        exportAllowed ? (
          <div className="ar-confirm">
            <p className="ar-small">{exportClause || 'Exports must follow the export clause in the wholesale terms.'}</p>
            <label className="ar-check"><input type="checkbox" checked={v.exportAcknowledged} onChange={(e) => setV({ ...v, exportAcknowledged: e.target.checked })} /> <span>I have read the export clause and will follow it.</span></label>
          </div>
        ) : <p className="ar-small" role="alert" style={{ color: 'var(--ar-red)' }}>This lot may not be exported. Choose the United States.</p>
      ) : null}
      {msg ? <p className="ar-small" role={msg.ok ? 'status' : 'alert'} style={{ color: msg.ok ? 'var(--ar-green)' : 'var(--ar-red)' }}>{msg.text}</p> : null}
      <button type="submit" className="ar-btn ar-btn-primary ar-btn-block" disabled={busy || (exporting && (!exportAllowed || !v.exportAcknowledged))}>{busy ? 'Saving…' : 'Save collection details'}</button>
    </form>
  )
}
