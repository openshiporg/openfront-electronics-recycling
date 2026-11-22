import { PlatformPage, can, day, label, term, usd, when, storeToday } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Track, Td } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, type SearchParams } from '../../lib/view'

const PAY_FIELDS = 'id method status amountMinor refundedMinor providerReference bankReference paidOn reportedAt confirmedAt rejectionReason createdAt reportedBy { name } confirmedBy { name } invoice { id invoiceNumber kind totalMinor balanceMinor buyerCompany { legalName } clientOrganization { name } }'

/** M2 transfers and cheques, M3 card results to check, M4 refunds. */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'reported'
  const invoiceNumber = param(sp, 'invoice')
  return (
    <PlatformPage route="/platform/payments" title="Payments" meta="A reported transfer is not money until you confirm it against the bank statement. Card payments confirm themselves through the provider.">
      {async (staff) => {
        const pay = can(staff, 'canManagePayments')
        const refund = can(staff, 'canRefund')
        const unpaid = await listQuery<any>('query U($where: InvoiceWhereInput!) { invoices(where: $where, orderBy: [{ dueAt: asc }], take: 100) { id invoiceNumber balanceMinor buyerCompany { legalName } clientOrganization { name } } }', { where: { status: { in: ['open', 'partially_paid'] }, ...(invoiceNumber ? { invoiceNumber: { equals: invoiceNumber } } : {}) } })
        const invoices = unpaid.ok ? unpaid.data.invoices : []
        const sessions = await listQuery<any>('query { paymentSessions(where: { status: { in: [unknown, requires_action, pending] } }, orderBy: [{ createdAt: asc }], take: 50) { id status method amountMinor lastError createdAt providerPaymentId invoice { invoiceNumber buyerCompany { legalName } clientOrganization { name } } } }')
        const data = await readTabbedList<any>({ list: 'payments', type: 'Payment', fields: PAY_FIELDS, current: status, where: invoiceNumber ? { invoice: { invoiceNumber: { equals: invoiceNumber } } } : {}, orderBy: [{ createdAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'reported', label: 'To confirm', where: { status: { equals: 'reported' } } },
          { value: 'received', label: 'Received', where: { status: { in: ['confirmed', 'captured'] } } },
          { value: 'refunded', label: 'Refunded', where: { status: { in: ['refunded', 'partially_refunded'] } } },
          { value: 'rejected', label: 'Rejected', where: { status: { equals: 'rejected' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        const who = (i: any) => i?.buyerCompany?.legalName ?? i?.clientOrganization?.name ?? ''
        return (
          <>
            {pay ? (
              <Track wrap>
                <OpDrawer op="recordOfflinePayment" title="Record a payment received" description="A cheque, cash, or a transfer the customer did not report. Recorded as received." trigger="Record a payment" triggerVariant="primary" fields={[
                  { name: 'invoiceId', label: 'Invoice', type: 'select', required: true, options: invoices.map((i: any) => ({ value: i.id, label: `${i.invoiceNumber} · ${who(i)} · ${usd(i.balanceMinor)} due` })), defaultValue: invoices.length === 1 ? invoices[0].id : undefined },
                  { name: 'method', label: 'Method', type: 'select', required: true, options: ['cheque', 'wire', 'ach', 'cash'].map((m) => ({ value: m, label: term(m) })), defaultValue: 'cheque' },
                  { name: 'amountMinor', label: 'Amount', type: 'money', required: true, defaultValue: invoices.length === 1 ? invoices[0].balanceMinor : undefined },
                  { name: 'reference', label: 'Cheque or bank reference', required: true },
                  { name: 'paidOn', label: 'Received on', type: 'date', required: true, defaultValue: storeToday() },
                ]} submitLabel="Record" />
                {invoiceNumber ? <RowLink href="/dashboard/platform/payments">Show every invoice</RowLink> : null}
              </Track>
            ) : null}

            {sessions.ok && sessions.data.paymentSessions.length ? (
              <Section title="Card payments to check" count={sessions.data.paymentSessions.length}>
                <DataTable label="Card sessions" head={[{ label: 'Invoice' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Started' }, { label: '' }]}>
                  {sessions.data.paymentSessions.map((s: any) => (
                    <tr key={s.id}>
                      <Td>{s.invoice?.invoiceNumber}<div className="text-xs text-muted-foreground">{who(s.invoice)}</div></Td>
                      <Td className="text-right tabular-nums">{usd(s.amountMinor)}</Td>
                      <Td><Status value={s.status} />{s.lastError ? <div className="max-w-xs text-xs text-muted-foreground">{s.lastError}</div> : null}</Td>
                      <Td>{when(s.createdAt)}</Td>
                      <Td className="text-right">{pay ? <OpButton op="checkPaymentSession" input={{ paymentSessionId: s.id }} label="Check with the provider" /> : null}</Td>
                    </tr>
                  ))}
                </DataTable>
              </Section>
            ) : null}
            {!sessions.ok ? <Notice tone="alert">{sessions.error}</Notice> : null}

            <TabbedTable label="Payments" path="/dashboard/platform/payments" params={{ status, invoice: invoiceNumber }} data={data} empty={<Empty>No payments here.</Empty>} head={[{ label: 'Invoice' }, { label: 'Method' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Reference' }, { label: 'Paid on' }, { label: '' }]} row={(p) => (
              <tr key={p.id}>
                <Td>{p.invoice?.invoiceNumber}<div className="text-xs text-muted-foreground">{who(p.invoice)}</div></Td>
                <Td>{term(p.method)}</Td>
                <Td className="text-right tabular-nums">{usd(p.amountMinor)}{p.refundedMinor ? <div className="text-xs text-muted-foreground">{usd(p.refundedMinor)} refunded</div> : null}</Td>
                <Td><Status value={p.status} />{p.rejectionReason ? <div className="max-w-xs text-xs text-muted-foreground">{p.rejectionReason}</div> : null}{p.confirmedBy ? <div className="text-xs text-muted-foreground">by {p.confirmedBy.name}</div> : null}</Td>
                <Td className="max-w-[12rem] break-words">{p.bankReference || p.providerReference || '—'}</Td>
                <Td>{day(p.paidOn)}{p.reportedAt ? <div className="text-xs text-muted-foreground">Reported {when(p.reportedAt)}</div> : null}</Td>
                <Td className="whitespace-nowrap text-right">
                  {pay && p.status === 'reported' ? <>
                    <OpDrawer op="confirmBankTransfer" fixed={{ paymentId: p.id }} title={`Confirm ${usd(p.amountMinor)} on ${p.invoice?.invoiceNumber}`} description="Only confirm once it is on the bank statement. If the amount differs, enter what arrived." trigger="Confirm" triggerVariant="primary" fields={[
                      { name: 'bankReference', label: 'Bank reference', defaultValue: p.bankReference },
                      { name: 'paidOn', label: 'Arrived on', type: 'date', defaultValue: p.paidOn },
                      { name: 'amountMinor', label: 'Amount received', type: 'money', defaultValue: p.amountMinor },
                    ]} submitLabel="Confirm received" />
                    <OpDrawer op="rejectBankTransfer" fixed={{ paymentId: p.id }} title="Not received" description="The buyer is told and the invoice stays unpaid." trigger="Reject" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Nothing matching this reference on the statement for 2 business days.' }]} submitLabel="Reject" />
                  </> : null}
                  {refund && ['confirmed', 'captured', 'partially_refunded'].includes(p.status) && p.amountMinor > p.refundedMinor ? (
                    <OpDrawer op="refundPayment" idempotent fixed={{ paymentId: p.id }} title={`Refund on ${p.invoice?.invoiceNumber}`} description={p.method === 'card' ? 'The refund goes back to the card through the provider.' : 'Send the money yourself; this records it.'} trigger="Refund" fields={[
                      { name: 'amountMinor', label: 'Amount', type: 'money', required: true, defaultValue: p.amountMinor - p.refundedMinor, hint: `At most ${usd(p.amountMinor - p.refundedMinor)}` },
                      { name: 'reason', label: 'Reason', type: 'textarea', required: true },
                    ]} submitLabel="Refund" />
                  ) : null}
                </Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
