import Link from 'next/link'
import { LotCard } from '../components/LotCard'
import { Empty, LoadError, Notice, PageHead, SlashHead } from '../components/ui'
import { getStore, publicCategories, publicSaleEvents, type LotCard as Lot, type SaleEvent } from '../lib/data/store'
import { getViewer } from '../lib/data/session'
import { lotsFor, seesPrices } from '../lib/data/lots'
import { dateTime, label } from '../lib/format'

type Search = { category?: string; format?: string; closing?: string; sale?: string }

const CLOSING = [
  { value: '', label: 'Any time' },
  { value: '24', label: 'Within 24 hours' },
  { value: '72', label: 'Within 3 days' },
  { value: '168', label: 'Within 7 days' },
]

/** P4 (public) and U2 (approved buyer): lots grouped by sale, with filters. */
export async function LotsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const viewer = await getViewer()
  const priced = seesPrices(viewer)
  const filter = {
    category: sp.category || undefined,
    format: ['sealed_bid', 'open_auction', 'fixed_price'].includes(sp.format || '') ? sp.format : undefined,
    closingWithinHours: Number(sp.closing) > 0 ? Number(sp.closing) : undefined,
    saleEventId: sp.sale || undefined,
  }
  const [store, lots, events, categories] = await Promise.all([getStore(), lotsFor(viewer, filter), publicSaleEvents(), publicCategories()])
  const s = store.ok ? store.data : null
  const tz = s?.timezone || 'America/New_York'
  const currency = s?.currencyCode || 'USD'
  const serverNow = Date.now()
  const eventList: SaleEvent[] = events.ok ? events.data : []
  const filtered = Boolean(filter.category || filter.format || filter.closingWithinHours || filter.saleEventId)

  // Group by sale in sale order; lots outside a sale come last.
  const groups = new Map<string, { title: string; event?: SaleEvent; lots: Lot[] }>()
  for (const lot of lots.ok ? lots.data : []) {
    const key = lot.saleEvent?.id ?? 'none'
    if (!groups.has(key)) groups.set(key, { title: lot.saleEvent?.title ?? 'Other lots', event: eventList.find((e) => e.id === key), lots: [] })
    groups.get(key)!.lots.push(lot)
  }
  const ordered = [...groups.values()].sort((a, b) => (a.event ? new Date(a.event.closesAt).getTime() : Infinity) - (b.event ? new Date(b.event.closesAt).getTime() : Infinity))
  const nextEvent = eventList.find((e) => new Date(e.opensAt).getTime() > serverNow)
  const pending = viewer?.kind === 'buyer' && !priced

  return (
    <>
      <PageHead title="Lots" lede={priced ? 'Prices, your bids and the full manifest are open to you. Soonest closing first.' : 'Every lot with its photos, unit count and closing time. Approved buyers see prices and the manifest, and bid.'} crumbs={[{ href: '/', label: 'Home' }, { label: 'Lots' }]} />
      <div className="ar-wrap ar-page">
        {pending ? (
          <div style={{ marginBottom: 20 }}>
            <Notice title="Your company is not approved to bid yet">
              Lots stay in summary form until we approve your application. <Link className="ar-textlink" href="/buyer">See your application</Link>
            </Notice>
          </div>
        ) : !viewer ? (
          <div style={{ marginBottom: 20 }}>
            <Notice title="Prices and bidding are for approved buyers">
              <Link className="ar-textlink" href="/signin?next=/lots">Sign in</Link> or <Link className="ar-textlink" href="/buyers/apply">apply as a buyer</Link>.
            </Notice>
          </div>
        ) : null}

        <form className="ar-filters" method="get" action="/lots" aria-label="Filter lots">
          <label className="ar-field">
            <span>Category</span>
            <select className="ar-select" name="category" defaultValue={sp.category || ''}>
              <option value="">All categories</option>
              {(categories.ok ? categories.data : []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label className="ar-field">
            <span>Format</span>
            <select className="ar-select" name="format" defaultValue={sp.format || ''}>
              <option value="">All formats</option>
              {['sealed_bid', 'open_auction', 'fixed_price'].map((f) => <option key={f} value={f}>{label(f)}</option>)}
            </select>
          </label>
          <label className="ar-field">
            <span>Closing</span>
            <select className="ar-select" name="closing" defaultValue={sp.closing || ''}>
              {CLOSING.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          {eventList.length > 1 ? (
            <label className="ar-field">
              <span>Sale</span>
              <select className="ar-select" name="sale" defaultValue={sp.sale || ''}>
                <option value="">All sales</option>
                {eventList.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </label>
          ) : null}
          <div className="ar-actions">
            <button className="ar-btn ar-btn-primary" type="submit">Show lots</button>
            {filtered ? <Link className="ar-btn ar-btn-ghost" href="/lots">Clear</Link> : null}
          </div>
        </form>

        {!lots.ok ? (
          <LoadError message={lots.error} />
        ) : !ordered.length ? (
          <Empty title={filtered ? 'No lots match these filters' : 'No lots are listed right now'}>
            {filtered ? <Link className="ar-textlink" href="/lots">Show all lots</Link> : nextEvent ? <>The next sale, {nextEvent.title}, opens {dateTime(nextEvent.opensAt, tz)}.</> : <>New lots are listed each sale week.</>}
          </Empty>
        ) : (
          <div className="ar-stack" style={{ display: 'grid', gap: 36 }}>
            {ordered.map((g) => (
              <section key={g.title} aria-label={g.title}>
                <div className="ar-section-head">
                  <SlashHead title={g.title} lede={g.event ? `${dateTime(g.event.opensAt, tz)} to ${dateTime(g.event.closesAt, tz)}` : undefined} />
                </div>
                <div className="ar-cards">
                  {g.lots.map((lot) => <LotCard key={lot.id} lot={lot} currency={currency} weightUnit={s?.weightUnit || 'lb'} priced={lots.priced} serverNow={serverNow} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
