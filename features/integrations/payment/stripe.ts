import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaymentAdapterArgs } from './types'

// Stripe through its REST API (adapted from Barbershop's adapter): PaymentIntents,
// captured at once. The secret key comes from STRIPE_SECRET_KEY; test keys on our
// own deployment, live keys for a customer, the same code. Money is confirmed by
// reading the intent back from Stripe or from a signed webhook, never the browser.

const API = 'https://api.stripe.com/v1'

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function stripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ''
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Card payments are not set up. Add STRIPE_SECRET_KEY, or pay by bank transfer.')
  return key
}

function form(values: Record<string, string | number | undefined>) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') body.append(key, String(value))
  return body
}

/** Thrown when Stripe's answer was not received; the outcome is unknown, not failed. */
export class StripeUnknownOutcome extends Error {}

async function stripe<T>(path: string, init: { method?: 'GET' | 'POST'; body?: URLSearchParams; idempotencyKey?: string } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API}${path}`, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
      },
      body: init.body,
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    throw new StripeUnknownOutcome(`Stripe did not answer: ${(error as Error).message}`)
  }
  if (response.status >= 500) throw new StripeUnknownOutcome(`Stripe answered ${response.status}.`)
  const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } } & T
  if (!response.ok) throw new Error(json.error?.message || `Stripe request failed (${response.status}).`)
  return json
}

export type Intent = { id: string; status: string; amount: number; amount_received: number; currency: string; client_secret: string | null; latest_charge: string | null; last_payment_error?: { message?: string } | null }

/** Our session status from a PaymentIntent. */
export function intentStatus(intent: Pick<Intent, 'status'>) {
  switch (intent.status) {
    case 'succeeded':
      return 'captured'
    case 'requires_action':
    case 'processing':
      return 'requires_action'
    case 'requires_payment_method':
    case 'requires_confirmation':
      return 'pending'
    case 'canceled':
      return 'canceled'
    default:
      return 'unknown'
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export async function createPaymentFunction({ amount, currency, description, idempotencyKey, metadata, customerEmail }: PaymentAdapterArgs) {
  const cents = Math.round(Number(amount))
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Payment amount must be greater than zero.')
  const meta = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>
  const intent = await stripe<Intent>('/payment_intents', {
    method: 'POST',
    idempotencyKey: asString(idempotencyKey) || undefined,
    body: form({
      amount: cents,
      currency: asString(currency || 'usd').toLowerCase(),
      description: asString(description) || undefined,
      'payment_method_types[]': 'card',
      capture_method: 'automatic',
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(customerEmail)) ? { receipt_email: asString(customerEmail) } : {}),
      ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [`metadata[${key}]`, asString(value)])),
    }),
  })
  return { status: intentStatus(intent), id: intent.id, clientSecret: intent.client_secret, data: { id: intent.id, status: intent.status, amount: intent.amount } }
}

export const generatePaymentLinkFunction = createPaymentFunction

export async function getPaymentStatusFunction({ paymentId }: PaymentAdapterArgs) {
  const intent = await stripe<Intent>(`/payment_intents/${encodeURIComponent(asString(paymentId))}`)
  return { status: intentStatus(intent), amount: intent.amount, amountReceived: intent.amount_received, error: intent.last_payment_error?.message || null, data: { id: intent.id, status: intent.status, amount: intent.amount, amountReceived: intent.amount_received } }
}

export async function capturePaymentFunction(args: PaymentAdapterArgs) {
  return getPaymentStatusFunction(args)
}

export async function cancelPayment(paymentId: string) {
  return stripe<Intent>(`/payment_intents/${encodeURIComponent(paymentId)}/cancel`, { method: 'POST', body: form({}) })
}

export async function refundPaymentFunction({ paymentId, amount, idempotencyKey }: PaymentAdapterArgs) {
  const refund = await stripe<{ id: string; status: string; amount: number }>('/refunds', {
    method: 'POST',
    idempotencyKey: asString(idempotencyKey) || undefined,
    body: form({ payment_intent: asString(paymentId), amount: amount == null ? undefined : Math.round(Number(amount)) }),
  })
  return { status: refund.status, id: refund.id, amount: refund.amount, data: refund }
}

/**
 * Stripe's webhook signature: header `t=<ts>,v1=<hex>` over `${t}.${rawBody}` with
 * HMAC-SHA256. Checked over the exact received bytes, with a 5 minute tolerance.
 */
export function verifyStripeSignature(rawBody: Uint8Array, header: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  if (!rawBody.byteLength || !secret || !header) return false
  const parts = header.split(',').map((p) => p.trim().split('='))
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1])
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!Number.isFinite(timestamp) || !signatures.length) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest()
  return signatures.some((sig) => {
    if (!/^[a-f0-9]{64}$/i.test(sig)) return false
    const received = Buffer.from(sig, 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
  })
}

export async function handleWebhookFunction({ rawBody, signature }: PaymentAdapterArgs) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
  const body = rawBody as Uint8Array
  if (!verifyStripeSignature(body, asString(signature), secret)) throw new Error('Stripe webhook signature is invalid.')
  const event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as { id: string; type: string; data?: { object?: Intent } }
  return { eventId: event.id, eventType: event.type, intent: event.data?.object ?? null }
}
