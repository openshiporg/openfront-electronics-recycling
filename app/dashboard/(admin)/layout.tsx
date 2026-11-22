export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { getAdminMetaAction, getAuthenticatedUser } from '@/features/dashboard/actions';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export default async function ListLayout({ children }: { children: React.ReactNode }) {
  // Fetch adminMeta and user data server-side to avoid loading states
  const [adminMetaResponse, userResponse, storeResponse] = await Promise.all([
    getAdminMetaAction(),
    getAuthenticatedUser(),
    keystoneClient('query { storefrontSettings }').catch(() => null),
  ]);
  const businessName: string | null = (storeResponse as any)?.success ? (storeResponse as any).data?.storefrontSettings?.businessName ?? null : null;
  
  const adminMeta = adminMetaResponse.success ? adminMetaResponse.data : null;
  const user = userResponse.success ? userResponse.data?.authenticatedItem : null;

  return (
    <DashboardLayout adminMeta={adminMeta} authenticatedItem={user} businessName={businessName}>
      {children}
    </DashboardLayout>
  );
}