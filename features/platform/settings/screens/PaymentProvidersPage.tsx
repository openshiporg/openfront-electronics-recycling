import { PlatformPage, can } from '../../lib/page'
import { ItemDrawer, SaveButton } from '../../lib/forms'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Td } from '../../lib/ui'

const ADAPTERS = [{ value: 'manual', label: 'Bank transfer (recorded by staff)' }, { value: 'stripe', label: 'Stripe card payments' }]

/** T7: which ways to pay are on. Card keys live only in the server environment; this page says what is set. */
export default async function PaymentProvidersPage() {
  return (
    <PlatformPage route="/platform/payment-providers" title="Payment providers" meta="Buyers and clients pay an invoice by card or bank transfer. Bank transfer always works; cards need Stripe keys on the server.">
      {async (staff) => {
        const [r, status] = await Promise.all([
          listQuery<any>('query { paymentProviders(orderBy: [{ name: asc }]) { id name code isInstalled createPaymentFunction paymentSessionsCount } }'),
          platformQuery<any>('serviceStatus', {}),
        ])
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const manage = can(staff, 'canManagePayments', 'canManageSettings')
        const cards = status.ok ? status.data.cards : null
        const fields = (p: any) => [
          { name: 'name', label: 'Name shown to payers', required: true, defaultValue: p.name },
          { name: 'isInstalled', label: 'On', type: 'checkbox' as const, defaultValue: p.isInstalled },
        ]
        return (
          <>
            <Section title="Card payments (Stripe)">
              {!cards ? <Notice tone="alert">{status.ok ? '' : status.error}</Notice> : cards.configured ? (
                <p className="text-sm">Cards are on, using Stripe {cards.mode}. Publishable key {cards.publishableKey ? 'set' : <span className="text-red-600">missing (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)</span>}. Webhook signing secret {cards.webhookSecret ? 'set' : <span className="text-amber-600">missing (STRIPE_WEBHOOK_SECRET): payments are still confirmed by reading them back from Stripe, just later</span>}. Webhook address: <span className="font-mono">/api/payment-webhooks/stripe</span>.</p>
              ) : (
                <p className="text-sm">Cards are off: STRIPE_SECRET_KEY is not set in the server environment. Payers see bank transfer only, and staff record payments under Payments. To turn cards on, set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_WEBHOOK_SECRET on the server.</p>
              )}
            </Section>
            <Section title="Providers" count={r.data.paymentProviders.length}>
              {r.data.paymentProviders.length ? <DataTable label="Payment providers" head={[{ label: 'Provider' }, { label: 'Adapter' }, { label: 'On' }, { label: 'Payments', className: 'text-right' }, { label: '' }]}>
                {r.data.paymentProviders.map((p: any) => <tr key={p.id}>
                  <Td className="font-medium">{p.name}<div className="font-mono text-xs text-muted-foreground">{p.code}</div></Td>
                  <Td>{ADAPTERS.find((a) => a.value === p.createPaymentFunction)?.label ?? p.createPaymentFunction}</Td>
                  <Td>{p.isInstalled ? 'Yes' : 'No'}</Td><Td className="text-right tabular-nums">{p.paymentSessionsCount}</Td>
                  <Td className="whitespace-nowrap text-right">{manage ? <><ItemDrawer listKey="PaymentProvider" id={p.id} title={`Edit ${p.name}`} trigger="Edit" fields={fields(p)} /><SaveButton listKey="PaymentProvider" id={p.id} data={{ isInstalled: !p.isInstalled }} label={p.isInstalled ? 'Turn off' : 'Turn on'} variant={p.isInstalled ? 'danger' : 'raised'} /></> : null}</Td>
                </tr>)}
              </DataTable> : <Empty>No providers. Run onboarding to add bank transfer and Stripe.</Empty>}
            </Section>
          </>
        )
      }}
    </PlatformPage>
  )
}
