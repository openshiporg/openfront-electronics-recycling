'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cmd, gql } from '../data/client'
import { getViewer, homeFor } from '../data/session'

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null

const SESSION_COOKIE = 'keystonejs-session'
const MAX_AGE = 60 * 60 * 24 * 30

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value || '')
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/api') ? next : ''
}

async function startSession(email: string, password: string): Promise<string | null> {
  const r = await gql<{ authenticateUserWithPassword: { sessionToken?: string; message?: string } | null }>(
    'mutation($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { ... on UserAuthenticationWithPasswordSuccess { sessionToken } ... on UserAuthenticationWithPasswordFailure { message } } }',
    { email, password },
  )
  const token = r.ok ? r.data.authenticateUserWithPassword?.sessionToken : null
  if (!token) return null
  ;(await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE })
  return token
}

/** P10: sign in, then go back to where the visitor came from or to their account. */
export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const password = String(form.get('password') || '')
  if (!email || !password) return { error: 'Enter your email and password.', values: { email } }
  const token = await startSession(email, password)
  if (!token) return { error: 'That email and password do not match an account.', values: { email } }
  const viewer = await getViewer()
  revalidatePath('/', 'layout')
  redirect(safeNext(form.get('next')) || (viewer ? homeFor(viewer) : '/'))
}

export async function signOutAction() {
  ;(await cookies()).delete(SESSION_COOKIE)
  revalidatePath('/', 'layout')
  redirect('/')
}

/** P7 step 1: the login and the draft company, then straight into the application. */
export async function registerBuyerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    name: String(form.get('name') || '').trim(),
    email: String(form.get('email') || '').trim().toLowerCase(),
    phone: String(form.get('phone') || '').trim(),
    legalName: String(form.get('legalName') || '').trim(),
    countryCode: String(form.get('countryCode') || 'US'),
  }
  const password = String(form.get('password') || '')
  if (password !== String(form.get('confirm') || '')) return { error: 'The two passwords do not match.', values }
  const r = await cmd('registerBuyer', { ...values, password })
  if (!r.success) return { error: r.error || 'We could not create the account.', values }
  const token = await startSession(values.email, password)
  if (!token) redirect('/signin?next=/buyers/apply')
  revalidatePath('/', 'layout')
  redirect('/buyers/apply')
}

/** P10: ask for a reset link. Always answers the same, so it does not reveal who has an account. */
export async function requestResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter the email you sign in with.', values: { email } }
  await gql('mutation($email: String!) { sendUserPasswordResetLink(email: $email) }', { email })
  return { ok: 'If that email has an account, a reset link is on its way. It works for one hour.', values: { email } }
}

export async function redeemResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const token = String(form.get('token') || '')
  const password = String(form.get('password') || '')
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.', values: { email } }
  if (password !== String(form.get('confirm') || '')) return { error: 'The two passwords do not match.', values: { email } }
  const r = await gql<{ redeemUserPasswordResetToken: { code: string; message: string } | null }>(
    'mutation($email: String!, $token: String!, $password: String!) { redeemUserPasswordResetToken(email: $email, token: $token, password: $password) { code message } }',
    { email, token, password },
  )
  if (!r.ok) return { error: r.error, values: { email } }
  const failure = r.data.redeemUserPasswordResetToken
  if (failure) return { error: failure.code === 'TOKEN_EXPIRED' ? 'This link has expired. Ask for a new one.' : 'This link is not valid for that email. Ask for a new one.', values: { email } }
  await startSession(email, password)
  const viewer = await getViewer()
  revalidatePath('/', 'layout')
  redirect(viewer ? homeFor(viewer) : '/signin')
}

/** P3: a public pickup request creates the organisation, a client login and the job; then the visitor is signed in. */
export async function submitPickupAction(input: Record<string, any>): Promise<{ ok: false; error: string } | { ok: true; jobNumber: string }> {
  const r = await cmd<{ jobNumber: string }>('submitPickupRequest', input)
  if (!r.success || !r.data) return { ok: false, error: r.error || 'We could not send the request.' }
  await startSession(String(input.contactEmail || '').trim().toLowerCase(), String(input.password || ''))
  revalidatePath('/', 'layout')
  return { ok: true, jobNumber: r.data.jobNumber }
}
