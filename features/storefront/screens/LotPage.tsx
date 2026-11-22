import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Countdown } from '../components/Countdown'
import { Gallery } from '../components/lot/Gallery'
import { BidPanel } from '../components/lot/BidPanel'
import { Manifest } from '../components/lot/Manifest'
import { DownloadButton } from '../components/lot/DownloadButton'
import { LineBid } from '../components/lot/LineBid'
import { fallbackPhoto } from '../components/LotCard'
import { LoadError, Notice, PageHead, StatusPill } from '../components/ui'
import { getStore } from '../lib/data/store'
import { getViewer } from '../lib/data/session'
import { lotFor, seesPrices } from '../lib/data/lots'
import { dateTime, docParagraphs, label, plural } from '../lib/format'

/** P5 (teaser) and U3 to U8 (approved buyer). */
export async function LotPage({ params }: { params: Promise<{ lotNumber: string }> }) {
  const { lotNumber: raw } = await params
  const lotNumber = decodeURIComponent(raw)
  const viewer = await getViewer()
  const [store, { result, full }] = await Promise.all([getStore(), lotFor(viewer, lotNumber)])
  const s = store.ok ? store.data : null
  const tz = s?.timezone || 'America/New_York'
  const currency = s?.currencyCode || 'USD'
  const unit = s?.weightUnit || 'lb'
  const serverNow = Date.now()
  if (!result.ok) {
    return (
      <div className="ar-wrap ar-page"><LoadError message={result.error} /></div>
    )
  }
  const lot = result.data
  if (!lot) notFound()
  const priced = seesPrices(viewer) && full
  const images: Array<{ url: string; caption: string }> = lot.images?.length ? lot.images : [{ url: fallbackPhoto(lot.category, lot.title), caption: '' }]
  const description = docParagraphs(lot.description)
  const facts: Array<[string, string]> = [
    ['Units', lot.unitCount ? `${plural(lot.unitCount, 'unit')}${lot.lineCount > 1 ? ` in ${plural(lot.lineCount, 'line')}` : ''}` : 'See manifest'],
    ['Format', `${label(lot.format)}${lot.format !== 'fixed_price' ? `, ${label(lot.bidBasis).toLowerCase()}` : ''}`],
    ['Pallets', lot.palletCount ? String(lot.palletCount) : 'Confirmed at release'],
    ['Weight', lot.weight ? `${Math.round(lot.weight).toLocaleString('en-US')} ${unit}` : 'Confirmed at release'],
    ['Shipping', label(lot.shippingTerms)],
    ['Export', lot.exportAllowed ? 'Allowed, with the export clause' : 'Domestic buyers only'],
  ]
  if (full && lot.facility) facts.push(['Collect from', lot.facility])
  if (full && lot.dimensions) facts.push(['Dimensions', lot.dimensions])
  if (full && lot.warrantyDays) facts.push(['Warranty', `${lot.warrantyDays} days`])
  if (lot.manufacturers?.length) facts.push(['Makes', lot.manufacturers.join(', ')])

  return (
    <>
      <PageHead
        title={lot.title}
        crumbs={[{ href: '/', label: 'Home' }, { href: '/lots', label: 'Lots' }, ...(lot.saleEvent ? [{ label: lot.saleEvent.title }] : []), { label: lot.lotNumber }]}
        lede={<span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}><span className="ar-pill ar-pill-y">Lot {lot.lotNumber}</span><StatusPill status={lot.status} />{lot.category ? <span className="ar-muted">{lot.category}</span> : null}</span>}
      />
      <div className="ar-wrap ar-page">
        <div className="ar-split">
          <div className="ar-stack">
            <div className="ar-lot-top" style={{ gridTemplateColumns: '1fr' }}>
              <Gallery images={images} title={lot.title} />
            </div>
            <dl className="ar-lot-facts">
              {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {lot.conditionSummary || description.length ? (
              <section className="ar-panel">
                <h2 style={{ marginBottom: 10 }}>About this lot</h2>
                <div className="ar-prose">
                  {lot.conditionSummary ? <p><strong>Condition:</strong> {lot.conditionSummary}</p> : null}
                  {description.map((p, i) => (p.heading ? <h3 key={i}>{p.text}</h3> : <p key={i}>{p.text}</p>))}
                </div>
              </section>
            ) : null}
            {full && lot.addenda?.length ? (
              <section className="ar-panel ar-panel-y" aria-label="Addenda">
                <h2 style={{ marginBottom: 10 }}>Addenda</h2>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                  {lot.addenda.map((a: any) => <li key={a.id}><span className="ar-muted ar-small">{dateTime(a.postedAt, tz)}</span><br />{a.body}</li>)}
                </ul>
              </section>
            ) : null}
            {priced && lot.manifestVisible && lot.bidBasis === 'per_line' && lot.format !== 'fixed_price' ? (
              <LineBid lotNumber={lot.lotNumber} lines={lot.lines} currency={currency} open={lot.status === 'open'} mayBid={lot.mayBid && !lot.termsVersionRequired} myLines={lot.myBid?.status === 'active' || lot.myBid?.status === 'won' || lot.myBid?.status === 'partially_won' ? lot.myBid.lines : []} />
            ) : (
            <section className="ar-panel" aria-labelledby="manifest-title">
              <div className="ar-panel-head">
                <h2 id="manifest-title">Manifest</h2>
                {full && lot.manifestVisible ? <DownloadButton kind="manifest" lotNumber={lot.lotNumber} label="Download manifest (Excel)" /> : null}
              </div>
              {full && lot.manifestVisible ? (
                lot.lines.length ? <Manifest lines={lot.lines} /> : <p className="ar-muted">No lines on this lot yet.</p>
              ) : (
                <div className="ar-empty">
                  <h3><Lock size={16} aria-hidden="true" /> Sign in to see the manifest and bid</h3>
                  <p>{viewer?.kind === 'buyer' ? 'The line-by-line manifest opens when your company is approved.' : 'Approved buyers see every line, grade and serial count, and can download it as Excel.'}</p>
                  <div className="ar-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
                    {viewer?.kind === 'buyer' ? <Link className="ar-btn ar-btn-primary" href="/buyer">See your application</Link> : viewer ? null : (
                      <>
                        <Link className="ar-btn ar-btn-primary" href={`/signin?next=${encodeURIComponent(`/lots/${lot.lotNumber}`)}`}>Sign in</Link>
                        <Link className="ar-btn ar-btn-ghost" href="/buyers/apply">Apply as a buyer</Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </section>
            )}
          </div>

          <aside aria-label="Bidding">
            {priced ? (
              <BidPanel lot={lot} currency={currency} tz={tz} serverNow={serverNow} termsVersion={s?.wholesaleTermsVersion || ''} />
            ) : (
              <div className="ar-bidbox">
                <h2>{label(lot.format)}</h2>
                <div style={{ marginTop: 12 }}>
                  <div className="ar-kicker">{lot.status === 'scheduled' ? 'Opens in' : lot.status === 'open' ? 'Ends in' : 'Bidding'}</div>
                  {lot.status === 'open' || lot.status === 'scheduled' ? (
                    <Countdown className="ar-count-big ar-num" to={lot.status === 'scheduled' ? lot.opensAt : lot.closesAt} serverNow={serverNow} />
                  ) : <div className="ar-count-big">{label(lot.status)}</div>}
                  <p className="ar-small ar-muted" style={{ marginTop: 4 }}>{lot.status === 'scheduled' ? `Opens ${dateTime(lot.opensAt, tz)}` : `Closes ${dateTime(lot.closesAt, tz)}`}</p>
                </div>
                <hr className="ar-rule" />
                {viewer?.kind === 'buyer' ? (
                  <Notice title="Not approved yet">Prices and bidding open when we approve your company. <Link className="ar-textlink" href="/buyer">Your application</Link></Notice>
                ) : viewer ? (
                  <Notice title="Buyer accounts only">This account is not a buyer account. Bidding is for approved buyer companies.</Notice>
                ) : (
                  <>
                    <p style={{ fontWeight: 700 }}>Sign in to see prices and bid</p>
                    <p className="ar-small ar-muted" style={{ marginTop: 4 }}>Bidding is for approved trade buyers.</p>
                    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                      <Link className="ar-btn ar-btn-primary ar-btn-block" href={`/signin?next=${encodeURIComponent(`/lots/${lot.lotNumber}`)}`}>Sign in to bid</Link>
                      <Link className="ar-btn ar-btn-ghost ar-btn-block" href="/buyers/apply">Apply as a buyer</Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
