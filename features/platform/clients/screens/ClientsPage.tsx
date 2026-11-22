import { PlatformPage, can, label, term } from '../../lib/page'
import { ItemDrawer } from '../../lib/forms'
import { Track, Td } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, type SearchParams } from '../../lib/view'
import { orgFields } from './orgFields'

/** T1: client organisations (the businesses whose equipment we collect). */
export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'active'
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/clients" title="Clients" meta="Organisations whose equipment you collect, their sites and their portal users.">
      {async (staff) => {
        const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { legalName: { contains: q, mode: 'insensitive' } }, { billingEmail: { contains: q, mode: 'insensitive' } }] } : {}
        const data = await readTabbedList<any>({ list: 'clientOrganizations', type: 'ClientOrganization', fields: 'id name industry city region status defaultPricingModel billingEmail usersCount sitesCount jobsCount accountManager { name }', current: status, where, orderBy: [{ name: 'asc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'active', label: 'Active', where: { status: { equals: 'active' } } },
          { value: 'prospect', label: 'Prospects', where: { status: { equals: 'prospect' } } },
          { value: 'inactive', label: 'Inactive', where: { status: { equals: 'inactive' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        return (
          <>
            <Track wrap>
              {can(staff, 'canManageClients') ? <ItemDrawer listKey="ClientOrganization" title="Add a client" trigger="Add client" triggerVariant="primary" fields={orgFields()} onResultHref="/dashboard/platform/clients/{id}" /> : null}
              <form className="flex gap-2" action="/dashboard/platform/clients">
                <input type="hidden" name="status" value={status} />
                <input name="q" defaultValue={q} placeholder="Name or billing email" className="h-9 w-64 rounded-[6px] border bg-background px-3 text-sm" />
                <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
              </form>
            </Track>
            <TabbedTable label="Clients" path="/dashboard/platform/clients" params={{ status, q }} data={data} empty="No clients here." head={[{ label: 'Client' }, { label: 'Status' }, { label: 'Pricing' }, { label: 'Sites', className: 'text-right' }, { label: 'Users', className: 'text-right' }, { label: 'Jobs', className: 'text-right' }, { label: 'Account manager' }]} row={(o) => (
              <tr key={o.id}>
                <Td><RowLink href={`/dashboard/platform/clients/${o.id}`}>{o.name}</RowLink><div className="text-xs text-muted-foreground">{[o.industry, [o.city, o.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div></Td>
                <Td><Status value={o.status} /></Td><Td>{term(o.defaultPricingModel)}</Td>
                <Td className="text-right tabular-nums">{o.sitesCount}</Td><Td className="text-right tabular-nums">{o.usersCount}</Td><Td className="text-right tabular-nums">{o.jobsCount}</Td>
                <Td>{o.accountManager?.name ?? '—'}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
