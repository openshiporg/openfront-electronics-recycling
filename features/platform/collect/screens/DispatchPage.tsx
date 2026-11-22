import { PlatformPage, can, day } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Td } from '../../lib/ui'
import { param, RowLink, Status, type SearchParams } from '../../lib/view'

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** K4: give accepted jobs a date, window, driver and vehicle; see the week's runs. */
export default async function DispatchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const from = param(sp, 'from') || ymd(new Date())
  const to = ymd(new Date(new Date(`${from}T00:00:00Z`).getTime() + 7 * 86_400_000))
  return (
    <PlatformPage route="/platform/dispatch" title="Dispatch" meta="Accepted jobs waiting for a date, and the runs booked for the next seven days.">
      {async (staff) => {
        const r = await listQuery<any>(`query D($from: CalendarDay!, $to: CalendarDay!) {
          waiting: jobs(where: { status: { equals: accepted } }, orderBy: [{ quoteAcceptedAt: asc }], take: 100) { id jobNumber requestedDates contactName organization { name } site { city hasDock needsLiftgate } siteAddress estimateLines { quantity unit notes } }
          booked: jobs(where: { AND: [{ status: { in: [scheduled, en_route] } }, { scheduledDate: { gte: $from, lt: $to } }] }, orderBy: [{ scheduledDate: asc }, { windowStart: asc }], take: 200) { id jobNumber status scheduledDate windowStart windowEnd vehicle driver { id name } organization { name } site { city } siteAddress }
          users(where: { AND: [{ kind: { equals: staff } }, { isActive: { equals: true } }, { role: { canCollect: { equals: true } } }] }, orderBy: [{ name: asc }]) { id name }
        }`, { from, to })
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const dispatch = can(staff, 'canDispatch')
        const drivers = r.data.users.map((u: any) => ({ value: u.id, label: u.name }))
        const city = (j: any) => j.site?.city ?? j.siteAddress?.city ?? ''
        const scheduleFields = (j: any) => [
          { name: 'date', label: 'Date', type: 'date' as const, required: true, defaultValue: j.scheduledDate?.slice(0, 10) || (Array.isArray(j.requestedDates) ? j.requestedDates[0] : undefined) },
          { name: 'windowStart', label: 'Window from', type: 'time' as const, required: true, defaultValue: j.windowStart || '09:00' },
          { name: 'windowEnd', label: 'Window to', type: 'time' as const, required: true, defaultValue: j.windowEnd || '12:00' },
          { name: 'driverId', label: 'Driver', type: 'select' as const, options: drivers, defaultValue: j.driver?.id },
          { name: 'vehicle', label: 'Vehicle', defaultValue: j.vehicle },
        ]
        const byDay = new Map<string, any[]>()
        for (const j of r.data.booked) { const k = j.scheduledDate.slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), j]) }
        const prev = ymd(new Date(new Date(`${from}T00:00:00Z`).getTime() - 7 * 86_400_000))
        return (
          <>
            {!drivers.length ? <Notice>No active team member has a role that can collect. Give a role “Collect” under Team.</Notice> : null}
            <Section title="Waiting for a date" count={r.data.waiting.length}>
              {r.data.waiting.length ? (
                <DataTable label="Accepted jobs" head={[{ label: 'Job' }, { label: 'Where' }, { label: 'Client wants' }, { label: 'Load' }, { label: '' }]}>
                  {r.data.waiting.map((j: any) => <tr key={j.id}>
                    <Td><RowLink href={`/dashboard/platform/jobs/${j.id}`}>{j.jobNumber}</RowLink><div className="text-xs text-muted-foreground">{j.organization?.name}</div></Td>
                    <Td>{city(j)}{j.site?.hasDock ? ' · dock' : ''}{j.site?.needsLiftgate ? ' · liftgate' : ''}</Td>
                    <Td>{Array.isArray(j.requestedDates) && j.requestedDates.length ? j.requestedDates.map((d: string) => day(d)).join(', ') : '—'}</Td>
                    <Td className="text-xs">{j.estimateLines.map((e: any) => `${e.quantity} ${e.unit} ${e.notes ?? ''}`).join('; ')}</Td>
                    <Td className="text-right">{dispatch ? <OpDrawer op="scheduleJob" fixed={{ jobId: j.id }} title={`Schedule ${j.jobNumber}`} trigger="Schedule" triggerVariant="primary" fields={scheduleFields(j)} submitLabel="Schedule" /> : null}</Td>
                  </tr>)}
                </DataTable>
              ) : <Empty>Nothing waiting.</Empty>}
            </Section>
            <Section title={`Runs from ${day(from)}`} actions={<span className="flex gap-3 text-sm"><RowLink href={`/dashboard/platform/dispatch?from=${prev}`}>Previous week</RowLink><RowLink href={`/dashboard/platform/dispatch?from=${to}`}>Next week</RowLink></span>}>
              {byDay.size ? [...byDay.entries()].map(([d, jobs]) => (
                <div key={d} className="mb-4">
                  <h3 className="mb-1 text-sm font-medium">{day(d)}</h3>
                  <DataTable label={`Runs on ${d}`} head={[{ label: 'Window' }, { label: 'Job' }, { label: 'Where' }, { label: 'Driver' }, { label: 'Status' }, { label: '' }]}>
                    {jobs.map((j: any) => <tr key={j.id}>
                      <Td className="tabular-nums">{j.windowStart}–{j.windowEnd}</Td>
                      <Td><RowLink href={`/dashboard/platform/jobs/${j.id}`}>{j.jobNumber}</RowLink><div className="text-xs text-muted-foreground">{j.organization?.name}</div></Td>
                      <Td>{city(j)}</Td><Td>{j.driver?.name ?? <span className="text-red-600">No driver</span>}{j.vehicle ? <div className="text-xs text-muted-foreground">{j.vehicle}</div> : null}</Td>
                      <Td><Status value={j.status} /></Td>
                      <Td className="whitespace-nowrap text-right">{dispatch && j.status === 'scheduled' ? <OpDrawer op="scheduleJob" fixed={{ jobId: j.id }} title={`Reschedule ${j.jobNumber}`} trigger="Change" fields={scheduleFields(j)} submitLabel="Save" /> : null}{can(staff, 'canCollect', 'canDispatch') && j.status === 'scheduled' ? <OpButton op="startJobRoute" input={{ jobId: j.id }} label="Start route" /> : null}</Td>
                    </tr>)}
                  </DataTable>
                </div>
              )) : <Empty>No runs booked this week.</Empty>}
            </Section>
          </>
        )
      }}
    </PlatformPage>
  )
}
