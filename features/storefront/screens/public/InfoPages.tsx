import { Fragment } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BadgeCheck, ClipboardList, FileSpreadsheet, Gavel, MapPin, Phone, ShieldCheck, Truck, X } from 'lucide-react'
import { ApplyForm } from '../../components/buyer/ApplyForm'
import { VerifyForm } from '../../components/VerifyForm'
import { LoadError, Notice, PageHead, SlashHead, StatusPill } from '../../components/ui'
import { getViewer } from '../../lib/data/session'
import { getStore, myBuyerCompany, publicAcceptedItems, publicCategories, publicCertifications, publicFacilities, publicGradeGuide, verifyCertificate } from '../../lib/data/store'
import { date, docParagraphs, label, money, plural } from '../../lib/format'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_NAMES: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

function fee(i: { feeType: string; feeMinor: number }, cur: string, wu: string) {
  if (i.feeType === 'free' || !i.feeMinor) return 'Free'
  if (i.feeType === 'per_item') return `${money(i.feeMinor, cur)} each`
  if (i.feeType === 'per_weight') return `${money(i.feeMinor, cur)} per ${wu}`
  return money(i.feeMinor, cur)
}

function Doc({ paragraphs }: { paragraphs: Array<{ heading: boolean; text: string }> }) {
  return <div className="ar-doc">{paragraphs.map((p, i) => (p.heading ? <h3 key={i}>{p.text}</h3> : <p key={i}>{p.text}</p>))}</div>
}

