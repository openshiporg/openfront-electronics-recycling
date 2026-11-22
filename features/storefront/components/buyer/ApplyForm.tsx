'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Upload } from 'lucide-react'
import { saveApplicationAction, submitApplicationAction, uploadDocumentAction } from '../../lib/actions/buyer'

const BUSINESS_TYPES: Array<[string, string]> = [['refurbisher', 'Refurbisher'], ['reseller', 'Reseller'], ['exporter', 'Exporter'], ['recycler', 'Recycler'], ['broker', 'Broker'], ['other', 'Other']]
const SPEND: Array<[string, string]> = [['under_5k', 'Under $5,000'], ['from_5k_to_25k', '$5,000–$25,000'], ['from_25k_to_100k', '$25,000–$100,000'], ['over_100k', 'Over $100,000']]
const DOC_TYPES: Array<[string, string]> = [['resale_certificate', 'Resale certificate'], ['business_registration', 'Business registration'], ['w9', 'W-9'], ['export_license', 'Export licence'], ['r2_certificate', 'R2 certificate'], ['other', 'Other']]
const COUNTRIES: Array<[string, string]> = [['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['GB', 'United Kingdom'], ['AE', 'United Arab Emirates'], ['IN', 'India'], ['HK', 'Hong Kong'], ['NG', 'Nigeria'], ['GH', 'Ghana'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['PK', 'Pakistan'], ['VN', 'Vietnam']]

type Company = Record<string, any>
type Cat = { id: string; name: string }

export function ApplyForm({ company, categories, termsVersion, terms }: { company: Company; categories: Cat[]; termsVersion: string; terms: Array<{ heading: boolean; text: string }> }) {
  const router = useRouter()
  const pick = (k: string) => (company[k] ?? '') as string
  const [v, setV] = useState({ legalName: pick('legalName'), tradingName: pick('tradingName'), addressLine1: pick('addressLine1'), addressLine2: pick('addressLine2'), city: pick('city'), region: pick('region'), postalCode: pick('postalCode'), countryCode: pick('countryCode') || 'US', phone: pick('phone'), website: pick('website'), taxId: pick('taxId'), businessType: pick('businessType'), monthlySpendBand: pick('monthlySpendBand') })
  const [cats, setCats] = useState<string[]>((company.categoriesOfInterest ?? []).map((c: Cat) => c.id))
  const [dest, setDest] = useState<string[]>(company.destinationCountries ?? [])
  const [doc, setDoc] = useState<{ type: string; state: string; expiresOn: string; file: File | null }>({ type: 'resale_certificate', state: '', expiresOn: '', file: null })
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState<'' | 'save' | 'upload' | 'submit'>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string; where: string } | null>(null)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })
  const docs: any[] = company.documents ?? []

  async function save() {
    const r = await saveApplicationAction({ ...v, categoryIds: cats, destinationCountries: dest })
    return r
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setBusy('save'); setMsg(null)
    const r = await save()
    setBusy('')
    setMsg(r.ok ? { ok: true, text: 'Saved.', where: 'company' } : { ok: false, text: r.error, where: 'company' })
    if (r.ok) router.refresh()
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!doc.file) return
    if (doc.file.size > 10 * 1024 * 1024) { setMsg({ ok: false, text: 'Files must be 10 MB or smaller.', where: 'docs' }); return }
    setBusy('upload'); setMsg(null)
    const base64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] ?? ''); r.onerror = () => reject(r.error); r.readAsDataURL(doc.file!) })
    const r = await uploadDocumentAction({ type: doc.type, state: doc.state, expiresOn: doc.expiresOn, file: { filename: doc.file.name, mimeType: doc.file.type || 'application/pdf', base64 } })
    setBusy('')
    if (r.ok) { setDoc({ ...doc, file: null }); (e.target as HTMLFormElement).reset(); setMsg({ ok: true, text: 'Uploaded.', where: 'docs' }); router.refresh() }
    else setMsg({ ok: false, text: r.error, where: 'docs' })
  }

  async function onSubmit() {
    setBusy('submit'); setMsg(null)
    const saved = await save()
    if (!saved.ok) { setBusy(''); setMsg({ ok: false, text: saved.error, where: 'submit' }); return }
    const r = await submitApplicationAction(termsVersion)
    setBusy('')
    if (r.ok) { router.push('/buyer'); router.refresh() }
    else setMsg({ ok: false, text: r.error, where: 'submit' })
  }

  const note = (where: string) => (msg && msg.where === where ? <p className="ar-small" role={msg.ok ? 'status' : 'alert'} style={{ color: msg.ok ? 'var(--ar-green)' : 'var(--ar-red)' }}>{msg.text}</p> : null)

  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <form className="ar-panel ar-form" onSubmit={onSave} aria-labelledby="co-title">
        <h2 id="co-title">2. Your company</h2>
        <div className="ar-row">
          <label className="ar-field"><span>Legal name</span><input className="ar-input" value={v.legalName} onChange={set('legalName')} required autoComplete="organization" /></label>
          <label className="ar-field"><span>Trading name <small className="ar-muted">(if different)</small></span><input className="ar-input" value={v.tradingName} onChange={set('tradingName')} /></label>
        </div>
        <label className="ar-field"><span>Street address</span><input className="ar-input" value={v.addressLine1} onChange={set('addressLine1')} autoComplete="address-line1" /></label>
        <label className="ar-field"><span>Suite or unit <small className="ar-muted">(optional)</small></span><input className="ar-input" value={v.addressLine2} onChange={set('addressLine2')} autoComplete="address-line2" /></label>
        <div className="ar-row-3">
          <label className="ar-field"><span>City</span><input className="ar-input" value={v.city} onChange={set('city')} autoComplete="address-level2" /></label>
          <label className="ar-field"><span>State or region</span><input className="ar-input" value={v.region} onChange={set('region')} autoComplete="address-level1" /></label>
          <label className="ar-field"><span>Postal code</span><input className="ar-input" value={v.postalCode} onChange={set('postalCode')} autoComplete="postal-code" /></label>
        </div>
        <div className="ar-row">
          <label className="ar-field"><span>Country</span><select className="ar-select" value={v.countryCode} onChange={set('countryCode')}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
          <label className="ar-field"><span>Phone</span><input className="ar-input" type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" /></label>
        </div>
        <div className="ar-row">
          <label className="ar-field"><span>Website <small className="ar-muted">(optional)</small></span><input className="ar-input" value={v.website} onChange={set('website')} autoComplete="url" /></label>
          <label className="ar-field"><span>Tax ID / EIN <small className="ar-muted">(optional)</small></span><input className="ar-input" value={v.taxId} onChange={set('taxId')} /></label>
        </div>
        <div className="ar-row">
          <label className="ar-field"><span>What you do</span><select className="ar-select" value={v.businessType} onChange={set('businessType')}><option value="">Choose…</option>{BUSINESS_TYPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          <label className="ar-field"><span>Expected monthly spend</span><select className="ar-select" value={v.monthlySpendBand} onChange={set('monthlySpendBand')}><option value="">Choose…</option>{SPEND.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        </div>
        {categories.length ? (
          <div className="ar-field"><span>What you buy</span>
            <div className="ar-checks ar-checks-cols">{categories.map((c) => <label key={c.id} className="ar-check"><input type="checkbox" checked={cats.includes(c.id)} onChange={(e) => setCats(e.target.checked ? [...cats, c.id] : cats.filter((x) => x !== c.id))} /> <span>{c.name}</span></label>)}</div>
          </div>
        ) : null}
        <div className="ar-field"><span>Where the goods go</span>
          <div className="ar-checks ar-checks-cols">{COUNTRIES.map(([c, n]) => <label key={c} className="ar-check"><input type="checkbox" checked={dest.includes(c)} onChange={(e) => setDest(e.target.checked ? [...dest, c] : dest.filter((x) => x !== c))} /> <span>{n}</span></label>)}</div>
        </div>
        {note('company')}
        <div><button type="submit" className="ar-btn ar-btn-ghost" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save and continue later'}</button></div>
      </form>

      <section className="ar-panel ar-form" aria-labelledby="doc-title">
        <h2 id="doc-title">3. Documents</h2>
        <p className="ar-small ar-muted">At least one: a resale certificate or business registration is usual. PDF or image, up to 10 MB.</p>
        {docs.length ? (
          <ul className="ar-list">{docs.map((d) => <li key={d.id}><span><Check size={16} aria-hidden="true" className="ar-inline-icon" /> {DOC_TYPES.find(([k]) => k === d.type)?.[1] ?? d.type}{d.state ? ` (${d.state})` : ''}</span><span className="ar-small ar-muted">{d.status === 'submitted' ? 'Received' : d.status}{d.reviewNote ? `: ${d.reviewNote}` : ''}</span></li>)}</ul>
        ) : null}
        <form className="ar-form" onSubmit={onUpload}>
          <div className="ar-row">
            <label className="ar-field"><span>Document type</span><select className="ar-select" value={doc.type} onChange={(e) => setDoc({ ...doc, type: e.target.value })}>{DOC_TYPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
            <label className="ar-field"><span>Issuing state <small className="ar-muted">(resale certificates)</small></span><input className="ar-input" value={doc.state} maxLength={2} onChange={(e) => setDoc({ ...doc, state: e.target.value.toUpperCase() })} placeholder="e.g. OH" /></label>
          </div>
          <div className="ar-row">
            <label className="ar-field"><span>File</span><input className="ar-input" type="file" accept="application/pdf,image/*" onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] ?? null })} required /></label>
            <label className="ar-field"><span>Expires <small className="ar-muted">(optional)</small></span><input className="ar-input" type="date" value={doc.expiresOn} onChange={(e) => setDoc({ ...doc, expiresOn: e.target.value })} /></label>
          </div>
          {note('docs')}
          <div><button type="submit" className="ar-btn ar-btn-ghost" disabled={!!busy || !doc.file}><Upload size={16} aria-hidden="true" /> {busy === 'upload' ? 'Uploading…' : 'Upload document'}</button></div>
        </form>
      </section>

      <section className="ar-panel ar-form" aria-labelledby="terms-title">
        <h2 id="terms-title">4. Wholesale terms</h2>
        {terms.length ? (
          <div className="ar-terms-box">{terms.map((p, i) => (p.heading ? <h3 key={i}>{p.text}</h3> : <p key={i}>{p.text}</p>))}</div>
        ) : <p className="ar-small">Read the <a className="ar-textlink" href="/terms" target="_blank" rel="noreferrer">wholesale terms</a> (version {termsVersion}).</p>}
        <label className="ar-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> <span>I accept the wholesale terms (version {termsVersion}) for my company: every sale is as-is, payment is due on the invoice, and goods are collected on time.</span></label>
        {note('submit')}
        <div><button type="button" className="ar-btn ar-btn-primary" disabled={!!busy || !agree || !docs.length} onClick={onSubmit}>{busy === 'submit' ? 'Sending…' : 'Send application'}</button>{!docs.length ? <span className="ar-small ar-muted" style={{ marginLeft: 12 }}>Upload a document first.</span> : null}</div>
      </section>
    </div>
  )
}
