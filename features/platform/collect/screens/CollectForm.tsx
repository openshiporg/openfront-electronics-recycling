'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { Input } from '@/components/ui/input'
import { SignaturePad, type SignatureFile } from '../../lib/signature'
import { Notice, Pill, Track, selectClass } from '../../lib/ui'

type Row = { label: string; type: string; sealNumber: string; itemCountDeclared: string; grossWeight: string }
const blank = (n: number): Row => ({ label: '', type: 'pallet', sealNumber: '', itemCountDeclared: '', grossWeight: '' })

async function toFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { filename: file.name, mimeType: file.type || 'image/jpeg', base64: btoa(binary) }
}

/** K5: containers, seals, photos and the client's signature, on a phone. */
export function CollectForm({ jobId, jobNumber, contactName }: { jobId: string; jobNumber: string; contactName?: string | null }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([blank(1)])
  const [signer, setSigner] = useState(contactName ?? '')
  const [signature, setSignature] = useState<SignatureFile | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()
  const set = (i: number, key: keyof Row, value: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)))
  const submit = () => start(async () => {
    setError(null)
    const containers = rows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), type: r.type, sealNumber: r.sealNumber.trim(), itemCountDeclared: r.itemCountDeclared ? Number(r.itemCountDeclared) : null, grossWeight: r.grossWeight ? Number(r.grossWeight) : null }))
    const result = await runOperation('collectJob', { jobId, containers, signerName: signer, signature, photos: await Promise.all(photos.map(toFile)), notes })
    if (!result.success) { setError(result.error ?? 'The collection was refused.'); return }
    setDone(true)
    router.refresh()
  })
  if (done) return <Notice>{jobNumber} collected. Receiving has been told it is inbound.</Notice>
  return (
    <div className="grid gap-4">
      {rows.map((r, i) => (
        <fieldset key={i} className="grid grid-cols-2 gap-2 rounded-[6px] border p-3">
          <legend className="px-1 text-xs text-muted-foreground">Container {i + 1}</legend>
          <label className="col-span-2 grid gap-1 text-sm">Label<Input value={r.label} onChange={(e) => set(i, 'label', e.target.value)} placeholder="Scan or type the label" autoCapitalize="characters" /></label>
          <label className="grid gap-1 text-sm">Type<select className={selectClass} value={r.type} onChange={(e) => set(i, 'type', e.target.value)}>{['pallet', 'gaylord', 'box', 'cage', 'tote'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Seal<Input value={r.sealNumber} onChange={(e) => set(i, 'sealNumber', e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Items<Input inputMode="numeric" value={r.itemCountDeclared} onChange={(e) => set(i, 'itemCountDeclared', e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Weight (lb)<Input inputMode="decimal" value={r.grossWeight} onChange={(e) => set(i, 'grossWeight', e.target.value)} /></label>
          {rows.length > 1 ? <button type="button" className="col-span-2 text-left text-xs text-red-600" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>Remove container</button> : null}
        </fieldset>
      ))}
      <Track><Pill variant="raised" onClick={() => setRows((r) => [...r, blank(r.length + 1)])}>Add container</Pill></Track>
      <label className="grid gap-1 text-sm">Photos<input type="file" accept="image/*" capture="environment" multiple className="text-sm text-muted-foreground file:mr-3 file:h-9 file:rounded-[6px] file:border file:bg-background file:px-3 file:text-sm file:font-medium file:text-foreground" onChange={(e) => setPhotos([...(e.target.files ?? [])].slice(0, 12))} /></label>
      <label className="grid gap-1 text-sm">Notes<Input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Client signer<Input value={signer} onChange={(e) => setSigner(e.target.value)} /></label>
      <SignaturePad label="Client signature" onChange={setSignature} />
      {error ? <Notice tone="alert">{error}</Notice> : null}
      <Pill variant="primary" disabled={pending || !signer.trim() || !signature || !rows.some((r) => r.label.trim())} onClick={submit}>{pending ? 'Saving…' : 'Collected and signed'}</Pill>
    </div>
  )
}
