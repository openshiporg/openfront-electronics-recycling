import { notFound } from 'next/navigation'
import { PlatformPage, can, label, usd, when } from '../../lib/page'
import { DeleteButton, ItemDrawer, OpButton, OpDrawer, type FieldSpec } from '../../lib/forms'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Track, Td } from '../../lib/ui'
import { Facts, RowLink, Status } from '../../lib/view'
import { AwardGrid } from './AwardGrid'
import { documentToText } from '../../lib/document'

const LOT = `id lotNumber title slug status format bidBasis awardMode description { document } conditionSummary opensAt closesAt originalClosesAt extensionCount
  openingBidMinor reserveMinor bidIncrementMinor fixedPriceMinor currentAmountMinor bidCount palletCount weight dimensions shippingTerms exportAllowed warrantyDays
  cancelReason publishedAt closedAt relistedFrom { id lotNumber }
  saleEvent { id title } category { id name } facility { id name }
  lines(orderBy: [{ lineNumber: asc }]) { id lineNumber manufacturer model partNumber description cosmeticGrade functionalGrade quantity unit serials notes assetsCount }
  images(orderBy: [{ sortOrder: asc }]) { id caption image { id filename } }
  addenda(orderBy: [{ postedAt: desc }]) { id body postedAt postedBy { name } }
  awards { id status amountMinor isBelowReserve overrideReason awardedAt company { legalName } order { id orderNumber status } }`

const FORMATS = ['sealed_bid', 'open_auction', 'fixed_price']
const o = (values: string[]) => values.map((v) => ({ value: v, label: label(v) }))

