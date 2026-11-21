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
