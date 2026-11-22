import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AccountShell, requireKind } from '../components/AccountShell'
import { FileButton } from '../components/FileButton'
import { PayBox } from '../components/pay/PayBox'
import { LoadError, Notice, StatusPill } from '../components/ui'
import { cmd } from '../lib/data/client'
import { getStore, myInvoice } from '../lib/data/store'
import { date, label, money } from '../lib/format'

/** U10, U11, U12 and C5: one invoice, its PDF, and how to pay it. */
export async function InvoicePage({ kind, params, searchParams }: { kind: 'buyer' | 'client'; params: Promise<{ invoiceNumber: string }>; searchParams: Promise<{ session?: string }> }) {
  const base = kind === 'buyer' ? '/buyer' : '/client'
  const { invoiceNumber: raw } = await params
  const { session } = await searchParams
  const invoiceNumber = decodeURIComponent(raw)
  await requireKind(kind, `${base}/invoices/${invoiceNumber}`)
  // Back from a bank's card check: ask the server for Stripe's answer before showing the page.
  let returned: string | null = null
  if (session) {
    const r = await cmd<{ session: { status: string } }>('completeInvoicePayment', { invoiceNumber, paymentSessionId: session })
    returned = r.success ? r.data?.session.status ?? null : r.error
  }
  const [store, result] = await Promise.all([getStore(), myInvoice(invoiceNumber)])
  const tz = store.ok ? store.data.timezone : 'America/New_York'
  if (!result.ok) {
    if (/not found/i.test(result.error)) notFound()
    return <AccountShell kind={kind} tab="invoices" title={`Invoice ${invoiceNumber}`}><LoadError message={result.error} /></AccountShell>
  }
  const inv = result.data
  const cur = inv.currencyCode
  const totals: Array<[string, number]> = [['Subtotal', inv.subtotalMinor], ['Buyer premium', inv.premiumMinor], ['Freight', inv.freightMinor], ['Fees', inv.feeMinor], ['Other', inv.otherMinor], ['Tax', inv.taxMinor]].filter(([, v]) => v) as Array<[string, number]>
  const reported = inv.payments.filter((p: any) => p.status === 'reported')
  const bill = inv.billTo || {}
  return (
    <AccountShell kind={kind} tab="invoices" title={`Invoice ${inv.invoiceNumber}`} lede={<span className="ar-meta-line"><StatusPill status={inv.isOverdue ? 'overdue' : inv.status} text={inv.isOverdue ? 'Overdue' : undefined} /><span>Issued {date(inv.issuedAt, tz)}</span><span>Due {date(inv.dueAt, tz)}</span></span>} crumbs={[{ href: base, label: 'Account' }, { href: `${base}/invoices`, label: 'Invoices' }, { label: inv.invoiceNumber }]} actions={<FileButton what="invoice" id={inv.invoiceNumber} label="Invoice PDF" />}>
      {returned ? (
        <div style={{ marginBottom: 18 }}>
          {returned === 'captured' ? <Notice tone="ok" title="Payment received">Thank you. The invoice is updated.</Notice>
            : ['pending', 'requires_action', 'unknown'].includes(returned) ? <Notice title="Your payment is being confirmed">Reload in a minute. We email you when it is through.</Notice>
            : <Notice tone="error" title="The card payment did not go through">{returned.length > 20 ? returned : 'No money was taken. Try again or pay by transfer.'}</Notice>}
        </div>
      ) : null}
      <div className="ar-split">
        <div className="ar-stack" style={{ display: 'grid', gap: 18 }}>
          <section className="ar-panel" aria-label="Invoice">
            <div className="ar-grid-2" style={{ marginBottom: 16 }}>
              <dl className="ar-dl">
                <dt>Bill to</dt><dd>{[bill.name || bill.legalName, bill.addressLine1, [bill.city, bill.region, bill.postalCode].filter(Boolean).join(' '), bill.countryCode].filter(Boolean).map((x: string, i: number) => <span key={i}>{x}<br /></span>)}</dd>
              </dl>
              <dl className="ar-dl">
                {inv.orderNumber ? <><dt>Order</dt><dd><Link className="ar-textlink" href={`/buyer/orders/${inv.orderNumber}`}>{inv.orderNumber}</Link></dd></> : null}
                {inv.jobNumber ? <><dt>Job</dt><dd><Link className="ar-textlink" href={`/client/jobs/${inv.jobNumber}`}>{inv.jobNumber}</Link></dd></> : null}
                <dt>Type</dt><dd>{label(inv.kind)}</dd>
                {inv.taxExemptReason ? <><dt>Tax</dt><dd>{inv.taxExemptReason}</dd></> : null}
              </dl>
            </div>
            <div className="ar-table-wrap">
              <table className="ar-table">
                <thead><tr><th scope="col">Item</th><th scope="col" className="ar-num">Qty</th><th scope="col" className="ar-num">Unit</th><th scope="col" className="ar-num">Amount</th></tr></thead>
                <tbody>
                  {inv.lines.map((l: any) => (
                    <tr key={l.id}><td data-label="Item">{l.description}</td><td data-label="Qty" className="ar-num">{l.quantity}</td><td data-label="Unit" className="ar-num">{money(l.unitPriceMinor, cur)}</td><td data-label="Amount" className="ar-num">{money(l.totalMinor, cur)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ar-dl" style={{ marginTop: 16, marginLeft: 'auto', maxWidth: 340 }}>
              {totals.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd className="ar-num" style={{ textAlign: 'right' }}>{money(v, cur)}</dd></Fragment>)}
              <dt><strong>Total</strong></dt><dd className="ar-num" style={{ textAlign: 'right' }}><strong>{money(inv.totalMinor, cur)}</strong></dd>
              {inv.paidMinor ? <><dt>Paid</dt><dd className="ar-num" style={{ textAlign: 'right' }}>−{money(inv.paidMinor, cur)}</dd></> : null}
              {inv.refundedMinor ? <><dt>Refunded</dt><dd className="ar-num" style={{ textAlign: 'right' }}>{money(inv.refundedMinor, cur)}</dd></> : null}
              <dt><strong>To pay</strong></dt><dd className="ar-num ar-y" style={{ textAlign: 'right' }}><strong>{money(inv.balanceMinor, cur)}</strong></dd>
            </dl>
          </section>

          {inv.payments.length ? (
            <section className="ar-panel" aria-labelledby="pay-title">
              <h2 id="pay-title" style={{ marginBottom: 12 }}>Payments</h2>
              <div className="ar-table-wrap">
                <table className="ar-table">
                  <thead><tr><th scope="col">Date</th><th scope="col">Method</th><th scope="col">Reference</th><th scope="col" className="ar-num">Amount</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {inv.payments.map((p: any) => (
                      <tr key={p.id}><td data-label="Date">{p.paidOn ? date(`${p.paidOn}T12:00:00Z`, tz) : date(p.createdAt, tz)}</td><td data-label="Method">{label(p.method)}</td><td data-label="Reference">{p.bankReference || '—'}</td><td data-label="Amount" className="ar-num">{money(p.amountMinor, cur)}</td><td data-label="Status"><StatusPill status={p.status} text={p.status === 'reported' ? 'Being checked' : undefined} />{p.rejectionReason ? <div className="ar-small ar-muted">{p.rejectionReason}</div> : null}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside aria-label="Payment">
          {inv.paymentOptions && inv.balanceMinor > 0 ? (
            <>
              {reported.length ? <div style={{ marginBottom: 12 }}><Notice title="Transfer reported">We are checking {reported.length === 1 ? 'your transfer' : `${reported.length} transfers`} against our bank statement.</Notice></div> : null}
              <PayBox invoiceNumber={inv.invoiceNumber} options={inv.paymentOptions} currency={cur} base={base} openSession={inv.latestSession && ['pending', 'requires_action'].includes(inv.latestSession.status) ? inv.latestSession : null} />
            </>
          ) : (
            <div className="ar-bidbox">
              <h2>{inv.status === 'paid' ? 'Paid in full' : label(inv.status)}</h2>
              <p className="ar-muted" style={{ marginTop: 8 }}>{inv.status === 'paid' ? (inv.orderNumber ? 'Tell us how the goods will leave on the order page.' : 'Thank you.') : 'Nothing to pay on this invoice.'}</p>
              {inv.orderNumber && kind === 'buyer' ? <Link className="ar-btn ar-btn-primary ar-btn-block" style={{ marginTop: 14 }} href={`/buyer/orders/${inv.orderNumber}`}>Go to order {inv.orderNumber}</Link> : null}
            </div>
          )}
        </aside>
      </div>
    </AccountShell>
  )
}
