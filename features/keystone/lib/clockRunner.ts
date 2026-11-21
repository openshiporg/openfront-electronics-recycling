import { keystoneContext } from '../context'
import { tickClock } from './clock'

let started = false
let running = false

export function startClock(intervalMs = 60_000) {
  if (started) return
  started = true
  const run = async () => {
    if (running) return
    running = true
    try { await tickClock((keystoneContext.sudo() as any)) } catch (error) { console.error('[clock]', error) } finally { running = false }
  }
  setTimeout(run, 15_000)
  setInterval(run, intervalMs).unref?.()
}
