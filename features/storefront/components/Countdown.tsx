'use client'
import { useEffect, useState } from 'react'
import { remaining } from '../lib/format'

/**
 * Time left to a server timestamp. `serverNow` is the server's clock when the page
 * was rendered, so a wrong device clock does not change the countdown.
 */
export function Countdown({ to, serverNow, className, onZero }: { to: string | null; serverNow: number; className?: string; onZero?: () => void }) {
  const [offset] = useState(() => serverNow - Date.now())
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [offset])
  const ms = to ? new Date(to).getTime() - now : 0
  useEffect(() => {
    if (to && ms <= 0) onZero?.()
    // Only on the transition to zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms <= 0])
  return (
    <span className={className} suppressHydrationWarning>
      {to ? remaining(ms) : 'Not set'}
    </span>
  )
}
