import { PlatformPage, can, day, storeToday } from '../../lib/page'
import { DeleteButton, ItemDrawer, OpDrawer, SaveButton } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Notice, Track } from '../../lib/ui'
import { param, readTabbedList, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const certText = (c: any) => (Array.isArray(c) ? c.map((x: any) => [x.name, x.number, x.expiresOn].filter(Boolean).join(' | ')).join('\n') : '')

/** Y4: downstream vendors, what each is approved to take, when the approval is reviewed, and its due-diligence file. */
export default async function DownstreamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'approved'
  return (
    <PlatformPage route="/platform/downstream" title="Downstream vendors" meta="R2v3 and e-Stewards require every downstream vendor to be approved for each material before it ships.">
      {async (staff) => {
        const cats = await listQuery<any>('query { materialCategories(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name } }')
        if (!cats.ok) return <Notice tone="alert">{cats.error}</Notice>
        const manage = can(staff, 'canManageDownstream')
        const today = storeToday()
        const fields = (v?: any) => [
          { name: 'name', label: 'Name', required: true, defaultValue: v?.name },
          { name: 'contactName', label: 'Contact', defaultValue: v?.contactName }, { name: 'contactEmail', label: 'Contact email', type: 'email' as const, defaultValue: v?.contactEmail },
          { name: 'addressLine1', label: 'Address', defaultValue: v?.addressLine1 }, { name: 'city', label: 'City', defaultValue: v?.city }, { name: 'region', label: 'State or region', defaultValue: v?.region },
          { name: 'postalCode', label: 'Postal code', defaultValue: v?.postalCode }, { name: 'countryCode', label: 'Country (2 letters)', defaultValue: v?.countryCode ?? 'US' },
          { name: 'certifications', label: 'Certifications (name | number | expires YYYY-MM-DD)', type: 'lines' as const, columns: [{ key: 'name' }, { key: 'number' }, { key: 'expiresOn' }], defaultValue: certText(v?.certifications), wide: true },
          { name: 'approvedCategories', label: 'Approved for', type: 'multiselect' as const, relation: true, options: cats.data.materialCategories.map((c: any) => ({ value: c.id, label: c.name })), defaultValue: (v?.approvedCategories ?? []).map((c: any) => c.id), wide: true },
          { name: 'status', label: 'Status', type: 'select' as const, options: ['pending', 'approved', 'suspended'].map((s) => ({ value: s, label: s })), defaultValue: v?.status ?? 'pending' },
          { name: 'approvedOn', label: 'Approved on', type: 'date' as const, defaultValue: v?.approvedOn },
          { name: 'reviewDueOn', label: 'Review due', type: 'date' as const, defaultValue: v?.reviewDueOn },
          { name: 'notes', label: 'Notes', type: 'textarea' as const, defaultValue: v?.notes, wide: true },
        ]
        const data = await readTabbedList<any>({ list: 'downstreamVendors', type: 'DownstreamVendor', fields: 'id name contactName contactEmail addressLine1 city region postalCode countryCode certifications status approvedOn reviewDueOn notes shipmentsCount approvedCategories { id name } dueDiligenceFile { id filename }', current: status, orderBy: [{ name: 'asc' }], tabs: [
          { value: 'approved', label: 'Approved', where: { status: { equals: 'approved' } } },
          { value: 'review', label: 'Review overdue', where: { AND: [{ status: { equals: 'approved' } }, { reviewDueOn: { lt: today } }] } },
          { value: 'pending', label: 'Pending', where: { status: { equals: 'pending' } } },
          { value: 'suspended', label: 'Suspended', where: { status: { equals: 'suspended' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        return (
          <>
            {manage ? <Track><ItemDrawer listKey="DownstreamVendor" title="Add a downstream vendor" trigger="Add vendor" triggerVariant="primary" fields={fields()} /></Track> : null}
            <TabbedTable label="Downstream vendors" path="/dashboard/platform/downstream" params={{ status }} data={data} empty="No vendors here." head={[{ label: 'Vendor' }, { label: 'Approved for' }, { label: 'Certifications' }, { label: 'Status' }, { label: 'Review due' }, { label: 'Due diligence' }, { label: '' }]} row={(v) => (
              <tr key={v.id}>
                <Td><span className="font-medium">{v.name}</span><div className="text-xs text-muted-foreground">{[v.city, v.region, v.countryCode].filter(Boolean).join(', ')}{v.contactEmail ? ` · ${v.contactEmail}` : ''}</div></Td>
                <Td className="max-w-[16rem] text-xs">{v.approvedCategories.map((c: any) => c.name).join(', ') || '—'}</Td>
                <Td className="text-xs">{Array.isArray(v.certifications) ? v.certifications.map((c: any, i: number) => <div key={i}>{c.name} {c.number} {c.expiresOn ? `· to ${day(c.expiresOn)}` : ''}</div>) : null}</Td>
                <Td><Status value={v.status} />{v.approvedOn ? <div className="text-xs text-muted-foreground">since {day(v.approvedOn)}</div> : null}</Td>
                <Td className={v.reviewDueOn && v.reviewDueOn < today ? 'text-red-600' : ''}>{day(v.reviewDueOn)}</Td>
                <Td>{v.dueDiligenceFile ? <a className="text-xs underline" href={`/api/files/${v.dueDiligenceFile.id}`} target="_blank">{v.dueDiligenceFile.filename}</a> : '—'}</Td>
                <Td className="whitespace-nowrap text-right">{manage ? <>
                  <ItemDrawer listKey="DownstreamVendor" id={v.id} title={`Edit ${v.name}`} trigger="Edit" fields={fields(v)} />
                  <OpDrawer op="attachFile" fixed={{ target: 'vendor_due_diligence', id: v.id }} title="Due-diligence file" description="The audit report, permits and insurance you reviewed." trigger="Upload file" fields={[{ name: 'file', label: 'File', type: 'file', required: true }]} submitLabel="Upload" />
                  {v.status === 'approved' ? <SaveButton listKey="DownstreamVendor" id={v.id} data={{ status: 'suspended' }} label="Suspend" variant="danger" /> : <SaveButton listKey="DownstreamVendor" id={v.id} data={{ status: 'approved', approvedOn: v.approvedOn ?? today }} label="Approve" />}
                  {!v.shipmentsCount ? <DeleteButton listKey="DownstreamVendor" id={v.id} label="Remove" confirm={`Remove ${v.name}?`} /> : null}
                </> : null}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
