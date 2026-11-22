import { notFound } from 'next/navigation'
import { PlatformPage, can, day, label, term, usd } from '../../lib/page'
import { DeleteButton, ItemDrawer, SaveButton } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Track, Td } from '../../lib/ui'
import { Facts, RowLink, Status } from '../../lib/view'
import { orgFields, siteFields } from './orgFields'

const CLIENT = `query C($id: ID!) {
  o: clientOrganization(where: { id: $id }) { id name legalName industry billingEmail addressLine1 addressLine2 city region postalCode countryCode taxId status defaultPricingModel defaultRevenueShareBps notes accountManager { id name }
    sites(orderBy: [{ name: asc }]) { id name addressLine1 addressLine2 city region postalCode contactName contactPhone hasDock needsLiftgate accessNotes hours jobsCount }
    users(orderBy: [{ name: asc }]) { id name email phone clientRole isActive acceptedTermsVersion }
    jobs(orderBy: [{ createdAt: desc }], take: 25) { id jobNumber type status pricingModel scheduledDate totalWeight assetCount site { name } }
    invoices(orderBy: [{ createdAt: desc }], take: 25) { id invoiceNumber kind status totalMinor balanceMinor dueAt isOverdue } }
  staff: users(where: { kind: { equals: staff }, isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name }
}`

