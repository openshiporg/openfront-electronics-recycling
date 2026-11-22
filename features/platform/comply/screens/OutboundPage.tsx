import { PlatformPage, can, day, when } from '../../lib/page'
import { DeleteButton, ItemDrawer, OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Track, Td } from '../../lib/ui'
import { Facts, param, readTabbedList, RowLink, Status, TabbedTable, type SearchParams } from '../../lib/view'

const DETAIL = `query O($id: ID!) {
  outboundShipment(where: { id: $id }) { id shipmentNumber status shippedAt carrier billOfLading totalWeight receivedWeight receiptConfirmedAt destinationCountry receiptDocument { id filename }
    vendor { id name status approvedCategories { id name } } facility { id name }
    lines { id weight containerCount category { id name } assetsCount commodityLinesCount assets(take: 50) { id assetNumber serialNumber } commodityLines { id weight job { jobNumber } } } }
  recyclable: assets(where: { AND: [{ status: { equals: recycling } }, { outboundLine: null }] }, orderBy: [{ assetNumber: asc }], take: 500) { id assetNumber serialNumber model category { id name } }
  commodities: commodityLines(where: { outboundLine: null }, orderBy: [{ createdAt: asc }], take: 300) { id weight category { id name } job { jobNumber } }
}`

/** Y5: build a shipment to an approved vendor, ship it, confirm the vendor's receipt weight. */
export default async function OutboundPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'draft'
  const id = param(sp, 'shipment')
  return (
    <PlatformPage route="/platform/outbound" title="Outbound shipments" meta="Material leaving for downstream processing. Only approved vendors, only approved materials, only sanitised assets.">
      {async (staff) => {
        const manage = can(staff, 'canManageDownstream')
        const opts = await listQuery<any>('query { downstreamVendors(where: { status: { equals: approved } }, orderBy: [{ name: asc }]) { id name } facilities(where: { isActive: { equals: true } }) { id name } materialCategories(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name } }')
        if (!opts.ok) return <Notice tone="alert">{opts.error}</Notice>
        const detail = id ? await listQuery<any>(DETAIL, { id }) : null
        const s = detail?.ok ? detail.data.outboundShipment : null
        const pool = detail?.ok ? detail.data : { recyclable: [], commodities: [] }
        const data = await readTabbedList<any>({ list: 'outboundShipments', type: 'OutboundShipment', fields: 'id shipmentNumber status shippedAt carrier totalWeight receivedWeight linesCount vendor { name } facility { name }', current: status, orderBy: [{ createdAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'draft', label: 'Draft', where: { status: { equals: 'draft' } } },
          { value: 'shipped', label: 'Awaiting receipt', where: { status: { equals: 'shipped' } } },
          { value: 'done', label: 'Receipt confirmed', where: { status: { in: ['receipt_confirmed', 'closed'] } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        const vendorOpts = opts.data.downstreamVendors.map((v: any) => ({ value: v.id, label: v.name }))
        return (
          <>
            {manage ? <Track>
              <ItemDrawer listKey="OutboundShipment" title="New outbound shipment" description="Add lines next, then ship." trigger="New shipment" triggerVariant="primary" fields={[
                { name: 'vendor', label: 'Vendor', type: 'select', relation: true, required: true, options: vendorOpts },
                { name: 'facility', label: 'From', type: 'select', relation: true, options: opts.data.facilities.map((f: any) => ({ value: f.id, label: f.name })) },
                { name: 'carrier', label: 'Carrier' }, { name: 'destinationCountry', label: 'Destination country', defaultValue: 'US' },
              ]} />
              {!vendorOpts.length ? <span className="text-sm text-muted-foreground">Approve a vendor under <RowLink href="/dashboard/platform/downstream">Downstream</RowLink> first.</span> : null}
            </Track> : null}
            {detail && !detail.ok ? <Notice tone="alert">{detail.error}</Notice> : null}
            {s ? (
              <Section title={<>{s.shipmentNumber} <Status value={s.status} /></>} actions={<RowLink href={`/dashboard/platform/outbound?status=${status}`}>Close</RowLink>}>
                <Facts items={[['Vendor', s.vendor ? `${s.vendor.name} (${s.vendor.status})` : 'Not chosen'], ['Approved for', s.vendor?.approvedCategories.map((c: any) => c.name).join(', ')], ['From', s.facility?.name], ['Carrier', s.carrier], ['Bill of lading', s.billOfLading], ['Shipped', when(s.shippedAt)], ['Weight shipped', s.totalWeight], ['Weight received', s.receivedWeight ?? ''], ['Receipt', s.receiptDocument ? <a key="r" className="underline" href={`/api/files/${s.receiptDocument.id}`} target="_blank">{s.receiptDocument.filename}</a> : '']]} />
                <div className="mt-4">
                  {s.lines.length ? (
                    <DataTable label="Shipment lines" head={[{ label: 'Material' }, { label: 'Weight', className: 'text-right' }, { label: 'Containers', className: 'text-right' }, { label: 'Contents' }, { label: '' }]}>
                      {s.lines.map((l: any) => <tr key={l.id}><Td>{l.category?.name ?? '—'}</Td><Td className="text-right tabular-nums">{l.weight}</Td><Td className="text-right tabular-nums">{l.containerCount}</Td>
                        <Td className="max-w-md text-xs">{l.assetsCount ? `${l.assetsCount} asset(s): ${l.assets.map((a: any) => a.assetNumber).join(', ')}${l.assetsCount > 50 ? '…' : ''}` : ''}{l.commodityLinesCount ? ` ${l.commodityLinesCount} commodity line(s) from ${[...new Set(l.commodityLines.map((c: any) => c.job?.jobNumber))].join(', ')}` : ''}</Td>
                        <Td className="text-right">{manage && s.status === 'draft' ? <DeleteButton listKey="OutboundShipmentLine" id={l.id} label="Remove" confirm="Remove this line?" /> : null}</Td></tr>)}
                    </DataTable>
                  ) : <Empty>No lines yet.</Empty>}
                </div>
                {manage ? <Track wrap className="mt-4">
                  {s.status === 'draft' ? <>
                    <ItemDrawer listKey="OutboundShipmentLine" fixed={{ shipment: { connect: { id: s.id } } }} title="Add a line" description="One line per material. Attach the recycle-bound assets and commodity lines it carries." trigger="Add line" fields={[
                      { name: 'category', label: 'Material', type: 'select', relation: true, required: true, options: opts.data.materialCategories.map((c: any) => ({ value: c.id, label: c.name })) },
                      { name: 'weight', label: 'Weight', type: 'decimal', required: true },
                      { name: 'containerCount', label: 'Containers', type: 'number', defaultValue: 1 },
                      { name: 'assets', label: 'Assets set to recycle', type: 'multiselect', relation: true, options: pool.recyclable.map((a: any) => ({ value: a.id, label: `${a.assetNumber} ${a.serialNumber} ${a.category?.name ?? ''}` })), wide: true },
                      { name: 'commodityLines', label: 'Commodity lines', type: 'multiselect', relation: true, options: pool.commodities.map((c: any) => ({ value: c.id, label: `${c.job?.jobNumber} · ${c.category?.name ?? ''} · ${c.weight}` })), wide: true },
                    ]} />
                    <ItemDrawer listKey="OutboundShipment" id={s.id} title="Edit shipment" trigger="Edit" fields={[
                      { name: 'vendor', label: 'Vendor', type: 'select', relation: true, options: vendorOpts, defaultValue: s.vendor?.id },
                      { name: 'carrier', label: 'Carrier', defaultValue: s.carrier }, { name: 'billOfLading', label: 'Bill of lading', defaultValue: s.billOfLading }, { name: 'destinationCountry', label: 'Destination country', defaultValue: s.destinationCountry },
                    ]} />
                    <OpDrawer op="shipOutbound" fixed={{ shipmentId: s.id }} title={`Ship ${s.shipmentNumber}`} description="Checks the vendor's approval and every asset's sanitisation, then records the hand-off on each asset's custody record." trigger="Ship" triggerVariant="primary" fields={[{ name: 'carrier', label: 'Carrier', defaultValue: s.carrier }, { name: 'billOfLading', label: 'Bill of lading', defaultValue: s.billOfLading }, { name: 'shippedAt', label: 'Left at', type: 'datetime' }]} submitLabel="Ship" />
                  </> : null}
                  {s.status === 'shipped' ? <OpDrawer op="confirmOutboundReceipt" fixed={{ shipmentId: s.id }} title="Confirm the vendor's receipt" description="From the vendor's weight ticket or certificate of recycling." trigger="Confirm receipt" triggerVariant="primary" fields={[{ name: 'receivedWeight', label: 'Weight received', type: 'number', required: true, defaultValue: s.totalWeight }, { name: 'receipt', label: 'Weight ticket or certificate', type: 'file' }, { name: 'close', label: 'Close the shipment', type: 'checkbox' }]} submitLabel="Confirm" /> : null}
                  {s.status === 'receipt_confirmed' ? <OpButton op="confirmOutboundReceipt" input={{ shipmentId: s.id, receivedWeight: s.receivedWeight, close: true }} label="Close" /> : null}
                </Track> : null}
              </Section>
            ) : null}
            <TabbedTable label="Outbound shipments" path="/dashboard/platform/outbound" params={{ status }} data={data} empty="No shipments here." head={[{ label: 'Shipment' }, { label: 'Vendor' }, { label: 'Status' }, { label: 'Lines', className: 'text-right' }, { label: 'Shipped', className: 'text-right' }, { label: 'Received', className: 'text-right' }, { label: 'Date' }]} row={(x) => (
              <tr key={x.id}>
                <Td><RowLink href={`/dashboard/platform/outbound?status=${status}&shipment=${x.id}`}>{x.shipmentNumber}</RowLink><div className="text-xs text-muted-foreground">{x.facility?.name}</div></Td>
                <Td>{x.vendor?.name ?? '—'}</Td><Td><Status value={x.status} /></Td><Td className="text-right tabular-nums">{x.linesCount}</Td>
                <Td className="text-right tabular-nums">{x.totalWeight}</Td><Td className="text-right tabular-nums">{x.receivedWeight ?? '—'}</Td><Td>{day(x.shippedAt)}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
