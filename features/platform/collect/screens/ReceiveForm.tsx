'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { Input } from '@/components/ui/input'
import { Notice, Pill } from '../../lib/ui'

type Container = { id: string; label: string; sealNumber?: string | null; status: string; jobId: string; jobNumber: string }

/** K6: scan a container, check the seal, weigh. A label that is not expected can be recorded as unexpected on its job. */
export function ReceiveForm({ containers, jobs, defaultLocation }: { containers: Container[]; jobs: Array<{ id: string; jobNumber: string }>; defaultLocation?: string }) {
  const router = useRouter()
  const [scan, setScan] = useState('')
  const [seal, setSeal] = useState('')
  const [gross, setGross] = useState('')
  const [tare, setTare] = useState('')
  const [location, setLocation] = useState(defaultLocation ?? '')
  const [jobId, setJobId] = useState(jobs.length === 1 ? jobs[0].id : '')
  const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null)
  const [pending, start] = useTransition()
  const match = containers.find((c) => c.label.toLowerCase() === scan.trim().toLowerCase())
  const receive = (unexpected: boolean) => start(async () => {
    setMessage(null)
    const input = match
      ? { containerId: match.id, receivedSealNumber: seal, grossWeight: Number(gross), tareWeight: tare ? Number(tare) : null, locationCode: location }
      : { jobId, label: scan.trim(), unexpected, receivedSealNumber: seal, grossWeight: Number(gross), tareWeight: tare ? Number(tare) : null, locationCode: location }
    const result = await runOperation('receiveContainer', input)
    if (!result.success) { setMessage({ tone: 'alert', text: result.error ?? 'Not received.' }); return }
    const c: any = result.data
    setMessage({ tone: c?.sealException ? 'alert' : 'status', text: c?.sealException ? `${c.label}: ${c.sealException}` : `${c?.label ?? scan} received.` })
    setScan(''); setSeal(''); setGross(''); setTare('')
    router.refresh()
  })
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">Container label<Input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan the label" autoCapitalize="characters" /></label>
      {scan.trim() ? (match ? <p className="text-sm">{match.jobNumber} · expected seal <span className="font-mono">{match.sealNumber || 'none'}</span></p> : (
        <div className="grid gap-1 text-sm">
          <span className="text-red-600">Not on any collection record.</span>
          <label className="grid gap-1">Job it came with<select className="h-9 rounded-[6px] border bg-background px-3" value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">Choose</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.jobNumber}</option>)}</select></label>
        </div>
      )) : null}
      <label className="grid gap-1 text-sm">Seal on arrival<Input value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="Leave blank if no seal" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">Gross weight (lb)<Input inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">Tare (lb)<Input inputMode="decimal" value={tare} onChange={(e) => setTare(e.target.value)} /></label>
      </div>
      <label className="grid gap-1 text-sm">Put away at<Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bay or rack" /></label>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {match || !scan.trim()
        ? <Pill variant="primary" disabled={pending || !match || !gross} onClick={() => receive(false)}>{pending ? 'Saving…' : 'Receive'}</Pill>
        : <Pill variant="danger" disabled={pending || !jobId || !gross} onClick={() => receive(true)}>{pending ? 'Saving…' : 'Record as unexpected'}</Pill>}
    </div>
  )
}
