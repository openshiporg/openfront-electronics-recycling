'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Gavel, Lock, ShoppingCart, TrendingUp } from 'lucide-react'
import { Countdown } from '../Countdown'
import { acceptTermsAction, buyNowAction, placeBidAction, refreshLotAction, withdrawBidAction } from '../../lib/actions/lots'
import { dateTime, label, money, toMinor } from '../../lib/format'

export function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** U15: the wholesale terms gate, shown before any bid when the accepted version is not current. */
export function TermsGate({ version, onDone }: { version: string; onDone: () => void | Promise<void> }) {
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="ar-confirm" role="group" aria-label="Wholesale terms">
      <p><strong>Accept the wholesale terms to bid.</strong> Version {version}. They cover sold-as-is, payment, removal and export.</p>
      <label className="ar-check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> <span>I have read the <Link className="ar-textlink" href="/terms" target="_blank">wholesale terms</Link> and accept them for my company.</span></label>
      {error ? <p role="alert" className="ar-small" style={{ color: 'var(--ar-red)' }}>{error}</p> : null}
      <button type="button" className="ar-btn ar-btn-primary ar-btn-block" disabled={!checked || busy} onClick={async () => {
        setBusy(true); setError('')
        const r = await acceptTermsAction(version)
        if (r.ok) await onDone(); else setError(r.error)
        setBusy(false)
      }}>{busy ? 'Saving…' : 'Accept terms'}</button>
    </div>
  )
}

type LotData = any

