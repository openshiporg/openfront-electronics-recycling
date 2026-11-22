import { PlatformPage, can, day, label, usd } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const KINDS = ['lot_sale', 'service', 'settlement', 'restocking', 'storage']

/** M1: every invoice, by status and kind; PDF and void. */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'open'
  const kind = param(sp, 'kind')
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/invoices" title="Invoices" meta="Lot sales to buyers, service and settlement invoices to clients, restocking and storage fees.">
      {async (staff) => {
        const where: Record<string, unknown> = {}
        if (KINDS.includes(kind)) where.kind = { equals: kind }
        if (q) where.OR = [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { buyerCompany: { legalName: { contains: q, mode: 'insensitive' } } }, { clientOrganization: { name: { contains: q, mode: 'insensitive' } } }]
        const data = await readTabbedList<any>({ list: 'invoices', type: 'Invoice', fields: 'id invoiceNumber kind status totalMinor paidMinor balanceMinor issuedAt dueAt isOverdue voidReason buyerCompany { id legalName } clientOrganization { id name } order { id orderNumber } job { id jobNumber }', current: status, where, orderBy: [{ issuedAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'open', label: 'Unpaid', where: { status: { in: ['open', 'partially_paid'] } } },
          { value: 'overdue', label: 'Overdue', where: { status: { in: ['open', 'partially_paid'] }, dueAt: { lt: new Date().toISOString() } } },
          { value: 'paid', label: 'Paid', where: { status: { equals: 'paid' } } },
          { value: 'refunded', label: 'Refunded', where: { status: { in: ['refunded', 'partially_refunded'] } } },
          { value: 'void', label: 'Void', where: { status: { equals: 'void' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        const pay = can(staff, 'canManagePayments')
        return (
          <>
            <form className="flex flex-wrap gap-2" action="/dashboard/platform/invoices">
              <input type="hidden" name="status" value={status} />
              <input name="q" defaultValue={q} placeholder="Invoice number or customer" className="h-9 w-64 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
              <select name="kind" defaultValue={kind} className="h-9 rounded-[6px] border bg-background px-3 text-sm"><option value="">Every kind</option>{KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}</select>
              <button className="h-9 rounded-[6px] border px-3 text-sm">Filter</button>
            </form>
            <TabbedTable label="Invoices" path="/dashboard/platform/invoices" params={{ status, kind, q }} data={data} empty="No invoices here." head={[{ label: 'Invoice' }, { label: 'Customer' }, { label: 'Status' }, { label: 'Total', className: 'text-right' }, { label: 'Balance', className: 'text-right' }, { label: 'Due' }, { label: '' }]} row={(i) => (
              <tr key={i.id}>
                <Td><span className="font-medium">{i.invoiceNumber}</span><div className="text-xs text-muted-foreground">{label(i.kind)}{i.order ? <> · <RowLink href={`/dashboard/platform/orders/${i.order.id}`}>{i.order.orderNumber}</RowLink></> : null}{i.job ? <> · <RowLink href={`/dashboard/platform/jobs/${i.job.id}`}>{i.job.jobNumber}</RowLink></> : null}</div></Td>
                <Td>{i.buyerCompany ? <RowLink href={`/dashboard/platform/buyers/${i.buyerCompany.id}`}>{i.buyerCompany.legalName}</RowLink> : i.clientOrganization ? <RowLink href={`/dashboard/platform/clients?org=${i.clientOrganization.id}`}>{i.clientOrganization.name}</RowLink> : '—'}</Td>
                <Td><Status value={i.status} />{i.isOverdue ? <div className="text-xs text-red-600">Overdue</div> : null}{i.voidReason ? <div className="text-xs text-muted-foreground">{i.voidReason}</div> : null}</Td>
                <Td className="text-right tabular-nums">{usd(i.totalMinor)}</Td>
                <Td className="text-right tabular-nums">{usd(i.balanceMinor)}</Td>
                <Td>{day(i.dueAt)}<div className="text-xs text-muted-foreground">Issued {day(i.issuedAt)}</div></Td>
                <Td className="whitespace-nowrap text-right">
                  <OpButton op="staffInvoicePdf" input={{ invoiceId: i.id }} label="PDF" />
                  {pay && ['open', 'partially_paid'].includes(i.status) ? <RowLink href={`/dashboard/platform/payments?invoice=${i.invoiceNumber}`}> Record payment</RowLink> : null}
                  {pay && i.status === 'open' && i.paidMinor === 0 ? <OpDrawer op="voidInvoice" fixed={{ invoiceId: i.id }} title={`Void ${i.invoiceNumber}`} description="A void invoice stays on record and can no longer be paid." trigger="Void" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} submitLabel="Void" /> : null}
                </Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
