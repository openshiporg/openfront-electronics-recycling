import { createHash } from 'node:crypto'
import { keystoneContext } from '@/features/keystone/context'
import { boundedRequestBytes, BoundedBodyError } from '@/features/keystone/security/bounded-body'
import { isPaymentProviderAdapterCode, paymentProviderAdapters } from '@/features/integrations/payment'
import { applyStripeEvent } from '@/features/keystone/domain/money'

const MAX_WEBHOOK_BYTES = 1_000_000
const reject = (status = 400) => Response.json({ success: false, error: 'Webhook was not accepted.' }, { status, headers: { Connection: 'close' } })

/**
 * Signed provider webhooks. The signature is checked by the adapter before anything is
 * parsed; each provider event id is processed once (PaymentWebhookEvent.replayKey is unique).
 */
export async function POST(request: Request, { params }: { params: Promise<{ providerCode: string }> }) {
  const { providerCode } = await params
  if (!isPaymentProviderAdapterCode(providerCode)) return reject(404)
  const registration = paymentProviderAdapters[providerCode]
  if (!registration.webhook) return reject(404)
  if (Number(request.headers.get('content-length') || 0) > MAX_WEBHOOK_BYTES) return reject(413)

  let rawBody: Uint8Array
  try { rawBody = await boundedRequestBytes(request, MAX_WEBHOOK_BYTES) }
  catch (error) { return reject(error instanceof BoundedBodyError ? error.status : 400) }
  if (!rawBody.byteLength) return reject()

  const adapter = await registration.load()
  let event: { eventId: string; eventType: string; intent: any }
  try {
    event = (await adapter.handleWebhookFunction({ rawBody, signature: request.headers.get(registration.webhook.signatureHeader) || '', provider: { code: providerCode } })) as any
  } catch {
    return reject(401)
  }
  if (!event?.eventId) return reject()

  const prisma = (keystoneContext.sudo() as any).prisma
  const replayKey = `${providerCode}:${event.eventId}`
  const payloadHash = createHash('sha256').update(rawBody).digest('hex')
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { replayKey } })
  if (existing) return Response.json({ success: true, error: null, replay: true })

  let outcome: string
  try {
    outcome = await applyStripeEvent({ prisma }, event)
  } catch (error) {
    console.error('[payment-webhook]', error)
    // Not recorded, so the provider retries.
    return Response.json({ success: false, error: 'Webhook could not be applied yet.' }, { status: 500 })
  }
  try {
    await prisma.paymentWebhookEvent.create({ data: { replayKey, providerCode, providerEventId: event.eventId, eventType: event.eventType, payloadHash, processedAt: new Date(), outcome } })
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error
  }
  return Response.json({ success: true, error: null })
}
