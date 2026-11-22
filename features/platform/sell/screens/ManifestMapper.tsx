'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runOperation } from '../../lib/actions'
import { OpDrawer, type FieldSpec } from '../../lib/forms'
import { Notice, Pill, Track, selectClass } from '../../lib/ui'

const FIELDS: Array<[string, string]> = [
  ['lineNumber', 'Line number'], ['category', 'Category'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['partNumber', 'Part number'],
  ['description', 'Description'], ['serial', 'Serial numbers'], ['cpu', 'CPU'], ['ramGb', 'RAM (GB)'], ['storageGb', 'Storage (GB)'], ['storageType', 'Storage type'],
  ['screenIn', 'Screen (in)'], ['cosmeticGrade', 'Cosmetic grade'], ['functionalGrade', 'Functional grade'], ['quantity', 'Quantity'], ['unit', 'Unit'],
  ['weight', 'Weight'], ['notes', 'Notes'], ['assetTag', 'Asset tag'],
]

/** S6 map step: pick the sheet, the header row and which column feeds each field. */
export function ManifestMapper({ importId, headers, mapping, sheetNames, sheetName, headerRow }: { importId: string; headers: string[]; mapping: Record<string, number>; sheetNames: string[]; sheetName: string; headerRow: number }) {
  const router = useRouter()
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(mapping ?? {}).map(([k, v]) => [k, String(v)])))
  const [sheet, setSheet] = useState(sheetName)
  const [row, setRow] = useState(String(headerRow + 1))
  const [saveAs, setSaveAs] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (validate: boolean) => start(async () => {
    setError(null)
    const clean = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
    const mapped = await runOperation('mapManifest', { importId, sheetName: sheet, headerRow: Math.max(0, Number(row) - 1), mapping: clean, saveAs: saveAs || null })
    if (!mapped.success) { setError(mapped.error ?? 'The mapping was refused.'); return }
    if (validate) {
      const checked = await runOperation('validateManifest', { importId })
      if (!checked.success) { setError(checked.error ?? 'The rows could not be checked.'); return }
    }
    router.refresh()
  })
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Sheet
          <select className={selectClass} value={sheet} onChange={(e) => setSheet(e.target.value)}>{sheetNames.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="grid gap-1 text-sm">Header row
          <input className="h-9 rounded-[6px] border bg-background px-3" type="number" min={1} value={row} onChange={(e) => setRow(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Remember this mapping as
          <input className="h-9 rounded-[6px] border bg-background px-3" value={saveAs} onChange={(e) => setSaveAs(e.target.value)} placeholder="Optional, e.g. Meridian manifest" />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map(([key, name]) => (
          <label key={key} className="grid gap-1 text-sm">{name}
            <select className={selectClass} value={map[key] ?? ''} onChange={(e) => setMap({ ...map, [key]: e.target.value })}>
              <option value="">Not in this file</option>
              {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
            </select>
          </label>
        ))}
      </div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      <Track>
        <Pill disabled={pending} onClick={() => run(false)}>Save mapping</Pill>
        <Pill variant="primary" disabled={pending} onClick={() => run(true)}>{pending ? 'Checking…' : 'Save and check rows'}</Pill>
      </Track>
    </div>
  )
}

/** Upload drawer that opens the new import for mapping. */
export function UploadManifest({ fields, title, description, trigger, fixed, op = 'uploadManifest' }: { fields: FieldSpec[]; title: string; description: string; trigger: string; fixed?: Record<string, unknown>; op?: 'uploadManifest' | 'importAssets' }) {
  const router = useRouter()
  return <OpDrawer op={op} title={title} description={description} trigger={trigger} triggerVariant="primary" fields={fields} fixed={fixed} submitLabel="Upload" onResult={(r) => { const id = (r.data as any)?.id; if (id) router.push(`/dashboard/platform/manifest-imports?import=${id}`) }} />
}
