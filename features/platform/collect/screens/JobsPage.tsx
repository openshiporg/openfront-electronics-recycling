import { PlatformPage, can, day, label } from '../../lib/page'
import { OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Track } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const FIELDS = 'id jobNumber type status contactName contactEmail requestedDates hasDataBearing servicesRequested scheduledDate quoteSentAt createdAt organization { id name } site { name city } siteAddress assetsCount containersCount'

/** K1 requests to quote, K2 phoned-in requests, T2 pickup enquiries from the site; the jobs board by stage. */
export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'requested'
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/jobs" title="Requests and jobs" meta="Pickup requests from the website and by phone, through quote, collection, processing and certificates.">
      {async (staff) => {
        const orgs = await listQuery<any>('query { clientOrganizations(orderBy: [{ name: asc }], take: 300) { id name sites { id name city } } facilities(where: { isActive: { equals: true } }) { id name } }')
        const create = can(staff, 'canManageJobs', 'canManageClients') && orgs.ok ? (
          <OpDrawer op="staffRequestJob" title="New pickup request" description="For a client who phoned or emailed. Add the client under Clients first if they are new." trigger="New request" triggerVariant="primary" fields={[
            { name: 'organizationId', label: 'Client', type: 'select', required: true, options: orgs.data.clientOrganizations.map((o: any) => ({ value: o.id, label: o.name })) },
            { name: 'siteId', label: 'Saved site', type: 'select', options: orgs.data.clientOrganizations.flatMap((o: any) => o.sites.map((s: any) => ({ value: s.id, label: `${o.name} · ${s.name || s.city}` }))), hint: 'Or enter an address below.' },
            { name: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'pickup', label: 'We collect' }, { value: 'drop_off', label: 'Client drops off' }], defaultValue: 'pickup' },
            { name: 'facilityId', label: 'Facility', type: 'select', options: orgs.data.facilities.map((f: any) => ({ value: f.id, label: f.name })) },
            { name: 'contactName', label: 'Contact', required: true }, { name: 'contactEmail', label: 'Contact email', type: 'email', required: true }, { name: 'contactPhone', label: 'Contact phone' },
            { name: 'site.addressLine1', label: 'Address' }, { name: 'site.city', label: 'City' }, { name: 'site.region', label: 'State' }, { name: 'site.postalCode', label: 'ZIP' },
            { name: 'site.hasDock', label: 'Loading dock', type: 'checkbox' }, { name: 'site.needsLiftgate', label: 'Needs liftgate', type: 'checkbox' },
            { name: 'site.accessNotes', label: 'Access notes', type: 'textarea' },
            { name: 'requestedDates', label: 'Preferred dates (one per line, YYYY-MM-DD)', type: 'list', placeholder: '2026-12-02' },
            { name: 'hasDataBearing', label: 'Includes data-bearing devices', type: 'checkbox', defaultValue: true },
            { name: 'services', label: 'Services', type: 'multiselect', options: ['pickup', 'drop_off', 'data_destruction', 'onsite_shred', 'itad', 'recycling', 'witness_destruction'].map((v) => ({ value: v, label: label(v) })), defaultValue: ['data_destruction', 'recycling'] },
            { name: 'estimate', label: 'Estimate (quantity | unit | notes)', type: 'lines', columns: [{ key: 'quantity', type: 'number' }, { key: 'unit' }, { key: 'notes' }], placeholder: '40 | each | laptops' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]} submitLabel="Create request" />
        ) : null
        const where = q ? { OR: [{ jobNumber: { contains: q, mode: 'insensitive' } }, { contactName: { contains: q, mode: 'insensitive' } }, { organization: { name: { contains: q, mode: 'insensitive' } } }] } : {}
        const data = await readTabbedList<any>({ list: 'jobs', type: 'Job', fields: FIELDS, current: status, where, orderBy: [{ createdAt: 'asc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'requested', label: 'To quote', where: { status: { equals: 'requested' } } },
          { value: 'quoted', label: 'Quote sent', where: { status: { equals: 'quoted' } } },
          { value: 'accepted', label: 'To schedule', where: { status: { equals: 'accepted' } } },
          { value: 'scheduled', label: 'Scheduled', where: { status: { in: ['scheduled', 'en_route'] } } },
          { value: 'collected', label: 'In transit', where: { status: { equals: 'collected' } } },
          { value: 'processing', label: 'Processing', where: { status: { in: ['received', 'processing'] } } },
          { value: 'completed', label: 'Completed', where: { status: { in: ['completed', 'settled', 'closed'] } } },
          { value: 'on_hold', label: 'On hold', where: { status: { equals: 'on_hold' } } },
          { value: 'ended', label: 'Declined or cancelled', where: { status: { in: ['declined', 'cancelled'] } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <form className="flex gap-2" action="/dashboard/platform/jobs">
                <input type="hidden" name="status" value={status} />
                <input name="q" defaultValue={q} placeholder="Job number, client or contact" className="h-9 w-64 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
                <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
              </form>
              <Track>{create}</Track>
            </div>
            <TabbedTable label="Jobs" path="/dashboard/platform/jobs" params={{ status, q }} data={data} empty="Nothing here." head={[{ label: 'Job' }, { label: 'Client' }, { label: 'Status' }, { label: 'Where' }, { label: 'Dates' }, { label: 'Items' }]} row={(j) => (
              <tr key={j.id}>
                <Td><RowLink href={`/dashboard/platform/jobs/${j.id}`}>{j.jobNumber}</RowLink><div className="text-xs text-muted-foreground">{label(j.type)} · {day(j.createdAt)}</div></Td>
                <Td>{j.organization?.name ?? '—'}<div className="text-xs text-muted-foreground">{j.contactName} {j.contactEmail ? `· ${j.contactEmail}` : ''}</div></Td>
                <Td><Status value={j.status} />{j.hasDataBearing ? <div className="text-xs text-muted-foreground">Data-bearing</div> : null}</Td>
                <Td>{j.site ? `${j.site.name || ''} ${j.site.city || ''}` : j.siteAddress?.city ?? '—'}</Td>
                <Td>{j.scheduledDate ? `Booked ${day(j.scheduledDate)}` : Array.isArray(j.requestedDates) && j.requestedDates.length ? `Wants ${j.requestedDates.map((d: string) => day(d)).join(', ')}` : '—'}</Td>
                <Td className="tabular-nums">{j.containersCount ? `${j.containersCount} containers` : ''}{j.assetsCount ? ` · ${j.assetsCount} assets` : ''}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
