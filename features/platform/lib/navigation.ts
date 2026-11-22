import {
  AlarmClock, Archive, BadgeCheck, Banknote, BarChart3, Boxes, Building2, CalendarClock, CalendarDays, ClipboardCheck, ClipboardList,
  CreditCard, Factory, FileCheck2, FileSpreadsheet, FileText, Gavel, HardDrive, History, Layers, ListChecks, MapPinned, Package,
  PackageCheck, Receipt, RotateCcw, ScanLine, Scale, ScrollText, Settings, ShieldAlert, ShieldCheck, ShoppingCart, Smartphone,
  Tags, Truck, Undo2, UserCheck, Users, Wallet, Wrench, Rocket, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RolePermission } from '@/features/keystone/access'

export interface PlatformNavItem {
  title: string
  href: string
  description: string
  icon: LucideIcon
  group: PlatformGroupId
  /** Shown when the role has any of these. */
  anyOf: RolePermission[]
}

export type PlatformGroupId = 'today' | 'sell' | 'collect' | 'process' | 'comply' | 'money' | 'clients' | 'settings'

export interface PlatformNavGroup {
  id: PlatformGroupId
  title: string
  icon: LucideIcon
}

// §4.10 sidebar groups, in order.
export const platformNavGroups: PlatformNavGroup[] = [
  { id: 'today', title: 'Today', icon: AlarmClock },
  { id: 'sell', title: 'Sell', icon: Gavel },
  { id: 'collect', title: 'Collect', icon: Truck },
  { id: 'process', title: 'Process', icon: Wrench },
  { id: 'comply', title: 'Comply', icon: ShieldCheck },
  { id: 'money', title: 'Money', icon: Wallet },
  { id: 'clients', title: 'Clients', icon: Building2 },
  { id: 'settings', title: 'Settings', icon: Settings },
]

const SELL: RolePermission[] = ['canManageLots', 'canAwardLots']