/** T1: one client: details, sites, portal users, jobs, invoices. */
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PlatformPage route="/platform/clients" title="Client" crumbs={[{ label: 'Clients', href: '/dashboard/platform/clients' }]}>
      {async (staff) => {
        const r = await listQuery<any>(CLIENT, { id })
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const o = r.data.o
        if (!o) notFound()
        const manage = can(staff, 'canManageClients')
        const managers = (r.data.staff ?? []).map((u: any) => ({ value: u.id, label: u.name }))
        return (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{o.name}</h2><Status value={o.status} /></div>
            <Section title="Details" actions={<Track>
              {manage ? <ItemDrawer listKey="ClientOrganization" id={o.id} title={`Edit ${o.name}`} trigger="Edit" fields={orgFields(o, managers)} /> : null}
              {can(staff, 'canManageJobs', 'canManageClients') ? <RowLink href={`/dashboard/platform/jobs?organization=${o.id}`}>Request a pickup</RowLink> : null}
              <RowLink href={`/dashboard/platform/jobs?status=all&q=${encodeURIComponent(o.name)}`}>All jobs</RowLink>
              {can(staff, 'canViewReports', 'canManageClients') ? <RowLink href={`/dashboard/platform/reports?org=${o.id}`}>Impact report</RowLink> : null}
              <RowLink href={`/dashboard/platform/assets?organization=${o.id}`}>Assets</RowLink>
            </Track>}>
              <Facts items={[['Legal name', o.legalName], ['Industry', o.industry], ['Billing email', o.billingEmail], ['Address', [o.addressLine1, o.addressLine2, o.city, o.region, o.postalCode, o.countryCode].filter(Boolean).join(', ')], ['Tax id', o.taxId], ['Pricing', `${label(o.defaultPricingModel)}${o.defaultRevenueShareBps != null ? `, client share ${o.defaultRevenueShareBps / 100}%` : ''}`], ['Account manager', o.accountManager?.name], ['Notes', o.notes]]} />
            </Section>

            <Section title="Sites" count={o.sites.length} actions={manage ? <ItemDrawer listKey="ClientSite" title="Add a site" trigger="Add site" fixed={{ organization: { connect: { id: o.id } } }} fields={siteFields()} /> : null}>
              {o.sites.length ? (
                <DataTable label="Sites" head={[{ label: 'Site' }, { label: 'Contact' }, { label: 'Access' }, { label: 'Jobs', className: 'text-right' }, { label: '' }]}>
                  {o.sites.map((s: any) => <tr key={s.id} className="align-top">
                    <Td><span className="font-medium">{s.name}</span><div className="text-xs text-muted-foreground">{[s.addressLine1, s.addressLine2, s.city, s.region, s.postalCode].filter(Boolean).join(', ')}</div></Td>
                    <Td>{s.contactName}{s.contactPhone ? <div className="text-xs text-muted-foreground">{s.contactPhone}</div> : null}</Td>
                    <Td className="text-xs">{[s.hasDock ? 'Dock' : 'No dock', s.needsLiftgate ? 'liftgate' : '', s.hours].filter(Boolean).join(' · ')}{s.accessNotes ? <div className="text-muted-foreground">{s.accessNotes}</div> : null}</Td>
                    <Td className="text-right tabular-nums">{s.jobsCount}</Td>
                    <Td className="whitespace-nowrap text-right">{manage ? <><ItemDrawer listKey="ClientSite" id={s.id} title={`Edit ${s.name}`} trigger="Edit" fields={siteFields(s)} />{!s.jobsCount ? <DeleteButton listKey="ClientSite" id={s.id} confirm={`Remove ${s.name}?`} /> : null}</> : null}</Td>
                  </tr>)}
                </DataTable>
              ) : <Empty>No sites yet. Add the address you collect from.</Empty>}
            </Section>

            <Section title="Portal users" count={o.users.length} actions={manage ? <ItemDrawer listKey="User" title="Add a client user" description="They sign in to the client portal to request pickups, accept quotes, and download certificates. Give them this temporary password; they can change it with Forgot password." trigger="Add user" fixed={{ kind: 'client', clientOrganization: { connect: { id: o.id } } }} fields={[
              { name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone' },
              { name: 'clientRole', label: 'Role', type: 'select', required: true, options: [{ value: 'admin', label: 'Admin (requests, accepts quotes, pays)' }, { value: 'viewer', label: 'Viewer' }], defaultValue: 'admin' },
              { name: 'password', label: 'Temporary password', type: 'password', required: true, hint: 'At least 8 characters.' },
            ]} /> : null}>
              {o.users.length ? (
                <DataTable label="Portal users" head={[{ label: 'Name' }, { label: 'Role' }, { label: 'Terms' }, { label: 'Active' }, { label: '' }]}>
                  {o.users.map((u: any) => <tr key={u.id}>
                    <Td>{u.name}<div className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></Td>
                    <Td>{term(u.clientRole)}</Td><Td>{u.acceptedTermsVersion ? `v${u.acceptedTermsVersion}` : 'Not yet'}</Td><Td>{u.isActive ? 'Yes' : 'No'}</Td>
                    <Td className="whitespace-nowrap text-right">{manage ? <>
                      <SaveButton listKey="User" id={u.id} data={{ clientRole: u.clientRole === 'admin' ? 'viewer' : 'admin' }} label={u.clientRole === 'admin' ? 'Make viewer' : 'Make admin'} />
                      <ItemDrawer listKey="User" id={u.id} title={`New password for ${u.name}`} trigger="Set password" submitLabel="Set" fields={[{ name: 'password', label: 'New password', type: 'password', required: true, hint: 'At least 8 characters. Tell them directly.' }]} />
                      <SaveButton listKey="User" id={u.id} data={{ isActive: !u.isActive }} label={u.isActive ? 'Remove access' : 'Restore access'} variant={u.isActive ? 'danger' : 'raised'} />
                    </> : null}</Td>
                  </tr>)}
                </DataTable>
              ) : <Empty>No portal users.</Empty>}
            </Section>

            <Section title="Jobs" count={o.jobs.length}>
              {o.jobs.length ? (
                <DataTable label="Jobs" head={[{ label: 'Job' }, { label: 'Site' }, { label: 'Status' }, { label: 'Date' }, { label: 'Weight', className: 'text-right' }, { label: 'Assets', className: 'text-right' }]}>
                  {o.jobs.map((j: any) => <tr key={j.id}><Td><RowLink href={`/dashboard/platform/jobs/${j.id}`}>{j.jobNumber}</RowLink><div className="text-xs text-muted-foreground">{label(j.type)} · {label(j.pricingModel)}</div></Td><Td>{j.site?.name ?? '—'}</Td><Td><Status value={j.status} /></Td><Td>{day(j.scheduledDate)}</Td><Td className="text-right tabular-nums">{j.totalWeight}</Td><Td className="text-right tabular-nums">{j.assetCount}</Td></tr>)}
                </DataTable>
              ) : <Empty>No jobs yet.</Empty>}
            </Section>

            <Section title="Invoices" count={o.invoices.length}>
              {o.invoices.length ? (
                <DataTable label="Invoices" head={[{ label: 'Invoice' }, { label: 'Status' }, { label: 'Total', className: 'text-right' }, { label: 'Balance', className: 'text-right' }, { label: 'Due' }]}>
                  {o.invoices.map((i: any) => <tr key={i.id}><Td><RowLink href={`/dashboard/platform/invoices?q=${i.invoiceNumber}&status=all`}>{i.invoiceNumber}</RowLink></Td><Td><Status value={i.isOverdue ? 'overdue' : i.status} /></Td><Td className="text-right tabular-nums">{usd(i.totalMinor)}</Td><Td className="text-right tabular-nums">{usd(i.balanceMinor)}</Td><Td>{day(i.dueAt)}</Td></tr>)}
                </DataTable>
              ) : <Empty>No invoices.</Empty>}
            </Section>
          </div>
        )
      }}
    </PlatformPage>
  )
}
