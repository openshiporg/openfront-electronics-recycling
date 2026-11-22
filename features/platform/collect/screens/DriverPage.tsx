import { PlatformPage, can, day, storeToday } from '../../lib/page'
import { OpButton } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Empty, Notice, Section } from '../../lib/ui'
import { param, RowLink, Status, type SearchParams } from '../../lib/view'
import { CollectForm } from './CollectForm'

const STOP = 'id jobNumber status scheduledDate windowStart windowEnd vehicle contactName contactPhone accessDetails siteAddress hasDataBearing organization { name } site { name addressLine1 city region postalCode hasDock needsLiftgate accessNotes contactName contactPhone } estimateLines { quantity unit notes category { name } } driver { id name }'

/** K5: the driver's stops on a phone; start the route, then collect with the client's signature. */
export default async function DriverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const jobId = param(sp, 'job')
  return (
    <PlatformPage route="/platform/driver" title="My stops" meta="Today and the next two days.">
      {async (staff) => {
        const dispatcher = can(staff, 'canDispatch')
        const soon = storeToday(3)
        const mine = dispatcher && param(sp, 'mine') !== '1' ? {} : { driver: { id: { equals: staff.id } } }
        const r = await listQuery<any>(`query S($where: JobWhereInput!) { jobs(where: $where, orderBy: [{ scheduledDate: asc }, { windowStart: asc }], take: 40) { ${STOP} } }`, { where: jobId ? { id: { equals: jobId } } : { AND: [{ status: { in: ['scheduled', 'en_route'] } }, { scheduledDate: { lt: soon } }, mine] } })
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const stops = r.data.jobs
        return (
          <div className="mx-auto grid w-full max-w-md gap-4">
            {dispatcher ? <p className="text-sm text-muted-foreground">{param(sp, 'mine') === '1' ? <RowLink href="/dashboard/platform/driver">Show every driver</RowLink> : <>Showing every driver. <RowLink href="/dashboard/platform/driver?mine=1">Only mine</RowLink></>}</p> : null}
            {jobId ? <RowLink href="/dashboard/platform/driver">All stops</RowLink> : null}
            {!stops.length ? <Empty>No stops booked for you in the next three days.</Empty> : stops.map((j: any) => {
              const a = j.site ?? j.siteAddress ?? {}
              const address = [a.addressLine1, a.city, a.region, a.postalCode].filter(Boolean).join(', ')
              const open = jobId === j.id || stops.length === 1
              return (
                <Section key={j.id} title={<>{j.jobNumber} <Status value={j.status} /></>}>
                  <div className="grid gap-1 text-sm">
                    <div className="font-medium">{j.organization?.name}</div>
                    <div>{day(j.scheduledDate)} · {j.windowStart}–{j.windowEnd}{j.driver ? ` · ${j.driver.name}` : ''}</div>
                    {address ? <a className="underline" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">{address}</a> : null}
                    <div>{j.site?.contactName || j.contactName} {j.site?.contactPhone || j.contactPhone ? <a className="underline" href={`tel:${j.site?.contactPhone || j.contactPhone}`}>{j.site?.contactPhone || j.contactPhone}</a> : null}</div>
                    {[j.site?.hasDock || j.accessDetails?.hasDock ? 'Dock' : '', j.site?.needsLiftgate || j.accessDetails?.needsLiftgate ? 'Liftgate needed' : '', j.accessDetails?.hours ? `Open ${j.accessDetails.hours}` : '', j.site?.accessNotes || j.accessDetails?.accessNotes || ''].filter(Boolean).map((x) => <div key={x} className="text-muted-foreground">{x}</div>)}
                    {j.estimateLines.length ? <div className="text-muted-foreground">Expect: {j.estimateLines.map((e: any) => [e.quantity, e.unit === 'units' ? '' : e.unit, e.category?.name ?? '', e.notes ?? ''].filter(Boolean).join(' ')).join('; ')}</div> : null}
                    {j.hasDataBearing ? <div className="font-medium">Data-bearing: seal every container.</div> : null}
                  </div>
                  <div className="mt-3 grid gap-3">
                    {j.status === 'scheduled' ? <OpButton op="startJobRoute" input={{ jobId: j.id }} label="On my way" variant="primary" size="md" /> : null}
                    {j.status === 'en_route' || j.status === 'scheduled' ? (open ? <CollectForm jobId={j.id} jobNumber={j.jobNumber} contactName={j.site?.contactName || j.contactName} /> : <RowLink href={`/dashboard/platform/driver?job=${j.id}`}>Collect</RowLink>) : null}
                  </div>
                </Section>
              )
            })}
          </div>
        )
      }}
    </PlatformPage>
  )
}
