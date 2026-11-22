// Business days in the store's time zone (Monday to Friday; no public holidays in v1).

function weekdayIn(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

/** Adds n business days, keeping the time of day. */
export function addBusinessDays(start: Date, days: number, timeZone = 'UTC') {
  let date = new Date(start.getTime())
  let remaining = Math.max(0, Math.floor(days))
  while (remaining > 0) {
    date = new Date(date.getTime() + 86_400_000)
    const day = weekdayIn(date, timeZone)
    if (day !== 0 && day !== 6) remaining--
  }
  return date
}

export function isPast(at: Date | string | null | undefined, now: Date) {
  return at != null && new Date(at).getTime() <= now.getTime()
}

/** The UTC instant for a wall-clock time ("YYYY-MM-DD", "HH:MM") in a time zone. */
export function zonedInstant(date: string, time: string, timeZone: string) {
  const guess = new Date(`${date}T${time}:00Z`)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess).map((p) => [p.type, p.value]))
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  const first = new Date(guess.getTime() - (shown - guess.getTime()))
  // Second pass settles the offset across a DST change.
  const p2 = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(first).map((p) => [p.type, p.value]))
  const shown2 = Date.UTC(Number(p2.year), Number(p2.month) - 1, Number(p2.day), Number(p2.hour), Number(p2.minute))
  return new Date(first.getTime() - (shown2 - guess.getTime()))
}

/**
 * Dock slots for one day from the facility's opening hours ({ mon: "07:30-16:30", ... }),
 * with how many bookings each slot can still take.
 */
export function dockSlots(args: { date: string; hours: Record<string, string | null> | null | undefined; slotMinutes: number; perWindow: number; timeZone: string; booked: Array<{ startsAt: Date | string; endsAt: Date | string }> }) {
  const weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${args.date}T12:00:00Z`).getUTCDay()]
  const window = args.hours?.[weekday]
  const match = typeof window === 'string' ? window.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/) : null
  if (!match) return { open: false as const, slots: [] as Array<{ startsAt: Date; endsAt: Date; taken: number; free: number }> }
  const minutes = Math.max(15, args.slotMinutes || 60)
  const from = zonedInstant(args.date, `${match[1]}:${match[2]}`, args.timeZone)
  const to = zonedInstant(args.date, `${match[3]}:${match[4]}`, args.timeZone)
  const slots = []
  for (let t = from.getTime(); t + minutes * 60_000 <= to.getTime(); t += minutes * 60_000) {
    const startsAt = new Date(t); const endsAt = new Date(t + minutes * 60_000)
    const taken = args.booked.filter((b) => new Date(b.startsAt) < endsAt && new Date(b.endsAt) > startsAt).length
    slots.push({ startsAt, endsAt, taken, free: Math.max(0, Math.max(1, args.perWindow || 1) - taken) })
  }
  return { open: true as const, slots }
}
