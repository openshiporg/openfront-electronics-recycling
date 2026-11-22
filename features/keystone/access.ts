// Access for one recycler per deployment. Staff reach lists through role flags.
// Buyers and clients have no role, so every list denies them; the storefront uses
// only the custom operations in features/keystone/mutations, which check ownership
// before using sudo().

export const ROLE_PERMISSIONS = [
  'canAccessDashboard',
  'canManageSettings',
  'canManageUsers',
  'canManageBuyers',
  'canManageLots',
  'canAwardLots',
  'canSeeSealedBidAmountsBeforeClose',
  'canManageClients',
  'canManageJobs',
  'canDispatch',
  'canCollect',
  'canReceive',
  'canAuditAssets',
  'canSanitize',
  'canVerifySanitization',
  'canIssueCertificates',
  'canManageDownstream',
  'canManagePayments',
  'canRefund',
  'canManageSettlements',
  'canViewReports',
  'canManageOnboarding',
] as const

export type RolePermission = (typeof ROLE_PERMISSIONS)[number]

export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    email?: string
    kind?: 'staff' | 'buyer' | 'client' | null
    isActive?: boolean | null
    buyerRole?: string | null
    clientRole?: string | null
    buyerCompany?: { id: string; status?: string | null } | null
    clientOrganization?: { id: string; status?: string | null } | null
    onboardingStatus?: string | null
    role: ({ id: string; name: string } & Partial<Record<RolePermission, boolean>>) | null
  }
}

type AccessArgs = { session?: Session | null; context?: unknown }

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

export function hasPermission(session: Session | null | undefined, permission: RolePermission) {
  if (!session?.data?.role) return false
  if (session.data.isActive === false) return false
  return session.data.role[permission] === true
}

export const can = (permission: RolePermission) => ({ session }: AccessArgs) => hasPermission(session, permission)

export const anyOf = (...flags: RolePermission[]) => ({ session }: AccessArgs) =>
  flags.some((flag) => hasPermission(session, flag))

export const isStaff = ({ session }: AccessArgs) => hasPermission(session, 'canAccessDashboard')

export const denyAll = () => false

export const permissions = Object.fromEntries(
  ROLE_PERMISSIONS.map((permission) => [permission, can(permission)])
) as Record<RolePermission, (args: AccessArgs) => boolean>

/**
 * Staff list access. `read` and `write` are role flags; pass `false` to deny an
 * operation to everyone (append-only lists, records created only by mutation).
 */
export function staffAccess(read: RolePermission | RolePermission[], write: RolePermission | RolePermission[] | false, options: { create?: boolean; update?: boolean; delete?: boolean } = {}) {
  const readCheck = Array.isArray(read) ? anyOf(...read) : can(read)
  const writeCheck = write === false ? denyAll : Array.isArray(write) ? anyOf(...write) : can(write)
  return {
    operation: {
      query: readCheck,
      create: options.create === false ? denyAll : writeCheck,
      update: options.update === false ? denyAll : writeCheck,
      delete: options.delete === false ? denyAll : writeCheck,
    },
  }
}

export const rules = {
  canReadPeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (hasPermission(session, 'canManageUsers') || hasPermission(session, 'canAccessDashboard')) return true
    return { id: { equals: session.itemId } }
  },
  canUpdatePeople: ({ session }: AccessArgs) => {
    if (!session) return false
    if (hasPermission(session, 'canManageUsers')) return true
    // Buyer and client managers look after portal users of their kind, never staff.
    const kinds = [hasPermission(session, 'canManageBuyers') && 'buyer', hasPermission(session, 'canManageClients') && 'client'].filter(Boolean) as string[]
    if (kinds.length) return { OR: [{ id: { equals: session.itemId } }, { kind: { in: kinds } }] }
    return { id: { equals: session.itemId } }
  },
}

/** Session fields loaded by createAuth. */
export const SESSION_DATA = `
  name
  email
  kind
  isActive
  buyerRole
  clientRole
  onboardingStatus
  buyerCompany { id status }
  clientOrganization { id status }
  role { id name ${ROLE_PERMISSIONS.join(' ')} }
`
