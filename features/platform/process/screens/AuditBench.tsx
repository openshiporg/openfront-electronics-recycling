'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Notice, Pill, Track, selectClass } from '../../lib/ui'

type Opt = { id: string; label: string }
type Category = { id: string; name: string; dataBearingDefault: boolean }

async function toFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { filename: file.name, mimeType: file.type || 'image/jpeg', base64: btoa(binary) }
}

/** R1: one asset at a time, fast on a phone: scan serial, category, grades, pulled drives as child assets. */
export function AuditBench({ jobId, containers, categories, cosmetic, functional }: { jobId: string; containers: Opt[]; categories: Category[]; cosmetic: Opt[]; functional: Opt[] }) {
  const router = useRouter()
  const [containerId, setContainer] = useState(containers.length === 1 ? containers[0].id : '')
  const [categoryId, setCategory] = useState('')
  const [serial, setSerial] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [tag, setTag] = useState('')
  const [specs, setSpecs] = useState('')
  const [dataBearing, setDataBearing] = useState<boolean | null>(null)
  const [storageRemoved, setStorageRemoved] = useState(false)
  const [cosmeticGradeId, setCosmetic] = useState('')
  const [functionalGradeId, setFunctional] = useState('')
  const [weight, setWeight] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [disposition, setDisposition] = useState('undecided')
  const [drives, setDrives] = useState<string[]>([])
  const [photos, setPhotos] = useState<File[]>([])
  const [message, setMessage] = useState<{ tone: 'status' | 'alert'; text: string } | null>(null)
  const [pending, start] = useTransition()
  const category = categories.find((c) => c.id === categoryId)
  const isDataBearing = dataBearing ?? category?.dataBearingDefault ?? false

  const save = () => start(async () => {
    setMessage(null)
    const specObject = Object.fromEntries(specs.split('\n').map((l) => l.split(':')).filter((p) => p.length >= 2 && p[0].trim()).map(([k, ...v]) => [k.trim(), v.join(':').trim()]))
    const result = await runOperation('auditAsset', {
      jobId, containerId: containerId || null, categoryId: categoryId || null, serialNumber: serial, manufacturer, model, clientAssetTag: tag, specs: specObject,
      isDataBearing, storageRemoved, cosmeticGradeId: cosmeticGradeId || null, functionalGradeId: functionalGradeId || null, testNotes: notes,
      weight: weight ? Number(weight) : null, locationCode: location, disposition, photos: await Promise.all(photos.map(toFile)),
    })
    if (!result.success) { setMessage({ tone: 'alert', text: result.error ?? 'Not saved.' }); return }
    const parent: any = result.data
    const failed: string[] = []
    for (const d of drives.filter((x) => x.trim())) {
      const drive = await runOperation('auditAsset', { jobId, containerId: containerId || null, parentId: parent.id, serialNumber: d.trim(), isDataBearing: true, model: 'Pulled drive', locationCode: location })
      if (!drive.success) failed.push(`${d}: ${drive.error}`)
    }
    setMessage(failed.length ? { tone: 'alert', text: `${parent.assetNumber} saved. Drives not saved: ${failed.join('; ')}` } : { tone: 'status', text: `${parent.assetNumber} saved${drives.filter(Boolean).length ? ` with ${drives.filter(Boolean).length} pulled drive(s)` : ''}.` })
    setSerial(''); setTag(''); setSpecs(''); setNotes(''); setWeight(''); setDrives([]); setPhotos([]); setStorageRemoved(false); setDataBearing(null)
    router.refresh()
  })

  const field = 'grid gap-1 text-sm'
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <label className={field}>Container<select className={selectClass} value={containerId} onChange={(e) => setContainer(e.target.value)}><option value="">—</option>{containers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className={field}>Category<select className={selectClass} value={categoryId} onChange={(e) => setCategory(e.target.value)}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>
      <label className={field}>Serial number<Input autoFocus value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Scan" autoCapitalize="characters" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className={field}>Manufacturer<Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} /></label>
        <label className={field}>Model<Input value={model} onChange={(e) => setModel(e.target.value)} /></label>
        <label className={field}>Client asset tag<Input value={tag} onChange={(e) => setTag(e.target.value)} /></label>
        <label className={field}>Weight<Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <label className={field}>Cosmetic<select className={selectClass} value={cosmeticGradeId} onChange={(e) => setCosmetic(e.target.value)}><option value="">—</option>{cosmetic.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        <label className={field}>Functional<select className={selectClass} value={functionalGradeId} onChange={(e) => setFunctional(e.target.value)}><option value="">—</option>{functional.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
      </div>
      <label className={field}>Specs (one per line, name: value)<Textarea rows={3} value={specs} onChange={(e) => setSpecs(e.target.value)} placeholder={'CPU: i5-1145G7\nRAM: 16 GB\nStorage: 512 GB NVMe'} className="font-mono text-xs" /></label>
      <div className="grid gap-2 rounded-[6px] border p-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={isDataBearing} onChange={(e) => setDataBearing(e.target.checked)} /> Holds data</label>
        {isDataBearing ? <>
          <label className="flex items-center gap-2"><input type="checkbox" checked={storageRemoved} onChange={(e) => setStorageRemoved(e.target.checked)} /> Storage pulled out</label>
          {storageRemoved ? <div className="grid gap-2">
            {drives.map((d, i) => <Input key={i} value={d} onChange={(e) => setDrives((x) => x.map((v, j) => (j === i ? e.target.value : v)))} placeholder={`Drive ${i + 1} serial`} autoCapitalize="characters" />)}
            <Track><Pill size="sm" onClick={() => setDrives((x) => [...x, ''])}>Add pulled drive</Pill></Track>
          </div> : null}
        </> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={field}>Disposition<select className={selectClass} value={disposition} onChange={(e) => setDisposition(e.target.value)}>{['undecided', 'resale', 'parts', 'recycle', 'return'].map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
        <label className={field}>Location<Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bin or rack" /></label>
      </div>
      <label className={field}>Test notes<Input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label className={field}>Photos<input type="file" accept="image/*" capture="environment" multiple onChange={(e) => setPhotos([...(e.target.files ?? [])].slice(0, 8))} /></label>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Pill variant="primary" disabled={pending || (!serial.trim() && !model.trim() && !manufacturer.trim())} onClick={save}>{pending ? 'Saving…' : 'Save and next'}</Pill>
    </div>
  )
}
