// Invoice arithmetic and money rules. Pure; integer minor units throughout.

export function bps(amountMinor: number, basisPoints: number) {
  return Math.round((amountMinor * basisPoints) / 10_000)
}

export type InvoiceLineLike = { kind: string; totalMinor: number }

/** One place that turns lines into the invoice totals. */
export function invoiceTotals(lines: InvoiceLineLike[]) {
  const sum = (kinds: string[]) => lines.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + l.totalMinor, 0)
  const subtotalMinor = sum(['item', 'service'])
  const premiumMinor = sum(['premium'])
  const taxMinor = sum(['tax'])
  const freightMinor = sum(['freight'])
  const feeMinor = sum(['card_fee'])
  const otherMinor = sum(['storage', 'adjustment'])
  return { subtotalMinor, premiumMinor, taxMinor, freightMinor, feeMinor, otherMinor, totalMinor: subtotalMinor + premiumMinor + taxMinor + freightMinor + feeMinor + otherMinor }
}

/** Lines for a lot-sale invoice at award time (§3.4). Card fee is added later. */
export function awardInvoiceLines(input: {
  items: Array<{ description: string; quantity: number; unitPriceMinor: number; totalMinor: number }>
  premiumBps: number
  taxBps: number
  taxStatus: string
  exported: boolean
  freightMinor?: number
}) {
  const lines: Array<{ kind: string; description: string; quantity: number; unitPriceMinor: number; totalMinor: number }> = input.items.map((i) => ({ kind: 'item', ...i }))
  const subtotal = input.items.reduce((s, i) => s + i.totalMinor, 0)
  const premium = bps(subtotal, input.premiumBps)
  if (premium > 0) lines.push({ kind: 'premium', description: `Buyer's premium (${input.premiumBps / 100}%)`, quantity: 1, unitPriceMinor: premium, totalMinor: premium })
  const exempt = input.taxStatus === 'exempt_resale' || input.taxStatus === 'export' || input.exported
  const tax = exempt ? 0 : bps(subtotal + premium, input.taxBps)
  if (tax > 0) lines.push({ kind: 'tax', description: `Sales tax (${input.taxBps / 100}%)`, quantity: 1, unitPriceMinor: tax, totalMinor: tax })
  if (input.freightMinor && input.freightMinor > 0) lines.push({ kind: 'freight', description: 'Freight', quantity: 1, unitPriceMinor: input.freightMinor, totalMinor: input.freightMinor })
  return { lines, taxExempt: exempt, taxExemptReason: exempt ? (input.exported || input.taxStatus === 'export' ? 'export' : 'resale certificate') : '' }
}

/** Card fee on the amount being paid by card. */
export function cardFee(amountMinor: number, feeBps: number) {
  return amountMinor > 0 ? bps(amountMinor, feeBps) : 0
}

/** Status of an invoice from its money. */
export function invoiceStatusFor(input: { totalMinor: number; paidMinor: number; refundedMinor: number; voided?: boolean }) {
  if (input.voided) return 'void'
  if (input.refundedMinor > 0 && input.refundedMinor >= input.paidMinor && input.paidMinor > 0) return 'refunded'
  if (input.refundedMinor > 0) return 'partially_refunded'
  if (input.paidMinor >= input.totalMinor && input.totalMinor > 0) return 'paid'
  if (input.totalMinor === 0) return 'paid'
  if (input.paidMinor > 0) return 'partially_paid'
  return 'open'
}

/** Refunds can never exceed what was captured on a payment. */
export function refundProblem(input: { capturedMinor: number; alreadyRefundedMinor: number; requestedMinor: number }) {
  if (!Number.isSafeInteger(input.requestedMinor) || input.requestedMinor <= 0) return 'Enter an amount greater than zero.'
  const refundable = input.capturedMinor - input.alreadyRefundedMinor
  if (input.requestedMinor > refundable) return `At most ${refundable} can be refunded on this payment.`
  return null
}

/** Restocking invoice amount on default (§3.4). */
export function restockingFee(awardMinor: number, feeBps: number) {
  return bps(awardMinor, feeBps)
}

/** Default bookkeeping: strike count and whether to suspend. */
export function strikeOutcome(currentStrikes: number, strikesBeforeSuspension: number) {
  const strikes = currentStrikes + 1
  return { strikes, suspend: strikes >= strikesBeforeSuspension }
}

/** Settlement totals (§4.2). Positive net is owed to the client. */
export function settlementTotals(lines: Array<{ kind: string; grossMinor: number; clientAmountMinor: number }>) {
  const fees = lines.filter((l) => l.kind === 'service_fee').reduce((s, l) => s + l.grossMinor, 0)
  const share = lines.filter((l) => l.kind !== 'service_fee').reduce((s, l) => s + l.clientAmountMinor, 0)
  return { feesTotalMinor: fees, clientShareTotalMinor: share, netMinor: share - fees }
}

export function formatMinor(minor: number | null | undefined, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((minor ?? 0) / 100)
}
