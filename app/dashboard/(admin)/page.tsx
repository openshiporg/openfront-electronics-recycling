import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Every role starts on Today: the work waiting for it, each item linking to where it is done.
export default function DashboardHome() {
  redirect('/dashboard/platform/today')
}
