import { PlatformPage, can, day, label, term, usd, when } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Notice, Section, Track } from '../../lib/ui'
import { Facts, param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const REASONS = ['shortage', 'wrong_item', 'misgraded', 'dead_on_arrival', 'damage', 'other']

/** S19: record a buyer's claim with photos, then approve with a refund, or deny it. */
export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'open'
  const claimId = param(sp, 'claim')
  const orderId = param(sp, 'order')
  return (
    <PlatformPage route="/platform/claims" title="Claims" meta="Shortages, wrong items, misgrades and damage reported after release. An approved claim refunds the buyer's payment.">
      {async (staff) => {
        const manage = can(staff, 'canManageLots', 'canAwardLots', 'canManagePayments')
        const released = await listQuery<any>('query { orders(where: { status: { in: [released, completed] } }, orderBy: [{ releasedAt: desc }], take: 100) { id orderNumber claimWindowEndsAt company { legalName } } }')
        const orders = released.ok ? released.data.orders : []
        const record = manage ? (
          <OpDrawer op="openClaim" title="Record a claim" description="For a claim the buyer phoned or emailed in. Photos are kept with the claim." trigger="Record a claim" triggerVariant="primary" fixed={orderId ? { orderId } : undefined} fields={[
            ...(orderId ? [] : [{ name: 'orderId', label: 'Order', type: 'select' as const, required: true, options: orders.map((o: any) => ({ value: o.id, label: `${o.orderNumber} · ${o.company?.legalName}${o.claimWindowEndsAt ? ` (window ends ${day(o.claimWindowEndsAt)})` : ''}` })) }]),
            { name: 'reason', label: 'Reason', type: 'select', required: true, options: REASONS.map((r) => ({ value: r, label: term(r) })) },
            { name: 'requestedAmountMinor', label: 'Amount asked for', type: 'money' },
            { name: 'description', label: 'What the buyer reported', type: 'textarea', required: true },
            { name: 'lines', label: 'Lines (line number | quantity | note)', type: 'lines', columns: [{ key: 'lineNumber', type: 'number' }, { key: 'quantity', type: 'number' }, { key: 'note' }], placeholder: '3 | 2 | two units do not power on' },
            { name: 'photos', label: 'Photos', type: 'files', accept: 'image/*' },
          ]} submitLabel="Record claim" />
        ) : null
        const detail = claimId ? await listQuery<any>('query C($id: ID!) { claim(where: { id: $id }) { id claimNumber status reason description lines requestedAmountMinor resolution approvedAmountMinor resolutionNote resolvedAt resolvedBy { name } openedBy { name } createdAt order { id orderNumber claimWindowEndsAt invoice { payments { id method status amountMinor refundedMinor } } } company { legalName } photos { id caption image { id } } refund { id amountMinor status } } }', { id: claimId }) : null
        const c = detail?.ok ? detail.data.claim : null
        const data = await readTabbedList<any>({ list: 'claims', type: 'Claim', fields: 'id claimNumber status reason requestedAmountMinor approvedAmountMinor createdAt order { id orderNumber } company { legalName }', current: status, where: orderId ? { order: { id: { equals: orderId } } } : {}, orderBy: [{ createdAt: 'asc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'open', label: 'Open', where: { status: { in: ['submitted', 'under_review'] } } },
          { value: 'resolved', label: 'Refunded', where: { status: { in: ['approved', 'resolved'] } } },
          { value: 'denied', label: 'Denied', where: { status: { equals: 'denied' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        const payments = (c?.order?.invoice?.payments ?? []).filter((p: any) => ['captured', 'confirmed', 'partially_refunded'].includes(p.status))
        return (
          <>
            <Track>{record}</Track>
            {detail && !detail.ok ? <Notice tone="alert">{detail.error}</Notice> : null}
            {c ? (
              <Section title={<>{c.claimNumber} <Status value={c.status} /></>} actions={<RowLink href="/dashboard/platform/claims">Close</RowLink>}>
                <Facts items={[
                  ['Buyer', c.company?.legalName], ['Order', <RowLink key="o" href={`/dashboard/platform/orders/${c.order.id}`}>{c.order.orderNumber}</RowLink>], ['Reason', term(c.reason)],
                  ['Asked for', usd(c.requestedAmountMinor)], ['Recorded', `${when(c.createdAt)}${c.openedBy ? ` by ${c.openedBy.name}` : ''}`], ['Claim window', day(c.order.claimWindowEndsAt)],
                  ...(c.resolvedAt ? [
                    ['Resolution', term(c.resolution)], ['Approved', usd(c.approvedAmountMinor)], ['Decided', `${when(c.resolvedAt)} by ${c.resolvedBy?.name ?? ''}`],
                    ['Refund', c.refund ? `${usd(c.refund.amountMinor)} · ${c.refund.status === 'succeeded' ? 'Refunded' : term(c.refund.status)}` : ''],
                  ] as Array<[string, any]> : []),
                ]} />
                <p className="mt-3 whitespace-pre-line text-sm">{c.description}</p>
                {Array.isArray(c.lines) && c.lines.length ? <ul className="mt-2 list-disc pl-5 text-sm">{c.lines.map((l: any, i: number) => <li key={i}>Line {l.lineNumber}, {l.quantity} unit{Number(l.quantity) === 1 ? '' : 's'}{l.note ? `: ${l.note}` : ''}</li>)}</ul> : null}
                {c.resolutionNote ? <p className="mt-2 text-sm text-muted-foreground">{c.resolutionNote}</p> : null}
                {c.photos.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{c.photos.map((p: any) => <a key={p.id} href={`/api/files/${p.image?.id}`} target="_blank" rel="noreferrer"><img src={`/api/files/${p.image?.id}`} alt={p.caption || 'Claim photo'} className="aspect-[4/3] w-full rounded-[6px] border object-cover" /></a>)}</div> : null}
                {manage ? (
                  <Track wrap className="mt-4">
                    {c.status === 'submitted' ? <OpButton op="resolveClaim" input={{ claimId: c.id, action: 'review' }} label="Start review" /> : null}
                    {['submitted', 'under_review'].includes(c.status) ? <OpDrawer op="resolveClaim" idempotent fixed={{ claimId: c.id, action: 'approve' }} title="Approve and refund" description="The refund goes back on the payment you choose (card refunds go through the provider)." trigger="Approve" triggerVariant="primary" fields={[
                      { name: 'resolution', label: 'Resolution', type: 'select', required: true, options: ['refund', 'partial_refund', 'return_and_refund'].map((v) => ({ value: v, label: term(v) })), defaultValue: 'partial_refund' },
                      { name: 'approvedAmountMinor', label: 'Refund amount', type: 'money', required: true, defaultValue: c.requestedAmountMinor },
                      { name: 'paymentId', label: 'Refund against', type: 'select', options: payments.map((p: any) => ({ value: p.id, label: `${term(p.method)} ${usd(p.amountMinor - p.refundedMinor)} left` })), defaultValue: payments.length === 1 ? payments[0].id : undefined },
                      { name: 'note', label: 'Note to the buyer', type: 'textarea' },
                    ]} submitLabel="Approve and refund" /> : null}
                    {['submitted', 'under_review'].includes(c.status) ? <OpDrawer op="resolveClaim" fixed={{ claimId: c.id, action: 'deny' }} title="Deny the claim" trigger="Deny" triggerVariant="danger" fields={[{ name: 'note', label: 'Reason, sent to the buyer', type: 'textarea', required: true }]} submitLabel="Deny" /> : null}
                  </Track>
                ) : null}
              </Section>
            ) : null}
            <TabbedTable label="Claims" path="/dashboard/platform/claims" params={{ status, order: orderId }} data={data} empty="No claims here." head={[{ label: 'Claim' }, { label: 'Buyer' }, { label: 'Reason' }, { label: 'Status' }, { label: 'Asked', className: 'text-right' }, { label: 'Approved', className: 'text-right' }, { label: 'Recorded' }]} row={(x) => (
              <tr key={x.id}>
                <Td className="whitespace-nowrap"><RowLink href={`/dashboard/platform/claims?claim=${x.id}&status=${status}`}>{x.claimNumber}</RowLink><div className="text-xs text-muted-foreground">{x.order?.orderNumber}</div></Td>
                <Td>{x.company?.legalName}</Td><Td>{term(x.reason)}</Td><Td><Status value={x.status} /></Td>
                <Td className="text-right tabular-nums">{usd(x.requestedAmountMinor)}</Td><Td className="text-right tabular-nums">{usd(x.approvedAmountMinor)}</Td><Td>{day(x.createdAt)}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
