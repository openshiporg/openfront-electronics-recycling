// Starter records are created in a few minutes by the real domain functions, so
// every row carries "now". This module gives them the history a real recycler's
// first weeks would have: the seed marks each phase (a job being quoted, a pallet
// being audited, a lot closing) with the business-hours time it should have
// happened, and afterwards every timestamp written during a phase is moved, in
// order, into that phase's story window. Order inside a phase is kept, so the
// chain of custody, audit log and notifications still read step by step.

type Piece = { r0: number; r1: number; s0: number; s1: number }
type Phase = { at: number; start: Date; end: Date }

const WORK_START = [8, 0] as const
const WORK_END = [17, 30] as const

function partsIn(t: number, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second }
}

/** 'YYYY-MM-DD' of an instant in the business's time zone. */
export function localDay(t: Date | number, timeZone: string) {
  const p = partsIn(+t, timeZone)
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** The instant of a wall-clock time on a local day in the time zone. */
export function zoned(day: string, hh: number, mm: number, timeZone: string) {
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const p = partsIn(guess, timeZone)
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - guess
  return new Date(guess - offset)
}

const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()
const isBusinessDay = (day: string) => weekday(day) !== 0 && weekday(day) !== 6
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export function storyClock(timeZone: string, now = new Date()) {
  // Day 0 is the latest business day whose working day has already ended, so every
  // story time is in the past whenever the seed runs.
  let anchor = localDay(now, timeZone)
  while (!isBusinessDay(anchor) || zoned(anchor, WORK_END[0], WORK_END[1], timeZone) > now) anchor = shiftDay(anchor, -1)
  const businessDay = (n: number) => {
    let day = anchor
    let left = Math.abs(n)
    const step = n >= 0 ? -1 : 1
    while (left > 0) {
      day = shiftDay(day, step)
      if (isBusinessDay(day)) left--
    }
    return day
  }
  /** n business days back (negative: ahead) at a local wall-clock time. */
  const at = (n: number, hh: number, mm = 0) => zoned(businessDay(n), hh, mm, timeZone)
  /** The local date n business days back; negative counts forward from today. */
  const day = (n: number) => {
    if (n >= 0) return businessDay(n)
    let d = localDay(now, timeZone)
    let left = -n
    while (left > 0) {
      d = shiftDay(d, 1)
      if (isBusinessDay(d)) left--
    }
    return d
  }
  return { at, day, timeZone }
}

/** Working-hours windows between two instants; time outside them is skipped. */
function workWindows(s: number, e: number, timeZone: string) {
  const out: Array<[number, number]> = []
  for (let day = localDay(s, timeZone); day <= localDay(e, timeZone); day = shiftDay(day, 1)) {
    if (!isBusinessDay(day)) continue
    const a = Math.max(s, +zoned(day, WORK_START[0], WORK_START[1], timeZone))
    const b = Math.min(e, +zoned(day, WORK_END[0], WORK_END[1], timeZone))
    if (b > a) out.push([a, b])
  }
  return out.length ? out : [[s, e] as [number, number]]
}

export class StarterTimeline {
  private phases: Phase[] = []
  constructor(readonly since: Date, readonly timeZone: string) {}

  /** Everything written from now until the next mark happened between start and end. */
  mark(start: Date, end: Date) {
    this.phases.push({ at: Date.now(), start, end: end > start ? end : new Date(+start + 60_000) })
  }

  pieces(until: number): Piece[] {
    const out: Piece[] = []
    const all = this.phases.map((p, i) => ({ ...p, from: i === 0 ? Math.min(+this.since, p.at) : p.at, to: this.phases[i + 1]?.at ?? until }))
    for (const p of all) {
      if (p.to <= p.from) continue
      const windows = workWindows(+p.start, +p.end, this.timeZone)
      const total = windows.reduce((n, [a, b]) => n + (b - a), 0)
      let used = 0
      for (const [a, b] of windows) {
        const r0 = p.from + ((p.to - p.from) * used) / total
        used += b - a
        const r1 = p.from + ((p.to - p.from) * used) / total
        out.push({ r0, r1, s0: a, s1: b })
      }
    }
    return out
  }
}

/** Moves every timestamp written in [since, until) to its phase's story time. */
export async function applyTimeline(prisma: any, timeline: StarterTimeline, until = Date.now()) {
  const pieces = timeline.pieces(until)
  if (!pieces.length) return 0
  const lo = Math.min(...pieces.map((p) => p.r0))
  const hi = Math.max(...pieces.map((p) => p.r1))
  const columns: Array<{ table_name: string; column_name: string }> = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND data_type = 'timestamp without time zone' AND table_name NOT LIKE '\\_prisma%'`,
  )
  let updated = 0
  for (const { table_name, column_name } of columns) {
    const col = `"${column_name.replace(/"/g, '')}"`
    const ms = `(extract(epoch from ${col}) * 1000)`
    const cases = pieces.map((p) => {
      const k = (p.s1 - p.s0) / Math.max(1, p.r1 - p.r0)
      return `WHEN ${ms} >= ${p.r0.toFixed(3)} AND ${ms} < ${p.r1.toFixed(3)} THEN to_timestamp((${p.s0} + (${ms} - ${p.r0.toFixed(3)}) * ${k}) / 1000.0) AT TIME ZONE 'UTC'`
    })
    const sql = `UPDATE "${table_name.replace(/"/g, '')}" SET ${col} = CASE ${cases.join(' ')} ELSE ${col} END WHERE ${ms} >= ${lo.toFixed(3)} AND ${ms} < ${hi.toFixed(3)}`
    updated += Number(await prisma.$executeRawUnsafe(sql))
  }
  return updated
}
