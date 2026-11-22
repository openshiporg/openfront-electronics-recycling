import { notFound } from 'next/navigation'
import { PlatformPage, can, day, label, term, usd, weight, when } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Track, Td } from '../../lib/ui'
import { Facts, RowLink, Status } from '../../lib/view'
import { ReleaseForm } from './ReleaseForm'

const Q = `query Order($id: ID!) {
  order(where: { id: $id }) {
    id orderNumber status paymentDueAt readyAt removalDueAt releaseMethod preferredPickupDate carrierName carrierReference freightPickupDate destinationCountry exportAcknowledgedAt releaseDetailsSetAt
    palletCount weight dimensions billOfLading releasedAt driverName claimWindowEndsAt runnerUpOfferedAt cancelReason
    releasedBy { name } driverSignature { id }
    company { id legalName strikes } lot { id lotNumber title facility { id name } }
    award { id amountMinor isBelowReserve }
    lines(orderBy: [{ lineNumber: asc }]) { id lineNumber description manufacturer model grade quantity unit unitPriceMinor totalMinor }
    invoice { id invoiceNumber status totalMinor paidMinor balanceMinor dueAt isOverdue lines(orderBy: [{ createdAt: asc }]) { id kind description quantity unitPriceMinor totalMinor } payments { id method status amountMinor paidOn } }
    restockingInvoice { id invoiceNumber status totalMinor waived }
    dockAppointment { id startsAt endsAt status driverName }
    claims { id claimNumber status reason requestedAmountMinor }
  }
}`

