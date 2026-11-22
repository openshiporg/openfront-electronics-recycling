'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { submitPickupAction } from '../lib/actions/auth'
import { requestJobAction } from '../lib/actions/buyer'

type Cat = { id: string; name: string }
type Facility = { id: string; name: string; city: string; acceptsDropOff: boolean }
type Site = { id: string; name: string; addressLine1: string; city: string; postalCode: string }
type Line = { categoryId: string; quantity: string; unit: string; notes: string }

const SERVICES: Array<[string, string]> = [['itad', 'IT asset disposition (audit, wipe, resale)'], ['data_destruction', 'Data destruction with certificate'], ['onsite_shred', 'On-site shredding'], ['witness_destruction', 'Witnessed destruction'], ['recycling', 'Recycling only']]

function readFile(file: File): Promise<{ filename: string; mimeType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ filename: file.name, mimeType: file.type || 'image/jpeg', base64: String(r.result).split(',')[1] ?? '' })
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/** P3 (public: also creates the login) and C1 (signed-in client: may reuse a saved site). */
export function PickupForm({ mode, categories, facilities, sites = [], me }: { mode: 'public' | 'client'; categories: Cat[]; facilities: Facility[]; sites?: Site[]; me?: { name: string; email: string } }) {
  const router = useRouter()
  const [type, setType] = useState<'pickup' | 'drop_off'>('pickup')
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [v, setV] = useState({ contactName: me?.name ?? '', contactEmail: me?.email ?? '', contactPhone: '', organizationName: '', password: '', addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', hasDock: false, needsLiftgate: false, accessNotes: '', hours: '', date1: '', date2: '', hasDataBearing: true, notes: '', facilityId: facilities.find((f) => f.acceptsDropOff)?.id ?? '' })
  const [services, setServices] = useState<string[]>(['itad', 'data_destruction'])
  const [lines, setLines] = useState<Line[]>([{ categoryId: categories[0]?.id ?? '', quantity: '', unit: 'units', notes: '' }])
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })
  const newSite = mode === 'public' || !siteId

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const input: Record<string, any> = {
        type,
        contactName: v.contactName, contactEmail: v.contactEmail, contactPhone: v.contactPhone,
        requestedDates: [v.date1, v.date2].filter(Boolean),
        hasDataBearing: v.hasDataBearing,
        services: [type, ...services],
        estimate: lines.filter((l) => Number(l.quantity) > 0).map((l) => ({ categoryId: l.categoryId || null, quantity: Number(l.quantity), unit: l.unit, notes: l.notes })),
        notes: v.notes,
        photos: await Promise.all(photos.slice(0, 8).map(readFile)),
        facilityId: v.facilityId || null,
      }
      if (type === 'pickup') {
        if (newSite) input.site = { addressLine1: v.addressLine1, addressLine2: v.addressLine2, city: v.city, region: v.region, postalCode: v.postalCode, countryCode: 'US', hasDock: v.hasDock, needsLiftgate: v.needsLiftgate, accessNotes: v.accessNotes, hours: v.hours }
        else input.siteId = siteId
      }
      if (mode === 'public') {
        input.organizationName = v.organizationName
        input.password = v.password
        const r = await submitPickupAction(input)
        if (!r.ok) { setError(r.error); setBusy(false); return }
        router.push(`/client/jobs/${r.jobNumber}?new=1`)
      } else {
        const r = await requestJobAction(input as any)
        if (!r.ok) { setError(r.error); setBusy(false); return }
        router.push(`/client/jobs/${r.data.jobNumber}?new=1`)
      }
    } catch {
      setError('A photo could not be read. Try a smaller JPG or PNG.')
      setBusy(false)
    }
  }

  return (
    <form className="ar-form" onSubmit={submit} style={{ display: 'grid', gap: 26 }}>
      <fieldset className="ar-panel ar-form">
        <legend className="ar-legend">1. Pickup or drop-off</legend>
        <div className="ar-choice" role="radiogroup" aria-label="Pickup or drop-off">
          <label><input type="radio" name="type" checked={type === 'pickup'} onChange={() => setType('pickup')} /><span>We collect<br /><small className="ar-muted">Our truck and driver, sealed containers</small></span></label>
          <label><input type="radio" name="type" checked={type === 'drop_off'} onChange={() => setType('drop_off')} /><span>You drop off<br /><small className="ar-muted">At one of our facilities</small></span></label>
        </div>
        {type === 'drop_off' ? (
          <label className="ar-field"><span>Facility</span><select className="ar-select" value={v.facilityId} onChange={set('facilityId')}>{facilities.filter((f) => f.acceptsDropOff).map((f) => <option key={f.id} value={f.id}>{f.name}, {f.city}</option>)}</select></label>
        ) : mode === 'client' && sites.length ? (
          <label className="ar-field"><span>Collect from</span><select className="ar-select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}: {s.addressLine1}, {s.city}</option>)}<option value="">A different address</option></select></label>
        ) : null}
        {type === 'pickup' && newSite ? (
          <>
            <label className="ar-field"><span>Street address</span><input className="ar-input" value={v.addressLine1} onChange={set('addressLine1')} required autoComplete="address-line1" /></label>
            <label className="ar-field"><span>Suite, floor or building <small className="ar-muted">(optional)</small></span><input className="ar-input" value={v.addressLine2} onChange={set('addressLine2')} autoComplete="address-line2" /></label>
            <div className="ar-row-3">
              <label className="ar-field"><span>City</span><input className="ar-input" value={v.city} onChange={set('city')} required autoComplete="address-level2" /></label>
              <label className="ar-field"><span>State</span><input className="ar-input" value={v.region} onChange={set('region')} autoComplete="address-level1" maxLength={40} /></label>
              <label className="ar-field"><span>ZIP</span><input className="ar-input" value={v.postalCode} onChange={set('postalCode')} required autoComplete="postal-code" /></label>
            </div>
            <div className="ar-row">
              <label className="ar-check"><input type="checkbox" checked={v.hasDock} onChange={set('hasDock')} /> <span>Loading dock</span></label>
              <label className="ar-check"><input type="checkbox" checked={v.needsLiftgate} onChange={set('needsLiftgate')} /> <span>Truck needs a liftgate</span></label>
            </div>
            <label className="ar-field"><span>Access notes <small className="ar-muted">(parking, elevator, security desk)</small></span><input className="ar-input" value={v.accessNotes} onChange={set('accessNotes')} maxLength={1000} /></label>
            <label className="ar-field"><span>Hours we can come</span><input className="ar-input" value={v.hours} onChange={set('hours')} placeholder="e.g. weekdays 8:00–16:00" maxLength={200} /></label>
          </>
        ) : null}
        <div className="ar-row">
          <label className="ar-field"><span>Preferred date</span><input className="ar-input" type="date" value={v.date1} onChange={set('date1')} /></label>
          <label className="ar-field"><span>Second choice</span><input className="ar-input" type="date" value={v.date2} onChange={set('date2')} /></label>
        </div>
      </fieldset>

      <fieldset className="ar-panel ar-form">
        <legend className="ar-legend">2. What you have</legend>
        {lines.map((l, i) => (
          <div key={i} className="ar-line-row">
            <label className="ar-field"><span>Type</span><select className="ar-select" value={l.categoryId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, categoryId: e.target.value } : x)))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">Other</option></select></label>
            <label className="ar-field" style={{ maxWidth: 120 }}><span>Quantity</span><input className="ar-input ar-num" inputMode="numeric" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value.replace(/[^\d]/g, '') } : x)))} /></label>
            <label className="ar-field" style={{ maxWidth: 130 }}><span>Unit</span><select className="ar-select" value={l.unit} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}><option value="units">Units</option><option value="pallets">Pallets</option><option value="lb">lb</option></select></label>
            <label className="ar-field"><span>Notes</span><input className="ar-input" value={l.notes} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} maxLength={300} /></label>
            {lines.length > 1 ? <button type="button" className="ar-btn ar-btn-ghost ar-btn-icon" aria-label={`Remove row ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden="true" /></button> : null}
          </div>
        ))}
        <div><button type="button" className="ar-btn ar-btn-ghost ar-btn-sm" onClick={() => setLines([...lines, { categoryId: categories[0]?.id ?? '', quantity: '', unit: 'units', notes: '' }])}><Plus size={16} aria-hidden="true" /> Add another type</button></div>
        <label className="ar-check"><input type="checkbox" checked={v.hasDataBearing} onChange={set('hasDataBearing')} /> <span>Some items hold data (drives, laptops, phones, servers)</span></label>
        <div className="ar-field"><span>Services</span>
          <div className="ar-checks">{SERVICES.map(([k, t]) => <label key={k} className="ar-check"><input type="checkbox" checked={services.includes(k)} onChange={(e) => setServices(e.target.checked ? [...services, k] : services.filter((s) => s !== k))} /> <span>{t}</span></label>)}</div>
        </div>
        <label className="ar-field"><span>Photos <small className="ar-muted">(optional, up to 8; helps us send the right truck)</small></span><input className="ar-input" type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} /></label>
        <label className="ar-field"><span>Anything else</span><textarea className="ar-textarea" rows={3} value={v.notes} onChange={set('notes')} maxLength={4000} /></label>
      </fieldset>

      <fieldset className="ar-panel ar-form">
        <legend className="ar-legend">3. {mode === 'public' ? 'You and your account' : 'Contact on the day'}</legend>
        {mode === 'public' ? <label className="ar-field"><span>Organisation</span><input className="ar-input" value={v.organizationName} onChange={set('organizationName')} required autoComplete="organization" /></label> : null}
        <div className="ar-row">
          <label className="ar-field"><span>Your name</span><input className="ar-input" value={v.contactName} onChange={set('contactName')} required autoComplete="name" /></label>
          <label className="ar-field"><span>Phone</span><input className="ar-input" type="tel" value={v.contactPhone} onChange={set('contactPhone')} autoComplete="tel" /></label>
        </div>
        <label className="ar-field"><span>Email</span><input className="ar-input" type="email" value={v.contactEmail} onChange={set('contactEmail')} required autoComplete="email" /></label>
        {mode === 'public' ? <label className="ar-field"><span>Choose a password <small className="ar-muted">(10+ characters; you use it to accept the quote and get certificates)</small></span><input className="ar-input" type="password" value={v.password} onChange={set('password')} required minLength={10} autoComplete="new-password" /></label> : null}
      </fieldset>

      {error ? <div className="ar-notice ar-notice-err" role="alert"><p>{error}</p></div> : null}
      <div><button type="submit" className="ar-btn ar-btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button> <span className="ar-small ar-muted" style={{ marginLeft: 12 }}>We reply with a quote, usually within one business day.</span></div>
    </form>
  )
}
