import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Montserrat } from 'next/font/google'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { getStore } from '../lib/data/store'
import { getViewer, homeFor } from '../lib/data/session'
import '../styles/arcturus.css'

// Arcturus: a heavy geometric sans for headings, a plain sans for text.
const head = Montserrat({ variable: '--font-ar-head', weight: ['600', '700', '800', '900'], subsets: ['latin'] })
const body = Inter({ variable: '--font-ar-body', subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore()
  const name = store.ok ? store.data.businessName : 'Electronics recycling'
  const tagline = store.ok && store.data.tagline ? store.data.tagline : `Wholesale lots of used business IT for approved buyers, and recycling and data destruction for businesses.`
  return { title: { default: name, template: `%s · ${name}` }, description: tagline }
}

export async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [store, viewer] = await Promise.all([getStore(), getViewer()])
  const settings = store.ok ? store.data : null
  const account = viewer ? { href: homeFor(viewer), label: viewer.isStaff ? 'Dashboard' : 'My account' } : null
  return (
    <div className={`ar ${head.variable} ${body.variable}`}>
      <a href="#main" className="ar-sr">Skip to content</a>
      <Header businessName={settings?.businessName || 'Electronics recycling'} logoUrl={settings?.logoUrl ?? null} account={account} />
      <main id="main">{children}</main>
      <Footer store={settings} signedIn={Boolean(viewer)} />
    </div>
  )
}
