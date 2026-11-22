import { cache } from 'react'
import { gql, op } from './client'

export type Viewer = {
  id: string
  name: string
  email: string
  kind: 'staff' | 'buyer' | 'client'
  isStaff: boolean
  buyerStatus: string | null
}

/** The signed-in person (own record only), or null for a visitor. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const result = await gql<{ authenticatedItem: any }>(
    'query { authenticatedItem { ... on User { id name email kind buyerCompany { id status } role { canAccessDashboard } } } }',
  )
  const u = result.ok ? result.data.authenticatedItem : null
  if (!u) return null
  // A buyer cannot read the BuyerCompany list item directly; the custom read returns its status.
  let buyerStatus: string | null = u.buyerCompany?.status ?? null
  if (u.kind === 'buyer' && !buyerStatus) {
    const company = await op<{ status: string } | null>('myBuyerCompany')
    buyerStatus = company.ok ? company.data?.status ?? null : null
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    kind: u.kind ?? 'staff',
    isStaff: Boolean(u.role?.canAccessDashboard),
    buyerStatus,
  }
})

export function homeFor(viewer: Pick<Viewer, 'kind' | 'isStaff'>) {
  if (viewer.isStaff || viewer.kind === 'staff') return '/dashboard'
  return viewer.kind === 'client' ? '/client' : '/buyer'
}
