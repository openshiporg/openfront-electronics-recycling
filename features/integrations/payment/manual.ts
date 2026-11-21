import type { PaymentAdapterArgs } from './types'

// Bank transfer (wire, ACH, cheque). There is no processor behind it: the payer
// reports the transfer and an accountant confirms it against the bank statement.
// It never reports money as captured or refunded by itself.

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export async function handleWebhookFunction() {
  throw new Error('Bank transfers do not accept webhooks.')
}

export async function createPaymentFunction({ amount, currency }: PaymentAdapterArgs) {
  return { status: 'pending', data: { status: 'pending', amount: asNumber(amount), currency: String(currency || 'usd').toLowerCase(), provider: 'manual', settlement: 'offline' } }
}

export async function capturePaymentFunction() {
  throw new Error('Bank transfers are confirmed by an accountant, not captured by a processor.')
}

export async function refundPaymentFunction() {
  throw new Error('Bank transfer refunds are recorded by staff after the money is sent back.')
}

export async function getPaymentStatusFunction() {
  throw new Error('Bank transfers have no processor status to check.')
}

export async function generatePaymentLinkFunction() {
  return null
}
