import { PlatformPage, can } from '../../lib/page'
import { ItemDrawer, SaveButton } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Track, Td } from '../../lib/ui'
import { RowLink } from '../../lib/view'

const DAYS: Array<[string, string]> = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']]

function fields(f: any = {}) {
  return [
    { name: 'name', label: 'Name', required: true, defaultValue: f.name }, { name: 'code', label: 'Short code', required: true, defaultValue: f.code, placeholder: 'COL' },
    { name: 'addressLine1', label: 'Address', defaultValue: f.addressLine1 }, { name: 'addressLine2', label: 'Address line 2', defaultValue: f.addressLine2 },
    { name: 'city', label: 'City', defaultValue: f.city }, { name: 'region', label: 'State or region', defaultValue: f.region },
    { name: 'postalCode', label: 'Postal code', defaultValue: f.postalCode }, { name: 'countryCode', label: 'Country', defaultValue: f.countryCode ?? 'US' },
    { name: 'phone', label: 'Phone', defaultValue: f.phone },
    ...DAYS.map(([k, l]) => ({ name: `hours.${k}`, label: `${l} hours`, defaultValue: f.hours?.[k] ?? (f.id ? '' : ['sat', 'sun'].includes(k) ? '' : '08:00-17:00'), placeholder: '08:00-17:00 or empty for closed' })),
    { name: 'dockSlotMinutes', label: 'Dock slot length (minutes)', type: 'number' as const, required: true, defaultValue: f.dockSlotMinutes ?? 30 },
    { name: 'dockSlotsPerWindow', label: 'Trucks per slot', type: 'number' as const, required: true, defaultValue: f.dockSlotsPerWindow ?? 2 },
    { name: 'acceptsDropOff', label: 'Accepts drop-offs', type: 'checkbox' as const, defaultValue: f.acceptsDropOff ?? true },
    { name: 'isActive', label: 'Active', type: 'checkbox' as const, defaultValue: f.isActive ?? true },
    { name: 'pickupInstructions', label: 'Buyer pickup instructions', type: 'textarea' as const, defaultValue: f.pickupInstructions, wide: true, hint: 'Shown to a buyer only after their order is paid.' },
  ]
}

/** T4: facilities, their hours and dock capacity. Dock slots are cut from these hours in the store time zone. */
export default async function FacilitiesPage() {
  return (
    <PlatformPage route="/platform/facilities" title="Facilities" meta="Where you receive, process and release. Hours set the dock calendar; a slot takes as many trucks as you set.">
      {async (staff) => {
        const r = await listQuery<any>('query { facilities(orderBy: [{ name: asc }]) { id name code addressLine1 addressLine2 city region postalCode countryCode phone hours acceptsDropOff dockSlotMinutes dockSlotsPerWindow pickupInstructions isActive } s: storeSettings(where: { id: 1 }) { timezone } }')
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const manage = can(staff, 'canManageSettings')
        const list = r.data.facilities
        return (
          <>
            {manage ? <Track><ItemDrawer listKey="Facility" title="Add a facility" trigger="Add facility" triggerVariant="primary" fields={fields()} /></Track> : null}
            <p className="text-sm text-muted-foreground">Times are in {r.data.s?.timezone ?? 'the store time zone'} (change it under <RowLink href="/dashboard/platform/settings">Settings</RowLink>).</p>
            {list.length ? (
              <DataTable label="Facilities" head={[{ label: 'Facility' }, { label: 'Hours' }, { label: 'Dock' }, { label: 'Drop-offs' }, { label: '' }]}>
                {list.map((f: any) => <tr key={f.id} className="align-top">
                  <Td><span className="font-medium">{f.name}</span> <span className="font-mono text-xs text-muted-foreground">{f.code}</span>{!f.isActive ? <span className="ml-2 text-xs text-red-600">inactive</span> : null}<div className="text-xs text-muted-foreground">{[f.addressLine1, f.city, f.region, f.postalCode].filter(Boolean).join(', ')}{f.phone ? ` · ${f.phone}` : ''}</div></Td>
                  <Td className="text-xs">{DAYS.map(([k, l]) => <div key={k}>{l.slice(0, 3)} {f.hours?.[k] || <span className="text-muted-foreground">closed</span>}</div>)}</Td>
                  <Td className="text-xs">{f.dockSlotMinutes}-minute slots, {f.dockSlotsPerWindow} per slot<div><RowLink href={`/dashboard/platform/dock?facility=${f.id}`}>Calendar</RowLink></div></Td>
                  <Td>{f.acceptsDropOff ? 'Yes' : 'No'}</Td>
                  <Td className="whitespace-nowrap text-right">{manage ? <><ItemDrawer listKey="Facility" id={f.id} title={`Edit ${f.name}`} trigger="Edit" fields={fields(f)} /><SaveButton listKey="Facility" id={f.id} data={{ isActive: !f.isActive }} label={f.isActive ? 'Deactivate' : 'Reactivate'} variant={f.isActive ? 'danger' : 'raised'} /></> : null}</Td>
                </tr>)}
              </DataTable>
            ) : <Empty>No facilities. Add the site that receives material.</Empty>}
          </>
        )
      }}
    </PlatformPage>
  )
}
