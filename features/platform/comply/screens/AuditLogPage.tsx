import { PlatformPage, when } from '../../lib/page'
import { param, readTabbedList, TabbedTable, Td, type SearchParams } from '../../lib/view'

const GROUPS: Record<string, string> = { bid: 'Bids and awards', lot: 'Lots', payment: 'Payments', invoice: 'Invoices', refund: 'Refunds', settlement: 'Settlements', certificate: 'Certificates', job: 'Jobs', asset: 'Assets', buyer: 'Buyers', settings: 'Settings', user: 'People' }

const brief = (v: unknown) => {
  if (v == null) return ''
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 240 ? `${s.slice(0, 240)}…` : s
}

/** Y7: who did what, to what, when, with before and after. Append-only. */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const group = param(sp, 'area') || 'all'
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/audit-log" title="Audit log" meta="Every money, award, certificate, custody and settings change. Entries are never edited or removed.">
      {async () => {
        const where = q ? { OR: [{ entityId: { equals: q } }, { actorLabel: { contains: q, mode: 'insensitive' } }, { action: { contains: q, mode: 'insensitive' } }, { reason: { contains: q, mode: 'insensitive' } }] } : {}
        const data = await readTabbedList<any>({ list: 'auditEvents', type: 'AuditEvent', fields: 'id action entityType entityId before after reason actorLabel ipAddress occurredAt actor { name email }', current: group, where, orderBy: [{ occurredAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'all', label: 'All', where: {} },
          ...Object.entries(GROUPS).map(([value, label]) => ({ value, label, where: { action: { startsWith: `${value}.` } } })),
        ] })
        return (
          <>
            <form className="flex gap-2" action="/dashboard/platform/audit-log">
              <input type="hidden" name="area" value={group} />
              <input name="q" defaultValue={q} placeholder="Person, action, reason or record id" className="h-9 w-72 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
              <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
            </form>
            <TabbedTable label="Audit log" tabKey="area" path="/dashboard/platform/audit-log" params={{ area: group, q }} data={data} empty="No entries." head={[{ label: 'When' }, { label: 'Who' }, { label: 'Action' }, { label: 'Record' }, { label: 'Change' }]} row={(e) => (
              <tr key={e.id} className="align-top">
                <Td className="whitespace-nowrap tabular-nums">{when(e.occurredAt)}</Td>
                <Td>{e.actor?.name ?? e.actorLabel ?? 'System'}{e.ipAddress ? <div className="text-xs text-muted-foreground">{e.ipAddress}</div> : null}</Td>
                <Td className="font-mono text-xs">{e.action}{e.reason ? <div className="font-sans text-muted-foreground">{e.reason}</div> : null}</Td>
                <Td className="text-xs">{e.entityType}<div className="font-mono text-muted-foreground">{e.entityId}</div></Td>
                <Td className="max-w-md break-words font-mono text-xs">{e.before ? <div className="text-muted-foreground">− {brief(e.before)}</div> : null}{e.after ? <div>+ {brief(e.after)}</div> : null}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
