export { LotPage as default } from '@/features/storefront/screens/LotPage'
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ lotNumber: string }> }) {
  const { lotNumber } = await params
  return { title: `Lot ${decodeURIComponent(lotNumber)}` }
}
