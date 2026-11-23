'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { runOperation } from '../../lib/actions'
import { Notice, Pill, Track } from '../../lib/ui'

const CERTS = ['R2v3', 'e-Stewards', 'NAID AAA', 'ISO 14001', 'ISO 45001', 'ISO 9001', 'ISO 27001', 'RIOS']
const field = 'h-9 rounded-[6px] border bg-background px-3 text-sm'

type Defaults = { businessName?: string; legalName?: string; supportEmail?: string; supportPhone?: string; timezone?: string; weightUnit?: string; wireInstructions?: string; storefrontUrl?: string; hasFacility: boolean; hasStarter: boolean }

/** T8: one form; runElectronicsRecyclingOnboarding is idempotent, so running it again only fills gaps. */
export function OnboardingForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [ticked, setTicked] = useState<string[]>([])

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const s = (k: string) => String(f.get(k) ?? '').trim()
    const input = {
      businessName: s('businessName'), legalName: s('legalName'), supportEmail: s('supportEmail'), supportPhone: s('supportPhone'),
      timezone: s('timezone'), weightUnit: s('weightUnit'), wireInstructions: s('wireInstructions'), storefrontUrl: s('storefrontUrl'),
      facility: { name: s('facility.name'), code: s('facility.code'), addressLine1: s('facility.addressLine1'), city: s('facility.city'), region: s('facility.region'), postalCode: s('facility.postalCode'), countryCode: s('facility.countryCode'), phone: s('facility.phone') },
      certifications: ticked.map((name) => ({ name, certificateNumber: s(`cert.${name}.number`), certifyingBody: s(`cert.${name}.body`), expiresOn: s(`cert.${name}.expires`) || null })),
      template: f.get('starter') === 'on' ? 'full' : 'basic',
      starterPassword: s('starterPassword') || undefined,
    }
    setError(null)
    start(async () => {
      const r = await runOperation('runElectronicsRecyclingOnboarding', input)
      if (!r.success) { setError(r.error || 'Onboarding did not finish.'); return }
      setResult(r.data)
      window.dispatchEvent(new Event('recycling-setup-complete'))
      router.refresh()
    })
  }

  if (result) {
    const counts = Object.entries(result.counts ?? {})
    const starter = result.starter
    return (
      <div className="grid gap-3">
        <Notice tone="status">Done. {counts.length ? `Added ${counts.map(([k, v]) => `${v} ${k}`).join(', ')}.` : 'Everything was already set up.'}</Notice>
        {starter ? (
          <div className="grid gap-2 rounded-[6px] border p-4 text-sm">
            <p className="font-medium">Business records{starter.skipped ? ' already existed' : ' added'}.</p>
            {starter.password ? <p>Password for the new portal accounts (shown once, copy it now): <span className="select-all font-mono">{starter.password}</span></p> : null}
            <ul className="grid gap-1">{(starter.logins ?? []).map((l: any) => <li key={l.email}><span className="font-mono text-xs">{l.email}</span> · {l.portal} · {l.organisation}{l.role ? ` · ${l.role}` : ''}</li>)}</ul>
            {starter.records?.note ? <p className="text-muted-foreground">{String(starter.records.note)}</p> : null}
          </div>
        ) : null}
        <Track><Pill onClick={() => setResult(null)}>Back to the form</Pill></Track>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Business</legend>
        <label className="grid gap-1 text-sm">Business name<Input name="businessName" required defaultValue={defaults.businessName} /></label>
        <label className="grid gap-1 text-sm">Legal name<Input name="legalName" defaultValue={defaults.legalName} /></label>
        <label className="grid gap-1 text-sm">Support email<Input name="supportEmail" type="email" defaultValue={defaults.supportEmail} /></label>
        <label className="grid gap-1 text-sm">Support phone<Input name="supportPhone" defaultValue={defaults.supportPhone} /></label>
        <label className="grid gap-1 text-sm">Time zone<Input name="timezone" defaultValue={defaults.timezone || 'America/Chicago'} /></label>
        <label className="grid gap-1 text-sm">Weight unit<select name="weightUnit" defaultValue={defaults.weightUnit || 'lb'} className={field}><option value="lb">Pounds</option><option value="kg">Kilograms</option></select></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Public site address<Input name="storefrontUrl" placeholder="Leave empty to use the address you are on now" defaultValue={defaults.storefrontUrl} /><span className="text-xs text-muted-foreground">Used for links in email, notices and certificates. You can change it later in Settings.</span></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Bank transfer instructions<textarea name="wireInstructions" rows={3} defaultValue={defaults.wireInstructions} className="rounded-[6px] border bg-background px-3 py-2 text-sm" /></label>
      </fieldset>

      {defaults.hasFacility ? <p className="text-sm text-muted-foreground">Your receiving facility is already set up. Manage its address and dock hours under Facilities.</p> : <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Main facility</legend>
        <label className="grid gap-1 text-sm">Name<Input name="facility.name" /></label>
        <label className="grid gap-1 text-sm">Short code<Input name="facility.code" placeholder="MAIN" /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Address<Input name="facility.addressLine1" required={!defaults.hasFacility} /></label>
        <label className="grid gap-1 text-sm">City<Input name="facility.city" required={!defaults.hasFacility} /></label>
        <label className="grid gap-1 text-sm">State or region<Input name="facility.region" /></label>
        <label className="grid gap-1 text-sm">Postal code<Input name="facility.postalCode" required={!defaults.hasFacility} /></label>
        <label className="grid gap-1 text-sm">Country<Input name="facility.countryCode" defaultValue="US" /></label>
        <label className="grid gap-1 text-sm">Phone<Input name="facility.phone" /></label>
      </fieldset>}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Certifications you hold</legend>
        <p className="text-sm text-muted-foreground">Tick only what you are certified for, and enter the number on your certificate. Nothing is added unless you tick it.</p>
        {CERTS.map((name) => {
          const on = ticked.includes(name)
          return (
            <div key={name} className="grid gap-2 rounded-[6px] border p-3 sm:grid-cols-[10rem_1fr_1fr_10rem] sm:items-center">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={on} onChange={(e) => setTicked((t) => e.target.checked ? [...t, name] : t.filter((x) => x !== name))} />{name}</label>
              {on ? <>
                <Input name={`cert.${name}.number`} required placeholder="Certificate number" aria-label={`${name} certificate number`} />
                <Input name={`cert.${name}.body`} placeholder="Certifying body" aria-label={`${name} certifying body`} />
                <Input name={`cert.${name}.expires`} type="date" aria-label={`${name} expires`} />
              </> : null}
            </div>
          )
        })}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold">Business records and portal accounts</legend>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="starter" className="mt-1" />
          <span>Add clients, buyers, jobs, lots and a completed sale, with accounts for each portal. These are real business records, not a separate mode. Only add them if they belong in this business.{defaults.hasStarter ? ' They already exist; running again changes nothing.' : ''}</span></label>
        <label className="grid max-w-sm gap-1 text-sm">New portal account password (optional)<Input name="starterPassword" type="password" minLength={10} placeholder="Generated if empty" /></label>
      </fieldset>

      {error ? <Notice tone="alert">{error}</Notice> : null}
      <Track><Pill type="submit" variant="primary" disabled={pending}>{pending ? 'Setting up…' : 'Run onboarding'}</Pill></Track>
    </form>
  )
}
