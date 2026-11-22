import Link from 'next/link'
import { Lock, Mail, Phone } from 'lucide-react'
import type { StoreSettings } from '../lib/data/store'
import { LogoMark } from './Icons'

export function Footer({ store, signedIn }: { store: StoreSettings | null; signedIn: boolean }) {
  const name = store?.businessName || 'Electronics recycling'
  const legal = store?.legalName || name
  const year = new Date().getFullYear()
  return (
    <footer className="ar-foot">
      <div className="ar-wrap">
        <div className="ar-foot-row">
          <Link href="/" className="ar-logo" aria-label={`${name} home`}>
            <LogoMark />
            <span className="ar-logo-text">
              <span className="ar-logo-name">{name}</span>
              <span className="ar-logo-sub">Electronics recycling</span>
            </span>
          </Link>
          <nav className="ar-foot-links" aria-label="Footer">
            <Link href="/lots">Lots</Link>
            <Link href="/buyers">How buying works</Link>
            <Link href="/recycle">Recycle with us</Link>
            <Link href="/verify">Verify a certificate</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <div className="ar-foot-contact">
            {!signedIn && <span className="ar-approved"><Lock size={13} aria-hidden="true" /> Approved buyers only</span>}
            {!signedIn && <Link className="ar-btn ar-btn-primary ar-btn-top" href="/signin">Buyer login</Link>}
          </div>
        </div>
        <div className="ar-foot-bottom">
          <span>© {year} {legal}</span>
          {store?.supportPhone && <span><Phone size={12} aria-hidden="true" /> <a href={`tel:${store.supportPhone.replace(/[^\d+]/g, '')}`}>{store.supportPhone}</a></span>}
          {store?.supportEmail && <span><Mail size={12} aria-hidden="true" /> <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a></span>}
          <span>Trade-only sales of used business IT equipment.</span>
        </div>
      </div>
    </footer>
  )
}
