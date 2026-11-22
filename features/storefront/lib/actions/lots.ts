'use server'
import { revalidatePath } from 'next/cache'
import { buyerLot } from '../data/store'
import { cmd } from '../data/client'

export type Result<T = any> = { ok: true; data: T } | { ok: false; error: string; needsTerms?: string | null }
const TERMS = 'Accept the current wholesale terms before bidding.'

async function run<T>(name: string, input: unknown, lotNumber?: string): Promise<Result<T>> {
  const r = await cmd<T>(name, input)
  if (lotNumber) revalidatePath(`/lots/${lotNumber}`)
  if (r.success) return { ok: true, data: r.data as T }
  return { ok: false, error: r.error || 'That did not go through.', needsTerms: r.error === TERMS ? 'yes' : null }
}

/** U5/U7: whole-lot amount. U6: per-line unit prices. */
export async function placeBidAction(input: { lotNumber: string; amountMinor?: number; lines?: Array<{ lotLineId: string; unitPriceMinor: number }>; idempotencyKey: string }) {
  return run<{ bidId: string; amountMinor: number; closesAt: string; status: string }>('placeBid', input, input.lotNumber)
}

export async function withdrawBidAction(lotNumber: string) {
  return run('withdrawBid', { lotNumber }, lotNumber)
}

/** U8 */
export async function buyNowAction(lotNumber: string, idempotencyKey: string) {
  return run<any>('buyNow', { lotNumber, idempotencyKey }, lotNumber)
}

/** U15 */
export async function acceptTermsAction(version: string) {
  const r = await run('acceptWholesaleTerms', { version })
  revalidatePath('/', 'layout')
  return r
}

/** U4 and U6 downloads: { filename, mimeType, base64 } handed to the browser. */
export async function downloadAction(kind: 'manifest' | 'bidSheet', lotNumber: string) {
  return run<{ filename: string; mimeType: string; base64: string }>(kind === 'manifest' ? 'downloadLotManifest' : 'downloadBidSheet', { lotNumber })
}

export async function previewBidSheetAction(lotNumber: string, file: { filename: string; mimeType: string; base64: string }) {
  return run<{ lines: Array<{ lotLineId: string; lineNumber: number; description: string; quantity: number; unitPriceMinor: number; totalMinor: number }>; problems: string[]; totalMinor: number }>('previewBidSheet', { lotNumber, file })
}

export async function placeBidFromSheetAction(lotNumber: string, file: { filename: string; mimeType: string; base64: string }, idempotencyKey: string) {
  return run<{ bidId: string; amountMinor: number }>('placeBidFromSheet', { lotNumber, file, idempotencyKey }, lotNumber)
}

/** U7: the auction box re-reads the lot every 15 seconds and after each bid. */
export async function refreshLotAction(lotNumber: string) {
  const r = await buyerLot(lotNumber)
  if (!r.ok || !r.data) return null
  const l = r.data
  return {
    status: l.status as string,
    closesAt: l.closesAt as string,
    currentAmountMinor: l.currentAmountMinor as number | null,
    bidCount: l.bidCount as number | null,
    minimumBidMinor: l.minimumBidMinor as number,
    leading: l.leading as boolean | null,
    reserveMet: l.reserveMet as boolean | null,
    extensionCount: l.extensionCount as number | null,
    myBid: l.myBid,
    mayBid: l.mayBid as boolean,
    bidBlockedReason: l.bidBlockedReason as string | null,
    serverNow: Date.now(),
  }
}
