import Link from 'next/link'
import { Clock, Gavel, Laptop, Layers, Tag } from 'lucide-react'
import type { LotCard as Lot } from '../lib/data/store'
import { label, money, plural } from '../lib/format'
import { Countdown } from './Countdown'

/** Our own photographs, used only for a lot that has none of its own, by category. */
export function fallbackPhoto(category: string, title = '') {
  const c = `${category} ${title}`.toLowerCase()
  if (/laptop|notebook|macbook|latitude|thinkpad|elitebook/.test(c)) return '/storefront/lot-laptops.webp'
  if (/server|network|storage|drive|rack|data-cent|data cent|switch/.test(c)) return '/storefront/lot-servers.webp'
  if (/desktop|monitor|printer|component|cable|scrap|crt|batter|mobile|phone|tablet/.test(c)) return '/storefront/lot-mixed.webp'
  return '/storefront/lot-laptops.webp'
}

function Price({ lot, currency, priced }: { lot: Lot; currency: string; priced: boolean }) {
  if (!priced) return <div className="ar-price"><div className="ar-price-note">Sign in to see<br />prices and bid</div></div>
  if (lot.format === 'fixed_price') {
    return <div className="ar-price"><div className="ar-kicker">Buy now</div><div className="ar-price-amount ar-num">{money(lot.fixedPriceMinor, currency, { whole: true })}</div></div>
  }
  if (lot.format === 'open_auction') {
    const has = (lot.bidCount ?? 0) > 0 && lot.currentAmountMinor != null
    return (
      <div className="ar-price">
        <div className="ar-kicker">{has ? 'Current bid' : 'Opening bid'}</div>
        <div className="ar-price-amount ar-num">{money(has ? lot.currentAmountMinor : lot.openingBidMinor ?? 0, currency, { whole: true })}</div>
      </div>
    )
  }
  return (
    <div className="ar-price">
      <div className="ar-kicker">Sealed bid</div>
      {lot.openingBidMinor ? <div className="ar-price-note ar-num">from {money(lot.openingBidMinor, currency, { whole: true })}</div> : <div className="ar-price-note">No public price</div>}
    </div>
  )
}

function When({ lot, serverNow }: { lot: Lot; serverNow: number }) {
  if (lot.status === 'scheduled') return <div><div className="ar-kicker">Opens in</div><Countdown className="ar-count ar-num" to={lot.opensAt} serverNow={serverNow} /></div>
  if (lot.status === 'open') return <div><div className="ar-kicker">Ends in</div><Countdown className="ar-count ar-num" to={lot.closesAt} serverNow={serverNow} /></div>
  return <div><div className="ar-kicker">Bidding</div><div className="ar-count" style={{ fontSize: 15 }}>{lot.status === 'closed' ? 'Closed' : label(lot.status)}</div></div>
}

export function LotCard({ lot, currency, weightUnit, priced, serverNow }: { lot: Lot; currency: string; weightUnit: string; priced: boolean; serverNow: number }) {
  const href = `/lots/${encodeURIComponent(lot.lotNumber)}`
  const units = lot.unitCount ? plural(lot.unitCount, 'unit') : 'Units on the manifest'
  const lines = lot.lineCount > 1 ? ` in ${plural(lot.lineCount, 'line')}` : ''
  const load = [lot.palletCount ? plural(lot.palletCount, 'pallet') : '', lot.weight ? `${Math.round(lot.weight).toLocaleString('en-US')} ${weightUnit}` : ''].filter(Boolean).join(', ')
  const cta = lot.status !== 'open' ? 'View lot' : !priced ? 'Sign in to bid' : lot.format === 'fixed_price' ? 'Buy now' : lot.myBidStatus === 'active' ? 'View your bid' : 'Place bid'
  return (
    <article className="ar-card">
      <Link href={href} className="ar-card-photo" tabIndex={-1} aria-hidden="true">
        <span className="ar-tab">LOT {lot.lotNumber}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lot.imageUrl || fallbackPhoto(lot.category, lot.title)} alt="" loading="lazy" />
      </Link>
      <div className="ar-card-body">
        <h3 className="ar-card-title"><Link href={href}>{lot.title}</Link></h3>
        <ul className="ar-specs">
          <li><Laptop size={15} aria-hidden="true" /><span>{units}{lines}</span></li>
          <li><Tag size={15} aria-hidden="true" /><span>{lot.conditionSummary || lot.category || label(lot.format)}</span></li>
          <li><Layers size={15} aria-hidden="true" /><span>{load || `${label(lot.format)}, ${label(lot.bidBasis).toLowerCase()}`}</span></li>
        </ul>
        {priced && lot.myBidStatus ? (
          <p className="ar-mine">Your bid: {lot.myBidMinor != null ? money(lot.myBidMinor, currency) : ''} · {label(lot.myBidStatus)}</p>
        ) : null}
        <div className="ar-card-foot">
          <div className="ar-ends"><Clock size={16} aria-hidden="true" /><When lot={lot} serverNow={serverNow} /></div>
          <Price lot={lot} currency={currency} priced={priced} />
        </div>
        <div className="ar-card-cta">
          <Link className="ar-btn ar-btn-primary ar-btn-block" href={href}><Gavel size={16} aria-hidden="true" /> {cta}</Link>
        </div>
      </div>
    </article>
  )
}