export function BidPanel({ lot: initial, currency, tz, serverNow, termsVersion }: { lot: LotData; currency: string; tz: string; serverNow: number; termsVersion: string }) {
  const router = useRouter()
  const [lot, setLot] = useState(initial)
  const [now, setNow] = useState(serverNow)
  const [needsTerms, setNeedsTerms] = useState(Boolean(initial.termsVersionRequired))
  const [amount, setAmount] = useState('')
  const [confirming, setConfirming] = useState<null | number>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | { title: string; body: React.ReactNode }>(null)
  const key = useRef(newKey())

  useEffect(() => { setLot(initial); setNeedsTerms(Boolean(initial.termsVersionRequired)) }, [initial])

  // U7: keep an open auction current without a reload.
  useEffect(() => {
    if (lot.format !== 'open_auction' || lot.status !== 'open') return
    const id = setInterval(async () => {
      const fresh = await refreshLotAction(lot.lotNumber)
      if (fresh) { setLot((l: LotData) => ({ ...l, ...fresh })); setNow(fresh.serverNow) }
    }, 15000)
    return () => clearInterval(id)
  }, [lot.format, lot.status, lot.lotNumber])

  const my = lot.myBid
  const open = lot.status === 'open'
  const perLine = lot.bidBasis === 'per_line' && lot.format !== 'fixed_price'

  async function submitBid(amountMinor: number) {
    setBusy(true); setError('')
    const r = await placeBidAction({ lotNumber: lot.lotNumber, amountMinor, idempotencyKey: key.current })
    setBusy(false); setConfirming(null)
    if (!r.ok) { if (r.needsTerms) setNeedsTerms(true); setError(r.error); key.current = newKey(); return }
    key.current = newKey()
    setAmount('')
    // Read the lot back from the server before showing the result, so the current bid and standing are never stale.
    setBusy(true)
    const fresh = await refreshLotAction(lot.lotNumber)
    setBusy(false)
    if (fresh) { setLot((l: LotData) => ({ ...l, ...fresh })); setNow(fresh.serverNow) }
    setDone({ title: lot.format === 'sealed_bid' ? 'Your sealed bid is in' : 'Your bid is in', body: <>{money(r.data.amountMinor, currency)} at {dateTime(new Date(), tz)}. {lot.format === 'sealed_bid' ? 'No one else can see it. You can change or withdraw it until the lot closes.' : fresh?.leading ? 'You are the highest bidder. We will email you if you are outbid.' : 'We will email you if you are outbid.'}</> })
    router.refresh()
  }

  async function buy() {
    setBusy(true); setError('')
    const r = await buyNowAction(lot.lotNumber, key.current)
    setBusy(false); setConfirming(null)
    if (!r.ok) { if (r.needsTerms) setNeedsTerms(true); setError(r.error); key.current = newKey(); return }
    setDone({ title: 'Bought. The lot is yours.', body: <>Order <Link className="ar-textlink" href={`/buyer/orders/${r.data.orderNumber}`}>{r.data.orderNumber}</Link> and invoice <Link className="ar-textlink" href={`/buyer/invoices/${r.data.invoiceNumber}`}>{r.data.invoiceNumber}</Link> are ready. Pay the invoice to release it.</> })
    const fresh = await refreshLotAction(lot.lotNumber)
    setLot((l: LotData) => ({ ...l, ...(fresh ?? { status: 'awarded' }) }))
    router.refresh()
  }

  async function withdraw() {
    if (!window.confirm('Withdraw your sealed bid? You can bid again while the lot is open.')) return
    setBusy(true); setError('')
    const r = await withdrawBidAction(lot.lotNumber)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setDone({ title: 'Bid withdrawn', body: 'You have no bid on this lot now.' })
    setLot((l: LotData) => ({ ...l, myBid: null }))
    router.refresh()
  }

  function review() {
    setError(''); setDone(null)
    const minor = toMinor(amount)
    if (minor == null || minor <= 0) { setError('Enter your bid as an amount, for example 12,500.'); return }
    if (lot.minimumBidMinor && minor < lot.minimumBidMinor) { setError(`Your bid must be at least ${money(lot.minimumBidMinor, currency)}.`); return }
    if (lot.format === 'open_auction' && my?.status === 'active' && minor <= my.amountMinor) { setError('Your new bid must be higher than your current bid.'); return }
    setConfirming(minor)
  }

  const timeBlock = (
    <div>
      <div className="ar-kicker">{lot.status === 'scheduled' ? 'Opens in' : open ? 'Ends in' : 'Bidding'}</div>
      {open || lot.status === 'scheduled' ? (
        <Countdown className="ar-count-big ar-num" to={lot.status === 'scheduled' ? lot.opensAt : lot.closesAt} serverNow={now} onZero={() => router.refresh()} />
      ) : <div className="ar-count-big">{label(lot.status)}</div>}
      <p className="ar-small ar-muted" style={{ marginTop: 4 }}>{lot.status === 'scheduled' ? `Opens ${dateTime(lot.opensAt, tz)}` : `${open ? 'Closes' : 'Closed'} ${dateTime(lot.closesAt, tz)}`}</p>
      {lot.format === 'open_auction' && lot.softCloseWindowMinutes ? <p className="ar-small ar-muted">A bid in the last {lot.softCloseWindowMinutes} minutes extends the close{lot.extensionCount ? `; extended ${lot.extensionCount}×` : ''}.</p> : null}
    </div>
  )

  return (
    <div className="ar-bidbox" aria-live="polite">
      <h2>{lot.format === 'fixed_price' ? 'Buy now' : `${label(lot.format)}${perLine ? ', per line' : ''}`}</h2>
      <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
        {timeBlock}
        <hr className="ar-rule" style={{ margin: 0 }} />

        {lot.format === 'fixed_price' ? (
          <div><div className="ar-kicker">Price for the whole lot</div><div className="ar-big ar-num">{money(lot.fixedPriceMinor, currency)}</div></div>
        ) : lot.format === 'open_auction' ? (
          <div>
            <div className="ar-kicker">{lot.bidCount ? 'Current bid' : 'Opening bid'}</div>
            <div className="ar-big ar-num">{money(lot.bidCount ? lot.currentAmountMinor : lot.openingBidMinor, currency)}</div>
            <p className="ar-small ar-muted" style={{ marginTop: 4 }}>
              {lot.bidCount ? `${lot.bidCount} ${lot.bidCount === 1 ? 'bid' : 'bids'}` : 'No bids yet'}
              {lot.reserveMet != null ? ` · ${lot.reserveMet ? 'Reserve met' : 'Reserve not met'}` : ''}
            </p>
          </div>
        ) : (
          <div>
            <div className="ar-kicker">Sealed bid</div>
            <p className="ar-small" style={{ marginTop: 4 }}><Lock size={14} aria-hidden="true" className="ar-inline-icon" /> No one sees other bids. Highest {perLine ? 'price per line' : 'bid'} wins when we award after close.{lot.openingBidMinor && !perLine ? ` Minimum ${money(lot.openingBidMinor, currency)}.` : ''}</p>
          </div>
        )}

        {my ? (
          <div className={`ar-bid-status ${my.status === 'won' || my.status === 'partially_won' || lot.leading ? 'lead' : my.status === 'lost' || lot.leading === false ? 'out' : 'held'}`}>
            {lot.leading === false ? <AlertTriangle size={16} aria-hidden="true" /> : lot.leading ? <TrendingUp size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            <span>
              {my.status === 'won' ? 'You won this lot' : my.status === 'partially_won' ? 'You won some lines' : my.status === 'lost' ? 'Another buyer won this lot' : lot.leading === false ? 'You have been outbid' : lot.leading ? 'You are the highest bidder' : 'Your bid is in'}
              {' · '}<span className="ar-num">{money(my.amountMinor, currency)}</span>
            </span>
          </div>
        ) : null}

        {done ? <div className="ar-notice ar-notice-ok" role="status"><strong>{done.title}</strong><p className="ar-small" style={{ marginTop: 4 }}>{done.body}</p></div> : null}
        {error ? <div className="ar-notice ar-notice-err" role="alert"><p className="ar-small">{error}</p></div> : null}

        {open && needsTerms ? (
          <TermsGate version={lot.termsVersionRequired || termsVersion} onDone={async () => {
            // Read the lot again first, so the terms block (mayBid / bidBlockedReason) is gone when the gate closes.
            const fresh = await refreshLotAction(lot.lotNumber)
            setLot((l: LotData) => ({ ...l, ...(fresh ?? {}), termsVersionRequired: null, ...(fresh ? {} : { mayBid: true, bidBlockedReason: null }) }))
            setNeedsTerms(false); setError('')
            router.refresh()
          }} />
        ) : open && !lot.mayBid && lot.bidBlockedReason ? (
          <div className="ar-notice" role="note"><p className="ar-small">{lot.bidBlockedReason}</p>{/overdue/i.test(lot.bidBlockedReason) ? <p className="ar-small" style={{ marginTop: 6 }}><Link className="ar-textlink" href="/buyer/invoices">Go to invoices</Link></p> : null}</div>
        ) : !open ? (
          lot.status === 'scheduled' ? <p className="ar-small ar-muted">Bidding opens {dateTime(lot.opensAt, tz)}. Read the manifest now.</p>
            : <p className="ar-small ar-muted">{my ? 'We email every bidder when the lot is awarded. Results show under My bids.' : 'Bidding on this lot has closed.'} <Link className="ar-textlink" href="/buyer/bids">My bids</Link></p>
        ) : lot.format === 'fixed_price' ? (
          confirming != null ? (
            <div className="ar-confirm">
              <p>Buy lot {lot.lotNumber} for <strong className="ar-num">{money(lot.fixedPriceMinor, currency)}</strong>? This is binding: we raise the invoice straight away.</p>
              <div className="ar-actions"><button type="button" className="ar-btn ar-btn-primary" disabled={busy} onClick={buy}>{busy ? 'Buying…' : 'Confirm purchase'}</button><button type="button" className="ar-btn ar-btn-ghost" onClick={() => setConfirming(null)}>Cancel</button></div>
            </div>
          ) : <button type="button" className="ar-btn ar-btn-primary ar-btn-block" onClick={() => { setDone(null); setConfirming(lot.fixedPriceMinor) }}><ShoppingCart size={18} aria-hidden="true" /> Buy now</button>
        ) : perLine ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <a className="ar-btn ar-btn-primary ar-btn-block" href="#line-bid"><Gavel size={18} aria-hidden="true" /> {my?.status === 'active' ? 'Change your line prices' : 'Enter line prices'}</a>
            <p className="ar-small ar-muted">Price each line you want, online or in the Excel bid sheet. You may win some lines and not others.</p>
            {my?.status === 'active' && lot.format === 'sealed_bid' ? <button type="button" className="ar-btn ar-btn-ghost ar-btn-sm" disabled={busy} onClick={withdraw}>Withdraw bid</button> : null}
          </div>
        ) : confirming != null ? (
          <div className="ar-confirm">
            <p>{lot.format === 'sealed_bid' ? 'Place a sealed bid of' : 'Bid'} <strong className="ar-num">{money(confirming, currency)}</strong> on lot {lot.lotNumber}? {my?.status === 'active' ? 'This replaces your current bid. ' : ''}A winning bid is binding.</p>
            <div className="ar-actions"><button type="button" className="ar-btn ar-btn-primary" disabled={busy} onClick={() => submitBid(confirming)}>{busy ? 'Placing…' : 'Confirm bid'}</button><button type="button" className="ar-btn ar-btn-ghost" onClick={() => setConfirming(null)}>Change</button></div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); review() }} style={{ display: 'grid', gap: 10 }}>
            <label className="ar-field">
              <span>{my?.status === 'active' ? (lot.format === 'sealed_bid' ? 'Change your bid' : 'Raise your bid') : 'Your bid'} ({currency})</span>
              <input className="ar-input ar-num" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={lot.minimumBidMinor ? `${(lot.minimumBidMinor / 100).toLocaleString('en-US')} or more` : 'Amount for the whole lot'} aria-describedby="bid-hint" />
            </label>
            <p id="bid-hint" className="ar-small ar-muted">{lot.format === 'open_auction' ? `Minimum ${money(lot.minimumBidMinor, currency)}${lot.bidIncrementMinor ? `, in steps of ${money(lot.bidIncrementMinor, currency)}` : ''}.` : 'One amount for the whole lot.'}</p>
            <button type="submit" className="ar-btn ar-btn-primary ar-btn-block"><Gavel size={18} aria-hidden="true" /> Review bid</button>
            {my?.status === 'active' && lot.format === 'sealed_bid' ? <button type="button" className="ar-btn ar-btn-ghost ar-btn-sm" disabled={busy} onClick={withdraw}>Withdraw bid</button> : null}
          </form>
        )}
      </div>
    </div>
  )
}
