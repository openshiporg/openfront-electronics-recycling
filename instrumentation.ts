// Starts the clock in the Node server: lot open/close, bid expiry, overdue invoices,
// reminders, document expiry and queued email. Runs every minute; no setting needed.
// Next requires a runtime-guarded import here so the edge bundle never loads Node code.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startClock } = await import('./features/keystone/lib/clockRunner')
  startClock()
}
