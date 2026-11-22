import { PlatformPage, can } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { Empty, Notice, Section, Track } from '../../lib/ui'
import { param, RowLink, Status, type SearchParams } from '../../lib/view'

const time = (at: string, timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(at))
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/** S17 pickup slots and K8 drop-offs: one facility, one day, slot by slot. */
export default async function DockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  return (
    <PlatformPage route="/platform/dock" title="Dock calendar" meta="Buyer pickups and client drop-offs, by facility and day. Each slot takes as many trucks as the facility allows.">
      {async (staff) => {
        const opts = await listQuery<any>(`query { facilities(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name code }
          orders(where: { status: { in: [paid, ready_for_release] } }, orderBy: [{ createdAt: asc }], take: 100) { id orderNumber company { legalName } dockAppointment { status } lot { facility { id } } }
          jobs(where: { status: { in: [accepted, scheduled] } }, orderBy: [{ createdAt: asc }], take: 100) { id jobNumber organization { name } } }`)
        if (!opts.ok) return <Notice tone="alert">{opts.error}</Notice>
        const facilities = opts.data.facilities
        if (!facilities.length) return <Empty>Add a facility under Settings first.</Empty>
        const facilityId = param(sp, 'facility') || facilities[0].id
        const today = new Date().toISOString().slice(0, 10)
        const date = /^\d{4}-\d{2}-\d{2}$/.test(param(sp, 'date')) ? param(sp, 'date') : today
        const dayRead = await platformQuery<any>('dockDay', { facilityId, date })
        if (!dayRead.ok) return <Notice tone="alert">{dayRead.error}</Notice>
        const d = dayRead.data
        const tz = d.timeZone
        const book = can(staff, 'canManageLots', 'canReceive', 'canDispatch')
        const unbooked = opts.data.orders.filter((o: any) => (!o.dockAppointment || o.dockAppointment.status === 'cancelled') && (!o.lot?.facility || o.lot.facility.id === facilityId))
        const link = (patch: Record<string, string>) => `/dashboard/platform/dock?${new URLSearchParams({ facility: facilityId, date, ...patch })}`
        const bookFields = (startsAt: string) => [
          { name: 'startsAt', label: 'Slot', type: 'datetime' as const, required: true, defaultValue: startsAt },
          { name: 'orderId', label: 'Buyer pickup (order)', type: 'select' as const, options: unbooked.map((o: any) => ({ value: o.id, label: `${o.orderNumber} · ${o.company?.legalName}` })) },
          { name: 'jobId', label: 'Client drop-off (job)', type: 'select' as const, options: opts.data.jobs.map((j: any) => ({ value: j.id, label: `${j.jobNumber} · ${j.organization?.name}` })) },
          { name: 'driverName', label: 'Driver' }, { name: 'vehicle', label: 'Vehicle' }, { name: 'notes', label: 'Notes', type: 'textarea' as const },
        ]
        const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
        return (
          <>
            <form className="flex flex-wrap items-center gap-2" action="/dashboard/platform/dock">
              <select name="facility" defaultValue={facilityId} className="h-9 rounded-[6px] border bg-background px-3 text-sm">{facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <input type="date" name="date" defaultValue={date} className="h-9 rounded-[6px] border bg-background px-3 text-sm" />
              <button className="h-9 rounded-[6px] border px-3 text-sm">Show</button>
              <Track><RowLink href={link({ date: shift(date, -1) })}>← Previous day</RowLink><RowLink href={link({ date: today })}>Today</RowLink><RowLink href={link({ date: shift(date, 1) })}>Next day →</RowLink></Track>
            </form>
            <Section title={`${d.facility.name} · ${dayName}`} count={d.appointments.filter((a: any) => a.status !== 'cancelled').length} actions={book ? <OpDrawer op="bookDockAppointment" fixed={{ facilityId }} title="Book a slot" trigger="Book a slot" triggerVariant="primary" fields={bookFields(`${date}T09:00`)} submitLabel="Book" /> : null}>
              {!d.open ? <Empty>The dock is closed this day.</Empty> : (
                <ul className="divide-y rounded-[6px] border">
                  {d.slots.map((s: any) => {
                    const here = d.appointments.filter((a: any) => new Date(a.startsAt) < new Date(s.endsAt) && new Date(a.endsAt) > new Date(s.startsAt))
                    return (
                      <li key={s.startsAt} className="grid gap-2 px-3 py-2 sm:grid-cols-[7rem_1fr_auto] sm:items-start">
                        <span className="text-sm font-medium tabular-nums">{time(s.startsAt, tz)}</span>
                        <div className="grid gap-1.5">
                          {here.length ? here.map((a: any) => (
                            <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                              {a.order ? <RowLink href={`/dashboard/platform/orders/${a.order.id}`}>{a.order.orderNumber}</RowLink> : a.job ? <RowLink href={`/dashboard/platform/jobs/${a.job.id}`}>{a.job.jobNumber}</RowLink> : null}
                              <span className="text-muted-foreground">{a.order ? `Pickup · ${a.order.company?.legalName}` : a.job ? `Drop-off · ${a.job.organization?.name}` : ''}{a.driverName ? ` · ${a.driverName}` : ''}{a.vehicle ? ` · ${a.vehicle}` : ''}</span>
                              <Status value={a.status} />
                              {book && ['booked', 'arrived'].includes(a.status) ? <>
                                {a.status === 'booked' ? <OpButton op="setDockAppointmentStatus" input={{ appointmentId: a.id, status: 'arrived' }} label="Arrived" /> : null}
                                <OpButton op="setDockAppointmentStatus" input={{ appointmentId: a.id, status: 'done' }} label="Done" />
                                <OpDrawer op="bookDockAppointment" fixed={{ facilityId, appointmentId: a.id, orderId: a.order?.id ?? null, jobId: a.job?.id ?? null }} title="Move this slot" trigger="Move" fields={[{ name: 'startsAt', label: 'New slot', type: 'datetime', required: true, defaultValue: a.startsAt }, { name: 'driverName', label: 'Driver', defaultValue: a.driverName }, { name: 'vehicle', label: 'Vehicle', defaultValue: a.vehicle }, { name: 'notes', label: 'Notes', type: 'textarea', defaultValue: a.notes }]} submitLabel="Move" />
                                {a.status === 'booked' ? <OpButton op="setDockAppointmentStatus" input={{ appointmentId: a.id, status: 'no_show' }} label="No-show" confirm="Mark as a no-show?" /> : null}
                                <OpDrawer op="setDockAppointmentStatus" fixed={{ appointmentId: a.id, status: 'cancelled' }} title="Cancel this slot" description={a.order ? 'The buyer is told.' : undefined} trigger="Cancel" triggerVariant="danger" fields={[{ name: 'note', label: 'Reason', type: 'textarea' }]} submitLabel="Cancel slot" />
                              </> : null}
                            </div>
                          )) : <span className="text-sm text-muted-foreground">Free</span>}
                        </div>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">{s.free ? `${s.free} free` : 'Full'}{book && s.free ? <OpDrawer op="bookDockAppointment" fixed={{ facilityId, startsAt: s.startsAt }} title={`Book ${time(s.startsAt, tz)}`} trigger="Book" fields={bookFields(s.startsAt).slice(1)} submitLabel="Book" /> : null}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
            {unbooked.length ? (
              <Section title="Paid orders without a pickup slot" count={unbooked.length}>
                <ul className="grid gap-1 text-sm">{unbooked.map((o: any) => <li key={o.id}><RowLink href={`/dashboard/platform/orders/${o.id}`}>{o.orderNumber}</RowLink> · {o.company?.legalName}</li>)}</ul>
              </Section>
            ) : null}
            <p className="text-xs text-muted-foreground">Times are {tz}. Slots are {d.facility.slotMinutes} minutes; {d.facility.perWindow} truck{d.facility.perWindow === 1 ? '' : 's'} per slot.</p>
          </>
        )
      }}
    </PlatformPage>
  )
}
