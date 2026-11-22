import { PlatformPage, can, label, usd } from '../../lib/page'
import { OpDrawer, SelectAll } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Notice, Track } from '../../lib/ui'
import { specLabel } from '@/features/keystone/lib/rules/sheets'
import { param, readTabbedList, RowLink, TabbedTable, Td, type SearchParams } from '../../lib/view'

/** R9 inventory ready for sale; S7 make a lot from ticked assets. Drafts let you take assets back out from the lot page. */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'ready'
  const category = param(sp, 'category')
  return (
    <PlatformPage route="/platform/inventory" title="Inventory" meta="Audited, sanitised assets marked for resale or parts, waiting to go on a lot.">
      {async (staff) => {
        const opts = await listQuery<any>('query { materialCategories(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name } saleEvents(where: { status: { in: [draft, published] } }, orderBy: [{ opensAt: asc }], take: 50) { id title } facilities(where: { isActive: { equals: true } }) { id name } }')
        if (!opts.ok) return <Notice tone="alert">{opts.error}</Notice>
        const where = category ? { category: { id: { equals: category } } } : {}
        const data = await readTabbedList<any>({ list: 'assets', type: 'Asset', fields: 'id assetNumber serialNumber manufacturer model specs disposition status locationCode fairMarketValueMinor category { name } cosmeticGrade { code } functionalGrade { code } job { jobNumber } lotLine { lot { id lotNumber status } }', current: status, where, orderBy: [{ model: 'asc' }, { assetNumber: 'asc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'ready', label: 'Ready for sale', where: { status: { equals: 'ready_for_sale' } } },
          { value: 'allocated', label: 'On a lot', where: { status: { equals: 'allocated' } } },
        ] })
        const sell = can(staff, 'canManageLots')
        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <form className="flex gap-2" action="/dashboard/platform/inventory">
                <input type="hidden" name="status" value={status} />
                <select name="category" defaultValue={category} className="h-9 rounded-[6px] border bg-background px-3 text-sm"><option value="">Every category</option>{opts.data.materialCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button className="h-9 rounded-[6px] border px-3 text-sm">Filter</button>
              </form>
              {sell && status === 'ready' ? <Track>
                <OpDrawer selection="assetIds" op="createLotFromAssets" title="Make a lot" description="A draft lot with one line per model and grade, serials attached. Review and publish it from Lots." trigger="Make a lot from ticked" triggerVariant="primary" fields={[
                  { name: 'title', label: 'Lot title', required: true, placeholder: '40 × Dell Latitude 5420, grade B, wiped' },
                  { name: 'categoryId', label: 'Category', type: 'select', options: opts.data.materialCategories.map((c: any) => ({ value: c.id, label: c.name })) },
                  { name: 'facilityId', label: 'Ships from', type: 'select', options: opts.data.facilities.map((f: any) => ({ value: f.id, label: f.name })) },
                  { name: 'saleEventId', label: 'Sale event', type: 'select', options: opts.data.saleEvents.map((e: any) => ({ value: e.id, label: e.title })) },
                  { name: 'format', label: 'Format', type: 'select', options: [{ value: 'sealed_bid', label: 'Sealed bid' }, { value: 'open_auction', label: 'Open ascending' }, { value: 'fixed_price', label: 'Fixed price' }], defaultValue: 'sealed_bid' },
                  { name: 'bidBasis', label: 'Bid on', type: 'select', options: [{ value: 'lot_total', label: 'The lot total' }, { value: 'per_line', label: 'Each line' }], defaultValue: 'lot_total' },
                ]} submitLabel="Make draft lot" onResultHref="/dashboard/platform/lots/{id}" />
              </Track> : null}
            </div>
            <TabbedTable label="Inventory" path="/dashboard/platform/inventory" params={{ status, category }} data={data} empty="Nothing here. Set an asset's disposition to resale or parts once it has passed sanitisation." head={[{ label: <SelectAll group="assetIds" /> }, { label: 'Asset' }, { label: 'Item' }, { label: 'Grade' }, { label: 'Specs' }, { label: 'Where' }, { label: 'Value', className: 'text-right' }]} row={(a) => (
              <tr key={a.id}>
                <Td>{status === 'ready' ? <input type="checkbox" data-select="assetIds" value={a.id} aria-label={`Select ${a.assetNumber}`} /> : null}</Td>
                <Td><span className="font-mono text-xs">{a.assetNumber}</span><div>{a.serialNumber}</div></Td>
                <Td>{[a.manufacturer, a.model].filter(Boolean).join(' ')}<div className="text-xs text-muted-foreground">{a.category?.name} · {label(a.disposition)}</div></Td>
                <Td>{[a.cosmeticGrade?.code, a.functionalGrade?.code].filter(Boolean).join(' / ') || '—'}</Td>
                <Td className="max-w-[16rem] text-xs">{a.specs && typeof a.specs === 'object' ? Object.entries(a.specs).map(([k, v]) => `${specLabel(k)}: ${v}`).join(' · ') : ''}</Td>
                <Td>{a.locationCode || '—'}<div className="text-xs text-muted-foreground">{a.job?.jobNumber}</div>{a.lotLine?.lot ? <RowLink href={`/dashboard/platform/lots/${a.lotLine.lot.id}`}>{a.lotLine.lot.lotNumber}</RowLink> : null}</Td>
                <Td className="text-right tabular-nums">{a.fairMarketValueMinor ? usd(a.fairMarketValueMinor) : '—'}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
