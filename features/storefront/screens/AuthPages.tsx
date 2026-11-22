import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getViewer, homeFor } from '../lib/data/session'
import { SignInForm, RegisterForm, RequestResetForm, RedeemResetForm } from '../components/AuthForms'

function Shell({ title, lede, children, art = true }: { title: string; lede: string; children: React.ReactNode; art?: boolean }) {
  return (
    <div className="ar-wrap ar-page">
      <div className="ar-auth">
        <div className="ar-auth-form">
          <span className="ar-slash" aria-hidden="true" />
          <h1>{title}</h1>
          <p className="ar-muted" style={{ margin: '8px 0 22px' }}>{lede}</p>
          {children}
        </div>
        {art ? (
          <div className="ar-auth-art" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/storefront/lot-mixed.webp" alt="" />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** P10 */
export async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const viewer = await getViewer()
  if (viewer) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(viewer))
  return (
    <Shell title="Sign in" lede="Buyers see prices and bid. Businesses that recycle with us see jobs, certificates and invoices.">
      <SignInForm next={next || ''} />
      <p className="ar-small" style={{ marginTop: 18 }}>New buyer? <Link className="ar-textlink" href="/buyers/apply">Apply for a buyer account</Link>. Recycling with us? <Link className="ar-textlink" href="/request-pickup">Request a pickup</Link> and we set up your account.</p>
    </Shell>
  )
}

/** P10 sign-up: the only self-serve account is a buyer account (clients are set up from a request). */
export async function SignUpPage() {
  const viewer = await getViewer()
  if (viewer) redirect(viewer.kind === 'buyer' ? '/buyers/apply' : homeFor(viewer))
  return (
    <Shell title="Create a buyer account" lede="Step 1 of 3. Then tell us about your company and upload a document, and we review it, usually within two business days.">
      <RegisterForm />
      <p className="ar-small" style={{ marginTop: 18 }}>Already have an account? <Link className="ar-textlink" href="/signin">Sign in</Link>.</p>
    </Shell>
  )
}

export async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
  const { token, email } = await searchParams
  return token ? (
    <Shell title="Choose a new password" lede="Enter the email the link was sent to and a new password.">
      <RedeemResetForm token={token} email={email || ''} />
    </Shell>
  ) : (
    <Shell title="Reset your password" lede="We email you a link to choose a new one.">
      <RequestResetForm />
      <p className="ar-small" style={{ marginTop: 18 }}><Link className="ar-textlink" href="/signin">Back to sign in</Link></p>
    </Shell>
  )
}
