import { InvoicePage } from '@/features/storefront/screens/InvoicePage'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoice' }
export default function Page(props: { params: Promise<{ invoiceNumber: string }>; searchParams: Promise<{ session?: string }> }) {
  return <InvoicePage kind="buyer" {...props} />
}
