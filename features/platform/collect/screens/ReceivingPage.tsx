import { PlatformPage, can, label, when } from '../../lib/page'
import { OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Empty, Notice, Section } from '../../lib/ui'
import { param, RowLink, Status, type SearchParams } from '../../lib/view'
import { CollectForm } from './CollectForm'
import { ReceiveForm } from './ReceiveForm'

/** K6 receive, K7 seal exceptions, and drop-offs handed over at the dock. */
export default async function ReceivingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const only = param(sp, 'job')
  return (
    <PlatformPage route="/platform/receiving" title="Receiving" meta="Scan each container, check the seal against the collection record, weigh it, put it away.">
      {async (staff) => {
        const r = await listQuery<any>(`query R($jobs: JobWhereInput!) {
          inbound: jobs(where: $jobs, orderBy: [{ collectedAt: asc }], take: 60) { id jobNumber type status contactName organization { name } containers(orderBy: [{ label: asc }]) { id label sealNumber status } }
          exceptions: containers(where: { AND: [{ sealException: { not: { equals: "" } } }, { sealExceptionResolution: { equals: "" } }, { status: { not: { equals: missing } } }] }, orderBy: [{ updatedAt: asc }], take: 50) { id label sealNumber receivedSealNumber sealException status updatedAt job { id jobNumber organization { name } } }
        }`, { jobs: only ? { id: { equals: only } } : { OR: [{ status: { in: ['collected', 'received'] } }, { AND: [{ type: { equals: 'drop_off' } }, { status: { in: ['scheduled', 'en_route'] } }] }] } })
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const receive = can(staff, 'canReceive')
        const resolve = can(staff, 'canReceive', 'canIssueCertificates')
        const awaiting = r.data.inbound.filter((j: any) => ['collected', 'received'].includes(j.status))
        const dropOffs = r.data.inbound.filter((j: any) => j.type === 'drop_off' && ['scheduled', 'en_route'].includes(j.status))
        const containers = awaiting.flatMap((j: any) => j.containers.filter((c: any) => c.status === 'collected' || c.status === 'unexpected').map((c: any) => ({ ...c, jobId: j.id, jobNumber: j.jobNumber })))
        return (
          <div className="mx-auto grid w-full max-w-3xl gap-5">
            {receive ? <Section title="Receive a container"><ReceiveForm containers={containers} jobs={awaiting.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber }))} /></Section> : null}
            <Section title="Seal exceptions" count={r.data.exceptions.length}>
              {r.data.exceptions.length ? <ul className="grid gap-3">{r.data.exceptions.map((c: any) => (
                <li key={c.id} className="grid gap-1 rounded-[6px] border p-3 text-sm">
                  <div className="font-medium">{c.label} · <RowLink href={`/dashboard/platform/jobs/${c.job.id}`}>{c.job.jobNumber}</RowLink> <span className="text-muted-foreground">{c.job.organization?.name}</span></div>
                  <div>{c.sealException}</div>
                  <div className="text-xs text-muted-foreground">Expected {c.sealNumber || 'none'} · arrived {c.receivedSealNumber || 'none'} · {when(c.updatedAt)}</div>
                  {resolve ? <div className="flex flex-wrap gap-2">
                    <OpDrawer op="resolveSealException" fixed={{ containerId: c.id }} title={`Resolve ${c.label}`} description="Say what you checked and who confirmed it. This goes on the custody record and the certificate." trigger="Resolve" triggerVariant="primary" fields={[{ name: 'resolution', label: 'Resolution', type: 'textarea', required: true, placeholder: 'Client confirmed the seal was replaced on site; contents counted against the manifest.' }]} submitLabel="Resolve" />
                    {c.status !== 'unexpected' ? <OpDrawer op="resolveSealException" fixed={{ containerId: c.id, markMissing: true }} title={`Mark ${c.label} missing`} trigger="Mark missing" triggerVariant="danger" fields={[{ name: 'resolution', label: 'What happened', type: 'textarea', required: true }]} submitLabel="Mark missing" /> : null}
                  </div> : null}
                </li>
              ))}</ul> : <Empty>No open seal exceptions.</Empty>}
            </Section>
            <Section title="Inbound" count={awaiting.length}>
              {awaiting.length ? <ul className="grid gap-2 text-sm">{awaiting.map((j: any) => (
                <li key={j.id} className="rounded-[6px] border p-3">
                  <div className="font-medium"><RowLink href={`/dashboard/platform/jobs/${j.id}`}>{j.jobNumber}</RowLink> <span className="text-muted-foreground">{j.organization?.name}</span> <Status value={j.status} /></div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{j.containers.map((c: any) => <span key={c.id}>{c.label} <span className="text-xs text-muted-foreground">{label(c.status)}</span></span>)}</div>
                </li>
              ))}</ul> : <Empty>Nothing inbound.</Empty>}
            </Section>
            {receive && dropOffs.length ? <Section title="Drop-offs expected" count={dropOffs.length}>
              {dropOffs.map((j: any) => <details key={j.id} className="mb-2 rounded-[6px] border p-3" open={only === j.id}>
                <summary className="cursor-pointer text-sm font-medium">{j.jobNumber} · {j.organization?.name} — record the handover</summary>
                <div className="mt-3"><CollectForm jobId={j.id} jobNumber={j.jobNumber} contactName={j.contactName} /></div>
              </details>)}
            </Section> : null}
          </div>
        )
      }}
    </PlatformPage>
  )
}
