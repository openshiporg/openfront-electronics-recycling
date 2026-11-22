'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Lock, Menu, UserRound, X } from 'lucide-react'
import { LogoMark } from './Icons'

type Props = {
  businessName: string
  logoUrl: string | null
  account: { href: string; label: string } | null
}

const NAV = [
  { href: '/recycle', label: 'Recycle with us', match: (p: string) => p.startsWith('/recycle') || p.startsWith('/request-pickup') },
  { href: '/', label: 'Buy from us', match: (p: string) => p === '/' || p.startsWith('/lots') || p.startsWith('/buyers') },
  { href: '/verify', label: 'Verify a certificate', match: (p: string) => p.startsWith('/verify') },
]

/**
 * Top bar and nav (§5.3 header): Recycle with us · Buy from us · Verify a certificate · Sign in.
 * After sign-in "My account" goes to /buyer, /client or the dashboard by User.kind.
 */
export function Header({ businessName, logoUrl, account }: Props) {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  return (
    <header>
      <div className="ar-top">
        <div className="ar-wrap ar-top-in">
          <Link href="/" className="ar-logo" aria-label={`${businessName} home`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ar-logo-img" src={logoUrl} alt={businessName} />
            ) : (
              <>
                <LogoMark />
                <span className="ar-logo-text">
                  <span className="ar-logo-name">{businessName}</span>
                  <span className="ar-logo-sub">Electronics recycling</span>
                </span>
              </>
            )}
          </Link>
          <div className="ar-services" aria-label="What we do">
            <span>Wholesale lots</span>
            <span>IT asset recovery</span>
            <span>Data destruction</span>
          </div>
          <div className="ar-top-right">
            <span className="ar-approved"><Lock size={13} aria-hidden="true" /> Approved buyers only</span>
            <Link className="ar-btn ar-btn-primary ar-btn-top ar-top-login" href={account?.href ?? '/signin'}>
              <UserRound size={15} aria-hidden="true" /> {account?.label ?? 'Buyer login'}
            </Link>
            <button type="button" className="ar-menu-btn" aria-expanded={open} aria-controls="ar-nav" onClick={() => setOpen((v) => !v)}>
              {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
              <span className="ar-sr">Menu</span>
            </button>
          </div>
        </div>
      </div>
      <nav id="ar-nav" className="ar-nav" data-open={open} aria-label="Main">
        <div className="ar-wrap ar-nav-in">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.match(pathname) ? 'page' : undefined}>{item.label}</Link>
          ))}
          {account ? (
            <Link className="ar-nav-account" href={account.href} aria-current={pathname.startsWith(account.href) ? 'page' : undefined}>{account.label}</Link>
          ) : (
            <Link className="ar-nav-account" href="/signin" aria-current={pathname.startsWith('/signin') || pathname.startsWith('/signup') ? 'page' : undefined}>Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  )
}
