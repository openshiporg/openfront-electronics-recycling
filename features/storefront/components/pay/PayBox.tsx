'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { CreditCard, Landmark } from 'lucide-react'
import { completePaymentAction, reportTransferAction, startPaymentAction, type PayOptions, type PaySession } from '../../lib/actions/buyer'
import { money, toMinor } from '../../lib/format'

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const APPEARANCE = {
  theme: 'night' as const,
  variables: { colorPrimary: '#fdcc28', colorBackground: '#111111', colorText: '#f4f4f4', colorDanger: '#ff6b5e', borderRadius: '2px', fontFamily: 'Inter, system-ui, sans-serif' },
}

function CardForm({ invoiceNumber, session, base, onDone }: { invoiceNumber: string; session: PaySession; base: '/buyer' | '/client'; onDone: (text: string, ok: boolean) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      if (!stripe || !elements) return
      setBusy(true); setError('')
      const { error: submitError } = await elements.submit()
      if (submitError) { setBusy(false); setError(submitError.message || 'Check the card details.'); return }
      const result = await stripe.confirmPayment({ elements, clientSecret: session.clientSecret, redirect: 'if_required', confirmParams: { return_url: `${window.location.origin}${base}/invoices/${invoiceNumber}?session=${session.id}` } })
      if (result.error) { setBusy(false); setError(result.error.message || 'The card was not charged.'); return }
      // Ask the server, which asks Stripe; the browser result is not proof of payment.
      const done = await completePaymentAction(invoiceNumber, session.id, base)
      setBusy(false)
      if (!done.ok) { onDone(done.error, false); return }
      const st = done.data.session.status
      onDone(st === 'captured' ? 'Payment received. Thank you.' : st === 'requires_action' ? 'Your bank needs one more step. Follow the prompt, then reload.' : `The payment is ${st.replace(/_/g, ' ')}. Reload in a minute.`, st === 'captured')
    }} style={{ display: 'grid', gap: 14 }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? <p role="alert" className="ar-small" style={{ color: 'var(--ar-red)' }}>{error}</p> : null}
      <button type="submit" className="ar-btn ar-btn-primary ar-btn-block" disabled={!stripe || busy}>{busy ? 'Paying…' : `Pay ${money(session.amountMinor, session.currencyCode)}`}</button>
    </form>
  )
}

