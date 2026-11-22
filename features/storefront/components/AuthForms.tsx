'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { redeemResetAction, registerBuyerAction, requestResetAction, signInAction, type FormState } from '../lib/actions/auth'

function Message({ state }: { state: FormState }) {
  if (state?.error) return <div className="ar-notice ar-notice-err" role="alert"><p className="ar-small">{state.error}</p></div>
  if (state?.ok) return <div className="ar-notice ar-notice-ok" role="status"><p className="ar-small">{state.ok}</p></div>
  return null
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, null)
  return (
    <form action={action} className="ar-form">
      <input type="hidden" name="next" value={next} />
      <Message state={state} />
      <label className="ar-field"><span>Email</span><input className="ar-input" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} /></label>
      <label className="ar-field"><span>Password</span><input className="ar-input" name="password" type="password" autoComplete="current-password" required /></label>
      <button className="ar-btn ar-btn-primary ar-btn-block" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <p className="ar-small"><Link className="ar-textlink" href="/reset-password">Forgot your password?</Link></p>
    </form>
  )
}

const COUNTRIES: Array<[string, string]> = [['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['GB', 'United Kingdom'], ['AE', 'United Arab Emirates'], ['IN', 'India'], ['HK', 'Hong Kong'], ['NG', 'Nigeria'], ['GH', 'Ghana'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['PL', 'Poland']]

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerBuyerAction, null)
  const v = state?.values || {}
  return (
    <form action={action} className="ar-form">
      <Message state={state} />
      <div className="ar-row">
        <label className="ar-field"><span>Your name</span><input className="ar-input" name="name" autoComplete="name" required defaultValue={v.name} /></label>
        <label className="ar-field"><span>Phone</span><input className="ar-input" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} /></label>
      </div>
      <label className="ar-field"><span>Work email</span><input className="ar-input" name="email" type="email" autoComplete="email" required defaultValue={v.email} /></label>
      <div className="ar-row">
        <label className="ar-field"><span>Company legal name</span><input className="ar-input" name="legalName" autoComplete="organization" required defaultValue={v.legalName} /></label>
        <label className="ar-field"><span>Country</span>
          <select className="ar-select" name="countryCode" defaultValue={v.countryCode || 'US'}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
        </label>
      </div>
      <div className="ar-row">
        <label className="ar-field"><span>Password</span><input className="ar-input" name="password" type="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" /></label>
        <label className="ar-field"><span>Password again</span><input className="ar-input" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
      </div>
      <p id="pw-hint" className="ar-small ar-muted">At least 10 characters.</p>
      <button className="ar-btn ar-btn-primary ar-btn-block" type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account and continue'}</button>
    </form>
  )
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, null)
  return (
    <form action={action} className="ar-form">
      <Message state={state} />
      <label className="ar-field"><span>Email</span><input className="ar-input" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} /></label>
      <button className="ar-btn ar-btn-primary ar-btn-block" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Email me a reset link'}</button>
    </form>
  )
}

export function RedeemResetForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(redeemResetAction, null)
  return (
    <form action={action} className="ar-form">
      <input type="hidden" name="token" value={token} />
      <Message state={state} />
      <label className="ar-field"><span>Email</span><input className="ar-input" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email || email} /></label>
      <label className="ar-field"><span>New password</span><input className="ar-input" name="password" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label className="ar-field"><span>New password again</span><input className="ar-input" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></label>
      <button className="ar-btn ar-btn-primary ar-btn-block" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save password and sign in'}</button>
    </form>
  )
}
