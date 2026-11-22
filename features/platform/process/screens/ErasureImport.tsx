'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { Input } from '@/components/ui/input'
import { DataTable, Notice, Pill, Td, Track } from '../../lib/ui'

/** R6: upload an erasure tool's report (Blancco, WhiteCanyon, KillDisk exports), check the matches, then commit. */
export function ErasureImport() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [tool, setTool] = useState('')
  const [imp, setImp] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const check = () => start(async () => {
    if (!file) return
    setError(null); setDone(null)
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    const r = await runOperation('importErasureReport', { file: { filename: file.name, mimeType: file.type || 'application/octet-stream', base64: btoa(binary) }, tool })
    if (!r.success) { setError(r.error ?? 'The report could not be read.'); return }
    setImp(r.data)
  })
  const commit = () => start(async () => {
    setError(null)
    const r = await runOperation('importErasureReport', { importId: imp.id, commit: true })
    if (!r.success) { setError(r.error ?? 'Not committed.'); return }
    setDone(`${imp.matchedCount} sanitisation record(s) added.`)
    setImp(null); setFile(null)
    router.refresh()
  })
  const unmatched: any[] = Array.isArray(imp?.unmatched) ? imp.unmatched : []
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <label className="grid gap-1 text-sm">Report (CSV or Excel)<input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setImp(null) }} /></label>
        <label className="grid gap-1 text-sm">Tool<Input value={tool} onChange={(e) => setTool(e.target.value)} placeholder="Blancco Drive Eraser" /></label>
        <Pill disabled={pending || !file} onClick={check}>{pending && !imp ? 'Reading…' : 'Check'}</Pill>
      </div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {done ? <Notice>{done}</Notice> : null}
      {imp ? <>
        <p className="text-sm">{imp.rowCount} rows · {imp.matchedCount} match one asset{unmatched.length ? ` · ${unmatched.length} need attention (not imported)` : ''}.</p>
        {unmatched.length ? <DataTable label="Rows that will not import" head={[{ label: 'Row' }, { label: 'Serial' }, { label: 'Problem' }]}>{unmatched.slice(0, 100).map((u, i) => <tr key={i}><Td>{u.row}</Td><Td className="font-mono">{u.serial}</Td><Td>{u.problem}</Td></tr>)}</DataTable> : null}
        <Track><Pill variant="primary" disabled={pending || !imp.matchedCount} onClick={commit}>{pending ? 'Saving…' : `Add ${imp.matchedCount} record(s)`}</Pill><Pill onClick={() => setImp(null)}>Cancel</Pill></Track>
      </> : null}
    </div>
  )
}