/** P2: services, what we accept and what it costs, locations and hours, on one page. */
export async function RecyclePage() {
  const [store, items, facilities, certs] = await Promise.all([getStore(), publicAcceptedItems(), publicFacilities(), publicCertifications()])
  const s = store.ok ? store.data : null
  const cur = s?.currencyCode || 'USD'
  const wu = s?.weightUnit || 'lb'
  const accepted = items.ok ? items.data.filter((i) => i.accepted) : []
  const refused = items.ok ? items.data.filter((i) => !i.accepted) : []
  return (
    <>
      <PageHead title="Recycle with us" lede="Retired IT from offices, hospitals, schools and data centres: we collect it in sealed containers, wipe or destroy every drive, resell what still works, and recycle the rest. You get a certificate for each job." />
      <div className="ar-wrap ar-section">
        <div className="ar-grid-3 ar-services">
          <div className="ar-panel"><Truck size={28} aria-hidden="true" className="ar-y" /><h2>Collection</h2><p>Our truck and driver, sealed and numbered containers, signed for at your door. Or drop off at our dock.</p></div>
          <div className="ar-panel"><ShieldCheck size={28} aria-hidden="true" className="ar-y" /><h2>Data destruction</h2><p>Drives wiped to NIST 800-88 and verified, or shredded. Serial-numbered record for every device.</p></div>
          <div className="ar-panel"><BadgeCheck size={28} aria-hidden="true" className="ar-y" /><h2>Certificates</h2><p>A certificate of data destruction and of recycling for each job, which anyone can check online by its code.</p></div>
        </div>
        <div className="ar-actions" style={{ marginTop: 24 }}>
          <Link className="ar-btn ar-btn-primary" href="/request-pickup">Request a pickup <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link className="ar-btn ar-btn-ghost" href="/verify">Verify a certificate</Link>
        </div>
      </div>

      <section className="ar-wrap ar-section" aria-labelledby="accept-title">
        <SlashHead title={<span id="accept-title">What we accept</span>} lede="Fees are per item or by weight; most IT equipment is free because we resell or recycle it." />
        {!items.ok ? <LoadError message={items.error} /> : (
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead><tr><th scope="col">Item</th><th scope="col">Fee</th><th scope="col">Notes</th></tr></thead>
              <tbody>{accepted.map((i) => <tr key={i.id}><td data-label="Item">{i.name}</td><td data-label="Fee" className={i.feeType === 'free' ? 'ar-y' : ''}>{fee(i, cur, wu)}</td><td data-label="Notes">{i.notes || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {refused.length ? <p className="ar-small" style={{ marginTop: 14 }}><X size={14} aria-hidden="true" className="ar-inline-icon" /> We do not take: {refused.map((i) => i.name + (i.notes ? ` (${i.notes})` : '')).join(', ')}.</p> : null}
      </section>

      <section className="ar-wrap ar-section" aria-labelledby="where-title">
        <SlashHead title={<span id="where-title">Where we are</span>} />
        {!facilities.ok ? <LoadError message={facilities.error} /> : (
          <div className="ar-grid-2">
            {facilities.data.map((f) => (
              <div key={f.id} className="ar-panel">
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{f.name}</h3>
                <p><MapPin size={16} aria-hidden="true" className="ar-inline-icon" /> {f.addressLine1}{f.addressLine2 ? `, ${f.addressLine2}` : ''}, {f.city}, {f.region} {f.postalCode}</p>
                {f.phone ? <p style={{ marginTop: 4 }}><Phone size={16} aria-hidden="true" className="ar-inline-icon" /> <a className="ar-textlink" href={`tel:${f.phone.replace(/[^\d+]/g, '')}`}>{f.phone}</a></p> : null}
                <dl className="ar-hours">{DAYS.map((d) => <div key={d}><dt>{DAY_NAMES[d]}</dt><dd>{f.hours?.[d] ? f.hours[d]!.replace('-', '–') : 'Closed'}</dd></div>)}</dl>
                <p className="ar-small ar-muted" style={{ marginTop: 10 }}>{f.acceptsDropOff ? 'Drop-offs welcome in these hours.' : 'Collections only.'}</p>
              </div>
            ))}
          </div>
        )}
        {certs.ok && certs.data.length ? (
          <p className="ar-small" style={{ marginTop: 18 }}><BadgeCheck size={16} aria-hidden="true" className="ar-inline-icon ar-y" /> Certified: {certs.data.map((c) => `${c.name} (${c.certifyingBody}, ${c.certificateNumber}${c.expiresOn ? `, until ${date(c.expiresOn, 'UTC')}` : ''})`).join('; ')}.</p>
        ) : null}
      </section>
    </>
  )
}

/** P6: how buying works, the rules read from settings, the grading guide. */
export async function BuyersPage() {
  const [store, grades, viewer] = await Promise.all([getStore(), publicGradeGuide(), getViewer()])
  if (!store.ok) return <div className="ar-wrap ar-section"><LoadError message={store.error} /></div>
  const s = store.data
  const r = s.rules as Record<string, any>
  const cur = s.currencyCode
  const rules: Array<[string, string]> = [
    ['Sealed bids', `Each approved buyer sends one bid for the lot, or a price per line. Nobody sees the others. You can change or withdraw it until the lot closes. Bids stay valid for ${plural(r.bidValidityBusinessDays, 'business day')} after the close.`],
    ['Open auctions', `The highest bid shows live. A bid in the last ${plural(r.softCloseWindowMinutes, 'minute')} extends the close by ${plural(r.softCloseExtensionMinutes, 'minute')}.`],
    ['Buyer premium', r.buyerPremiumBps ? `${r.buyerPremiumBps / 100}% is added to the winning price.` : 'None.'],
    ['Payment', `Due within ${plural(r.paymentDueBusinessDays, 'business day')} of the invoice, by wire or ACH at no charge${r.cardFeeBps ? `, or by card with a ${r.cardFeeBps / 100}% fee` : ', or by card'}${r.cardMaxAmountMinor ? ` up to ${money(r.cardMaxAmountMinor, cur)}` : ''}.`],
    ['Collection', `Within ${plural(r.removalBusinessDays, 'business day')} of payment.${r.storageFeePerPalletPerDayMinor ? ` After that, storage is ${money(r.storageFeePerPalletPerDayMinor, cur)} per pallet per day.` : ''}`],
    ['Claims', `Report a count or grade problem within ${plural(r.claimWindowBusinessDays, 'business day')} of collection.`],
    ['Not paying', `A won lot that is not paid is cancelled${r.restockingFeeBps ? ` with a ${r.restockingFeeBps / 100}% restocking fee` : ''}. After ${plural(r.strikesBeforeSuspension, 'missed payment')} the account is suspended.`],
  ]
  const byKind = grades.ok ? grades.data.reduce<Record<string, typeof grades.data>>((m, g) => ({ ...m, [g.kind]: [...(m[g.kind] ?? []), g] }), {}) : {}
  return (
    <>
      <PageHead title="Buy from us" lede="Pallets of used business laptops, desktops, servers, networking and drives, sold by the lot to approved trade buyers. Every data device is wiped or its drive removed before sale." />
      <section className="ar-wrap ar-section" aria-labelledby="steps-title">
        <SlashHead title={<span id="steps-title">How it works</span>} />
        <ol className="ar-steps-list">
          <li><ClipboardList size={26} aria-hidden="true" /><div><h3>Apply once</h3><p>Create an account, tell us about your company and upload a resale certificate or registration. We review it, usually within two business days.</p></div></li>
          <li><FileSpreadsheet size={26} aria-hidden="true" /><div><h3>Read the manifest</h3><p>Every lot lists make, model, specs, grade and quantity. Read it online or download it as Excel.</p></div></li>
          <li><Gavel size={26} aria-hidden="true" /><div><h3>Bid</h3><p>Enter one amount for the lot, a price per line, or fill in the bid sheet and upload it. You see straight away that it arrived.</p></div></li>
          <li><Truck size={26} aria-hidden="true" /><div><h3>Pay and collect</h3><p>Win, pay the invoice online, and tell us your driver or carrier. The pallets are wrapped and waiting with the packing list.</p></div></li>
        </ol>
        <div className="ar-actions" style={{ marginTop: 24 }}>
          {viewer?.kind === 'buyer' ? <Link className="ar-btn ar-btn-primary" href="/lots">See the lots <ArrowRight size={18} aria-hidden="true" /></Link> : <Link className="ar-btn ar-btn-primary" href="/buyers/apply">Apply to buy <ArrowRight size={18} aria-hidden="true" /></Link>}
          <Link className="ar-btn ar-btn-ghost" href="/terms#wholesale">Wholesale terms</Link>
        </div>
      </section>
      <section className="ar-wrap ar-section" aria-labelledby="rules-title">
        <SlashHead title={<span id="rules-title">The rules</span>} lede="These come straight from our current settings." />
        <dl className="ar-rules">{rules.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </section>
      {grades.ok && grades.data.length ? (
        <section className="ar-wrap ar-section" aria-labelledby="grades-title">
          <SlashHead title={<span id="grades-title">Grading guide</span>} lede="Every unit carries a cosmetic grade and a functional grade." />
          <div className="ar-grid-2">
            {Object.entries(byKind).map(([kind, list]) => (
              <div key={kind} className="ar-panel">
                <h3 style={{ fontSize: 18, marginBottom: 12 }}>{label(kind)}</h3>
                <dl className="ar-dl">{list.map((g) => <Fragment key={g.id}><dt><strong className="ar-y">{g.code}</strong> {/^grade\s/i.test(g.label) ? '' : g.label}</dt><dd>{g.description}</dd></Fragment>)}</dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

/** P7: account (via sign up), company, documents, terms. */
export async function ApplyPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/signup')
  if (viewer.kind !== 'buyer') {
    return (
      <>
        <PageHead title="Apply to buy" />
        <div className="ar-wrap ar-section" style={{ maxWidth: 760 }}><Notice title={`You are signed in with a ${viewer.kind === 'client' ? 'client' : 'staff'} account`}>Buyer applications need their own login. Sign out, then create a buyer account.</Notice></div>
      </>
    )
  }
  const [store, company, cats] = await Promise.all([getStore(), myBuyerCompany(), publicCategories()])
  if (!company.ok) return <div className="ar-wrap ar-section"><LoadError message={company.error} /></div>
  const c = company.data
  if (!['draft', 'needs_info', 'rejected'].includes(c.status)) redirect('/buyer')
  const s = store.ok ? store.data : null
  return (
    <>
      <PageHead title="Apply to buy" lede={<>Signed in as {c.me.name}. Step 1 is done; finish the rest now or save and come back. <StatusPill status={c.status} /></>} crumbs={[{ href: '/buyers', label: 'Buy from us' }, { label: 'Apply' }]} />
      <div className="ar-wrap ar-section" style={{ maxWidth: 900 }}>
        {c.status === 'needs_info' && c.statusReason ? <div style={{ marginBottom: 18 }}><Notice title="We need more information">{c.statusReason} <Link className="ar-textlink" href="/buyer">Reply on your account page</Link>.</Notice></div> : null}
        <ApplyForm company={c} categories={cats.ok ? cats.data.filter((x) => x.kind !== 'material').map((x) => ({ id: x.id, name: x.name })) : []} termsVersion={s?.wholesaleTermsVersion || c.currentTermsVersion} terms={docParagraphs(s?.wholesaleTerms)} />
      </div>
    </>
  )
}

/** P8 */
export async function VerifyPage({ params }: { params?: Promise<{ code?: string }> }) {
  const code = params ? decodeURIComponent((await params).code || '') : ''
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const result = clean ? await verifyCertificate(clean) : null
  const cert = result && result.ok ? result.data : null
  return (
    <>
      <PageHead title="Verify a certificate" lede="Every certificate we issue carries a 12-character code. Enter it to see that it is genuine and still valid." />
      <div className="ar-wrap ar-section" style={{ maxWidth: 820 }}>
        <VerifyForm initial={clean} />
        {clean ? (
          <div style={{ marginTop: 24 }}>
            {result && !result.ok ? <LoadError message={result.error} /> : !cert ? (
              <Notice tone="error" title="No certificate has that code">Check the code on the certificate. It is 12 letters and numbers, without spaces.</Notice>
            ) : (
              <section className={`ar-panel ar-cert ${cert.status === 'revoked' ? 'is-revoked' : ''}`} aria-labelledby="cert-title">
                <div className="ar-panel-head">
                  <h2 id="cert-title">{cert.certificateNumber}</h2>
                  <StatusPill status={cert.status === 'revoked' ? 'revoked' : 'valid'} text={cert.status === 'revoked' ? 'Revoked' : 'Genuine and valid'} />
                </div>
                {cert.status === 'revoked' ? <p style={{ marginBottom: 12, color: 'var(--ar-red)' }}>Revoked {date(cert.revokedAt, 'UTC')}{cert.revokedReason ? `: ${cert.revokedReason}` : ''}.{cert.replacedBy ? ` Replaced by ${cert.replacedBy}.` : ''}</p> : null}
                <dl className="ar-dl">
                  <dt>Type</dt><dd>{label(cert.type)}</dd>
                  <dt>Issued to</dt><dd>{cert.clientName}</dd>
                  <dt>Job</dt><dd>{cert.jobNumber}</dd>
                  <dt>Issued</dt><dd>{date(cert.issuedAt, 'UTC')}</dd>
                  {cert.deviceCount ? <><dt>Devices</dt><dd>{cert.deviceCount}</dd></> : null}
                  {cert.totalWeight ? <><dt>Weight</dt><dd>{cert.totalWeight}</dd></> : null}
                  <dt>Processed at</dt><dd>{cert.facility}</dd>
                </dl>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

/** P9 */
export async function TermsPage() {
  const store = await getStore()
  if (!store.ok) return <div className="ar-wrap ar-section"><LoadError message={store.error} /></div>
  const s = store.data
  const wholesale = docParagraphs(s.wholesaleTerms)
  const service = docParagraphs(s.serviceTerms)
  return (
    <>
      <PageHead title="Terms" lede={`The terms ${s.businessName} sells and collects under. When a version changes, buyers and clients accept the new one before their next bid or quote.`} />
      <div className="ar-wrap ar-section ar-terms-page">
        <nav className="ar-actions" aria-label="On this page" style={{ marginBottom: 24 }}><a className="ar-btn ar-btn-ghost ar-btn-sm" href="#wholesale">Wholesale terms</a><a className="ar-btn ar-btn-ghost ar-btn-sm" href="#service">Service terms</a></nav>
        <section id="wholesale" className="ar-panel" aria-labelledby="wt">
          <div className="ar-panel-head"><h2 id="wt">Wholesale terms</h2><span className="ar-small ar-muted">Version {s.wholesaleTermsVersion}</span></div>
          {wholesale.length ? <Doc paragraphs={wholesale} /> : <p className="ar-muted">The full wholesale terms are sent with your buyer approval. Email {s.supportEmail} for a copy.</p>}
          {s.exportClause ? <><h3 style={{ marginTop: 18 }}>Export clause</h3><p>{s.exportClause}</p></> : null}
        </section>
        <section id="service" className="ar-panel" aria-labelledby="st">
          <div className="ar-panel-head"><h2 id="st">Service terms</h2><span className="ar-small ar-muted">Version {s.serviceTermsVersion}</span></div>
          {service.length ? <Doc paragraphs={service} /> : <p className="ar-muted">The service terms come with each quote. Email {s.supportEmail} for a copy.</p>}
        </section>
      </div>
    </>
  )
}
