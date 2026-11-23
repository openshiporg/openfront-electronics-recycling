'use client'

import { useEffect, useState } from 'react'
import { readOperation } from '../../lib/actions'
import Link from 'next/link'

const STEP_LINK: Record<string, string> = { roles: 'team?tab=roles', settings: 'settings', facility: 'facilities', categories: 'catalog', grades: 'catalog?tab=grades', accepted: 'catalog?tab=accepted', terms: 'settings', payments: 'payment-providers' }

export function OnboardingChecklist({ initial }: { initial: any }) {
  const [status, setStatus] = useState(initial)
  useEffect(() => { setStatus(initial) }, [initial])
  useEffect(() => {
    let active = true
    const refresh = async () => {
      const result = await readOperation('onboardingStatus', {})
      if (active && result.success) setStatus(result.data)
    }
    window.addEventListener('recycling-setup-complete', refresh)
    return () => { active = false; window.removeEventListener('recycling-setup-complete', refresh) }
  }, [])
  return <ul className="grid gap-1 text-sm" aria-live="polite">
    {status.steps.map((x: any) => <li key={x.key} className="flex items-center gap-2"><span className={x.done ? 'text-emerald-600' : 'text-amber-600'}>{x.done ? 'Done' : 'To do'}</span> <Link href={`/dashboard/platform/${STEP_LINK[x.key] ?? 'settings'}`}>{x.label}</Link></li>)}
    <li className="flex flex-wrap items-center gap-2"><span className={status.cardPayments ? 'text-emerald-600' : 'text-muted-foreground'}>{status.cardPayments ? 'On' : 'Off'}</span> <Link href="/dashboard/platform/payment-providers">Card payments</Link>{status.cardPayments ? null : <span className="text-muted-foreground">(bank transfer works without it)</span>}</li>
  </ul>
}
