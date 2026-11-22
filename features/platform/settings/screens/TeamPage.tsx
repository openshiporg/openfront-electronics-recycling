import { PlatformPage, can, when } from '../../lib/page'
import { DeleteButton, ItemDrawer, SaveButton } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, StatusTabs, Track, Td } from '../../lib/ui'
import { param, type SearchParams } from '../../lib/view'

/** Every permission flag, grouped as in the sidebar, with a plain label. */
const PERMISSIONS: Array<[string, Array<[string, string]>]> = [
  ['General', [['canAccessDashboard', 'Sign in to the dashboard'], ['canManageSettings', 'Change settings and the catalogue'], ['canManageUsers', 'Manage staff and roles'], ['canManageOnboarding', 'Run onboarding'], ['canViewReports', 'See reports and the audit log']]],
  ['Sell', [['canManageBuyers', 'Approve and manage buyers'], ['canManageLots', 'Build and publish lots'], ['canAwardLots', 'Award lots'], ['canSeeSealedBidAmountsBeforeClose', 'See sealed bid amounts before close']]],
  ['Collect', [['canManageClients', 'Manage clients'], ['canManageJobs', 'Quote and manage jobs'], ['canDispatch', 'Dispatch'], ['canCollect', 'Drive and collect'], ['canReceive', 'Receive at the dock']]],
  ['Process and comply', [['canAuditAssets', 'Audit assets'], ['canSanitize', 'Record sanitisation'], ['canVerifySanitization', 'Verify sanitisation (second person)'], ['canIssueCertificates', 'Issue and revoke certificates'], ['canManageDownstream', 'Manage downstream vendors and shipments']]],
  ['Money', [['canManagePayments', 'Record and confirm payments'], ['canRefund', 'Refund'], ['canManageSettlements', 'Build and publish settlements']]],
]
const ALL = PERMISSIONS.flatMap(([, list]) => list.map(([k]) => k))

const roleFields = (r: any = {}) => [
  { name: 'name', label: 'Role name', required: true, defaultValue: r.name, wide: true },
  ...PERMISSIONS.flatMap(([group, list]) => list.map(([k, l], i) => ({ name: k, label: l, type: 'checkbox' as const, defaultValue: Boolean(r[k]), hint: i === 0 ? group : undefined }))),
]

/** T6: staff and roles. Buyer users live on each buyer, client users on each client. */
export default async function TeamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const tab = param(sp, 'tab') || 'staff'
  return (
    <PlatformPage route="/platform/team" title="Team and roles" meta="A role is a set of permissions. Every screen and every action checks them on the server.">
      {async (staff) => {
        const r = await listQuery<any>(`query {
          users(where: { kind: { equals: staff } }, orderBy: [{ name: asc }]) { id name email phone isActive createdAt role { id name } }
          roles(orderBy: [{ name: asc }]) { id name assignedToCount ${ALL.join(' ')} }
        }`)
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const manage = can(staff, 'canManageUsers')
        const roleOpts = r.data.roles.map((x: any) => ({ value: x.id, label: x.name }))
        const userFields = (u: any = {}) => [
          { name: 'name', label: 'Name', required: true, defaultValue: u.name }, { name: 'email', label: 'Email', type: 'email' as const, required: true, defaultValue: u.email },
          { name: 'phone', label: 'Phone', defaultValue: u.phone },
          { name: 'role', label: 'Role', type: 'select' as const, relation: true, required: true, options: roleOpts, defaultValue: u.role?.id },
          ...(u.id ? [] : [{ name: 'password', label: 'Temporary password', type: 'password' as const, required: true, hint: 'At least 8 characters. They can change it with Forgot password once email is set up.' }]),
        ]
        return (
          <>
            <StatusTabs label="Team" current={tab} hrefFor={(v) => `/dashboard/platform/team?tab=${v}`} tabs={[{ value: 'staff', label: 'Staff', count: r.data.users.length }, { value: 'roles', label: 'Roles', count: r.data.roles.length }]} />
            {!manage ? <Notice>Only someone who can manage staff can change this.</Notice> : null}
            {tab === 'staff' ? (
              <Section title="Staff" count={r.data.users.length} actions={manage ? <ItemDrawer listKey="User" title="Add a staff member" trigger="Add staff" triggerVariant="primary" fixed={{ kind: 'staff' }} fields={userFields()} /> : null}>
                {r.data.users.length ? <DataTable label="Staff" head={[{ label: 'Name' }, { label: 'Role' }, { label: 'Active' }, { label: 'Since' }, { label: '' }]}>
                  {r.data.users.map((u: any) => <tr key={u.id}>
                    <Td>{u.name}<div className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></Td>
                    <Td>{u.role?.name ?? <span className="text-red-600">No role</span>}</Td><Td>{u.isActive ? 'Yes' : 'No'}</Td><Td>{when(u.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-right">{manage ? <>
                      <ItemDrawer listKey="User" id={u.id} title={`Edit ${u.name}`} trigger="Edit" fields={userFields(u)} />
                      <ItemDrawer listKey="User" id={u.id} title={`New password for ${u.name}`} trigger="Set password" submitLabel="Set" fields={[{ name: 'password', label: 'New password', type: 'password', required: true, hint: 'At least 8 characters.' }]} />
                      {u.id !== staff.id ? <SaveButton listKey="User" id={u.id} data={{ isActive: !u.isActive }} label={u.isActive ? 'Remove access' : 'Restore access'} variant={u.isActive ? 'danger' : 'raised'} /> : null}
                    </> : null}</Td>
                  </tr>)}
                </DataTable> : <Empty>No staff.</Empty>}
              </Section>
            ) : (
              <Section title="Roles" count={r.data.roles.length} actions={manage ? <ItemDrawer listKey="Role" title="Add a role" trigger="Add role" triggerVariant="primary" fields={roleFields({ canAccessDashboard: true })} /> : null}>
                {r.data.roles.length ? <DataTable label="Roles" head={[{ label: 'Role' }, { label: 'People', className: 'text-right' }, { label: 'Can' }, { label: '' }]}>
                  {r.data.roles.map((x: any) => <tr key={x.id} className="align-top">
                    <Td className="font-medium">{x.name}</Td><Td className="text-right tabular-nums">{x.assignedToCount}</Td>
                    <Td className="max-w-xl text-xs">{PERMISSIONS.map(([group, list]) => { const on = list.filter(([k]) => x[k]); return on.length ? <div key={group}><span className="text-muted-foreground">{group}:</span> {on.map(([, l]) => l).join(', ')}</div> : null })}</Td>
                    <Td className="whitespace-nowrap text-right">{manage ? <><ItemDrawer listKey="Role" id={x.id} title={`Edit ${x.name}`} trigger="Edit" fields={roleFields(x)} />{!x.assignedToCount ? <DeleteButton listKey="Role" id={x.id} confirm={`Remove the ${x.name} role?`} /> : null}</> : null}</Td>
                  </tr>)}
                </DataTable> : <Empty>No roles. Run onboarding to create the standard ones.</Empty>}
              </Section>
            )}
          </>
        )
      }}
    </PlatformPage>
  )
}
