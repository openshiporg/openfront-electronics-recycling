import type { ReactNode } from 'react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import type { RolePermission } from '@/features/keystone/access'
import { platformNavGroups, platformNavItems } from './navigation'
import { platformRequest } from './platformRequest'
import { Notice, PageHeader, Restricted, type Tone } from './ui'

export type StaffRole = Partial<Record<RolePermission, boolean>> & { id?: string; name?: string }
export type Staff = { id: string; name: string; email: string; role: StaffRole }

const ROLE_FIELDS = 'id name canAccessDashboard canManageSettings canManageUsers canManageBuyers canManageLots canAwardLots canSeeSealedBidAmountsBeforeClose canManageClients canManageJobs canDispatch canCollect canReceive canAuditAssets canSanitize canVerifySanitization canIssueCertificates canManageDownstream canManagePayments canRefund canManageSettlements canViewReports canManageOnboarding'

export async function getStaff(): Promise<Staff | null> {
  const result = await platformRequest<{ authenticatedItem: any }>(`query Me { authenticatedItem { ... on User { id name email role { ${ROLE_FIELDS} } } } }`)
  if (!result.ok || !result.data.authenticatedItem?.role) return null
  return result.data.authenticatedItem
}

export const can = (staff: Staff | null, ...flags: RolePermission[]) => Boolean(staff?.role && flags.some((f) => staff.role[f]))

/**
 * Page shell for every platform page: breadcrumbs from the sidebar group, a header,
 * and the role gate. `route` is the nav href without basePath, e.g. "/platform/lots".
 */
export async function PlatformPage({ route, title, meta, tone, actions, children, crumbs = [] }: {
  route: string; title: string; meta?: ReactNode; tone?: Tone; actions?: ReactNode; children: (staff: Staff) => ReactNode | Promise<ReactNode>; crumbs?: Array<{ label: string; href?: string }>
}) {
  const nav = platformNavItems.find((i) => i.href === route)
  const group = platformNavGroups.find((g) => g.id === nav?.group)
  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: '/dashboard' },
    ...(group ? [{ type: 'page' as const, label: group.title }] : []),
    ...(crumbs.length ? [{ type: 'link' as const, label: nav?.title ?? title, href: `/dashboard${route}` }, ...crumbs.map((c) => (c.href ? { type: 'link' as const, label: c.label, href: c.href } : { type: 'page' as const, label: c.label }))] : [{ type: 'page' as const, label: title }]),
  ]
  const staff = await getStaff()
  const allowed = staff && (!nav || nav.anyOf.some((p) => staff.role[p]))
  const header = <PageHeader title={title} tone={tone} meta={meta} actions={allowed ? actions : null} />
  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="flex min-w-0 flex-col gap-6 px-4 pb-24 md:px-6">
        {!staff ? <Notice tone="alert">Sign in with a staff account to use this page.</Notice> : !allowed ? <Restricted>Your role does not include this page.</Restricted> : await children(staff)}
      </div>
    </PageContainer>
  )
}

export function LoadError({ error }: { error: string }) {
  return <Notice tone="alert">{error}</Notice>
}

// ---------------------------------------------------------------- formatting

export const label = (value?: string | null) => (value ? value.replaceAll('_', ' ') : '—')
export const when = (value?: string | null) => (value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—')
export const day = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
export const usd = (minor?: number | null, currency = 'USD') => (minor === null || minor === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100))
export const weight = (value?: number | string | null, unit = 'lb') => (value === null || value === undefined || value === '' ? '—' : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`)

const TONES: Record<string, Tone> = {
  open: 'live', approved: 'live', paid: 'live', captured: 'live', confirmed: 'live', passed: 'live', issued: 'live', published: 'live', won: 'live', active: 'live', released: 'live', completed: 'live', received: 'live', ready_for_sale: 'live', succeeded: 'live', done: 'live', committed: 'live', receipt_confirmed: 'live', settled: 'live', accepted: 'live',
  submitted: 'wait', under_review: 'wait', needs_info: 'wait', scheduled: 'wait', pending: 'wait', reported: 'wait', closed: 'info', awarded: 'info', awaiting_payment: 'wait', ready_for_release: 'info', requested: 'wait', quoted: 'wait', en_route: 'info', collected: 'info', processing: 'info', in_review: 'wait', partially_paid: 'wait', booked: 'info', arrived: 'info', uploaded: 'wait', mapped: 'wait', validated: 'info', shipped: 'info', draft: 'off', requires_action: 'wait', audited: 'info', allocated: 'info', sold: 'info',
  rejected: 'alert', suspended: 'alert', failed: 'alert', defaulted: 'alert', cancelled: 'off', canceled: 'off', void: 'off', unsold: 'wait', on_hold: 'alert', disputed: 'alert', denied: 'alert', revoked: 'alert', unknown: 'alert', missing: 'alert', no_show: 'alert', declined: 'off', discarded: 'off', expired: 'off', lost: 'off', superseded: 'off', withdrawn: 'off',
}
export const toneOf = (status?: string | null): Tone => (status ? TONES[status] ?? 'off' : 'off')

/** Options for a select from a list of strings. */
export const opts = (values: readonly string[]) => values.map((value) => ({ value, label: label(value) }))

/** ?status=… tab helper */
export function tabHref(path: string, params: Record<string, string | undefined>, patch: Record<string, string>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}
