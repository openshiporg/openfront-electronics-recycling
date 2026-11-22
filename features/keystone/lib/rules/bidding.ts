// Bidding rules: ranking, increments, soft close, eligibility, award plans.
// Pure functions; no database or framework imports.
import { RuleError } from './lifecycle'

export type RankableBid = { id: string; companyId: string; amountMinor: number; submittedAt: Date | string; status?: string }

/** Higher amount first; equal amounts, earlier submission first. */
export function rankBids<T extends RankableBid>(bids: T[]): T[] {
  return [...bids].sort((a, b) => {
    if (b.amountMinor !== a.amountMinor) return b.amountMinor - a.amountMinor
    const ta = new Date(a.submittedAt).getTime()
    const tb = new Date(b.submittedAt).getTime()
    if (ta !== tb) return ta - tb
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** The least an open-auction bid may be. */
export function minimumOpenBid(lot: { openingBidMinor?: number | null; bidIncrementMinor?: number | null; currentAmountMinor?: number | null; bidCount?: number | null }) {
  const opening = Math.max(0, lot.openingBidMinor ?? 0)
  if (!lot.bidCount || !lot.currentAmountMinor) return Math.max(opening, 1)
  return Math.max(opening, lot.currentAmountMinor + Math.max(1, lot.bidIncrementMinor ?? 1))
}

/** A bid inside the window before close pushes the close back, a limited number of times. */
export function softCloseExtension(input: { now: Date; closesAt: Date; windowMinutes: number; extensionMinutes: number; extensionCount: number; maxExtensions: number }) {
  const remainingMs = input.closesAt.getTime() - input.now.getTime()
  if (remainingMs <= 0) return null
  if (input.windowMinutes <= 0 || input.extensionMinutes <= 0) return null
  if (remainingMs > input.windowMinutes * 60_000) return null
  if (input.extensionCount >= input.maxExtensions) return null
  return new Date(input.closesAt.getTime() + input.extensionMinutes * 60_000)
}

export type EligibilityInput = {
  companyStatus: string
  userActive: boolean
  acceptedTermsVersion: string | null | undefined
  currentTermsVersion: string | null | undefined
  hasOverdueInvoice: boolean
  spendLimitMinor: number | null | undefined
  unpaidAwardsMinor: number
  otherActiveBidsMinor: number
  bidAmountMinor: number
}

/** "May this user bid?" (§3.1). Returns null when allowed, or the reason. */
export function bidEligibilityProblem(input: EligibilityInput): { code: string; message: string } | null {
  if (input.companyStatus !== 'approved') return { code: 'not_approved', message: 'Your company must be approved before it can bid.' }
  if (!input.userActive) return { code: 'inactive', message: 'Your account is not active.' }
  if ((input.currentTermsVersion || '') && input.acceptedTermsVersion !== input.currentTermsVersion) {
    return { code: 'terms', message: 'Accept the current wholesale terms before bidding.' }
  }
  if (input.hasOverdueInvoice) return { code: 'overdue', message: 'You have an overdue invoice. Pay it to bid again.' }
  if (input.spendLimitMinor != null && input.spendLimitMinor >= 0) {
    const exposure = input.unpaidAwardsMinor + input.otherActiveBidsMinor + input.bidAmountMinor
    if (exposure > input.spendLimitMinor) return { code: 'limit', message: 'This bid would take you over your spending limit.' }
  }
  return null
}

export type LineBidInput = { lotLineId: string; unitPriceMinor: number }
export type LotLineForBid = { id: string; quantity: number; lineNumber: number }

/** Validates per-line prices and returns lines with quantity and the total. */
export function perLineTotal(lines: LotLineForBid[], prices: LineBidInput[]) {
  const byId = new Map(lines.map((l) => [l.id, l]))
  const seen = new Set<string>()
  const out: Array<{ lotLineId: string; unitPriceMinor: number; quantity: number; totalMinor: number }> = []
  for (const price of prices) {
    const line = byId.get(price.lotLineId)
    if (!line) throw new RuleError('A bid line does not belong to this lot.')
    if (seen.has(price.lotLineId)) throw new RuleError(`Line ${line.lineNumber} appears twice.`)
    seen.add(price.lotLineId)
    const unit = Math.round(Number(price.unitPriceMinor))
    if (!Number.isSafeInteger(unit) || unit < 0) throw new RuleError(`Line ${line.lineNumber} has an invalid price.`)
    if (unit === 0) continue
    out.push({ lotLineId: line.id, unitPriceMinor: unit, quantity: line.quantity, totalMinor: unit * line.quantity })
  }
  if (!out.length) throw new RuleError('Enter a price on at least one line.')
  return { lines: out, totalMinor: out.reduce((s, l) => s + l.totalMinor, 0) }
}

export type GridBid = RankableBid & { lines: Array<{ id: string; lotLineId: string; unitPriceMinor: number; quantity: number }> }

/** Best bid per line, ranked by unit price then time (per-line lots). */
export function bestPerLine(bids: GridBid[]) {
  const result = new Map<string, { bidId: string; bidLineId: string; companyId: string; unitPriceMinor: number; quantity: number; submittedAt: Date | string }[]>()
  for (const bid of bids) {
    for (const line of bid.lines) {
      const list = result.get(line.lotLineId) ?? []
      list.push({ bidId: bid.id, bidLineId: line.id, companyId: bid.companyId, unitPriceMinor: line.unitPriceMinor, quantity: line.quantity, submittedAt: bid.submittedAt })
      result.set(line.lotLineId, list)
    }
  }
  for (const [key, list] of result) {
    list.sort((a, b) => b.unitPriceMinor - a.unitPriceMinor || new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    result.set(key, list)
  }
  return result
}

export type AwardSelection = { lotLineId: string; bidId: string }

/**
 * Groups a per-line award selection into one award per winning bid, with totals.
 * Every chosen line must be priced by the chosen bid, and a line may be awarded once.
 */
export function planPerLineAward(bids: GridBid[], selection: AwardSelection[]) {
  const byBid = new Map(bids.map((b) => [b.id, b]))
  const seenLines = new Set<string>()
  const groups = new Map<string, { bid: GridBid; lines: Array<{ lotLineId: string; bidLineId: string; quantity: number; unitPriceMinor: number; totalMinor: number }> }>()
  for (const pick of selection) {
    if (seenLines.has(pick.lotLineId)) throw new RuleError('A line can be awarded to one buyer only.')
    seenLines.add(pick.lotLineId)
    const bid = byBid.get(pick.bidId)
    if (!bid) throw new RuleError('A chosen bid is no longer valid.')
    const line = bid.lines.find((l) => l.lotLineId === pick.lotLineId)
    if (!line) throw new RuleError('The chosen bid has no price for that line.')
    const group = groups.get(bid.id) ?? { bid, lines: [] }
    group.lines.push({ lotLineId: line.lotLineId, bidLineId: line.id, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor, totalMinor: line.unitPriceMinor * line.quantity })
    groups.set(bid.id, group)
  }
  return [...groups.values()].map((g) => ({ bidId: g.bid.id, companyId: g.bid.companyId, lines: g.lines, totalMinor: g.lines.reduce((s, l) => s + l.totalMinor, 0) }))
}

/** Award guard: below reserve needs the override and a note; not-the-highest needs a reason. */
export function awardOverrideProblem(input: { totalMinor: number; reserveMinor: number | null | undefined; confirmBelowReserve: boolean; isHighest: boolean; reason: string }) {
  const below = input.reserveMinor != null && input.reserveMinor > 0 && input.totalMinor < input.reserveMinor
  if (below && !input.confirmBelowReserve) return { below, message: 'This award is below the reserve. Confirm the override to continue.' }
  if (below && !input.reason.trim()) return { below, message: 'Write a note explaining the award below reserve.' }
  if (!input.isHighest && !input.reason.trim()) return { below, message: 'Write a reason for awarding to a bid other than the highest.' }
  return { below, message: null as string | null }
}
