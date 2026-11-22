import { PlatformPage, day, label, term } from '../../lib/page'
import { OpDrawer } from '../../lib/forms'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const FIELDS = 'id legalName tradingName city region countryCode status taxStatus strikes submittedAt approvedAt documentsCount pending: documentsCount(where: { status: { equals: submitted } }) usersCount'

/** S1: applications queue, with every approved / suspended buyer one tab away. */
export default async function BuyersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'queue'
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/buyers" title="Buyers" meta="Review applications and their documents, then manage approved buyers: tax status, spend limit, strikes and suspension.">
      {async () => {
        const data = await readTabbedList<any>({ list: 'buyerCompanies', type: 'BuyerCompany', fields: FIELDS, current: status, orderBy: [{ submittedAt: 'asc' }], page: Number(param(sp, 'page')) || 1,
          where: q ? { OR: [{ legalName: { contains: q, mode: 'insensitive' } }, { tradingName: { contains: q, mode: 'insensitive' } }] } : {},
          tabs: [
            { value: 'queue', label: 'To review', where: { status: { in: ['submitted', 'under_review'] } } },
            { value: 'needs_info', label: 'Waiting on buyer', where: { status: { equals: 'needs_info' } } },
            { value: 'approved', label: 'Approved', where: { status: { equals: 'approved' } } },
            { value: 'suspended', label: 'Suspended', where: { status: { equals: 'suspended' } } },
            { value: 'rejected', label: 'Rejected', where: { status: { equals: 'rejected' } } },
            { value: 'draft', label: 'Not submitted', where: { status: { equals: 'draft' } } },
            { value: 'all', label: 'All', where: {} },
          ] })
        return (
          <>
            <form className="flex gap-2" action="/dashboard/platform/buyers">
              <input type="hidden" name="status" value={status} />
              <input name="q" defaultValue={q} placeholder="Company name" className="h-9 w-64 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
              <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
            </form>
            <TabbedTable label="Buyers" path="/dashboard/platform/buyers" params={{ status, q }} data={data} empty="No buyers here." head={[{ label: 'Company' }, { label: 'Status' }, { label: 'Documents' }, { label: 'Strikes', className: 'text-right' }, { label: 'Submitted' }, { label: '' }]} row={(c) => (
              <tr key={c.id}>
                <Td><RowLink href={`/dashboard/platform/buyers/${c.id}`}>{c.legalName}</RowLink><div className="text-xs text-muted-foreground">{[c.city, c.region, c.countryCode].filter(Boolean).join(', ')}</div></Td>
                <Td><Status value={c.status} /><div className="text-xs text-muted-foreground">{label(c.taxStatus)}</div></Td>
                <Td>{c.documentsCount}{c.pending ? <span className="text-xs text-amber-700 dark:text-amber-400"> ({c.pending} to check)</span> : null}</Td>
                <Td className="text-right tabular-nums">{c.strikes}</Td>
                <Td>{day(c.submittedAt)}</Td>
                <Td className="whitespace-nowrap text-right">
                  {['submitted', 'under_review'].includes(c.status) ? <OpDrawer op="reviewBuyerApplication" fixed={{ companyId: c.id, action: 'approve' }} title={`Approve ${c.legalName}`} description="They can bid as soon as this is saved." trigger="Approve" triggerVariant="primary" fields={[
                    { name: 'taxStatus', label: 'Tax status', type: 'select', required: true, options: ['taxable', 'exempt_resale', 'export'].map((v) => ({ value: v, label: term(v) })), defaultValue: c.taxStatus },
                    { name: 'spendLimitMinor', label: 'Spend limit', type: 'money', hint: 'Leave empty for no limit.' },
                    { name: 'message', label: 'Message to the buyer', type: 'textarea' },
                  ]} submitLabel="Approve" /> : null}
                </Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
