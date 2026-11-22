import type { ReactNode } from 'react'
import { getAuthenticatedUser } from '../actions'
import { canBrowseRecords } from '../lib/sidebarAccess'
import { PageContainer } from './PageContainer'

/**
 * The raw record pages are for whoever manages settings. Everyone else gets a plain
 * page that points them back to their own work, never an error or a blank table.
 */
export async function RecordsGate({ children }: { children: ReactNode }) {
  const response = await getAuthenticatedUser()
  const user = response.success ? response.data?.authenticatedItem : null
  if (canBrowseRecords(user)) return <>{children}</>
  return (
    <PageContainer title="Records" header={<h1 className="text-xl font-semibold tracking-tight">Records</h1>} breadcrumbs={[{ type: 'link', label: 'Dashboard', href: '/dashboard/platform/today' }, { type: 'page', label: 'Records' }]}>
      <div className="grid gap-3 px-4 pb-24 md:px-6">
        <p role="status" className="text-sm text-muted-foreground">Your role does not include the record browser. Your work is on the pages in the sidebar.</p>
        <p className="text-sm"><a className="font-medium underline-offset-2 hover:underline" href="/dashboard/platform/today">Go to Today</a></p>
      </div>
    </PageContainer>
  )
}
