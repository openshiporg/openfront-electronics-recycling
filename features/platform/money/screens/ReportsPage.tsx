import { PlatformPage, can, day, label, usd } from '../../lib/page'
import { OpButton } from '../../lib/forms'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Track, Td } from '../../lib/ui'
import { param, type SearchParams } from '../../lib/view'

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** M6: sales report and client impact report, on screen and as Excel or PDF. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const to = param(sp, 'to') || ymd(new Date())
  const from = param(sp, 'from') || ymd(new Date(Date.now() - 30 * 86_400_000))
  const org = param(sp, 'org')
  return (
    <PlatformPage route="/platform/reports" title="Reports" meta="Sales by lot, category and buyer; and the environmental impact report clients ask for.">
      {async (staff) => {
        const sales = can(staff, 'canViewReports') ? await platformQuery<any>('salesReport', { from, to }) : null
        const orgs = await listQuery<any>('query { clientOrganizations(orderBy: [{ name: asc }], take: 200) { id name } }')
        const impact = org ? await platformQuery<any>('clientImpactReport', { organizationId: org, from, to }) : null
        return (
          <>
            <form className="flex flex-wrap items-end gap-2" action="/dashboard/platform/reports">
              <label className="grid gap-1 text-xs">From<input type="date" name="from" defaultValue={from} className="h-9 rounded-[6px] border bg-background px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs">To<input type="date" name="to" defaultValue={to} className="h-9 rounded-[6px] border bg-background px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs">Client (impact report)<select name="org" defaultValue={org} className="h-9 rounded-[6px] border bg-background px-3 text-sm"><option value="">—</option>{(orgs.ok ? orgs.data.clientOrganizations : []).map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
              <button className="h-9 rounded-[6px] border px-3 text-sm">Run</button>
            </form>

            {sales ? (
              <Section title={`Sales, ${day(from)} to ${day(to)}`} actions={<OpButton read op="salesReport" input={{ from, to, format: 'xlsx' }} label="Excel" />}>
                {!sales.ok ? <Notice tone="alert">{sales.error}</Notice> : (
                  <div className="grid gap-4">
                    <Readouts items={[{ label: 'Lots awarded', value: sales.data.lots }, { label: 'Awarded', value: usd(sales.data.grossMinor) }, { label: 'Invoiced', value: usd(sales.data.invoicedMinor) }, { label: 'Collected', value: usd(sales.data.collectedMinor) }, { label: 'Defaults', value: sales.data.defaults }]} />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <DataTable label="By category" head={[{ label: 'Category' }, { label: 'Lots', className: 'text-right' }, { label: 'Amount', className: 'text-right' }]}>{sales.data.byCategory.map((c: any) => <tr key={c.name}><Td>{c.name || 'Uncategorised'}</Td><Td className="text-right tabular-nums">{c.lots}</Td><Td className="text-right tabular-nums">{usd(c.amountMinor)}</Td></tr>)}</DataTable>
                      <DataTable label="By buyer" head={[{ label: 'Buyer' }, { label: 'Lots', className: 'text-right' }, { label: 'Amount', className: 'text-right' }]}>{sales.data.byBuyer.map((c: any) => <tr key={c.name}><Td>{c.name}</Td><Td className="text-right tabular-nums">{c.lots}</Td><Td className="text-right tabular-nums">{usd(c.amountMinor)}</Td></tr>)}</DataTable>
                    </div>
                    {sales.data.rows.length ? (
                      <DataTable label="Awards" head={[{ label: 'Awarded' }, { label: 'Lot' }, { label: 'Buyer' }, { label: 'Format' }, { label: 'Award', className: 'text-right' }, { label: 'Order' }, { label: 'Paid', className: 'text-right' }]}>
                        {sales.data.rows.map((r: any, i: number) => <tr key={i}><Td>{day(r.awardedAt)}</Td><Td>{r.lotNumber} <span className="text-muted-foreground">{r.title}</span></Td><Td>{r.buyer}</Td><Td>{label(r.format)}</Td><Td className="text-right tabular-nums">{usd(r.amountMinor)}{r.belowReserve ? <div className="text-xs text-muted-foreground">below reserve</div> : null}</Td><Td>{r.orderNumber} <span className="text-xs text-muted-foreground">{label(r.orderStatus)}</span></Td><Td className="text-right tabular-nums">{usd(r.paidMinor)}</Td></tr>)}
                      </DataTable>
                    ) : <Empty>No awards in this period.</Empty>}
                  </div>
                )}
              </Section>
            ) : null}

            <Section title="Client impact report" actions={impact?.ok ? <Track><OpButton read op="clientImpactReport" input={{ organizationId: org, from, to, format: 'pdf' }} label="PDF" /><OpButton read op="clientImpactReport" input={{ organizationId: org, from, to, format: 'xlsx' }} label="Excel" /></Track> : null}>
              {!impact ? <Empty>Choose a client above to see weight collected, units reused and weight recycled.</Empty> : !impact.ok ? <Notice tone="alert">{impact.error}</Notice> : (
                <Readouts items={[
                  { label: 'Jobs', value: impact.data.jobs }, { label: 'Collected', value: `${Number(impact.data.collectedWeight).toFixed(1)} ${impact.data.unit}` },
                  { label: 'Units processed', value: impact.data.units }, { label: 'Units reused', value: impact.data.reusedUnits },
                  { label: 'Weight reused', value: `${Number(impact.data.reusedWeight).toFixed(1)} ${impact.data.unit}` }, { label: 'Weight recycled', value: `${Number(impact.data.recycledWeight).toFixed(1)} ${impact.data.unit}` },
                  { label: 'Data-bearing', value: impact.data.dataBearing }, { label: 'Sanitised or destroyed', value: impact.data.sanitized },
                ]} />
              )}
            </Section>
          </>
        )
      }}
    </PlatformPage>
  )
}
