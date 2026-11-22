'use client'

import { useState, useTransition } from 'react'
import { readOperation } from '../../lib/actions'
import { OpDrawer } from '../../lib/forms'
import { Notice, Pill } from '../../lib/ui'

/** R7: draw the verification sample (the settings' sample rate), then verify each record in it. */
export function SampleDraw() {
  const [records, setRecords] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const draw = () => start(async () => {
    setError(null)
    const r = await readOperation('sanitizationSample', {})
    if (!r.success) { setError(r.error ?? 'The sample could not be drawn.'); return }
    setRecords(r.data as any[])
  })
  return (
    <div className="grid gap-3">
      <div><Pill variant="primary" disabled={pending} onClick={draw}>{pending ? 'Drawing…' : records ? 'Draw again' : 'Draw a sample'}</Pill></div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {records && !records.length ? <Notice>Every passed record is already verified.</Notice> : null}
      {records?.length ? <ul className="grid gap-2 text-sm">{records.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border p-2">
          <span><span className="font-mono text-xs">{r.asset?.assetNumber}</span> {r.asset?.serialNumber} · {[r.asset?.manufacturer, r.asset?.model].filter(Boolean).join(' ')} · {r.technique} by {r.operator?.name ?? r.tool}</span>
          <span className="flex gap-2">
            <OpDrawer op="verifySanitization" fixed={{ recordId: r.id, confirmed: true }} title={`Verify ${r.asset?.assetNumber}`} description="Re-read the device and confirm no data is recoverable." trigger="Confirm" triggerVariant="primary" fields={[{ name: 'note', label: 'What you checked', type: 'textarea' }]} submitLabel="Verified" onResult={() => setRecords((x) => x?.filter((y) => y.id !== r.id) ?? null)} />
            <OpDrawer op="verifySanitization" fixed={{ recordId: r.id, confirmed: false }} title={`Verification failed on ${r.asset?.assetNumber}`} description="The asset goes back to failed and must be sanitised again or destroyed." trigger="Failed" triggerVariant="danger" fields={[{ name: 'note', label: 'What you found', type: 'textarea', required: true }]} submitLabel="Record failure" onResult={() => setRecords((x) => x?.filter((y) => y.id !== r.id) ?? null)} />
          </span>
        </li>
      ))}</ul> : null}
    </div>
  )
}
