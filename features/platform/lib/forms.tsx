'use client'

import { createContext, useContext, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { textToDocument } from './document'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Notice, Pill, Track, selectClass, type PillVariant } from './ui'
import { deleteItem, readOperation, runOperation, saveItem, type ActionResult } from './actions'

/*
 * Platform form kit (adapted from Openfront Barbershop): a right-hand drawer or an
 * inline form, labelled fields, and buttons for explicit state transitions. Every save
 * refreshes the page's server data on success and shows the server's refusal otherwise.
 */

/*
 * Date-and-time fields are typed and shown in the store's time zone (the one every page
 * names), whatever zone the phone or laptop is set to.
 */
const ZoneContext = createContext<string | undefined>(undefined)
export function StoreZone({ zone, children }: { zone?: string; children: ReactNode }) {
  return <ZoneContext.Provider value={zone}>{children}</ZoneContext.Provider>
}
function zoneParts(date: Date, zone?: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute'), s: get('second') }
}
/** "2026-11-22T14:30" read as wall time in the zone, to an instant. */
export function zonedToIso(local: string, zone?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return new Date(local).toISOString()
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let t = wall
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(new Date(t), zone)
    t = wall - (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - t)
  }
  return new Date(t).toISOString()
}
function isoToZoned(value: string, zone?: string) {
  const d = new Date(value); if (Number.isNaN(d.getTime())) return ''
  const p = zoneParts(d, zone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
}
function zoneAbbr(zone?: string) {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value } catch { return undefined }
}

export type FieldSpec = {
  name: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'money' | 'percent' | 'date' | 'datetime' | 'time' | 'select' | 'multiselect' | 'checkbox' | 'file' | 'files' | 'email' | 'password' | 'hidden' | 'lines' | 'json' | 'document' | 'list' | 'decimal'
  /** Leave the field out when it is empty (for secrets such as a password: empty keeps the saved one). */
  omitEmpty?: boolean
  /** Keystone relationship: a select becomes { connect: { id } }, a multiselect { set: [...] }. */
  relation?: boolean
  options?: Array<{ value: string; label: string }>
  required?: boolean
  defaultValue?: string | number | boolean | null | string[]
  hint?: string
  wide?: boolean
  placeholder?: string
  accept?: string
  /** For type 'lines': one item per line, split on "|" into these keys. */
  columns?: Array<{ key: string; type?: 'text' | 'number' | 'money' }>
}

export const toDollars = (minor?: number | null) => ((minor ?? 0) / 100).toFixed(2)
export const money = (minor?: number | null, currency = 'USD') =>
  minor === null || minor === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)

async function fileInput(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  return { filename: file.name, mimeType: file.type || 'application/octet-stream', base64: btoa(binary) }
}

/** Turns FormData into typed input using the field specs. */
export async function collect(form: FormData, fields: FieldSpec[], forUpdate = false, zone?: string) {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const raw = form.get(f.name)
    switch (f.type) {
      case 'checkbox': out[f.name] = raw === 'on'; break
      case 'number': out[f.name] = raw === '' || raw === null ? null : Number(raw); break
      case 'money': out[f.name] = raw === '' || raw === null ? null : Math.round(Number(raw) * 100); break
      case 'percent': out[f.name] = raw === '' || raw === null ? null : Math.round(Number(raw) * 100); break
      case 'datetime': out[f.name] = raw ? zonedToIso(String(raw), zone) : null; break
      case 'file': {
        const file = form.get(f.name)
        out[f.name] = file instanceof File && file.size ? await fileInput(file) : null
        break
      }
      case 'files': {
        const files = form.getAll(f.name).filter((x): x is File => x instanceof File && x.size > 0)
        out[f.name] = await Promise.all(files.map(fileInput))
        break
      }
      case 'multiselect': out[f.name] = form.getAll(f.name).map(String); break
      case 'document': out[f.name] = textToDocument(String(raw ?? '')); break
      case 'decimal': out[f.name] = raw === '' || raw === null ? null : String(raw); break
      case 'list': out[f.name] = String(raw ?? '').split(/[\n,]/).map((l) => l.trim()).filter(Boolean); break
      case 'json': {
        try { out[f.name] = raw ? JSON.parse(String(raw)) : null } catch { throw new Error(`${f.label} is not valid JSON.`) }
        break
      }
      case 'lines': {
        const rows = String(raw ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
        out[f.name] = rows.map((row) => {
          const parts = row.split('|').map((p) => p.trim())
          return Object.fromEntries((f.columns ?? []).map((c, i) => [c.key, c.type === 'number' ? Number(parts[i] || 0) : c.type === 'money' ? Math.round(Number(parts[i] || 0) * 100) : parts[i] ?? '']))
        })
        break
      }
      default: out[f.name] = raw === null ? '' : String(raw)
    }
    if (f.omitEmpty && (out[f.name] === '' || out[f.name] === null)) { delete out[f.name]; continue }
    if (f.relation) {
      const v = out[f.name]
      // Keystone create inputs accept connect only; updates replace the whole set.
      if (Array.isArray(v)) out[f.name] = forUpdate ? { set: v.map((id) => ({ id })) } : v.length ? { connect: v.map((id) => ({ id })) } : undefined
      else out[f.name] = v ? { connect: { id: v } } : forUpdate ? { disconnect: true } : undefined
      if (out[f.name] === undefined) delete out[f.name]
    }
  }
  return nest(out)
}

