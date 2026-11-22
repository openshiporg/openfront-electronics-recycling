import Link from 'next/link'
import { PickupForm } from '../../components/PickupForm'
import { LoadError, Notice, PageHead } from '../../components/ui'
import { getViewer } from '../../lib/data/session'
import { myJobs, publicCategories, publicFacilities } from '../../lib/data/store'

/** P3 for visitors (creates the account too) and C1 for a signed-in client (reuses saved sites). */
export async function RequestPickupPage() {
  const viewer = await getViewer()
  const [cats, facilities, jobs] = await Promise.all([publicCategories(), publicFacilities(), viewer?.kind === 'client' ? myJobs() : Promise.resolve(null)])
  const categories = cats.ok ? cats.data.filter((c) => c.kind !== 'material').map((c) => ({ id: c.id, name: c.name })) : []
  const fac = facilities.ok ? facilities.data.map((f) => ({ id: f.id, name: f.name, city: f.city, acceptsDropOff: f.acceptsDropOff })) : []
  const isClient = viewer?.kind === 'client'
  return (
    <>
      <PageHead title="Request a pickup" lede="Tell us what you have and where it is. We send a quote, you accept it online, and we book the truck." crumbs={isClient ? [{ href: '/client', label: 'Jobs' }, { label: 'Request a pickup' }] : [{ href: '/recycle', label: 'Recycle with us' }, { label: 'Request a pickup' }]} />
      <div className="ar-wrap ar-section" style={{ maxWidth: 900 }}>
        {viewer && !isClient ? (
          <Notice title="You are signed in as a buyer">Pickup requests come from client accounts. <Link className="ar-textlink" href="/signin?next=/request-pickup">Sign in with a client account</Link>, or sign out and fill this in to create one.</Notice>
        ) : !cats.ok ? <LoadError message={cats.error} /> : (
          <>
            {!isClient ? <p className="ar-small ar-muted" style={{ marginBottom: 18 }}>Already a client? <Link className="ar-textlink" href="/signin?next=/request-pickup">Sign in</Link> to use your saved sites.</p> : null}
            <PickupForm mode={isClient ? 'client' : 'public'} categories={categories} facilities={fac} sites={jobs && jobs.ok ? jobs.data.sites : []} me={isClient ? { name: viewer!.name, email: viewer!.email } : undefined} />
          </>
        )}
      </div>
    </>
  )
}
