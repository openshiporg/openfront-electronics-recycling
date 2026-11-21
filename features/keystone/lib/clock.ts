import { advanceLotClock } from '../domain/lots'
import { expireBuyerDocuments } from '../domain/buyers'
import { cancelStaleUnknownSessions } from '../domain/money'
import { deliverPendingEmail } from './services'
import type { Ctx } from './core'

/**
 * One pass of the time-driven work: close and open lots on schedule, expire bids,
 * mark overdue invoices, send lot reminders, expire buyer documents and send queued email.
 * Reads also call advanceLotClock for the lots they show, so a stopped ticker never
 * shows a lot as open after its close time.
 */
export async function tickClock(context: Pick<Ctx, 'prisma'>) {
  const results: Record<string, string> = {}
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { await fn(); results[name] = 'ok' } catch (error) { console.error(`[clock] ${name}`, error); results[name] = 'failed' }
  }
  await step('lots', () => advanceLotClock(context))
  await step('buyerDocuments', () => expireBuyerDocuments(context, new Date()))
  await step('paymentSessions', () => cancelStaleUnknownSessions(context))
  await step('email', () => deliverPendingEmail(context))
  return results
}
