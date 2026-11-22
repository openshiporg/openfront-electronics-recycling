import { PlatformPage, day, label, usd, when } from '../../lib/page'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const FIELDS = 'id orderNumber status paymentDueAt removalDueAt releaseMethod preferredPickupDate releaseDetailsSetAt company { id legalName } lot { id lotNumber title } invoice { invoiceNumber totalMinor balanceMinor isOverdue } dockAppointment { startsAt status }'

/** S15: orders by stage. */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'awaiting_payment'
  return (
    <PlatformPage route="/platform/orders" title="Orders" meta="Each award becomes an order: the buyer pays, staff confirm pallets and weight, then release to the driver or carrier.">
      {async () => {
        const data = await readTabbedList<any>({ list: 'orders', type: 'Order', fields: FIELDS, current: status, orderBy: [{ createdAt: 'asc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'awaiting_payment', label: 'Awaiting payment', where: { status: { equals: 'awaiting_payment' } } },
          { value: 'paid', label: 'Paid', where: { status: { equals: 'paid' } } },
          { value: 'ready_for_release', label: 'Ready', where: { status: { equals: 'ready_for_release' } } },
          { value: 'released', label: 'Released', where: { status: { in: ['released', 'completed'] } } },
          { value: 'defaulted', label: 'Defaulted', where: { status: { equals: 'defaulted' } } },
          { value: 'cancelled', label: 'Cancelled', where: { status: { equals: 'cancelled' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        return (
          <TabbedTable label="Orders" path="/dashboard/platform/orders" params={{ status }} data={data} empty="No orders here." head={[{ label: 'Order' }, { label: 'Buyer' }, { label: 'Status' }, { label: 'Total', className: 'text-right' }, { label: 'Balance', className: 'text-right' }, { label: 'Due' }, { label: 'Release' }]} row={(o) => (
            <tr key={o.id}>
              <Td><RowLink href={`/dashboard/platform/orders/${o.id}`}>{o.orderNumber}</RowLink><div className="text-xs text-muted-foreground">{o.lot?.lotNumber} {o.lot?.title}</div></Td>
              <Td>{o.company?.legalName}</Td>
              <Td><Status value={o.status} />{o.invoice?.isOverdue ? <div className="text-xs text-red-600">Overdue</div> : null}</Td>
              <Td className="text-right tabular-nums">{usd(o.invoice?.totalMinor)}</Td>
              <Td className="text-right tabular-nums">{usd(o.invoice?.balanceMinor)}</Td>
              <Td>{o.status === 'awaiting_payment' ? day(o.paymentDueAt) : ['paid', 'ready_for_release'].includes(o.status) ? `Remove by ${day(o.removalDueAt)}` : '—'}</Td>
              <Td>{o.releaseMethod ? label(o.releaseMethod) : <span className="text-muted-foreground">Not set</span>}{o.dockAppointment && o.dockAppointment.status !== 'cancelled' ? <div className="text-xs text-muted-foreground">Dock {when(o.dockAppointment.startsAt)}</div> : o.preferredPickupDate ? <div className="text-xs text-muted-foreground">Wants {day(o.preferredPickupDate)}</div> : null}</Td>
            </tr>
          )} />
        )
      }}
    </PlatformPage>
  )
}
