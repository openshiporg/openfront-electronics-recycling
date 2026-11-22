import { buyerLot, buyerLots, publicLot, publicLots, type LotCard } from './store'
import type { Viewer } from './session'
import type { Read } from './client'

/**
 * Prices are for approved buyers only (§4.7). Everyone else, including a buyer whose
 * application is still in review, gets the teaser projection.
 */
export function seesPrices(viewer: Viewer | null) {
  return Boolean(viewer && viewer.kind === 'buyer' && viewer.buyerStatus === 'approved')
}

export async function lotsFor(viewer: Viewer | null, filter: { category?: string; format?: string; saleEventId?: string; closingWithinHours?: number; status?: string } = {}): Promise<Read<LotCard[]> & { priced: boolean }> {
  if (seesPrices(viewer)) {
    const { status: _status, ...rest } = filter
    return { ...(await buyerLots(rest)), priced: true }
  }
  const { format: _format, closingWithinHours: _c, ...rest } = filter
  const result = await publicLots(rest)
  if (!result.ok) return { ...result, priced: false }
  // The public read has no format or time filter; narrow here so the same controls work for everyone.
  let rows = result.data
  if (filter.format) rows = rows.filter((l) => l.format === filter.format)
  if (filter.closingWithinHours) {
    const limit = Date.now() + filter.closingWithinHours * 3_600_000
    rows = rows.filter((l) => l.closesAt && new Date(l.closesAt).getTime() <= limit && new Date(l.closesAt).getTime() >= Date.now())
  }
  return { ok: true, data: rows, priced: false }
}

export async function lotFor(viewer: Viewer | null, lotNumber: string) {
  if (viewer?.kind === 'buyer') return { result: await buyerLot(lotNumber), full: true as const }
  return { result: await publicLot(lotNumber), full: false as const }
}
