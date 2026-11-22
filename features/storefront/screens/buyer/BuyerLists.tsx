import Link from 'next/link'
import { AccountShell, requireKind } from '../../components/AccountShell'
import { Empty, LoadError, StatusPill, Tabs } from '../../components/ui'
import { getStore, myBids, myInvoices, myOrders } from '../../lib/data/store'
import { date, dateTime, label, money } from '../../lib/format'

const BID_STATUS_TEXT: Record<string, string> = { active: 'In play', won: 'Won', partially_won: 'Won some lines', lost: 'Not won', expired: 'Expired', void: 'Void', withdrawn: 'Withdrawn', defaulted: 'Defaulted' }

/** U9 */
export async function BidsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireKind('buyer', '/buyer/bids')
  const { status } = await searchParams
  const filter = ['active', 'won', 'lost'].includes(status || '') ? status : undefined
  const [store, bids] = await Promise.all([getStore(), myBids(filter)])
  const tz = store.ok ? store.data.timezone : 'America/New_York'
  return (
    <AccountShell kind="buyer" tab="bids" title="My bids" crumbs={[{ href: '/buyer', label: 'Account' }, { label: 'My bids' }]}>
      <Tabs current={filter || 'all'} items={[{ key: 'all', href: '/buyer/bids', label: 'All' }, { key: 'active', href: '/buyer/bids?status=active', label: 'Active' }, { key: 'won', href: '/buyer/bids?status=won', label: 'Won' }, { key: 'lost', href: '/buyer/bids?status=lost', label: 'Lost' }]} />
      {!bids.ok ? <LoadError message={bids.error} /> : !bids.data.length ? (
        <Empty title={filter ? `No ${filter} bids` : 'No bids yet'}><Link className="ar-textlink" href="/lots">See open lots</Link></Empty>
      ) : (
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead><tr><th scope="col">Lot</th><th scope="col">Format</th><th scope="col">Placed</th><th scope="col">Closes</th><th scope="col" className="ar-num">Your bid</th><th scope="col">Result</th></tr></thead>
            <tbody>
              {bids.data.map((b) => (
                <tr key={b.id}>
                  <td data-label="Lot"><Link className="ar-textlink" href={`/lots/${b.lotNumber}`}>{b.lotNumber}</Link><div className="ar-small ar-muted">{b.lotTitle}</div></td>
                  <td data-label="Format">{label(b.format)}{b.lineCount ? <div className="ar-small ar-muted">{b.lineCount} lines</div> : null}</td>
                  <td data-label="Placed">{dateTime(b.submittedAt, tz)}<div className="ar-small ar-muted">{label(b.source)}{b.placedBy ? ` · ${b.placedBy}` : ''}</div></td>
                  <td data-label="Closes">{dateTime(b.closesAt, tz)}</td>
                  <td data-label="Your bid" className="ar-num">{money(b.amountMinor, store.ok ? store.data.currencyCode : 'USD')}</td>
                  <td data-label="Result"><StatusPill status={b.status} text={b.status === 'active' && b.lotStatus === 'closed' ? 'Awaiting award' : BID_STATUS_TEXT[b.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  )
}

/** U10 and C5 list. */
export async function InvoicesPage({ kind }: { kind: 'buyer' | 'client' }) {
  const base = kind === 'buyer' ? '/buyer' : '/client'
  await requireKind(kind, `${base}/invoices`)
  const [store, invoices] = await Promise.all([getStore(), myInvoices()])
  const tz = store.ok ? store.data.timezone : 'America/New_York'
  return (
    <AccountShell kind={kind} tab="invoices" title="Invoices" crumbs={[{ href: base, label: 'Account' }, { label: 'Invoices' }]}>
      {!invoices.ok ? <LoadError message={invoices.error} /> : !invoices.data.length ? (
        <Empty title="No invoices yet">{kind === 'buyer' ? 'When you win a lot, its invoice appears here.' : 'Invoices for your jobs appear here.'}</Empty>
      ) : (
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead><tr><th scope="col">Invoice</th><th scope="col">Issued</th><th scope="col">Due</th><th scope="col" className="ar-num">Total</th><th scope="col" className="ar-num">To pay</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {invoices.data.map((i) => (
                <tr key={i.id}>
                  <td data-label="Invoice"><Link className="ar-textlink" href={`${base}/invoices/${i.invoiceNumber}`}>{i.invoiceNumber}</Link></td>
                  <td data-label="Issued">{date(i.issuedAt, tz)}</td>
                  <td data-label="Due">{date(i.dueAt, tz)}</td>
                  <td data-label="Total" className="ar-num">{money(i.totalMinor, i.currencyCode)}</td>
                  <td data-label="To pay" className="ar-num">{i.balanceMinor ? <span className="ar-y">{money(i.balanceMinor, i.currencyCode)}</span> : '—'}</td>
                  <td data-label="Status"><StatusPill status={i.isOverdue ? 'overdue' : i.status} text={i.isOverdue ? 'Overdue' : undefined} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  )
}

/** U13 list */
export async function OrdersPage() {
  await requireKind('buyer', '/buyer/orders')
  const [store, orders] = await Promise.all([getStore(), myOrders()])
  const tz = store.ok ? store.data.timezone : 'America/New_York'
  const cur = store.ok ? store.data.currencyCode : 'USD'
  return (
    <AccountShell kind="buyer" tab="orders" title="Orders" crumbs={[{ href: '/buyer', label: 'Account' }, { label: 'Orders' }]}>
      {!orders.ok ? <LoadError message={orders.error} /> : !orders.data.length ? (
        <Empty title="No orders yet">Each lot you win becomes an order here, with its invoice and collection details.</Empty>
      ) : (
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead><tr><th scope="col">Order</th><th scope="col">Lot</th><th scope="col">Next step</th><th scope="col" className="ar-num">Total</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {orders.data.map((o) => (
                <tr key={o.id}>
                  <td data-label="Order"><Link className="ar-textlink" href={`/buyer/orders/${o.orderNumber}`}>{o.orderNumber}</Link><div className="ar-small ar-muted">{date(o.createdAt, tz)}</div></td>
                  <td data-label="Lot">{o.lotNumber}<div className="ar-small ar-muted">{o.lotTitle}</div></td>
                  <td data-label="Next step">{o.status === 'awaiting_payment' ? <>Pay {o.invoiceNumber ? <Link className="ar-textlink" href={`/buyer/invoices/${o.invoiceNumber}`}>{o.invoiceNumber}</Link> : 'the invoice'} by {date(o.paymentDueAt, tz)}</> : o.status === 'paid' ? 'Tell us how it leaves' : o.status === 'ready_for_release' ? `Collect by ${date(o.removalDueAt, tz)}` : label(o.status)}</td>
                  <td data-label="Total" className="ar-num">{money(o.totalMinor, cur)}</td>
                  <td data-label="Status"><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  )
}
