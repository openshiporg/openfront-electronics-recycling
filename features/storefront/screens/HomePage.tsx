import Link from 'next/link'
import { ArrowRight, BadgeCheck, CalendarClock, Check, ClipboardList, CreditCard, Gavel, MapPin, PackageCheck, ShieldCheck, Truck, Warehouse } from 'lucide-react'
import { LotCard } from '../components/LotCard'
import { Empty, LoadError, SlashHead } from '../components/ui'
import { getStore, publicAcceptedItems, publicCertifications, publicFacilities, publicSaleEvents } from '../lib/data/store'
import { getViewer } from '../lib/data/session'
import { lotsFor } from '../lib/data/lots'
import { dateTime, plural } from '../lib/format'

/** P1: what we do, the two doors, lots closing soon, certifications held. */
export async function HomePage() {
  const viewer = await getViewer()
  const [store, lots, events, facilities, certs, accepted] = await Promise.all([getStore(), lotsFor(viewer), publicSaleEvents(), publicFacilities(), publicCertifications(), publicAcceptedItems()])
  const s = store.ok ? store.data : null
  const tz = s?.timezone || 'America/New_York'
  const currency = s?.currencyCode || 'USD'
  const serverNow = Date.now()
  const open = lots.ok ? lots.data.filter((l) => l.status === 'open' || l.status === 'scheduled') : []
  const shown = open.slice(0, 4)
  const nextEvent = events.ok ? events.data.find((e) => new Date(e.opensAt).getTime() > serverNow) : undefined
  const facility = facilities.ok ? facilities.data[0] : undefined
  const dueDays = Number(s?.rules?.paymentDueBusinessDays ?? 0)
  const removalDays = Number(s?.rules?.removalBusinessDays ?? 0)
  const certList = certs.ok ? certs.data : []
  const acceptedList = accepted.ok ? accepted.data.filter((a) => a.accepted).slice(0, 6) : []
  const approvedBuyer = viewer?.kind === 'buyer' && viewer.buyerStatus === 'approved'
  return (
    <>
      <section className="ar-hero" aria-labelledby="hero-title">
        <div className="ar-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/storefront/hero-warehouse.webp" alt="Shrink-wrapped pallets of used laptops and rack servers in our warehouse" />
        </div>
        <span className="ar-hero-stripe" aria-hidden="true" />
        <div className="ar-wrap ar-hero-in">
          <div className="ar-hero-text">
            <p className="ar-label">Trade-only sales</p>
            <h1 id="hero-title">Bid on pallets of used business <span className="ar-y">laptops &amp; servers</span></h1>
            <p className="ar-hero-lede">Wholesale lots from business IT refreshes, with a full manifest, for approved buyers only.</p>
            <div className="ar-hero-actions">
              <Link className="ar-btn ar-btn-primary" href="/lots"><Gavel size={18} aria-hidden="true" /> View this week&rsquo;s lots <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link className="ar-btn ar-btn-outline" href="/request-pickup">Request a pickup</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="ar-facts" aria-label="At a glance">
        <div className="ar-wrap ar-facts-in">
          <div className="ar-fact">
            <PackageCheck size={30} aria-hidden="true" />
            <div><strong>{open.length ? `${plural(open.length, 'lot')} on sale` : 'Lots every sale week'}</strong><span>{open.length ? `Full manifests for approved buyers` : nextEvent ? `Next sale opens ${dateTime(nextEvent.opensAt, tz)}` : 'Sign up to hear about the next sale'}</span></div>
          </div>
          <div className="ar-fact">
            <ClipboardList size={30} aria-hidden="true" />
            <div><strong>Bid in Excel or online</strong><span>Download the manifest, bid by lot or by line</span></div>
          </div>
          <div className="ar-fact">
            <CreditCard size={30} aria-hidden="true" />
            <div><strong>{dueDays ? `Pay within ${plural(dueDays, 'business day')}` : 'Pay by wire, ACH or card'}</strong><span>Wire, ACH or card on every invoice</span></div>
          </div>
          <div className="ar-fact">
            <Warehouse size={30} aria-hidden="true" />
            <div><strong>{facility ? `Pickup in ${facility.city}${facility.region ? `, ${facility.region}` : ''}` : 'Pickup or freight'}</strong><span>{removalDays ? `Collect within ${plural(removalDays, 'business day')} of payment` : 'Own pickup or your carrier'}</span></div>
          </div>
        </div>
      </section>

      <section className="ar-section" aria-labelledby="lots-title">
        <div className="ar-wrap">
          <div className="ar-section-head">
            <div id="lots-title"><SlashHead title="This week’s lots" lede={approvedBuyer ? 'Open lots, soonest closing first. Your bids are marked on each card.' : 'Pallets of used business laptops, servers and more. Bidding is for approved buyers only.'} /></div>
            <Link className="ar-link" href="/lots">View all lots <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          {!lots.ok ? (
            <LoadError message={lots.error} />
          ) : shown.length ? (
            <div className="ar-cards">
              {shown.map((lot) => <LotCard key={lot.id} lot={lot} currency={currency} weightUnit={s?.weightUnit || 'lb'} priced={lots.priced} serverNow={serverNow} />)}
            </div>
          ) : (
            <Empty title="No lots are open right now">
              {nextEvent ? <>The next sale, {nextEvent.title}, opens {dateTime(nextEvent.opensAt, tz)}.</> : <>New lots are listed each sale week. Apply now so you can bid when they open.</>}
            </Empty>
          )}
        </div>
      </section>

      <section className="ar-how" aria-labelledby="how-title">
        <div className="ar-wrap ar-how-in">
          <div className="ar-how-intro" id="how-title">
            <SlashHead title="How it works" />
            <p>A trade-only process for buying used IT in volume. <Link className="ar-textlink" href="/buyers">Read the rules</Link></p>
          </div>
          <ol className="ar-steps">
            <li className="ar-step">
              <span className="ar-step-n">1</span>
              <div><ClipboardList className="ar-step-icon" size={34} aria-hidden="true" /><h3>Get approved</h3><p>Apply with your company details and a resale certificate or business registration.</p></div>
            </li>
            <li className="ar-step-arrow" aria-hidden="true"><ArrowRight size={20} /></li>
            <li className="ar-step">
              <span className="ar-step-n">2</span>
              <div><Gavel className="ar-step-icon" size={34} aria-hidden="true" /><h3>Bid on lots</h3><p>Read the manifest, then bid on the lot or line by line before it closes.</p></div>
            </li>
            <li className="ar-step-arrow" aria-hidden="true"><ArrowRight size={20} /></li>
            <li className="ar-step">
              <span className="ar-step-n">3</span>
              <div><Truck className="ar-step-icon" size={34} aria-hidden="true" /><h3>Pay and collect</h3><p>Win, pay the invoice, then collect it yourself or send your carrier.</p></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="ar-recycle" aria-labelledby="recycle-title">
        <div className="ar-wrap ar-recycle-in">
          <div>
            <p className="ar-label" style={{ fontSize: 13 }}>For businesses</p>
            <h2 id="recycle-title" style={{ marginTop: 6 }}>Retiring IT equipment? Recycle with us.</h2>
            <p>We collect from your site, wipe or destroy every data-bearing device, and send you a certificate listing each serial number. Resale value can come back to you.</p>
            <div className="ar-actions" style={{ marginTop: 18 }}>
              <Link className="ar-btn ar-btn-primary" href="/request-pickup">Request a pickup</Link>
              <Link className="ar-link" href="/recycle">What we accept and fees <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
          {acceptedList.length ? (
            <ul className="ar-recycle-list" aria-label="Some of what we accept">
              {acceptedList.map((a) => <li key={a.id}><Check size={16} aria-hidden="true" /> {a.name}</li>)}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="ar-close" aria-label="Why buy and recycle with us">
        <div className="ar-wrap ar-close-in">
          <div className="ar-close-block"><h2>{certList.length ? 'Certified and accountable' : 'Every device accounted for'}</h2></div>
          <div className="ar-close-items">
            {certList.slice(0, 2).map((c) => (
              <div className="ar-close-item" key={c.id}><BadgeCheck size={30} aria-hidden="true" /><span>{c.name}{c.certificateNumber ? <><br /><small className="ar-muted">No. {c.certificateNumber}</small></> : null}</span></div>
            ))}
            <div className="ar-close-item"><ShieldCheck size={30} aria-hidden="true" /><span>Certificates you can<br /><Link className="ar-textlink" href="/verify">verify online</Link></span></div>
            <div className="ar-close-item"><ClipboardList size={30} aria-hidden="true" /><span>Serial-level manifests<br />on every lot</span></div>
            {certList.length < 2 ? <div className="ar-close-item"><CalendarClock size={30} aria-hidden="true" /><span>Times shown in<br />{tz.split('/').pop()?.replace(/_/g, ' ')} time</span></div> : null}
            {certList.length < 1 && facility ? <div className="ar-close-item"><MapPin size={30} aria-hidden="true" /><span>{facility.name}<br />{facility.city}{facility.region ? `, ${facility.region}` : ''}</span></div> : null}
          </div>
        </div>
      </section>
    </>
  )
}
