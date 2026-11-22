import { InvoicesPage } from '@/features/storefront/screens/buyer/BuyerLists'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoices' }
export default function Page() {
  return <InvoicesPage kind="client" />
}