/** S16 ready, S18 release, S20 default and restocking fee, plus links to claims and the dock. */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const read = await listQuery<any>(Q, { id })
  if (read.ok && !read.data.order) notFound()
  const o = read.ok ? read.data.order : null
  return (
    <PlatformPage route="/platform/orders" title={o ? `${o.orderNumber} · ${o.company?.legalName}` : 'Order'} crumbs={[{ label: o?.orderNumber ?? 'Order' }]} meta={o ? `${o.lot?.lotNumber} ${o.lot?.title}` : undefined}>
      {async (staff) => {
        if (!read.ok) return <Notice tone="alert">{read.error}</Notice>
        const inv = o.invoice
        const manage = can(staff, 'canManageLots', 'canManagePayments')
        const release = can(staff, 'canManageLots', 'canReceive', 'canDispatch')
        const open = !['released', 'completed', 'defaulted', 'cancelled'].includes(o.status)
        return (
          <>
            <Readouts items={[
              { label: 'Status', value: term(o.status) }, { label: 'Total', value: usd(inv?.totalMinor) }, { label: 'Balance', value: usd(inv?.balanceMinor), tone: inv?.isOverdue ? 'alert' : undefined },
              { label: o.status === 'awaiting_payment' ? 'Pay by' : 'Remove by', value: day(o.status === 'awaiting_payment' ? o.paymentDueAt : o.removalDueAt) },
            ]} />
            {o.cancelReason ? <Notice tone="alert">{o.cancelReason}</Notice> : null}
            <Track wrap label="Order actions">
              {manage && inv && open && inv.status !== 'paid' ? <OpDrawer op="addInvoiceLine" fixed={{ invoiceId: inv.id }} title="Add a charge" description="Freight, storage or another agreed charge on this invoice." trigger="Add charge" fields={[
                { name: 'kind', label: 'Kind', type: 'select', required: true, options: ['freight', 'storage', 'service', 'adjustment'].map((v) => ({ value: v, label: term(v) })), defaultValue: 'freight' },
                { name: 'description', label: 'Description', required: true, wide: true },
                { name: 'quantity', label: 'Quantity', type: 'number', defaultValue: 1 },
                { name: 'unitPriceMinor', label: 'Unit price', type: 'money', required: true },
              ]} submitLabel="Add" /> : null}
              {release && o.status === 'paid' ? <OpDrawer op="markOrderReady" fixed={{ orderId: o.id }} title="Mark ready for release" description="Confirm what is on the dock. The buyer is told it is ready." trigger="Mark ready" triggerVariant="primary" fields={[
                { name: 'palletCount', label: 'Pallets', type: 'number', defaultValue: o.palletCount },
                { name: 'weight', label: 'Weight (lb)', type: 'number', defaultValue: o.weight },
                { name: 'dimensions', label: 'Dimensions', defaultValue: o.dimensions },
              ]} submitLabel="Mark ready" /> : null}
              {manage && o.status === 'awaiting_payment' ? <OpDrawer op="defaultOrder" fixed={{ orderId: o.id }} title="Default this order" description="The award is voided, the buyer gets a strike, and a restocking fee is invoiced unless you waive it. You can then offer the lot to the runner-up." trigger="Default" triggerVariant="danger" fields={[
                { name: 'reason', label: 'Reason', type: 'textarea', required: true },
                { name: 'waiveFee', label: 'Waive the restocking fee', type: 'checkbox' },
              ]} submitLabel="Default order" /> : null}
              {manage && o.restockingInvoice && !o.restockingInvoice.waived && o.restockingInvoice.status !== 'paid' && o.restockingInvoice.status !== 'void' ? <OpDrawer op="waiveRestockingFee" fixed={{ orderId: o.id }} title="Waive the restocking fee" trigger="Waive restocking fee" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} submitLabel="Waive" /> : null}
              {manage && open && o.status !== 'ready_for_release' ? <OpDrawer op="cancelOrder" fixed={{ orderId: o.id }} title="Cancel this order" description="Use for a mistake on our side. No strike is given." trigger="Cancel order" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} submitLabel="Cancel order" /> : null}
              {o.status === 'awaiting_payment' && inv ? <RowLink href={`/dashboard/platform/payments?invoice=${inv.invoiceNumber}`}>Record a payment</RowLink> : null}
              {['released', 'completed'].includes(o.status) ? <RowLink href={`/dashboard/platform/claims?order=${o.id}`}>Record a claim</RowLink> : null}
              {['paid', 'ready_for_release', 'released', 'completed'].includes(o.status) ? <><OpButton op="staffOrderDocument" input={{ orderId: o.id, kind: 'packing_list' }} label="Packing list" /><OpButton op="staffOrderDocument" input={{ orderId: o.id, kind: 'bill_of_lading' }} label="Bill of lading" /></> : null}
              {o.lot?.id ? <RowLink href={`/dashboard/platform/lots/${o.lot.id}`}>Open the lot</RowLink> : null}
            </Track>

            <Section title="Lines" count={o.lines.length}>
              <DataTable label="Order lines" head={[{ label: '#' }, { label: 'Item' }, { label: 'Qty', className: 'text-right' }, { label: 'Price', className: 'text-right' }, { label: 'Total', className: 'text-right' }]}>
                {o.lines.map((l: any) => <tr key={l.id}><Td className="tabular-nums">{l.lineNumber}</Td><Td>{[l.manufacturer, l.model].filter(Boolean).join(' ')}<div className="text-xs text-muted-foreground">{l.description}{l.grade ? ` · ${l.grade}` : ''}</div></Td><Td className="text-right tabular-nums">{l.quantity}</Td><Td className="text-right tabular-nums">{usd(l.unitPriceMinor)}</Td><Td className="text-right tabular-nums">{usd(l.totalMinor)}</Td></tr>)}
              </DataTable>
            </Section>

            {inv ? (
              <Section title={<>Invoice {inv.invoiceNumber} <Status value={inv.status} /></>} actions={<OpButton op="staffInvoicePdf" input={{ invoiceId: inv.id }} label="Invoice PDF" />}>
                <DataTable label="Invoice lines" head={[{ label: 'Charge' }, { label: 'Kind' }, { label: 'Qty', className: 'text-right' }, { label: 'Total', className: 'text-right' }]}>
                  {inv.lines.map((l: any) => <tr key={l.id}><Td>{l.description}</Td><Td>{term(l.kind)}</Td><Td className="text-right tabular-nums">{l.quantity}</Td><Td className="text-right tabular-nums">{usd(l.totalMinor)}</Td></tr>)}
                </DataTable>
                <p className="mt-2 text-sm">Due {day(inv.dueAt)} · paid {usd(inv.paidMinor)} · balance {usd(inv.balanceMinor)}</p>
                {inv.payments.length ? <ul className="mt-2 text-sm">{inv.payments.map((p: any) => <li key={p.id}>{label(p.method)} {usd(p.amountMinor)} · {label(p.status)} {p.paidOn ? `· ${day(p.paidOn)}` : ''}</li>)}</ul> : null}
              </Section>
            ) : null}

            <Section title="Release">
              <Facts items={[
                ['Method', term(o.releaseMethod)], ['Details set', when(o.releaseDetailsSetAt)], ['Preferred date', day(o.preferredPickupDate)],
                ['Driver', o.driverName], ['Carrier', [o.carrierName, o.carrierReference].filter(Boolean).join(' · ')], ['Freight pickup', day(o.freightPickupDate)],
                ['Destination', o.destinationCountry], ['Export acknowledged', when(o.exportAcknowledgedAt)], ['Pickup from', o.lot?.facility?.name],
                ['Pallets', o.palletCount], ['Weight', weight(o.weight)], ['Dimensions', o.dimensions],
                ['Dock slot', o.dockAppointment && o.dockAppointment.status !== 'cancelled' ? `${when(o.dockAppointment.startsAt)} (${label(o.dockAppointment.status)})` : <RowLink href={`/dashboard/platform/dock${o.lot?.facility ? `?facility=${o.lot.facility.id}` : ''}`}>Book on the dock calendar</RowLink>],
                ['Released', o.releasedAt ? `${when(o.releasedAt)} by ${o.releasedBy?.name ?? ''}` : ''], ['Bill of lading', o.billOfLading], ['Claims until', day(o.claimWindowEndsAt)],
              ]} />
              {o.driverSignature ? <img src={`/api/files/${o.driverSignature.id}`} alt="Driver signature" className="mt-3 h-20 rounded border bg-white" /> : null}
              {release && o.status === 'ready_for_release' ? <div className="mt-4"><ReleaseForm orderId={o.id} driverName={o.driverName} billOfLading={o.billOfLading} /></div> : null}
            </Section>

            <Section title="Claims" count={o.claims.length}>
              {o.claims.length ? <ul className="grid gap-1 text-sm">{o.claims.map((c: any) => <li key={c.id}><RowLink href={`/dashboard/platform/claims?claim=${c.id}`}>{c.claimNumber}</RowLink> · {label(c.reason)} · <Status value={c.status} /> · {usd(c.requestedAmountMinor)}</li>)}</ul> : <Empty>No claims.</Empty>}
            </Section>
          </>
        )
      }}
    </PlatformPage>
  )
}