// hrefs are relative to the dashboard basePath.
export const platformNavItems: PlatformNavItem[] = [
  { group: 'today', title: 'Today', href: '/platform/today', icon: AlarmClock, description: 'What needs doing now, for your role.', anyOf: ['canAccessDashboard'] },

  { group: 'sell', title: 'Sale events', href: '/platform/sale-events', icon: CalendarDays, description: 'Group lots into a sale and announce it.', anyOf: SELL },
  { group: 'sell', title: 'Lots', href: '/platform/lots', icon: Package, description: 'Lots by status: manifest, bids, award.', anyOf: SELL },
  { group: 'sell', title: 'Manifest imports', href: '/platform/manifest-imports', icon: FileSpreadsheet, description: 'Upload, map and commit a manifest.', anyOf: ['canManageLots'] },
  { group: 'sell', title: 'Buyers', href: '/platform/buyers', icon: UserCheck, description: 'Applications queue and buyer directory.', anyOf: ['canManageBuyers'] },
  { group: 'sell', title: 'Orders', href: '/platform/orders', icon: ShoppingCart, description: 'Awaiting payment, paid, ready, released.', anyOf: ['canManageLots', 'canReceive'] },
  { group: 'sell', title: 'Dock calendar', href: '/platform/dock', icon: CalendarClock, description: 'Buyer pickups and drop-offs by slot.', anyOf: ['canManageLots', 'canReceive', 'canDispatch'] },
  { group: 'sell', title: 'Claims', href: '/platform/claims', icon: ShieldAlert, description: 'Buyer claims: record, approve, deny, refund.', anyOf: ['canManageLots'] },

  { group: 'collect', title: 'Requests and jobs', href: '/platform/jobs', icon: ClipboardList, description: 'Pickup requests, quotes and the jobs board.', anyOf: ['canManageJobs', 'canManageClients', 'canIssueCertificates'] },
  { group: 'collect', title: 'Dispatch', href: '/platform/dispatch', icon: MapPinned, description: 'Date, window, driver and vehicle.', anyOf: ['canDispatch'] },
  { group: 'collect', title: 'Driver', href: '/platform/driver', icon: Smartphone, description: 'My stops: containers, seals, photos, signature.', anyOf: ['canCollect'] },
  { group: 'collect', title: 'Receiving', href: '/platform/receiving', icon: ScanLine, description: 'Scan, check the seal, weigh.', anyOf: ['canReceive'] },

  { group: 'process', title: 'Assets', href: '/platform/assets', icon: HardDrive, description: 'Search by serial, bulk actions, import and export.', anyOf: ['canAuditAssets', 'canManageLots', 'canIssueCertificates', 'canManageClients'] },
  { group: 'process', title: 'Audit bench', href: '/platform/audit', icon: ClipboardCheck, description: 'Record an asset, drives, grades and photos.', anyOf: ['canAuditAssets'] },
  { group: 'process', title: 'Sanitisation', href: '/platform/sanitization', icon: ShieldCheck, description: 'Record, import erasure reports, verify a sample.', anyOf: ['canSanitize', 'canVerifySanitization'] },
  { group: 'process', title: 'Ready for sale', href: '/platform/inventory', icon: Boxes, description: 'Build a lot from a selection.', anyOf: ['canManageLots'] },

  { group: 'comply', title: 'Certificates', href: '/platform/certificates', icon: FileCheck2, description: 'Issue, revoke and reissue.', anyOf: ['canIssueCertificates'] },
  { group: 'comply', title: 'Custody log', href: '/platform/custody', icon: History, description: 'Every hand-off and movement.', anyOf: ['canIssueCertificates', 'canReceive', 'canManageDownstream'] },
  { group: 'comply', title: 'Downstream vendors', href: '/platform/downstream', icon: Factory, description: 'Vendors and their approvals.', anyOf: ['canManageDownstream'] },
  { group: 'comply', title: 'Outbound shipments', href: '/platform/outbound', icon: Truck, description: 'Ship and confirm receipt.', anyOf: ['canManageDownstream'] },
  { group: 'comply', title: 'Mass balance', href: '/platform/mass-balance', icon: Scale, description: 'Weight in, weight out.', anyOf: ['canManageDownstream', 'canIssueCertificates', 'canViewReports'] },
  { group: 'comply', title: 'Audit log', href: '/platform/audit-log', icon: ScrollText, description: 'Who changed what, and when.', anyOf: ['canIssueCertificates', 'canViewReports', 'canManageSettings'] },
  { group: 'comply', title: 'Certifications', href: '/platform/certifications', icon: BadgeCheck, description: 'Our own R2, e-Stewards and ISO certificates.', anyOf: ['canIssueCertificates', 'canManageSettings'] },

  { group: 'money', title: 'Invoices', href: '/platform/invoices', icon: Receipt, description: 'All invoices, PDF and void.', anyOf: ['canManagePayments', 'canViewReports'] },
  { group: 'money', title: 'Payments', href: '/platform/payments', icon: CreditCard, description: 'Confirm transfers, check cards, refund.', anyOf: ['canManagePayments', 'canRefund'] },
  { group: 'money', title: 'Settlements', href: '/platform/settlements', icon: Banknote, description: 'Build, publish and pay client settlements.', anyOf: ['canManageSettlements'] },
  { group: 'money', title: 'Reports', href: '/platform/reports', icon: BarChart3, description: 'Sales and client impact reports.', anyOf: ['canViewReports', 'canManageClients'] },
  { group: 'money', title: 'Accounting export', href: '/platform/export', icon: Download, description: 'CSV for the accounting package.', anyOf: ['canViewReports', 'canManagePayments'] },

  { group: 'clients', title: 'Clients', href: '/platform/clients', icon: Building2, description: 'Organisations, sites and users.', anyOf: ['canManageClients'] },

  { group: 'settings', title: 'Store settings', href: '/platform/settings', icon: Settings, description: 'Rules, terms, bank instructions, email.', anyOf: ['canManageSettings'] },
  { group: 'settings', title: 'Facilities', href: '/platform/facilities', icon: Factory, description: 'Addresses, hours and dock capacity.', anyOf: ['canManageSettings'] },
  { group: 'settings', title: 'Catalog', href: '/platform/catalog', icon: Tags, description: 'Categories, grades, accepted items and fees.', anyOf: ['canManageSettings'] },
  { group: 'settings', title: 'Team and roles', href: '/platform/team', icon: Users, description: 'Staff accounts and what each role can do.', anyOf: ['canManageUsers'] },
  { group: 'settings', title: 'Payment providers', href: '/platform/payment-providers', icon: Banknote, description: 'Card and bank transfer.', anyOf: ['canManageSettings', 'canManagePayments'] },
  { group: 'settings', title: 'Onboarding', href: '/platform/onboarding', icon: Rocket, description: 'Set up the business on day one.', anyOf: ['canManageOnboarding'] },
]

type RoleFlags = Partial<Record<RolePermission, boolean | null>> | null | undefined

export function canSee(item: Pick<PlatformNavItem, 'anyOf'>, role: RoleFlags) {
  if (!role?.canAccessDashboard) return false
  return item.anyOf.some((p) => role[p] === true)
}

export function visiblePlatformNav(role: RoleFlags, basePath = '/dashboard') {
  return platformNavGroups
    .map((group) => ({ ...group, items: platformNavItems.filter((i) => i.group === group.id && canSee(i, role)).map((i) => ({ ...i, href: `${basePath}${i.href}` })) }))
    .filter((g) => g.items.length > 0)
}

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({ ...item, href: `${basePath}${item.href}` }))
}

// Icons kept for slices that reuse them.
export const icons = { Archive, Layers, ListChecks, PackageCheck, RotateCcw, Undo2, FileText }