/** "site.city" → { site: { city } } */
function nest(flat: Record<string, unknown>) {
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    let at = out
    for (let i = 0; i < parts.length - 1; i++) at = at[parts[i]] ??= {}
    at[parts[parts.length - 1]] = value
  }
  return out
}

function initialValue(f: FieldSpec, zone?: string): string {
  const dv = f.defaultValue
  if (dv === null || dv === undefined) return ''
  if (f.type === 'money') return toDollars(Number(dv))
  if (f.type === 'percent') return (Number(dv) / 100).toString()
  if (f.type === 'date') return String(dv).slice(0, 10)
  if (f.type === 'datetime') return isoToZoned(String(dv), zone)
  if (f.type === 'json') return typeof dv === 'string' ? dv : JSON.stringify(dv, null, 2)
  if (f.type === 'list') return Array.isArray(dv) ? dv.join('\n') : String(dv)
  return String(dv)
}

/** If a command returned a file, hand it to the browser. */
export function offerDownload(data: unknown) {
  const d: any = (data as any)?.download ?? data
  if (!d || typeof d !== 'object' || typeof d.base64 !== 'string' || !d.filename) return false
  const bytes = Uint8Array.from(atob(d.base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: d.mimeType || 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url; a.download = d.filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}

export function Field({ id, label, children, wide = false, hint }: { id: string; label: string; children: ReactNode; wide?: boolean; hint?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', wide && 'sm:col-span-2')}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export function Inputs({ fields, prefix }: { fields: FieldSpec[]; prefix: string }) {
  const zone = useContext(ZoneContext)
  const abbr = zoneAbbr(zone)
  const initial = (f: FieldSpec) => initialValue(f, zone)
  return (
    <>
      {fields.map((f) => {
        const id = `${prefix}-${f.name}`
        const dv = f.defaultValue
        if (f.type === 'hidden') return <input key={f.name} type="hidden" name={f.name} value={String(dv ?? '')} />
        if (f.type === 'checkbox') {
          return (
            <label key={f.name} htmlFor={id} className={cn('flex min-h-9 items-center gap-2 text-sm', f.wide && 'sm:col-span-2')}>
              <input id={id} name={f.name} type="checkbox" defaultChecked={Boolean(dv)} className="size-4" />
              {f.label}
              {f.hint ? <span className="text-xs text-muted-foreground">{f.hint}</span> : null}
            </label>
          )
        }
        let control: ReactNode
        if (f.type === 'multiselect') {
          const chosen = new Set(Array.isArray(dv) ? (dv as unknown[]).map(String) : [])
          return (
            <fieldset key={f.name} className="grid gap-1.5 sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">{f.label}</legend>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-[6px] border p-2 sm:grid-cols-2">
                {(f.options ?? []).map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name={f.name} value={o.value} defaultChecked={chosen.has(o.value)} className="size-4" />{o.label}</label>
                ))}
              </div>
              {f.hint ? <span className="text-xs text-muted-foreground">{f.hint}</span> : null}
            </fieldset>
          )
        }
        if (f.type === 'textarea' || f.type === 'lines' || f.type === 'json' || f.type === 'document' || f.type === 'list') control = <Textarea id={id} name={f.name} required={f.required} defaultValue={initial(f)} placeholder={f.placeholder} rows={f.type === 'textarea' ? 3 : 5} className={f.type === 'lines' || f.type === 'json' ? 'font-mono text-xs' : undefined} />
        else if (f.type === 'select') control = (
          <select id={id} name={f.name} required={f.required} defaultValue={initial(f)} className={selectClass}>
            {!f.required ? <option value="">—</option> : null}
            {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
        else if (f.type === 'file' || f.type === 'files') control = <Input id={id} name={f.name} type="file" multiple={f.type === 'files'} required={f.required} accept={f.accept} />
        else {
          const type = f.type === 'money' || f.type === 'percent' || f.type === 'number' || f.type === 'decimal' ? 'number' : f.type === 'datetime' ? 'datetime-local' : f.type || 'text'
          const step = f.type === 'money' || f.type === 'percent' || f.type === 'decimal' ? '0.01' : f.type === 'number' ? 'any' : undefined
          control = <Input id={id} name={f.name} type={type} step={step} inputMode={step ? 'decimal' : undefined} required={f.required} defaultValue={initial(f)} placeholder={f.placeholder} className={f.type === 'money' ? 'font-mono' : undefined} />
        }
        return <Field key={f.name} id={id} label={f.type === 'datetime' && abbr ? `${f.label} (${abbr})` : f.label} wide={f.wide || f.type === 'textarea' || f.type === 'lines' || f.type === 'json' || f.type === 'document'} hint={f.hint}>{control}</Field>
      })}
    </>
  )
}

function useSubmit(build: (form: FormData) => Promise<ActionResult>, onDone?: (result: ActionResult) => void) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null); setNotice(null)
    startTransition(async () => {
      try {
        let result: ActionResult
        try { result = await build(form) } catch (e) { setError((e as Error).message || 'Check the fields.'); return }
        if (!result.success) { setError(result.error || 'This couldn’t be saved.'); return }
        offerDownload(result.data)
        onDone?.(result)
        router.refresh()
      } catch { setError('Connection interrupted. Reload to check whether it saved.') }
    })
  }
  return { submit, pending, error, notice, setNotice }
}

