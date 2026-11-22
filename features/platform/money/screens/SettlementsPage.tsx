import { PlatformPage, can, day, label, term, usd, when } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Track, Td } from '../../lib/ui'
import { Facts, param, readTabbedList, RowLink, Status, TabbedTable, type SearchParams } from '../../lib/view'

const DETAIL = `query S($id: ID!) { settlement(where: { id: $id }) {
  id settlementNumber status feesTotalMinor clientShareTotalMinor netMinor publishedAt disputeNote payoutMethod payoutReference paidAt
  disputeRecordedBy { name } organization { id name } job { id jobNumber pricingModel revenueShareBps } invoice { id invoiceNumber status totalMinor balanceMinor }
  lines(orderBy: [{ createdAt: asc }]) { id kind description quantity grossMinor clientShareBps clientAmountMinor asset { id assetNumber serialNumber } }
} }`

/** M5: build from a processed job, adjust, review, publish, record a dispute, record the payout. */
export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'draft'
  const id = param(sp, 'settlement')
  return (
    <PlatformPage route="/platform/settlements" title="Settlements" meta="What each client is owed (or owes) for a job: service fees against their share of resale and commodity value.">
      {async (staff) => {
        const manage = can(staff, 'canManageSettlements')
        const payout = can(staff, 'canManageSettlements', 'canManagePayments')
        const jobs = await listQuery<any>('query { jobs(where: { AND: [{ status: { in: [received, processing, completed] } }, { settlement: null }, { pricingModel: { not: null } }] }, orderBy: [{ createdAt: asc }], take: 100) { id jobNumber organization { name } } }')
        const detail = id ? await listQuery<any>(DETAIL, { id }) : null
        const s = detail?.ok ? detail.data.settlement : null
        const data = await readTabbedList<any>({ list: 'settlements', type: 'Settlement', fields: 'id settlementNumber status netMinor feesTotalMinor clientShareTotalMinor publishedAt paidAt organization { name } job { jobNumber }', current: status, orderBy: [{ createdAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'draft', label: 'Draft', where: { status: { equals: 'draft' } } },
          { value: 'in_review', label: 'In review', where: { status: { equals: 'in_review' } } },
          { value: 'published', label: 'Published', where: { status: { equals: 'published' } } },
          { value: 'disputed', label: 'Disputed', where: { status: { equals: 'disputed' } } },
          { value: 'paid', label: 'Paid', where: { status: { in: ['paid', 'closed'] } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        const editable = s && ['draft', 'in_review', 'disputed'].includes(s.status)
        return (
          <>
            {manage ? (
              <Track>
                <OpDrawer op="buildSettlement" title="Build a settlement" description="Lines come from the job's quote, its audited assets and commodity weights. Rebuilding keeps your adjustments." trigger="Build from a job" triggerVariant="primary" fields={[
                  { name: 'jobId', label: 'Job', type: 'select', required: true, options: (jobs.ok ? jobs.data.jobs : []).map((j: any) => ({ value: j.id, label: `${j.jobNumber} · ${j.organization?.name}` })) },
                ]} submitLabel="Build" />
              </Track>
            ) : null}
            {detail && !detail.ok ? <Notice tone="alert">{detail.error}</Notice> : null}
            {s ? (
              <Section title={<>{s.settlementNumber} <Status value={s.status} /></>} actions={<RowLink href={`/dashboard/platform/settlements?status=${status}`}>Close</RowLink>}>
                <Facts items={[
                  ['Client', s.organization?.name], ['Job', s.job ? <RowLink key="j" href={`/dashboard/platform/jobs/${s.job.id}`}>{s.job.jobNumber}</RowLink> : ''], ['Pricing', s.job ? `${label(s.job.pricingModel)}${s.job.revenueShareBps ? ` · client ${s.job.revenueShareBps / 100}%` : ''}` : ''],
                  ['Fees', usd(s.feesTotalMinor)], ['Client share', usd(s.clientShareTotalMinor)], ['Net', s.netMinor >= 0 ? `${usd(s.netMinor)} to the client` : `${usd(-s.netMinor)} owed by the client`],
                  ['Published', when(s.publishedAt)], ['Invoice', s.invoice ? `${s.invoice.invoiceNumber} · ${label(s.invoice.status)}` : ''], ['Paid out', s.paidAt ? `${day(s.paidAt)} · ${label(s.payoutMethod)} ${s.payoutReference}` : ''],
                ]} />
                {s.disputeNote ? <Notice className="mt-3">Disputed{s.disputeRecordedBy ? ` (recorded by ${s.disputeRecordedBy.name})` : ''}: {s.disputeNote}</Notice> : null}
                <div className="mt-4">
                  {s.lines.length ? (
                    <DataTable label="Settlement lines" head={[{ label: 'Line' }, { label: 'Kind' }, { label: 'Qty', className: 'text-right' }, { label: 'Gross', className: 'text-right' }, { label: 'Share', className: 'text-right' }, { label: 'Client', className: 'text-right' }, { label: '' }]}>
                      {s.lines.map((l: any) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 text-sm">{l.description}{l.asset ? <div className="text-xs text-muted-foreground">{l.asset.assetNumber} {l.asset.serialNumber}</div> : null}</td>
                          <Td>{term(l.kind)}</Td><Td className="text-right tabular-nums">{Number(l.quantity)}</Td><Td className="text-right tabular-nums">{usd(l.grossMinor)}</Td>
                          <Td className="text-right tabular-nums">{l.kind === 'service_fee' ? '—' : `${(l.clientShareBps ?? 0) / 100}%`}</Td><Td className="text-right tabular-nums">{usd(l.clientAmountMinor)}</Td>
                          <Td className="text-right">{manage && editable && l.kind === 'adjustment' ? <OpButton op="removeSettlementLine" input={{ lineId: l.id }} label="Remove" variant="danger" confirm="Remove this adjustment?" /> : null}</Td>
                        </tr>
                      ))}
                    </DataTable>
                  ) : <Empty>No lines. Rebuild from the job.</Empty>}
                </div>
                {manage ? (
                  <Track wrap className="mt-4">
                    {editable && s.job ? <OpButton op="buildSettlement" input={{ jobId: s.job.id }} label="Rebuild from the job" /> : null}
                    {editable ? <OpDrawer op="addSettlementLine" fixed={{ settlementId: s.id }} title="Add an adjustment" description="A positive client amount is owed to the client; a negative one is charged." trigger="Add adjustment" fields={[
                      { name: 'line.kind', label: 'Kind', type: 'hidden', defaultValue: 'adjustment' },
                      { name: 'line.description', label: 'Description', required: true, wide: true },
                      { name: 'line.quantity', label: 'Quantity', type: 'number', defaultValue: 1 },
                      { name: 'line.grossMinor', label: 'Amount', type: 'money', required: true, hint: 'Negative to charge the client.' },
                      { name: 'line.clientShareBps', label: 'Client share (%)', type: 'percent', defaultValue: 10000 },
                    ]} submitLabel="Add" /> : null}
                    {s.status === 'draft' ? <OpButton op="submitSettlementForReview" input={{ settlementId: s.id }} label="Send for review" /> : null}
                    {['draft', 'in_review', 'disputed'].includes(s.status) ? <OpButton op="publishSettlement" input={{ settlementId: s.id }} label={s.status === 'disputed' ? 'Republish' : 'Publish to the client'} variant="primary" confirm="Publish? The client sees it in their portal and, if they owe a balance, gets an invoice." /> : null}
                    {s.status === 'published' ? <OpDrawer op="recordSettlementDispute" fixed={{ settlementId: s.id }} title="Record the client's dispute" trigger="Record a dispute" fields={[{ name: 'note', label: 'What the client disputes', type: 'textarea', required: true }]} submitLabel="Record" /> : null}
                    <OpButton op="staffDownloadFile" input={{ kind: 'settlement', id: s.id }} label="PDF" />
                  </Track>
                ) : null}
                {payout && s.status === 'published' && s.netMinor >= 0 ? (
                  <div className="mt-3"><OpDrawer op="recordSettlementPayout" fixed={{ settlementId: s.id }} title={`Record the payout of ${usd(s.netMinor)}`} trigger="Record payout" triggerVariant="primary" fields={[
                    { name: 'method', label: 'Method', type: 'select', required: true, options: ['cheque', 'ach', 'wire', 'credit'].map((m) => ({ value: m, label: term(m) })) },
                    { name: 'reference', label: 'Reference', required: true },
                  ]} submitLabel="Record payout" /></div>
                ) : null}
              </Section>
            ) : null}
            <TabbedTable label="Settlements" path="/dashboard/platform/settlements" params={{ status }} data={data} empty="No settlements here." head={[{ label: 'Settlement' }, { label: 'Client' }, { label: 'Status' }, { label: 'Fees', className: 'text-right' }, { label: 'Client share', className: 'text-right' }, { label: 'Net', className: 'text-right' }, { label: 'Published' }]} row={(x) => (
              <tr key={x.id}>
                <Td><RowLink href={`/dashboard/platform/settlements?status=${status}&settlement=${x.id}`}>{x.settlementNumber}</RowLink><div className="text-xs text-muted-foreground">{x.job?.jobNumber}</div></Td>
                <Td>{x.organization?.name}</Td><Td><Status value={x.status} /></Td>
                <Td className="text-right tabular-nums">{usd(x.feesTotalMinor)}</Td><Td className="text-right tabular-nums">{usd(x.clientShareTotalMinor)}</Td><Td className="text-right tabular-nums">{usd(x.netMinor)}</Td><Td>{day(x.publishedAt)}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
