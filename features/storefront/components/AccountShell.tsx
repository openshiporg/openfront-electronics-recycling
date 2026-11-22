import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { PageHead, Tabs } from './ui'
import { SignOutButton } from './SignOutButton'
import { getViewer, homeFor, type Viewer } from '../lib/data/session'

const BUYER_TABS = [
  { key: 'home', href: '/buyer', label: 'Overview' },
  { key: 'bids', href: '/buyer/bids', label: 'My bids' },
  { key: 'invoices', href: '/buyer/invoices', label: 'Invoices' },
  { key: 'orders', href: '/buyer/orders', label: 'Orders' },
]
const CLIENT_TABS = [
  { key: 'home', href: '/client', label: 'Jobs' },
  { key: 'invoices', href: '/client/invoices', label: 'Invoices' },
]

/** Signed-in gate for /buyer and /client: wrong kind goes to its own home. */
export async function requireKind(kind: 'buyer' | 'client', path: string): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(path)}`)
  if (viewer.kind !== kind) redirect(homeFor(viewer))
  return viewer
}

export function AccountShell({ kind, tab, title, lede, crumbs, actions, children }: { kind: 'buyer' | 'client'; tab: string; title: ReactNode; lede?: ReactNode; crumbs?: Array<{ href?: string; label: string }>; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHead title={title} lede={lede} crumbs={crumbs}>
        <div className="ar-actions">{actions}<SignOutButton /></div>
      </PageHead>
      <div className="ar-wrap ar-page">
        <Tabs items={kind === 'buyer' ? BUYER_TABS : CLIENT_TABS} current={tab} />
        {children}
      </div>
    </>
  )
}
