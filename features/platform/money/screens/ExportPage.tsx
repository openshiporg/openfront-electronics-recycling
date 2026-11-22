import { PlatformPage } from '../../lib/page'
import { OpForm } from '../../lib/forms'
import { Section } from '../../lib/ui'

/** M7: CSV for the accounting package (QuickBooks / Xero import columns). */
export default async function ExportPage() {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 8)}01`
  return (
    <PlatformPage route="/platform/export" title="Accounting export" meta="Invoices (one row per line), received payments, or refunds for a date range, as CSV.">
      {async () => (
        <Section title="Export">
          <OpForm op="accountingExport" className="max-w-xl" fields={[
            { name: 'kind', label: 'What', type: 'select', required: true, options: [{ value: 'invoices', label: 'Invoices' }, { value: 'payments', label: 'Payments' }, { value: 'refunds', label: 'Refunds' }], defaultValue: 'invoices' },
            { name: 'from', label: 'From', type: 'date', required: true, defaultValue: monthStart },
            { name: 'to', label: 'To', type: 'date', required: true, defaultValue: today },
          ]} submitLabel="Download CSV" />
        </Section>
      )}
    </PlatformPage>
  )
}