/** U11, U12, C5: card through Stripe Elements, or wire/ACH reported for staff to confirm. */
export function PayBox({ invoiceNumber, options, currency, base, openSession }: { invoiceNumber: string; options: PayOptions; currency: string; base: '/buyer' | '/client'; openSession: PaySession | null }) {
  const router = useRouter()
  const [method, setMethod] = useState<'card' | 'bank_transfer'>(options.card ? 'card' : 'bank_transfer')
  const [session, setSession] = useState<PaySession | null>(openSession && openSession.clientSecret ? openSession : null)
  const [publishableKey, setPublishableKey] = useState(options.publishableKey)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [wire, setWire] = useState({ amount: (options.balanceMinor / 100).toFixed(2), reference: '', date: new Date().toISOString().slice(0, 10) })
  const key = useRef(newKey())
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), [publishableKey])

  async function startCard() {
    setBusy(true); setMsg(null)
    const r = await startPaymentAction(invoiceNumber, 'card', key.current, base)
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); key.current = newKey(); return }
    if (r.data.options.publishableKey) setPublishableKey(r.data.options.publishableKey)
    if (!r.data.session?.clientSecret) { setMsg({ ok: false, text: r.data.session?.lastError || 'The card payment could not start. Try again or pay by transfer.' }); key.current = newKey(); return }
    setSession(r.data.session)
  }

  async function chooseBank() {
    setMethod('bank_transfer'); setMsg(null)
    if (session) {
      // Leaving the card path removes its fee; the domain cancels the open session.
      setBusy(true)
      const r = await startPaymentAction(invoiceNumber, 'bank_transfer', newKey(), base)
      setBusy(false)
      setSession(null); key.current = newKey()
      if (!r.ok) setMsg({ ok: false, text: r.error })
      router.refresh()
    }
  }

  async function report(e: React.FormEvent) {
    e.preventDefault()
    const amountMinor = toMinor(wire.amount)
    if (!amountMinor) { setMsg({ ok: false, text: 'Enter the amount you sent.' }); return }
    setBusy(true); setMsg(null)
    const r = await reportTransferAction({ invoiceNumber, reference: wire.reference, date: wire.date, amountMinor }, base)
    setBusy(false)
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: 'Thanks. We match it against our bank statement, usually the next business day, and email you when it is confirmed.' })
    router.refresh()
  }

  return (
    <div className="ar-bidbox">
      <h2>Pay this invoice</h2>
      <div className="ar-big ar-num" style={{ marginTop: 8 }}>{money(options.balanceMinor, currency)}</div>
      <p className="ar-small ar-muted">left to pay</p>

      <div className="ar-choice" role="radiogroup" aria-label="How to pay" style={{ marginTop: 16 }}>
        <label><input type="radio" name="pay" checked={method === 'card'} disabled={!options.card} onChange={() => { setMethod('card'); setMsg(null) }} /><span><CreditCard size={16} aria-hidden="true" className="ar-inline-icon" /> Card<br /><small className="ar-muted">{options.card ? (options.cardFeeBps ? `${options.cardFeeBps / 100}% fee, ${money(options.cardFeeMinor, currency)}` : 'No fee') : 'Not available'}</small></span></label>
        <label><input type="radio" name="pay" checked={method === 'bank_transfer'} onChange={chooseBank} /><span><Landmark size={16} aria-hidden="true" className="ar-inline-icon" /> Wire or ACH<br /><small className="ar-muted">No fee</small></span></label>
      </div>
      {!options.card && options.cardUnavailableReason ? <p className="ar-small ar-muted" style={{ marginTop: 8 }}>{options.cardUnavailableReason}</p> : null}

      {msg ? <div className={`ar-notice ${msg.ok ? 'ar-notice-ok' : 'ar-notice-err'}`} role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 14 }}><p className="ar-small">{msg.text}</p></div> : null}

      <div style={{ marginTop: 16 }}>
        {method === 'card' && options.card ? (
          session && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret: session.clientSecret, appearance: APPEARANCE }}>
              <CardForm invoiceNumber={invoiceNumber} session={session} base={base} onDone={(text, ok) => { setMsg({ ok, text }); if (ok) { setSession(null); router.refresh() } }} />
            </Elements>
          ) : (
            <button type="button" className="ar-btn ar-btn-primary ar-btn-block" disabled={busy} onClick={startCard}>{busy ? 'Starting…' : `Pay ${money(options.balanceMinor + options.cardFeeMinor, currency)} by card`}</button>
          )
        ) : method === 'bank_transfer' ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div className="ar-kicker">Send to</div>
              <pre className="ar-small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '6px 0 0', padding: 12, background: '#111', border: '1px solid var(--ar-rule)' }}>{options.wireInstructions || 'Our bank details are on the invoice PDF.'}</pre>
              <p className="ar-small ar-muted" style={{ marginTop: 6 }}>Put <strong>{invoiceNumber}</strong> in the payment reference.</p>
            </div>
            <form className="ar-form" onSubmit={report}>
              <h3 style={{ fontSize: 15 }}>Tell us you sent it</h3>
              <div className="ar-row">
                <label className="ar-field"><span>Amount sent</span><input className="ar-input ar-num" inputMode="decimal" value={wire.amount} onChange={(e) => setWire({ ...wire, amount: e.target.value })} required /></label>
                <label className="ar-field"><span>Date sent</span><input className="ar-input" type="date" value={wire.date} onChange={(e) => setWire({ ...wire, date: e.target.value })} required /></label>
              </div>
              <label className="ar-field"><span>Bank reference</span><input className="ar-input" value={wire.reference} onChange={(e) => setWire({ ...wire, reference: e.target.value })} required maxLength={120} placeholder="e.g. Fed reference or ACH trace number" /></label>
              <button type="submit" className="ar-btn ar-btn-ghost ar-btn-block" disabled={busy}>{busy ? 'Sending…' : 'Report transfer'}</button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}