type OpProps = {
  op: string
  fields: FieldSpec[]
  fixed?: Record<string, unknown>
  submitLabel?: string
  onResult?: (result: ActionResult) => void
  /** The op is a query (reports): run it read-only. */
  read?: boolean
}

/** Inline form that runs one domain command. */
export function OpForm({ op, fields, fixed, submitLabel = 'Save', onResult, className, idempotent }: OpProps & { className?: string; idempotent?: boolean }) {
  const zone = useContext(ZoneContext)
  const [key] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())))
  const { submit, pending, error } = useSubmit(async (form) => {
    const values = await collect(form, fields, false, zone)
    const input = { ...(fixed ?? {}), ...values, ...(idempotent ? { idempotencyKey: key } : {}) }
    return runOperation(op, input)
  }, onResult)
  return (
    <form onSubmit={submit} className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Inputs fields={fields} prefix={op} />
      {error ? <Notice tone="alert" className="sm:col-span-2">{error}</Notice> : null}
      <Track className="sm:col-span-2"><Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Working…' : submitLabel}</Pill></Track>
    </form>
  )
}

/** Drawer that runs one domain command. */
export function OpDrawer({ trigger, title, description, triggerVariant = 'raised', selection, onResultHref, ...props }: OpProps & { trigger: ReactNode; title: string; description?: string; triggerVariant?: PillVariant; idempotent?: boolean; selection?: string; onResultHref?: string }) {
  const router = useRouter()
  const zone = useContext(ZoneContext)
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(() => String(Date.now()) + Math.random().toString(36).slice(2))
  const [picked, setPicked] = useState<string[]>([])
  const { submit, pending, error } = useSubmit(async (form) => {
    const values = await collect(form, props.fields, false, zone)
    const input = { ...(props.fixed ?? {}), ...values, ...(selection ? { [selection]: picked } : {}), ...(props.idempotent ? { idempotencyKey: key } : {}) }
    return props.read ? readOperation(props.op, input) : runOperation(props.op, input)
  }, (result) => {
    setOpen(false); setKey(String(Date.now()) + Math.random().toString(36).slice(2)); props.onResult?.(result)
    const id = (result.data as any)?.id
    if (onResultHref && id) router.push(onResultHref.replace('{id}', encodeURIComponent(id)))
  })
  return (
    <>
      <Pill size="sm" variant={triggerVariant} onClick={() => {
        if (selection) setPicked([...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][data-select="${selection}"]:checked`)].map((x) => x.value))
        setOpen(true)
      }}>{trigger}</Pill>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <form onSubmit={submit} className="grid gap-4 px-4 pb-6 sm:grid-cols-2">
            {selection ? <p className="text-sm sm:col-span-2">{picked.length ? `${picked.length} selected.` : 'Tick at least one row in the list first.'}</p> : null}
            <Inputs fields={props.fields} prefix={props.op} />
            {error ? <Notice tone="alert" className="sm:col-span-2">{error}</Notice> : null}
            <Track className="sm:col-span-2">
              <Pill onClick={() => setOpen(false)}>Cancel</Pill>
              <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Working…' : props.submitLabel ?? 'Save'}</Pill>
            </Track>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Drawer that creates or edits a Keystone list item. */
export function ItemDrawer({ listKey, id, fields, fixed, trigger, title, description, triggerVariant = 'raised', submitLabel = 'Save', onResultHref }: {
  listKey: string; id?: string | null; fields: FieldSpec[]; fixed?: Record<string, unknown>; trigger: ReactNode; title: string; description?: string; triggerVariant?: PillVariant; submitLabel?: string
  /** After a create, go here; "{id}" is replaced with the new item's id. */
  onResultHref?: string
}) {
  const router = useRouter()
  const zone = useContext(ZoneContext)
  const [open, setOpen] = useState(false)
  const { submit, pending, error } = useSubmit(async (form) => {
    const values = await collect(form, fields, Boolean(id), zone)
    return saveItem(listKey, id ?? null, { ...(fixed ?? {}), ...values })
  }, (result) => {
    setOpen(false)
    const newId = (result.data as any)?.id
    if (onResultHref && newId) router.push(onResultHref.replace('{id}', encodeURIComponent(newId)))
  })
  return (
    <>
      <Pill size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>{trigger}</Pill>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <form onSubmit={submit} className="grid gap-4 px-4 pb-6 sm:grid-cols-2">
            <Inputs fields={fields} prefix={`${listKey}-${id ?? 'new'}`} />
            {error ? <Notice tone="alert" className="sm:col-span-2">{error}</Notice> : null}
            <Track className="sm:col-span-2">
              <Pill onClick={() => setOpen(false)}>Cancel</Pill>
              <Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Pill>
            </Track>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** One-click command, with an optional confirm step. */
export function OpButton({ op, input, label, variant = 'raised', confirm, size = 'sm', read }: { op: string; input: Record<string, unknown>; label: string; variant?: PillVariant; confirm?: string; size?: 'sm' | 'md'; read?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-grid gap-1">
      <Pill size={size} variant={variant} disabled={pending} onClick={() => {
        if (confirm && !window.confirm(confirm)) return
        setError(null)
        startTransition(async () => {
          const result = read ? await readOperation(op, input) : await runOperation(op, input)
          if (!result.success) { setError(result.error || 'This couldn’t be done.'); return }
          offerDownload(result.data)
          router.refresh()
        })
      }}>{pending ? 'Working…' : label}</Pill>
      {error ? <span role="alert" className="max-w-xs text-xs text-destructive">{error}</span> : null}
    </span>
  )
}

/** One-click list delete. */
export function DeleteButton({ listKey, id, label = 'Remove', confirm = 'Remove this?' }: { listKey: string; id: string; label?: string; confirm?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-grid gap-1">
      <Pill size="sm" variant="danger" disabled={pending} onClick={() => {
        if (!window.confirm(confirm)) return
        startTransition(async () => {
          const result = await deleteItem(listKey, id)
          if (!result.success) setError(result.error || 'This can’t be removed.')
          else router.refresh()
        })
      }}>{label}</Pill>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  )
}

/** One-click list update (a toggle or a status field the list allows staff to set). */
export function SaveButton({ listKey, id, data, label, variant = 'raised' }: { listKey: string; id: string; data: Record<string, unknown>; label: string; variant?: PillVariant }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-grid gap-1">
      <Pill size="sm" variant={variant} disabled={pending} onClick={() => startTransition(async () => {
        const result = await saveItem(listKey, id, data)
        if (!result.success) setError(result.error || 'This couldn’t be saved.')
        else router.refresh()
      })}>{pending ? 'Saving…' : label}</Pill>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  )
}

/** Header checkbox that ticks every row checkbox of one selection group (see OpDrawer selection). */
export function SelectAll({ group, label = 'Select all' }: { group: string; label?: string }) {
  return <input type="checkbox" aria-label={label} onChange={(e) => document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][data-select="${group}"]`).forEach((x) => { x.checked = e.target.checked })} />
}
