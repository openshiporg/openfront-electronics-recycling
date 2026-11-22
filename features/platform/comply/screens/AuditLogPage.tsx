import { PlatformPage, label, usd, when, weight } from '../../lib/page'
import { param, readTabbedList, RowLink, TabbedTable, Td, type SearchParams } from '../../lib/view'

const GROUPS: Record<string, string> = { bid: 'Bids and awards', lot: 'Lots', payment: 'Payments', invoice: 'Invoices', refund: 'Refunds', settlement: 'Settlements', certificate: 'Certificates', job: 'Jobs', asset: 'Assets', buyer: 'Buyers', settings: 'Settings', user: 'People' }

/** Record kinds in plain words, and the page each one opens on. */
const RECORDS: Record<string, [string, ((id: string) => string)?]> = {
  Lot: ['Lot', (id) => `/dashboard/platform/lots/${id}`], Job: ['Job', (id) => `/dashboard/platform/jobs/${id}`], Order: ['Order', (id) => `/dashboard/platform/orders/${id}`],
  BuyerCompany: ['Buyer', (id) => `/dashboard/platform/buyers/${id}`], ClientOrganization: ['Client', (id) => `/dashboard/platform/clients/${id}`],
  Invoice: ['Invoice'], Payment: ['Payment'], SaleEvent: ['Sale event'], User: ['Person'], SanitizationRecord: ['Sanitisation record'], OutboundShipment: ['Outbound shipment'],
  Settlement: ['Settlement'], Asset: ['Asset'], Container: ['Container'], BuyerDocument: ['Buyer document'], Certificate: ['Certificate'], Refund: ['Refund'], Claim: ['Claim'], StoreSettings: ['Settings'],
}

/** "lot.created_from_assets" → "Lot created from assets". */
const actionText = (action: string) => {
  const [area, ...rest] = action.split('.')
  const words = `${label(area)} ${label(rest.join(' '))}`.trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Internal keys (record ids, session ids) are not useful to a reader; the record column links to the record.
const HIDDEN = /(^id$|Id$|Ids$)/
const KEY_LABELS: Record<string, string> = { termsVersion: 'terms version', isBelowReserve: 'below reserve', spendLimitMinor: 'spend limit', signatureName: 'signed by' }

function valueText(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'number') return /Minor$/.test(key) ? usd(v) : /[wW]eight$/.test(key) ? weight(v) : v.toLocaleString('en-US')
  if (typeof v === 'string') return /^[a-z]+(_[a-z]+)+$/.test(v) ? label(v) : v
  if (Array.isArray(v)) return v.length > 4 ? `${v.length} items` : v.map((x) => valueText('', x)).join(', ')
  return `${Object.keys(v as object).length} fields`
}

/** A change as "key: value · key: value", in words. */
function changeText(v: unknown) {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object' || Array.isArray(v)) return valueText('', v)
  const parts = Object.entries(v as Record<string, unknown>).filter(([k]) => !HIDDEN.test(k)).map(([k, x]) => `${KEY_LABELS[k] ?? label(k.replace(/Minor$/, '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase())}: ${valueText(k, x)}`)
  const text = parts.join(' · ')
  return text.length > 240 ? `${text.slice(0, 240)}…` : text
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
            <form className="flex max-w-full gap-2" action="/dashboard/platform/audit-log">
              <input type="hidden" name="area" value={group} />
              <input name="q" defaultValue={q} placeholder="Person, action or reason" className="h-9 min-w-0 flex-1 sm:w-72 sm:flex-none rounded-[6px] border bg-background px-3 text-sm" />
              <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
            </form>
            <TabbedTable label="Audit log" tabKey="area" path="/dashboard/platform/audit-log" params={{ area: group, q }} data={data} empty="No entries." head={[{ label: 'When' }, { label: 'Who' }, { label: 'Action' }, { label: 'Record' }, { label: 'Change' }]} row={(e) => (
              <tr key={e.id} className="align-top">
                <Td className="whitespace-nowrap tabular-nums">{when(e.occurredAt)}</Td>
                <Td>{e.actor?.name ?? e.actorLabel ?? 'System'}{e.ipAddress ? <div className="text-xs text-muted-foreground">{e.ipAddress}</div> : null}</Td>
                <Td className="min-w-40">{actionText(e.action)}{e.reason ? <div className="text-xs text-muted-foreground">{e.reason}</div> : null}</Td>
                <Td className="whitespace-nowrap text-xs">{(() => { const [name, href] = RECORDS[e.entityType] ?? [label(e.entityType)]; return href && e.entityId ? <RowLink href={href(e.entityId)}>Open {name.toLowerCase()}</RowLink> : name })()}</Td>
                <Td className="min-w-56 max-w-md break-words text-xs">{changeText(e.before) ? <div className="text-muted-foreground">Before: {changeText(e.before)}</div> : null}{changeText(e.after) ? <div>{e.before ? 'After: ' : ''}{changeText(e.after)}</div> : null}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
