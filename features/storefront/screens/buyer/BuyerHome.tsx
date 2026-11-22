import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AccountShell, requireKind } from '../../components/AccountShell'
import { Empty, LoadError, Notice, StatusPill } from '../../components/ui'
import { ReplyBox } from '../../components/buyer/ReplyBox'
import { getStore, myBids, myBuyerCompany, myInvoices, myOrders } from '../../lib/data/store'
import { date, dateTime, label, money } from '../../lib/format'

const STATUS_TEXT: Record<string, string> = {
  draft: 'Your application is not sent yet. Finish it so we can review it.',
  submitted: 'We have your application and are reviewing it, usually within two business days. We email you when it is decided.',
  needs_info: 'We need more information before we can approve you. Read our message below and reply.',
  approved: 'Your company is approved to bid.',
  rejected: 'We could not approve your application.',
  suspended: 'Your company is suspended from bidding.',
}

/** U1: application status, standing, bids in play, invoices due, orders to collect. */
export async function BuyerHome() {
  await requireKind('buyer', '/buyer')
  const [store, company, bids, invoices, orders] = await Promise.all([getStore(), myBuyerCompany(), myBids('active'), myInvoices(), myOrders()])
  const s = store.ok ? store.data : null
  const tz = s?.timezone || 'America/New_York'
  const cur = s?.currencyCode || 'USD'
  if (!company.ok) return <AccountShell kind="buyer" tab="home" title="Your account"><LoadError message={company.error} /></AccountShell>
  const c = company.data
  const approved = c.status === 'approved'
  const due = invoices.ok ? invoices.data.filter((i) => ['open', 'partially_paid'].includes(i.status)) : []
  const toCollect = orders.ok ? orders.data.filter((o) => ['awaiting_payment', 'paid', 'ready_for_release'].includes(o.status)) : []
  const active = bids.ok ? bids.data : []

  return (
    <AccountShell kind="buyer" tab="home" title={c.tradingName || c.legalName} lede={<>Signed in as {c.me.name} · <StatusPill status={c.status} /></>}>
      <div className="ar-stack" style={{ display: 'grid', gap: 22 }}>
        {!approved ? (
          <section className={`ar-panel${c.status === 'needs_info' ? ' ar-panel-y' : ''}`} aria-labelledby="app-title">
            <div className="ar-panel-head"><h2 id="app-title">Your application</h2><StatusPill status={c.status} /></div>
            <p>{STATUS_TEXT[c.status] ?? label(c.status)}</p>
            {c.statusReason ? <p style={{ marginTop: 8 }}><strong>Reason:</strong> {c.statusReason}</p> : null}
            {['draft', 'needs_info', 'rejected'].includes(c.status) ? <div className="ar-actions" style={{ marginTop: 14 }}><Link className="ar-btn ar-btn-primary" href="/buyers/apply">{c.status === 'draft' ? 'Finish your application' : 'Update your application'}</Link></div> : null}
            {c.messages.length || c.status === 'needs_info' ? (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ fontSize: 16, marginBottom: 10 }}>Messages</h3>
                {c.messages.length ? (
                  <div className="ar-msgs">
                    {c.messages.map((m: any) => <div key={m.id} className={`ar-msg${m.fromStaff ? ' staff' : ''}`}><small>{m.author} · {dateTime(m.createdAt, tz)}</small>{m.body}</div>)}
                  </div>
                ) : null}
                <ReplyBox />
              </div>
            ) : null}
          </section>
        ) : null}

        {approved && !c.mayBid && c.bidBlockedReason ? (
          <Notice tone="error" title="You cannot bid right now">
            <p>{c.bidBlockedReason}</p>
            {c.overdueInvoices.length ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{c.overdueInvoices.map((i: any) => <li key={i.invoiceNumber}><Link className="ar-textlink" href={`/buyer/invoices/${i.invoiceNumber}`}>{i.invoiceNumber}</Link>: {money(i.totalMinor - i.paidMinor, cur)} was due {date(i.dueAt, tz)}</li>)}</ul> : null}
            {/terms/i.test(c.bidBlockedReason) ? <p style={{ marginTop: 6 }}>You accept them on the next lot you bid on. <Link className="ar-textlink" href="/terms">Read the terms</Link></p> : null}
          </Notice>
        ) : null}

        {approved ? (
          <dl className="ar-grid-3" style={{ margin: 0 }}>
            <div className="ar-stat"><dt>Bids in play</dt><dd className="ar-num">{active.length}</dd></div>
            <div className="ar-stat"><dt>Invoices to pay</dt><dd className="ar-num">{due.length ? money(due.reduce((t, i) => t + i.balanceMinor, 0), cur) : '0'}</dd></div>
            <div className="ar-stat"><dt>{c.spendLimitMinor ? 'Spending limit left' : 'Orders to collect'}</dt><dd className="ar-num">{c.spendLimitMinor ? money(Math.max(0, c.spendLimitMinor - c.exposureMinor), cur) : toCollect.length}</dd></div>
          </dl>
        ) : null}

        {approved ? (
          <div className="ar-grid-2">
            <section className="ar-panel" aria-labelledby="bids-title">
              <div className="ar-panel-head"><h2 id="bids-title">Bids in play</h2><Link className="ar-link" href="/buyer/bids">All bids <ArrowRight size={16} aria-hidden="true" /></Link></div>
              {!bids.ok ? <LoadError message={bids.error} /> : active.length ? (
                <ul className="ar-list">
                  {active.slice(0, 5).map((b) => (
                    <li key={b.id}><Link href={`/lots/${b.lotNumber}`}><strong>{b.lotNumber}</strong> {b.lotTitle}</Link><span className="ar-small ar-muted">{label(b.format)} · closes {dateTime(b.closesAt, tz)}</span><span className="ar-num ar-y">{money(b.amountMinor, cur)}</span></li>
                  ))}
                </ul>
              ) : <p className="ar-muted">No bids in play. <Link className="ar-textlink" href="/lots">See open lots</Link></p>}
            </section>

            <section className="ar-panel" aria-labelledby="due-title">
              <div className="ar-panel-head"><h2 id="due-title">Invoices to pay</h2><Link className="ar-link" href="/buyer/invoices">All invoices <ArrowRight size={16} aria-hidden="true" /></Link></div>
              {!invoices.ok ? <LoadError message={invoices.error} /> : due.length ? (
                <ul className="ar-list">
                  {due.map((i) => (
                    <li key={i.id}><Link href={`/buyer/invoices/${i.invoiceNumber}`}><strong>{i.invoiceNumber}</strong></Link><span className="ar-small ar-muted">{i.isOverdue ? 'Overdue, was due' : 'Due'} {date(i.dueAt, tz)}</span><span className="ar-num ar-y">{money(i.balanceMinor, i.currencyCode)}</span></li>
                  ))}
                </ul>
              ) : <p className="ar-muted">Nothing to pay.</p>}
            </section>

            <section className="ar-panel" aria-labelledby="orders-title" style={{ gridColumn: '1 / -1' }}>
              <div className="ar-panel-head"><h2 id="orders-title">Orders to collect</h2><Link className="ar-link" href="/buyer/orders">All orders <ArrowRight size={16} aria-hidden="true" /></Link></div>
              {!orders.ok ? <LoadError message={orders.error} /> : toCollect.length ? (
                <ul className="ar-list">
                  {toCollect.map((o) => (
                    <li key={o.id}><Link href={`/buyer/orders/${o.orderNumber}`}><strong>{o.orderNumber}</strong> {o.lotTitle}</Link><StatusPill status={o.status} /><span className="ar-small ar-muted">{o.status === 'awaiting_payment' ? `Pay by ${date(o.paymentDueAt, tz)}` : o.removalDueAt ? `Collect by ${date(o.removalDueAt, tz)}` : ''}</span></li>
                  ))}
                </ul>
              ) : <p className="ar-muted">No orders waiting.</p>}
            </section>
          </div>
        ) : !c.messages.length && c.status === 'submitted' ? (
          <Empty title="While you wait">You can look through the <Link className="ar-textlink" href="/lots">lots on sale</Link> now. Prices and bidding open when we approve you.</Empty>
        ) : null}

        <section className="ar-panel" aria-labelledby="company-title">
          <div className="ar-panel-head"><h2 id="company-title">Company</h2></div>
          <dl className="ar-dl">
            <dt>Legal name</dt><dd>{c.legalName}</dd>
            {c.addressLine1 ? <><dt>Address</dt><dd>{[c.addressLine1, c.addressLine2, c.city, c.region, c.postalCode, c.countryCode].filter(Boolean).join(', ')}</dd></> : null}
            {c.phone ? <><dt>Phone</dt><dd>{c.phone}</dd></> : null}
            <dt>Terms accepted</dt><dd>{c.termsVersionAccepted ? `Version ${c.termsVersionAccepted}${c.termsVersionAccepted !== c.currentTermsVersion ? ` (current is ${c.currentTermsVersion})` : ''}` : 'Not yet'}</dd>
            {c.spendLimitMinor ? <><dt>Spending limit</dt><dd className="ar-num">{money(c.spendLimitMinor, cur)}</dd></> : null}
            <dt>Documents</dt><dd>{c.documents.length ? c.documents.map((d: any) => `${label(d.type)} (${label(d.status)})`).join(', ') : 'None'}</dd>
            <dt>People</dt><dd>{c.users.map((u: any) => u.name).join(', ')}</dd>
          </dl>
          <p className="ar-small ar-muted" style={{ marginTop: 12 }}>To change company details after approval, email {s?.supportEmail ? <a className="ar-textlink" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a> : 'us'}.</p>
        </section>
      </div>
    </AccountShell>
  )
}
