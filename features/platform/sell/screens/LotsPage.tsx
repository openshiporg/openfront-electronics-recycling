import { PlatformPage, label, term, usd, when } from '../../lib/page'
import { ItemDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const STATUSES = ['draft', 'scheduled', 'open', 'closed', 'awarded', 'unsold', 'completed', 'cancelled']
const FIELDS = 'id lotNumber title status format bidBasis closesAt bidCount currentAmountMinor saleEvent { id title } category { name } linesCount'

/** Lots by status: the way into the lot editor, bid board and award (S8, S10-S14). */
export default async function LotsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status')
  const saleEvent = param(sp, 'saleEvent')
  const q = param(sp, 'q')
  const opts = await listQuery<any>('query { saleEvents(orderBy: [{ opensAt: desc }], take: 50) { id title } materialCategories(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name } }')
  const events = opts.ok ? opts.data.saleEvents : []
  const cats = opts.ok ? opts.data.materialCategories : []
  const create = (
    <ItemDrawer listKey="Lot" title="New draft lot" description="Add lines here, from a manifest import, or build the lot from inventory on Ready for sale." trigger="New lot" triggerVariant="primary" fields={[
      { name: 'title', label: 'Title', required: true, wide: true },
      { name: 'saleEvent', label: 'Sale event', type: 'select', relation: true, options: events.map((e: any) => ({ value: e.id, label: e.title })), defaultValue: saleEvent },
      { name: 'category', label: 'Category', type: 'select', relation: true, options: cats.map((c: any) => ({ value: c.id, label: c.name })) },
      { name: 'format', label: 'Format', type: 'select', required: true, options: ['sealed_bid', 'open_auction', 'fixed_price'].map((v) => ({ value: v, label: term(v) })), defaultValue: 'sealed_bid' },
      { name: 'bidBasis', label: 'Bid basis', type: 'select', required: true, options: ['lot_total', 'per_line'].map((v) => ({ value: v, label: term(v) })), defaultValue: 'lot_total' },
    ]} />
  )
  const where: Record<string, unknown> = {}
  if (saleEvent) where.saleEvent = { id: { equals: saleEvent } }
  if (q) where.OR = [{ lotNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }]
  return (
    <PlatformPage route="/platform/lots" title="Lots" meta="Draft lots get their manifest and terms; open lots take bids; closed lots wait for an award." actions={create}>
      {async () => {
        const data = await readTabbedList<any>({ list: 'lots', type: 'Lot', fields: FIELDS, current: status, where, orderBy: [{ closesAt: 'asc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: '', label: 'All', where: {} },
          ...STATUSES.map((s) => ({ value: s, label: term(s).replace(/^./, (c) => c.toUpperCase()), where: { status: { equals: s } } })),
        ] })
        return (
          <>
            <form className="flex flex-wrap gap-2" action="/dashboard/platform/lots">
              {status ? <input type="hidden" name="status" value={status} /> : null}
              <input name="q" defaultValue={q} placeholder="Lot number or title" className="h-9 w-64 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
              <select name="saleEvent" defaultValue={saleEvent} className="h-9 max-w-full rounded-[6px] border bg-background px-3 text-sm">
                <option value="">Every sale event</option>
                {events.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <button className="h-9 rounded-[6px] border px-3 text-sm">Filter</button>
            </form>
            <TabbedTable label="Lots" path="/dashboard/platform/lots" params={{ status, saleEvent, q }} data={data} empty="No lots here." head={[{ label: 'Lot' }, { label: 'Status' }, { label: 'Format' }, { label: 'Lines', className: 'text-right' }, { label: 'Bids', className: 'text-right' }, { label: 'High', className: 'text-right' }, { label: 'Closes' }]} row={(l) => (
              <tr key={l.id}>
                <Td><RowLink href={`/dashboard/platform/lots/${l.id}`}>{l.lotNumber}</RowLink> <span className="text-muted-foreground">{l.title}</span>{l.saleEvent ? <div className="text-xs text-muted-foreground">{l.saleEvent.title}</div> : null}</Td>
                <Td><Status value={l.status} /></Td>
                <Td>{term(l.format)}<div className="text-xs text-muted-foreground">{label(l.bidBasis)}</div></Td>
                <Td className="text-right tabular-nums">{l.linesCount}</Td>
                <Td className="text-right tabular-nums">{l.bidCount}</Td>
                <Td className="text-right tabular-nums">{l.currentAmountMinor === null && l.format === 'sealed_bid' && ['open', 'scheduled'].includes(l.status) ? 'Sealed' : usd(l.currentAmountMinor)}</Td>
                <Td>{when(l.closesAt)}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
