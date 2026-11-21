import type { PaymentAdapterModule } from './types';
import * as manualAdapter from './manual';
import * as stripeAdapter from './stripe';

export type PaymentWebhookRegistration = {
  secretEnv: string;
  signatureHeader: string;
};

export type PaymentAdapterRegistration = {
  load: () => Promise<PaymentAdapterModule>;
  /**
   * `offline` providers (bank transfer, cheque) have no processor: the payer reports
   * the transfer and an accountant confirms it against the bank statement. Capture,
   * refund and status checks never run through them.
   */
  settlement: 'offline' | 'processor';
  webhook: PaymentWebhookRegistration | null;
};

// Provider execution is code-owned (copied from Barbershop). Database values may select
// only one of these keys; they can never supply an import path, URL, or secret.
export const paymentProviderAdapters = {
  manual: {
    load: async () => manualAdapter as unknown as PaymentAdapterModule,
    settlement: 'offline',
    webhook: null,
  },
  // Card payments through Stripe PaymentIntents; needs STRIPE_SECRET_KEY. The webhook
  // secret is STRIPE_WEBHOOK_SECRET; without it staff use "Check payment".
  stripe: {
    load: async () => stripeAdapter as unknown as PaymentAdapterModule,
    settlement: 'processor',
    webhook: { secretEnv: 'STRIPE_WEBHOOK_SECRET', signatureHeader: 'stripe-signature' },
  },
} as const satisfies Record<string, PaymentAdapterRegistration>;

export type PaymentProviderAdapterCode = keyof typeof paymentProviderAdapters;

export function isPaymentProviderAdapterCode(value: string): value is PaymentProviderAdapterCode {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value);
}

export function getPaymentProviderRegistration(code: string): PaymentAdapterRegistration | null {
  return isPaymentProviderAdapterCode(code) ? paymentProviderAdapters[code] : null;
}
