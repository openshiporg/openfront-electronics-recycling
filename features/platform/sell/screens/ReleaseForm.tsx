'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { Input } from '@/components/ui/input'
import { SignaturePad, type SignatureFile } from '../../lib/signature'
import { Notice, Pill, Track } from '../../lib/ui'

/** S18: hand the goods to the buyer's driver or carrier. */
export function ReleaseForm({ orderId, driverName, billOfLading }: { orderId: string; driverName?: string | null; billOfLading?: string | null }) {
  const router = useRouter()
  const [driver, setDriver] = useState(driverName ?? '')
  const [bol, setBol] = useState(billOfLading ?? '')
  const [signature, setSignature] = useState<SignatureFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const release = () => start(async () => {
    setError(null)
    const result = await runOperation('releaseOrder', { orderId, driverName: driver, billOfLading: bol, signature })
    if (!result.success) { setError(result.error ?? 'The release was refused.'); return }
    router.refresh()
  })
  return (
    <div className="grid max-w-lg gap-3">
      <label className="grid gap-1 text-sm">Driver name<Input value={driver} onChange={(e) => setDriver(e.target.value)} required /></label>
      <label className="grid gap-1 text-sm">Bill of lading<Input value={bol} onChange={(e) => setBol(e.target.value)} placeholder="Optional for a buyer's own truck" /></label>
      <SignaturePad label="Driver signature" onChange={setSignature} />
      {error ? <Notice tone="alert">{error}</Notice> : null}
      <Track><Pill variant="primary" disabled={pending || !driver.trim()} onClick={release}>{pending ? 'Releasing…' : 'Release the goods'}</Pill></Track>
    </div>
  )
}
