'use server'
import { revalidatePath } from 'next/cache'
import { cmd } from '../data/client'
import type { Result } from './lots'

type FileInput = { filename: string; mimeType: string; base64: string }

async function run<T = any>(name: string, input: unknown, paths: string[] = ['/buyer', '/buyers/apply']): Promise<Result<T>> {
  const r = await cmd<T>(name, input)
  for (const p of paths) revalidatePath(p)
  return r.success ? { ok: true, data: r.data as T } : { ok: false, error: r.error || 'That did not go through.' }
}

/** P7 step 2 */
export async function saveApplicationAction(input: Record<string, unknown>) {
  return run('saveBuyerApplication', input)
}

/** P7 step 3 */
export async function uploadDocumentAction(input: { type: string; file: FileInput; state?: string; expiresOn?: string }) {
  return run('uploadBuyerDocument', input)
}

export async function submitApplicationAction(acceptTermsVersion: string) {
  return run('submitBuyerApplication', { acceptTermsVersion })
}

/** U1: answer a "more information" request. */
export async function replyAction(body: string) {
  return run('replyToBuyerMessage', { body })
}

/** U10 / U14 downloads */
export async function invoicePdfAction(invoiceNumber: string) {
  return run<FileInput>('downloadInvoice', { invoiceNumber }, [])
}

export async function orderDocumentAction(orderNumber: string, kind: string) {
  return run<FileInput>('downloadOrderDocument', { orderNumber, kind }, [])
}

/** U13 */
export async function setReleaseAction(input: { orderNumber: string; method: 'pickup' | 'freight'; preferredDate?: string; driverName?: string; carrierName?: string; carrierReference?: string; destinationCountry: string; exportAcknowledged?: boolean }) {
  return run('setOrderRelease', input, [`/buyer/orders/${input.orderNumber}`, '/buyer/orders', '/buyer'])
}

export type PaySession = { id: string; status: string; method: string; amountMinor: number; feeMinor: number; currencyCode: string; clientSecret: string; providerPaymentId: string; lastError: string }
export type PayOptions = { balanceMinor: number; card: boolean; cardFeeBps: number; cardFeeMinor: number; cardUnavailableReason: string | null; publishableKey: string; bankTransfer: boolean; wireInstructions: string }

/** U11 / C5: card. The domain opens the session through the Stripe adapter; we only hand the client secret to Stripe.js. */
export async function startPaymentAction(invoiceNumber: string, method: 'card' | 'bank_transfer', idempotencyKey: string, base: '/buyer' | '/client') {
  return run<{ method: string; session: PaySession | null; options: PayOptions }>('initiateInvoicePaymentSession', { invoiceNumber, method, idempotencyKey }, [`${base}/invoices/${invoiceNumber}`])
}

/** After Stripe.js confirms, the server asks Stripe for the result; the browser's word is never trusted. */
export async function completePaymentAction(invoiceNumber: string, paymentSessionId: string, base: '/buyer' | '/client') {
  return run<{ session: PaySession; invoice: { status: string; paidMinor: number; totalMinor: number } }>('completeInvoicePayment', { invoiceNumber, paymentSessionId }, [`${base}/invoices/${invoiceNumber}`, `${base}/invoices`, base, '/buyer/orders'])
}

/** U12 / C5: wire or ACH reported by the payer; staff confirm it against the statement. */
export async function reportTransferAction(input: { invoiceNumber: string; reference: string; date: string; amountMinor: number }, base: '/buyer' | '/client') {
  return run('reportBankTransfer', input, [`${base}/invoices/${input.invoiceNumber}`, `${base}/invoices`])
}
