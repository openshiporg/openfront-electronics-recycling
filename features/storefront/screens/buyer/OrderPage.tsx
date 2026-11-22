import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AccountShell, requireKind } from '../../components/AccountShell'
import { FileButton } from '../../components/FileButton'
import { ReleaseForm } from '../../components/buyer/ReleaseForm'
import { LoadError, Notice, StatusPill, Timeline } from '../../components/ui'
import { getStore, myOrder } from '../../lib/data/store'
import { date, dateTime, label, money } from '../../lib/format'

const STAGES = ['awaiting_payment', 'paid', 'ready_for_release', 'released', 'completed']
const STAGE_LABELS = { awaiting_payment: 'Awaiting payment', paid: 'Paid', ready_for_release: 'Ready to collect', released: 'Collected', completed: 'Completed' }

/** U13 and U14 */
export async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber: raw } = await params
  const orderNumber = decodeURIComponent(raw)
  await requireKind('buyer', `/buyer/orders/${orderNumber}`)
  const [store, result] = await Promise.all([getStore(), myOrder(orderNumber)])
  const s = store.ok ? store.data : null
  const tz = s?.timezone || 'America/New_York'
  const cur = s?.currencyCode || 'USD'
  if (!result.ok) {
    if (/not found/i.test(result.error)) notFound()
    return <AccountShell kind="buyer" tab="orders" title={`Order ${orderNumber}`}><LoadError message={result.error} /></AccountShell>
  }
  const o = result.data
  const p = o.pickup
  const editable = ['awaiting_payment', 'paid', 'ready_for_release'].includes(o.status)
  const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const hours = p?.hours ? Object.entries(p.hours).filter(([, v]) => v).sort(([a], [b]) => DAY_ORDER.indexOf(a.slice(0, 3).toLowerCase()) - DAY_ORDER.indexOf(b.slice(0, 3).toLowerCase())) : []
  return (
    <AccountShell kind="buyer" tab="orders" title={`Order ${o.orderNumber}`} lede={<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><StatusPill status={o.status} /> Lot <Link className="ar-textlink" href={`/lots/${o.lotNumber}`}>{o.lotNumber}</Link><span>{o.lotTitle}</span></span>} crumbs={[{ href: '/buyer', label: 'Account' }, { href: '/buyer/orders', label: 'Orders' }, { label: o.orderNumber }]}>
      <div className="ar-stack" style={{ display: 'grid', gap: 18 }}>
        {['defaulted', 'cancelled'].includes(o.status) ? <Notice tone="error" title={`This order is ${label(o.status).toLowerCase()}`}>Email us if you think this is wrong.</Notice> : (
          <section className="ar-panel" aria-label="Progress"><Timeline stages={STAGES} current={o.status} labels={STAGE_LABELS} /></section>
        )}

        {o.status === 'awaiting_payment' ? (
          <Notice title="Pay the invoice to release this lot">
            {o.invoiceNumber ? <>Invoice <Link className="ar-textlink" href={`/buyer/invoices/${o.invoiceNumber}`}>{o.invoiceNumber}</Link> for {money(o.totalMinor, cur)} is due {date(o.paymentDueAt, tz)}. The pickup address shows here once it is paid.</> : 'The invoice is being prepared.'}
          </Notice>
        ) : null}

        <div className="ar-split">
          <div className="ar-stack" style={{ display: 'grid', gap: 18 }}>
            <section className="ar-panel" aria-labelledby="lines-title">
              <div className="ar-panel-head">
                <h2 id="lines-title">What you bought</h2>
                {o.documentsAvailable ? (
                  <div className="ar-actions">
                    <FileButton what="order" id={o.orderNumber} kind="packing_list" label="Packing list (PDF)" />
                    <FileButton what="order" id={o.orderNumber} kind="bill_of_lading" label="Bill of lading (PDF)" />
                  </div>
                ) : <span className="ar-small ar-muted">Packing list and bill of lading once paid</span>}
              </div>
              <div className="ar-table-wrap">
                <table className="ar-table">
                  <thead><tr><th scope="col">Line</th><th scope="col">Item</th><th scope="col">Grade</th><th scope="col" className="ar-num">Qty</th><th scope="col" className="ar-num">Total</th></tr></thead>
                  <tbody>
                    {o.lines.map((l: any) => (
                      <tr key={l.lineNumber}><td data-label="Line">{l.lineNumber}</td><td data-label="Item">{[l.manufacturer, l.model].filter(Boolean).join(' ') || l.description}<div className="ar-small ar-muted">{l.serialCount ? `${l.serialCount} serials on the packing list` : l.description}</div></td><td data-label="Grade">{l.grade || '—'}</td><td data-label="Qty" className="ar-num">{l.quantity}</td><td data-label="Total" className="ar-num">{money(l.totalMinor, cur)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="ar-dl" style={{ marginTop: 14 }}>
                {o.palletCount ? <><dt>Pallets</dt><dd>{o.palletCount}</dd></> : null}
                {o.weight ? <><dt>Weight</dt><dd>{Math.round(o.weight).toLocaleString('en-US')} {s?.weightUnit || 'lb'}</dd></> : null}
                {o.dimensions ? <><dt>Dimensions</dt><dd>{o.dimensions}</dd></> : null}
                <dt>Shipping</dt><dd>{label(o.shippingTerms)}</dd>
                {o.invoiceNumber ? <><dt>Invoice</dt><dd><Link className="ar-textlink" href={`/buyer/invoices/${o.invoiceNumber}`}>{o.invoiceNumber}</Link> · {label(o.invoiceStatus)}</dd></> : null}
                {o.billOfLading ? <><dt>B/L number</dt><dd>{o.billOfLading}</dd></> : null}
                {o.releasedAt ? <><dt>Collected</dt><dd>{dateTime(o.releasedAt, tz)}</dd></> : null}
                {o.claimWindowEndsAt ? <><dt>Claims until</dt><dd>{date(o.claimWindowEndsAt, tz)}</dd></> : null}
              </dl>
            </section>

            {o.claims?.length ? (
              <section className="ar-panel"><h2 style={{ marginBottom: 10 }}>Claims</h2><ul className="ar-list">{o.claims.map((c: any) => <li key={c.claimNumber}><strong>{c.claimNumber}</strong><StatusPill status={c.status} />{c.approvedAmountMinor ? <span className="ar-num">{money(c.approvedAmountMinor, cur)}</span> : null}</li>)}</ul></section>
            ) : null}
          </div>

          <aside className="ar-stack" style={{ display: 'grid', gap: 18, alignContent: 'start' }} aria-label="Collection">
            <section className="ar-bidbox" style={{ position: 'static' }}>
              <h2>Collection</h2>
              {p ? (
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  <div><div className="ar-kicker">Pick up from</div><p><strong>{p.facility}</strong><br />{p.addressLine1}{p.addressLine2 ? <>, {p.addressLine2}</> : null}<br />{[p.city, p.region, p.postalCode].filter(Boolean).join(', ')}</p>{p.phone ? <p className="ar-small">{p.phone}</p> : null}</div>
                  {hours.length ? <div><div className="ar-kicker">Dock hours</div><p className="ar-small">{hours.map(([d, h]) => `${label(d)} ${h}`).join(' · ')}</p></div> : null}
                  {p.instructions ? <div><div className="ar-kicker">Instructions</div><p className="ar-small">{p.instructions}</p></div> : null}
                  {o.removalDueAt ? <p className="ar-small"><strong>Collect by {date(o.removalDueAt, tz)}.</strong> Storage is charged after that.</p> : null}
                  {o.dockAppointment ? <p className="ar-small">Dock booked {dateTime(o.dockAppointment.startsAt, tz)}.</p> : null}
                </div>
              ) : <p className="ar-small ar-muted" style={{ marginTop: 10 }}>The pickup address shows here once the invoice is paid.</p>}
            </section>
            {editable ? (
              <ReleaseForm orderNumber={o.orderNumber} release={o.release} exportAllowed={o.exportAllowed} exportClause={o.exportClause} shippingTerms={o.shippingTerms} />
            ) : o.release?.method ? (
              <section className="ar-panel"><h2 style={{ marginBottom: 8 }}>How it left</h2><p>{o.release.method === 'pickup' ? `Own pickup, driver ${o.release.driverName}` : `Freight with ${o.release.carrierName} ${o.release.carrierReference}`.trim()} · to {o.release.destinationCountry}</p></section>
            ) : null}
          </aside>
        </div>
      </div>
    </AccountShell>
  )
}
