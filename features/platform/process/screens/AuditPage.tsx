import { PlatformPage, can, label } from '../../lib/page'
import { listQuery } from '../../lib/platformRequest'
import { Empty, Notice, Section } from '../../lib/ui'
import { param, RowLink, Status, type SearchParams } from '../../lib/view'
import { AuditBench } from './AuditBench'
import { UploadManifest } from '../../sell/screens/ManifestMapper'

/** R1 audit bench; R2 import from Excel for the chosen job. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const jobId = param(sp, 'job')
  return (
    <PlatformPage route="/platform/audit" title="Audit bench" meta="Record each asset by serial: grade it, note pulled drives, photograph it.">
      {async (staff) => {
        const r = await listQuery<any>(`query A($job: ID!, $hasJob: Boolean!) {
          jobs(where: { status: { in: [collected, received, processing] } }, orderBy: [{ receivedAt: asc }], take: 80) { id jobNumber status organization { name } assetsCount }
          job(where: { id: $job }) @include(if: $hasJob) { id jobNumber status organization { name } containers(orderBy: [{ label: asc }]) { id label status } assets(where: { parent: null }, orderBy: [{ createdAt: desc }], take: 15) { id assetNumber serialNumber manufacturer model status sanitizationStatus childrenCount category { name } } }
          materialCategories(where: { AND: [{ isActive: { equals: true } }, { kind: { in: [equipment, component] } }] }, orderBy: [{ sortOrder: asc }, { name: asc }]) { id name dataBearingDefault }
          gradeDefinitions(orderBy: [{ sortOrder: asc }]) { id kind code label }
        }`, { job: jobId || '', hasJob: Boolean(jobId) })
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const job = r.data.job ?? null
        const audit = can(staff, 'canAuditAssets')
        return (
          <div className="mx-auto grid w-full max-w-3xl gap-5">
            <form action="/dashboard/platform/audit" className="flex gap-2">
              <select name="job" defaultValue={jobId} className="h-9 min-w-0 flex-1 rounded-[6px] border bg-background px-3 text-sm"><option value="">Choose a job</option>{r.data.jobs.map((j: any) => <option key={j.id} value={j.id}>{j.jobNumber} · {j.organization?.name} · {j.assetsCount} assets</option>)}</select>
              <button className="h-9 rounded-[6px] border px-3 text-sm">Open</button>
            </form>
            {!job ? <Empty>Choose a received job to start auditing.</Empty> : (
              <>
                <p className="text-sm"><RowLink href={`/dashboard/platform/jobs/${job.id}`}>{job.jobNumber}</RowLink> · {job.organization?.name} <Status value={job.status} /></p>
                {audit ? <Section title="Record an asset"><AuditBench jobId={job.id} containers={job.containers.map((c: any) => ({ id: c.id, label: c.label }))} categories={r.data.materialCategories} cosmetic={r.data.gradeDefinitions.filter((g: any) => g.kind === 'cosmetic').map((g: any) => ({ id: g.id, label: `${g.code} ${g.label}` }))} functional={r.data.gradeDefinitions.filter((g: any) => g.kind === 'functional').map((g: any) => ({ id: g.id, label: `${g.code} ${g.label}` }))} /></Section> : null}
                <Section title="Recently recorded" actions={<RowLink href={`/dashboard/platform/assets?job=${job.id}`}>Every asset on this job</RowLink>}>
                  {job.assets.length ? <ul className="grid gap-1 text-sm">{job.assets.map((a: any) => <li key={a.id}><span className="font-mono">{a.assetNumber}</span> {a.serialNumber} · {[a.manufacturer, a.model].filter(Boolean).join(' ')} {a.category ? `· ${a.category.name}` : ''} {a.childrenCount ? `· ${a.childrenCount} drive(s)` : ''} <span className="text-xs text-muted-foreground">{label(a.sanitizationStatus)}</span></li>)}</ul> : <Empty>Nothing recorded yet.</Empty>}
                </Section>
                {audit ? <Section title="Import from Excel">
                  <p className="mb-2 text-sm text-muted-foreground">The client's own asset list or your bench sheet. You map its columns, every row is checked, then the assets are added to {job.jobNumber}.</p>
                  <UploadManifest op="importAssets" fixed={{ jobId: job.id }} title={`Import assets onto ${job.jobNumber}`} description="Excel or CSV. Formulas are never run." trigger="Import from Excel" fields={[{ name: 'file', label: 'Spreadsheet', type: 'file', required: true, accept: '.xlsx,.xls,.csv' }]} />
                </Section> : null}
              </>
            )}
          </div>
        )
      }}
    </PlatformPage>
  )
}
