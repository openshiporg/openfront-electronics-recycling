import { PlatformPage, day, when } from '../../lib/page'
import { ItemDrawer, OpButton } from '../../lib/forms'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const FIELDS = 'id title slug status opensAt closesAt announcementSentAt lotsCount draft: lotsCount(where: { status: { equals: draft } })'

/** S9: sale events, add lots, publish and announce. */
export default async function SaleEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status')
  const create = (
    <ItemDrawer listKey="SaleEvent" title="New sale event" trigger="New sale event" triggerVariant="primary" fields={[
      { name: 'title', label: 'Title', required: true, wide: true, placeholder: 'December enterprise IT sale' },
      { name: 'slug', label: 'Web address', required: true, hint: 'Lower case and hyphens, e.g. december-it-sale' },
      { name: 'opensAt', label: 'Opens', type: 'datetime', required: true },
      { name: 'closesAt', label: 'Closes', type: 'datetime', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ]} />
  )
  return (
    <PlatformPage route="/platform/sale-events" title="Sale events" meta="Group lots into a sale, publish them together and email buyers who follow those categories." actions={create}>
      {async () => {
        const data = await readTabbedList<any>({ list: 'saleEvents', type: 'SaleEvent', fields: FIELDS, current: status, orderBy: [{ opensAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: '', label: 'All', where: {} },
          { value: 'draft', label: 'Draft', where: { status: { equals: 'draft' } } },
          { value: 'published', label: 'Published', where: { status: { equals: 'published' } } },
          { value: 'closed', label: 'Closed', where: { status: { equals: 'closed' } } },
        ] })
        return (
          <TabbedTable label="Sale events" path="/dashboard/platform/sale-events" params={{ status }} data={data} empty="No sale events yet. Create one, then add lots from the Lots page." head={[{ label: 'Sale' }, { label: 'Status' }, { label: 'Opens' }, { label: 'Closes' }, { label: 'Lots', className: 'text-right' }, { label: '' }]} row={(e) => (
            <tr key={e.id}>
              <Td><RowLink href={`/dashboard/platform/lots?saleEvent=${e.id}`}>{e.title}</RowLink><div className="text-xs text-muted-foreground">/{e.slug}</div></Td>
              <Td><Status value={e.status} />{e.announcementSentAt ? <div className="text-xs text-muted-foreground">Announced {day(e.announcementSentAt)}</div> : null}</Td>
              <Td>{when(e.opensAt)}</Td>
              <Td>{when(e.closesAt)}</Td>
              <Td className="text-right tabular-nums">{e.lotsCount}{e.draft ? <span className="text-xs text-muted-foreground"> ({e.draft} draft)</span> : null}</Td>
              <Td className="whitespace-nowrap text-right">
                {e.draft || e.status === 'draft' ? <OpButton op="publishSaleEvent" input={{ saleEventId: e.id, announce: !e.announcementSentAt }} label={e.announcementSentAt ? 'Publish lots' : 'Publish and announce'} variant="primary" confirm="Publish every draft lot in this sale?" /> : null}
                <ItemDrawer listKey="SaleEvent" id={e.id} title={`Edit ${e.title}`} trigger="Edit" fields={[
                  { name: 'title', label: 'Title', required: true, wide: true, defaultValue: e.title },
                  { name: 'opensAt', label: 'Opens', type: 'datetime', defaultValue: e.opensAt },
                  { name: 'closesAt', label: 'Closes', type: 'datetime', defaultValue: e.closesAt },
                ]} />
              </Td>
            </tr>
          )} />
        )
      }}
    </PlatformPage>
  )
}
