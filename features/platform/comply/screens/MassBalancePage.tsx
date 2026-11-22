import { PlatformPage, day } from '../../lib/page'
import { OpButton } from '../../lib/forms'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Td } from '../../lib/ui'
import { param, type SearchParams } from '../../lib/view'

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const w = (n: number) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })

/** Y6: weight in against weight out (downstream, resale, returned) and on hand; the R2 mass balance. */
export default async function MassBalancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const to = param(sp, 'to') || ymd(new Date())
  const from = param(sp, 'from') || `${to.slice(0, 4)}-01-01`
  const facilityId = param(sp, 'facility')
  return (
    <PlatformPage route="/platform/mass-balance" title="Mass balance" meta="Everything received must be accounted for: shipped downstream, resold, returned to the client, or still on hand.">
      {async () => {
        const fac = await listQuery<any>('query { facilities(orderBy: [{ name: asc }]) { id name } }')
        const r = await platformQuery<any>('massBalanceReport', { from, to, facilityId: facilityId || null })
        const input = { from, to, facilityId: facilityId || null, format: 'xlsx' }
        return (
          <>
            <form className="flex flex-wrap items-end gap-2" action="/dashboard/platform/mass-balance">
              <label className="grid gap-1 text-xs">From<input type="date" name="from" defaultValue={from} className="h-9 rounded-[6px] border bg-background px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs">To<input type="date" name="to" defaultValue={to} className="h-9 rounded-[6px] border bg-background px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs">Facility<select name="facility" defaultValue={facilityId} className="h-9 rounded-[6px] border bg-background px-3 text-sm"><option value="">All</option>{(fac.ok ? fac.data.facilities : []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
              <button className="h-9 rounded-[6px] border px-3 text-sm">Run</button>
              <OpButton read op="massBalanceReport" input={input} label="Excel" />
            </form>
            {!r.ok ? <Notice tone="alert">{r.error}</Notice> : (
              <>
                <Readouts items={[
                  { label: `In (${r.data.unit})`, value: w(r.data.inWeight) }, { label: 'Out', value: w(r.data.outWeight) }, { label: 'On hand', value: w(r.data.onHandWeight) },
                  { label: 'Unaccounted', value: w(r.data.varianceWeight), tone: Math.abs(r.data.varianceWeight) > 0.5 ? 'alert' : 'live' },
                  { label: 'Shipments', value: r.data.shipments }, { label: 'Receipts confirmed', value: r.data.receiptsConfirmed }, { label: 'Receipt variance', value: w(r.data.receiptVarianceWeight) },
                ]} />
                <p className="text-sm text-muted-foreground">{day(from)} to {day(to)}. Unaccounted = in − out − on hand.</p>
                <Section title="Out, by material">
                  {r.data.rows.length ? <DataTable label="By material" head={[{ label: 'Material' }, { label: 'Downstream', className: 'text-right' }, { label: 'Resale', className: 'text-right' }, { label: 'Returned', className: 'text-right' }]}>{r.data.rows.map((x: any) => <tr key={x.category}><Td>{x.category}</Td><Td className="text-right tabular-nums">{w(x.downstream)}</Td><Td className="text-right tabular-nums">{w(x.resale)}</Td><Td className="text-right tabular-nums">{w(x.returned)}</Td></tr>)}</DataTable> : <Empty>Nothing left in this period.</Empty>}
                </Section>
                <Section title="Downstream, by vendor">
                  {r.data.vendors.length ? <DataTable label="By vendor" head={[{ label: 'Vendor' }, { label: 'Weight', className: 'text-right' }]}>{r.data.vendors.map((v: any) => <tr key={v.name}><Td>{v.name}</Td><Td className="text-right tabular-nums">{w(v.weight)}</Td></tr>)}</DataTable> : <Empty>No downstream shipments.</Empty>}
                </Section>
              </>
            )}
          </>
        )
      }}
    </PlatformPage>
  )
}
