'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptQuoteAction, declineQuoteAction } from '../../lib/actions/buyer'

/** C3: accept by typed name against the current service terms, or decline with a reason. */
export function QuoteBox({ jobNumber, termsVersion, terms }: { jobNumber: string; termsVersion: string; terms: string[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'accept' | 'decline'>('accept')
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <section className="ar-bidbox" style={{ position: 'static' }} aria-labelledby="qb-title">
      <h2 id="qb-title">Your answer</h2>
      <div className="ar-choice" role="radiogroup" aria-label="Accept or decline" style={{ marginTop: 12 }}>
        <label><input type="radio" name="qb" checked={mode === 'accept'} onChange={() => setMode('accept')} /><span>Accept</span></label>
        <label><input type="radio" name="qb" checked={mode === 'decline'} onChange={() => setMode('decline')} /><span>Decline</span></label>
      </div>
      <form className="ar-form" style={{ marginTop: 14 }} onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true); setError('')
        const r = mode === 'accept' ? await acceptQuoteAction(jobNumber, name, termsVersion) : await declineQuoteAction(jobNumber, reason)
        setBusy(false)
        if (r.ok) router.refresh(); else setError(r.error)
      }}>
        {mode === 'accept' ? (
          <>
            {terms.length ? (
              <details className="ar-terms">
                <summary>Service terms, version {termsVersion}</summary>
                <div className="ar-small" style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>{terms.map((p, i) => <p key={i} style={{ marginBottom: 8 }}>{p}</p>)}</div>
              </details>
            ) : null}
            <label className="ar-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /> <span>I accept this quote and the service terms (version {termsVersion}) for my organisation.</span></label>
            <label className="ar-field"><span>Type your full name to sign</span><input className="ar-input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
          </>
        ) : (
          <label className="ar-field"><span>Why? <small className="ar-muted">(optional, helps us requote)</small></span><textarea className="ar-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></label>
        )}
        {error ? <p className="ar-small" role="alert" style={{ color: 'var(--ar-red)' }}>{error}</p> : null}
        <button type="submit" className={`ar-btn ar-btn-block ${mode === 'accept' ? 'ar-btn-primary' : 'ar-btn-ghost'}`} disabled={busy || (mode === 'accept' && (!agree || name.trim().length < 2))}>{busy ? 'Sending…' : mode === 'accept' ? 'Accept and sign' : 'Decline quote'}</button>
      </form>
    </section>
  )
}