/** S8 lot editor, S10 open-lot actions, S11 bid board, S12 staff bid, S13 award, S14 relist / runner-up. */
export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const read = await listQuery<any>(`query Lot($id: ID!) { lot(where: { id: $id }) { ${LOT} } saleEvents(orderBy: [{ opensAt: desc }], take: 50) { id title } materialCategories(orderBy: [{ name: asc }]) { id name } facilities { id name } buyerCompanies(where: { status: { equals: approved } }, orderBy: [{ legalName: asc }]) { id legalName } }`, { id })
  if (read.ok && !read.data.lot) notFound()
  const lot = read.ok ? read.data.lot : null
  return (
    <PlatformPage route="/platform/lots" title={lot ? `${lot.lotNumber} · ${lot.title}` : 'Lot'} tone={lot ? undefined : 'alert'} crumbs={[{ label: lot?.lotNumber ?? 'Lot' }]} meta={lot ? `${label(lot.format)}, ${label(lot.bidBasis)}${lot.saleEvent ? ` · ${lot.saleEvent.title}` : ''}` : undefined}>
      {async (staff) => {
        if (!read.ok) return <Notice tone="alert">{read.error}</Notice>
        const { saleEvents, materialCategories, facilities, buyerCompanies } = read.data
        const draft = lot.status === 'draft'
        const live = ['open', 'scheduled'].includes(lot.status)
        const manage = can(staff, 'canManageLots')
        const award = can(staff, 'canAwardLots')
        const board = await platformQuery<any>('lotBidBoard', { lotId: lot.id })

        const details: FieldSpec[] = [
          { name: 'title', label: 'Title', required: true, wide: true, defaultValue: lot.title },
          { name: 'description', label: 'Description', type: 'document', defaultValue: documentToText(lot.description?.document) },
          { name: 'conditionSummary', label: 'Condition summary', wide: true, defaultValue: lot.conditionSummary },
          { name: 'category', label: 'Category', type: 'select', relation: true, options: materialCategories.map((c: any) => ({ value: c.id, label: c.name })), defaultValue: lot.category?.id },
          { name: 'facility', label: 'Pickup facility', type: 'select', relation: true, options: facilities.map((f: any) => ({ value: f.id, label: f.name })), defaultValue: lot.facility?.id },
          { name: 'closesAt', label: 'Closes', type: 'datetime', defaultValue: lot.closesAt },
          { name: 'palletCount', label: 'Pallets', type: 'number', defaultValue: lot.palletCount },
          { name: 'weight', label: 'Weight', type: 'number', defaultValue: lot.weight },
          { name: 'dimensions', label: 'Dimensions', defaultValue: lot.dimensions },
          { name: 'shippingTerms', label: 'Shipping', type: 'select', required: true, options: o(['buyer_arranged', 'seller_quoted', 'pickup_only']), defaultValue: lot.shippingTerms },
          { name: 'warrantyDays', label: 'Warranty days', type: 'number', defaultValue: lot.warrantyDays },
          { name: 'exportAllowed', label: 'Export allowed', type: 'checkbox', defaultValue: lot.exportAllowed },
        ]
        // Frozen once the lot leaves draft (§3): format, basis, prices, opening time, sale event.
        const terms: FieldSpec[] = [
          { name: 'saleEvent', label: 'Sale event', type: 'select', relation: true, options: saleEvents.map((e: any) => ({ value: e.id, label: e.title })), defaultValue: lot.saleEvent?.id },
          { name: 'format', label: 'Format', type: 'select', required: true, options: o(FORMATS), defaultValue: lot.format },
          { name: 'bidBasis', label: 'Bid basis', type: 'select', required: true, options: o(['lot_total', 'per_line']), defaultValue: lot.bidBasis },
          { name: 'awardMode', label: 'Award', type: 'select', required: true, options: o(['manual', 'auto']), defaultValue: lot.awardMode, hint: 'Manual is the default: staff choose the winner.' },
          { name: 'opensAt', label: 'Opens', type: 'datetime', defaultValue: lot.opensAt },
          { name: 'openingBidMinor', label: 'Opening bid', type: 'money', defaultValue: lot.openingBidMinor },
          { name: 'bidIncrementMinor', label: 'Bid increment', type: 'money', defaultValue: lot.bidIncrementMinor },
          { name: 'reserveMinor', label: 'Reserve (never shown to buyers)', type: 'money', defaultValue: lot.reserveMinor },
          { name: 'fixedPriceMinor', label: 'Fixed price', type: 'money', defaultValue: lot.fixedPriceMinor },
        ]
        const lineFields = (l: any = {}): FieldSpec[] => [
          { name: 'lineNumber', label: 'Line', type: 'number', required: true, defaultValue: l.lineNumber ?? lot.lines.length + 1 },
          { name: 'quantity', label: 'Quantity', type: 'number', required: true, defaultValue: l.quantity ?? 1 },
          { name: 'manufacturer', label: 'Manufacturer', defaultValue: l.manufacturer },
          { name: 'model', label: 'Model', defaultValue: l.model },
          { name: 'description', label: 'Description', wide: true, required: true, defaultValue: l.description },
          { name: 'cosmeticGrade', label: 'Cosmetic grade', defaultValue: l.cosmeticGrade },
          { name: 'functionalGrade', label: 'Functional grade', defaultValue: l.functionalGrade },
          { name: 'unit', label: 'Unit', type: 'select', required: true, options: o(['each', 'lb', 'kg']), defaultValue: l.unit ?? 'each' },
          { name: 'notes', label: 'Notes', defaultValue: l.notes },
        ]

        const b = board.ok ? board.data : null
        const activeBids = b ? b.bids.filter((x: any) => x.status === 'active') : []
        const topBid = activeBids.sort((x: any, y: any) => (x.rank ?? 99) - (y.rank ?? 99))[0]
        const liveAward = lot.awards.find((a: any) => a.status === 'active')
        const defaulted = lot.awards.some((a: any) => a.status === 'defaulted')

        return (
          <>
            <Readouts items={[
              { label: 'Status', value: label(lot.status) },
              { label: 'Bids', value: lot.bidCount },
              { label: lot.format === 'sealed_bid' && live ? 'High bid' : 'Current', value: lot.currentAmountMinor === null && lot.format === 'sealed_bid' && live ? 'Sealed' : usd(lot.currentAmountMinor) },
              { label: 'Closes', value: when(lot.closesAt) },
              { label: 'Extensions', value: lot.extensionCount },
            ]} />
            {lot.cancelReason ? <Notice tone="alert">Cancelled: {lot.cancelReason}</Notice> : null}

            {manage ? (
              <Track wrap label="Lot actions">
                {draft ? <OpButton op="publishLot" input={{ lotId: lot.id }} label="Publish lot" variant="primary" confirm="Publish this lot? Format, basis and prices are then fixed." /> : null}
                {live ? <OpDrawer op="postLotAddendum" fixed={{ lotId: lot.id }} title="Post an addendum" description="Every bidder is told. Addenda cannot be edited or removed." trigger="Post addendum" fields={[{ name: 'body', label: 'Addendum', type: 'textarea', required: true }]} submitLabel="Post" /> : null}
                {live ? <OpDrawer op="extendLotClose" fixed={{ lotId: lot.id }} title="Extend the close" trigger="Extend close" fields={[{ name: 'closesAt', label: 'New close', type: 'datetime', required: true, defaultValue: lot.closesAt }, { name: 'reason', label: 'Reason', wide: true }]} submitLabel="Extend" /> : null}
                {live || draft ? <OpDrawer op="cancelLot" fixed={{ lotId: lot.id }} title="Cancel this lot" description="Active bids are voided and bidders are told." trigger="Cancel lot" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} submitLabel="Cancel lot" /> : null}
                {lot.status === 'unsold' ? <OpButton op="relistLot" input={{ lotId: lot.id }} label="Relist as a new draft" variant="primary" /> : null}
                <OpButton op="staffLotManifest" input={{ lotId: lot.id }} label="Download manifest" />
                {draft ? <DeleteButton listKey="Lot" id={lot.id} label="Delete draft" confirm="Delete this draft lot and its lines?" /> : null}
              </Track>
            ) : null}

            <Section title="Details" actions={manage && lot.status !== 'cancelled' && lot.status !== 'completed' ? <ItemDrawer listKey="Lot" id={lot.id} title="Edit details" trigger="Edit details" fields={details} /> : null}>
              <Facts items={[
                ['Category', lot.category?.name], ['Facility', lot.facility?.name], ['Shipping', label(lot.shippingTerms)],
                ['Pallets', lot.palletCount], ['Weight', lot.weight], ['Dimensions', lot.dimensions],
                ['Warranty', lot.warrantyDays ? `${lot.warrantyDays} days` : 'None'], ['Export', lot.exportAllowed ? 'Allowed' : 'Domestic only'], ['Condition', lot.conditionSummary],
              ]} />
              {documentToText(lot.description?.document) ? <p className="mt-3 whitespace-pre-line text-sm">{documentToText(lot.description?.document)}</p> : null}
            </Section>

            <Section title="Format and prices" actions={manage && draft ? <ItemDrawer listKey="Lot" id={lot.id} title="Format and prices" description="These are fixed once the lot is published." trigger="Edit terms" fields={terms} /> : null}>
              <Facts items={[
                ['Format', label(lot.format)], ['Bid basis', label(lot.bidBasis)], ['Award', label(lot.awardMode)], ['Opens', when(lot.opensAt)],
                ['Opening bid', usd(lot.openingBidMinor)], ['Increment', usd(lot.bidIncrementMinor)], ['Reserve', usd(lot.reserveMinor)], ['Fixed price', usd(lot.fixedPriceMinor)],
                ['Original close', when(lot.originalClosesAt)], ['Relisted from', lot.relistedFrom ? <RowLink href={`/dashboard/platform/lots/${lot.relistedFrom.id}`}>{lot.relistedFrom.lotNumber}</RowLink> : ''],
              ]} />
            </Section>

            <Section title="Manifest" count={lot.lines.length} actions={manage && draft ? <ItemDrawer listKey="LotLine" title="Add a line" trigger="Add line" fixed={{ lot: { connect: { id: lot.id } } }} fields={lineFields()} /> : null}>
              {lot.lines.length ? (
                <DataTable label="Manifest lines" head={[{ label: '#' }, { label: 'Item' }, { label: 'Grade' }, { label: 'Qty', className: 'text-right' }, { label: 'Assets', className: 'text-right' }, { label: '' }]}>
                  {lot.lines.map((l: any) => (
                    <tr key={l.id}>
                      <Td className="tabular-nums">{l.lineNumber}</Td>
                      <Td>{[l.manufacturer, l.model].filter(Boolean).join(' ')}<div className="text-xs text-muted-foreground">{l.description}</div></Td>
                      <Td>{[l.cosmeticGrade, l.functionalGrade].filter(Boolean).join(' / ') || '—'}</Td>
                      <Td className="text-right tabular-nums">{l.quantity} {l.unit === 'each' ? '' : l.unit}</Td>
                      <Td className="text-right tabular-nums">{l.assetsCount || '—'}</Td>
                      <Td className="whitespace-nowrap text-right">{manage && draft ? <><ItemDrawer listKey="LotLine" id={l.id} title={`Line ${l.lineNumber}`} trigger="Edit" fields={lineFields(l)} /> <DeleteButton listKey="LotLine" id={l.id} confirm="Remove this line?" /></> : null}</Td>
                    </tr>
                  ))}
                </DataTable>
              ) : <Empty>No lines yet. Add them here, import a manifest, or build the lot from Ready for sale.</Empty>}
            </Section>

            <Section title="Photos" count={lot.images.length} actions={manage && lot.status !== 'completed' ? <OpDrawer op="attachFile" fixed={{ target: 'lot_image', id: lot.id }} title="Add a photo" trigger="Add photo" fields={[{ name: 'file', label: 'Photo', type: 'file', required: true, accept: 'image/*' }, { name: 'caption', label: 'Caption', wide: true }]} submitLabel="Upload" /> : null}>
              {lot.images.length ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {lot.images.map((img: any) => (
                    <li key={img.id} className="grid gap-1 text-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${img.image?.id}`} alt={img.caption || lot.title} className="aspect-[4/3] w-full rounded-[6px] border object-cover" />
                      <span className="flex items-center justify-between gap-2">{img.caption || img.image?.filename}{manage ? <DeleteButton listKey="LotImage" id={img.id} confirm="Remove this photo?" /> : null}</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty>No photos.</Empty>}
            </Section>

            {lot.addenda.length ? (
              <Section title="Addenda" count={lot.addenda.length}>
                <ul className="grid gap-2 text-sm">{lot.addenda.map((a: any) => <li key={a.id} className="rounded-[6px] border px-3 py-2"><div className="text-xs text-muted-foreground">{when(a.postedAt)} · {a.postedBy?.name}</div><p className="whitespace-pre-line">{a.body}</p></li>)}</ul>
              </Section>
            ) : null}

            <Section title="Bid board" count={b ? b.activeCount : undefined} actions={manage && live && lot.bidBasis === 'lot_total' ? (
              <OpDrawer op="placeBidForBuyer" idempotent fixed={{ lotNumber: lot.lotNumber }} title="Enter a bid for a buyer" description="For bids that came by phone or email. It is recorded as placed by you, with your note." trigger="Enter a bid" fields={[
                { name: 'companyId', label: 'Buyer', type: 'select', required: true, options: buyerCompanies.map((c: any) => ({ value: c.id, label: c.legalName })) },
                { name: 'amountMinor', label: 'Amount', type: 'money', required: true },
                { name: 'note', label: 'How it came in', type: 'textarea', required: true, placeholder: 'Phoned in by Dana Ruiz, 10:40' },
              ]} submitLabel="Place bid" />
            ) : null}>
              {!board.ok ? <Notice tone="alert">{board.error}</Notice> : b.sealed ? (
                <Notice>{b.activeCount} sealed bid{b.activeCount === 1 ? '' : 's'}. Amounts and bidders show once the lot closes.</Notice>
              ) : b.bids.length ? (
                <DataTable label="Bids" head={[{ label: 'Rank' }, { label: 'Buyer' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Source' }, { label: 'Placed' }, { label: '' }]}>
                  {b.bids.map((x: any) => (
                    <tr key={x.id}>
                      <Td className="tabular-nums">{x.rank ?? '—'}</Td>
                      <Td>{x.company}{x.strikes ? <div className="text-xs text-red-600">{x.strikes} strike{x.strikes === 1 ? '' : 's'}</div> : null}{x.companyStatus !== 'approved' ? <div className="text-xs text-muted-foreground">{label(x.companyStatus)}</div> : null}</Td>
                      <Td className="text-right tabular-nums">{x.lineCount ? `${x.lineCount} lines · ` : ''}{usd(x.amountMinor)}</Td>
                      <Td><Status value={x.status} /></Td>
                      <Td>{label(x.source)}{x.staffNote ? <div className="text-xs text-muted-foreground">{x.placedBy}: {x.staffNote}</div> : null}</Td>
                      <Td>{when(x.submittedAt)}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {award && lot.status === 'closed' && lot.bidBasis === 'lot_total' && x.status === 'active' ? (
                          lot.reserveMinor !== null && x.amountMinor < lot.reserveMinor
                            ? <OpDrawer op="awardLot" fixed={{ lotId: lot.id, bidId: x.id, confirmBelowReserve: true }} title={`Award to ${x.company} below reserve`} description={`Bid ${usd(x.amountMinor)} is under the reserve of ${usd(lot.reserveMinor)}.`} trigger="Award (below reserve)" fields={[{ name: 'reason', label: 'Why you are accepting it', type: 'textarea', required: true }]} submitLabel="Award" />
                            : <OpButton op="awardLot" input={{ lotId: lot.id, bidId: x.id, ...(x.rank === 1 ? {} : { reason: 'Awarded to a lower bid by staff choice.' }) }} label={x.rank === 1 ? 'Award' : 'Award this bid'} variant={x.rank === 1 ? 'primary' : 'raised'} confirm={`Award ${lot.lotNumber} to ${x.company} for ${usd(x.amountMinor)}? An invoice is issued at once.`} />
                        ) : null}
                        {award && defaulted && !liveAward && x.status === 'active' ? <OpButton op="reAwardToRunnerUp" input={{ lotId: lot.id, bidId: x.id }} label="Offer to this runner-up" confirm={`Award to ${x.company}?`} /> : null}
                      </Td>
                    </tr>
                  ))}
                </DataTable>
              ) : <Empty>No bids yet.</Empty>}
              {award && lot.status === 'closed' && b && !b.sealed && lot.bidBasis === 'per_line' && b.lines.some((l: any) => l.offers.length) ? (
                <div className="mt-4 grid gap-2"><h3 className="text-sm font-semibold">Award by line</h3><AwardGrid lotId={lot.id} lines={b.lines} reserveMinor={b.reserveMinor} /></div>
              ) : null}
              {award && lot.status === 'closed' ? (
                <div className="mt-3"><OpDrawer op="declineLotBids" fixed={{ lotId: lot.id }} title="Decline every bid" description="The lot becomes unsold; bidders are told. You can relist it." trigger="Decline all bids" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea' }]} submitLabel="Decline all" /></div>
              ) : null}
              {award && defaulted && !liveAward && topBid ? <p className="mt-2 text-xs text-muted-foreground">The winner defaulted. Offer the lot to a runner-up above, or relist it.</p> : null}
            </Section>

            {lot.awards.length ? (
              <Section title="Awards" count={lot.awards.length}>
                <DataTable label="Awards" head={[{ label: 'Buyer' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Order' }, { label: 'Awarded' }]}>
                  {lot.awards.map((a: any) => (
                    <tr key={a.id}>
                      <Td>{a.company?.legalName}{a.isBelowReserve ? <div className="text-xs text-muted-foreground">Below reserve: {a.overrideReason}</div> : null}</Td>
                      <Td className="text-right tabular-nums">{usd(a.amountMinor)}</Td>
                      <Td><Status value={a.status} /></Td>
                      <Td>{a.order ? <RowLink href={`/dashboard/platform/orders/${a.order.id}`}>{a.order.orderNumber}</RowLink> : '—'} {a.order ? <span className="text-xs text-muted-foreground">{label(a.order.status)}</span> : null}</Td>
                      <Td>{when(a.awardedAt)}</Td>
                    </tr>
                  ))}
                </DataTable>
              </Section>
            ) : null}
          </>
        )
      }}
    </PlatformPage>
  )
}
