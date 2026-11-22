import Link from 'next/link'
import type { ReactNode } from 'react'
import { DataTable, Empty, Notice, Pager, StatusCell, StatusTabs, Td } from './ui'
import { label, tabHref, toneOf } from './page'
import { listQuery } from './platformRequest'

/*
 * Shared pieces for the platform screens: a status-tabbed list read straight from the
 * Keystone list API, and a key/value block for detail pages. Each screen supplies the
 * GraphQL fields and the cells; nothing here decides access (Keystone does).
 */

export type SearchParams = Record<string, string | string[] | undefined>
export const param = (sp: SearchParams, key: string) => (Array.isArray(sp[key]) ? sp[key]![0] : sp[key]) || ''

const PAGE = 50

/** Reads one page of a list with counts per status tab. */
export async function readTabbedList<T = any>(args: {
  list: string // GraphQL plural, e.g. "lots"
  type: string // GraphQL type, e.g. "Lot"
  fields: string
  tabs: Array<{ value: string; label: string; where: Record<string, unknown> }>
  current: string
  where?: Record<string, unknown>
  orderBy?: Record<string, string> | Array<Record<string, string>>
  page?: number
}) {
  const tab = args.tabs.find((t) => t.value === args.current) ?? args.tabs[0]
  const and = (w: Record<string, unknown>) => ({ AND: [w, args.where ?? {}] })
  const page = Math.max(1, args.page ?? 1)
  const counts = args.tabs.map((t, i) => `c${i}: ${args.list}Count(where: $w${i})`).join('\n')
  const vars: Record<string, unknown> = { where: and(tab.where), take: PAGE, skip: (page - 1) * PAGE, orderBy: args.orderBy ?? [{ createdAt: 'desc' }] }
  args.tabs.forEach((t, i) => { vars[`w${i}`] = and(t.where) })
  const decl = args.tabs.map((_, i) => `$w${i}: ${args.type}WhereInput!`).join(', ')
  const result = await listQuery<any>(`query Tabbed($where: ${args.type}WhereInput!, $take: Int, $skip: Int!, $orderBy: [${args.type}OrderByInput!]!, ${decl}) {
    items: ${args.list}(where: $where, take: $take, skip: $skip, orderBy: $orderBy) { ${args.fields} }
    total: ${args.list}Count(where: $where)
    ${counts}
  }`, vars)
  if (!result.ok) return { ok: false as const, error: result.error }
  const tabs = args.tabs.map((t, i) => ({ value: t.value, label: t.label, count: result.data[`c${i}`] as number, tone: t.value ? toneOf(t.value) : undefined }))
  return { ok: true as const, items: result.data.items as T[], total: result.data.total as number, tabs, tab: tab.value, page, pages: Math.max(1, Math.ceil(result.data.total / PAGE)) }
}

/** Status tabs + table + pager for a readTabbedList result. */
export function TabbedTable<T>({ path, params, data, head, row, empty, tabKey = 'status', label: tableLabel }: {
  path: string; params: Record<string, string>; data: Awaited<ReturnType<typeof readTabbedList<T>>>; head: Array<{ label: ReactNode; className?: string }>; row: (item: T) => ReactNode; empty: ReactNode; tabKey?: string; label: string
}) {
  if (!data.ok) return <Notice tone="alert">{data.error}</Notice>
  const href = (patch: Record<string, string>) => tabHref(path, params, patch)
  return (
    <div className="grid gap-3">
      <StatusTabs tabs={data.tabs} current={data.tab} hrefFor={(value) => href({ [tabKey]: value, page: '' })} />
      {data.items.length ? <DataTable label={tableLabel} head={head}>{data.items.map(row)}</DataTable> : <Empty>{empty}</Empty>}
      <Pager label={`${tableLabel} pages`} page={data.page} pages={data.pages} prev={data.page > 1 ? href({ page: String(data.page - 1) }) : null} next={data.page < data.pages ? href({ page: String(data.page + 1) }) : null} />
    </div>
  )
}

export function Status({ value }: { value?: string | null }) {
  return <StatusCell tone={toneOf(value)}>{label(value)}</StatusCell>
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium underline-offset-2 hover:underline">{children}</Link>
}

/** Definition list for detail pages. */
export function Facts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="break-words">{v === '' || v === null || v === undefined ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  )
}

export { Td }
