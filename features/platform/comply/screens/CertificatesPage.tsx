import { PlatformPage, can, day, label, when } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { Section, Track } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

/** Y2: issue, revoke and reissue. A certificate is a snapshot; a correction is a revoke plus a reissue. */
export default async function CertificatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'issued'
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/certificates" title="Certificates" meta="Certificates of data destruction and of recycling. Each has a public verification code.">
      {async (staff) => {
        const issue = can(staff, 'canIssueCertificates')
        const ready = issue ? await listQuery<any>('query { jobs(where: { status: { in: [completed, settled, closed] } }, orderBy: [{ completedAt: desc }], take: 100) { id jobNumber hasDataBearing organization { name } certificates(where: { status: { equals: issued } }) { type } } }') : null
        const waiting = ready?.ok ? ready.data.jobs.filter((j: any) => !j.certificates.some((c: any) => c.type === 'recycling') || (j.hasDataBearing && !j.certificates.some((c: any) => c.type === 'data_destruction'))) : []
        const where = q ? { OR: [{ certificateNumber: { contains: q, mode: 'insensitive' } }, { verificationCode: { equals: q } }, { job: { jobNumber: { contains: q, mode: 'insensitive' } } }, { organization: { name: { contains: q, mode: 'insensitive' } } }] } : {}
        const data = await readTabbedList<any>({ list: 'certificates', type: 'Certificate', fields: 'id certificateNumber type status issuedAt verificationCode revokedReason revokedAt issuedBy { name } job { id jobNumber } organization { name } replaces { certificateNumber } pdf { id }', current: status, where, orderBy: [{ issuedAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'issued', label: 'Issued', where: { status: { equals: 'issued' } } },
          { value: 'revoked', label: 'Revoked', where: { status: { equals: 'revoked' } } },
          { value: 'all', label: 'All', where: {} },
        ] })
        return (
          <>
            {waiting.length ? (
              <Section title="Completed jobs without a certificate" count={waiting.length}>
                <ul className="grid gap-2 text-sm">{waiting.map((j: any) => {
                  const has = (t: string) => j.certificates.some((c: any) => c.type === t)
                  return <li key={j.id} className="flex flex-wrap items-center gap-2"><RowLink href={`/dashboard/platform/jobs/${j.id}`}>{j.jobNumber}</RowLink> <span className="text-muted-foreground">{j.organization?.name}</span>
                    <Track>{j.hasDataBearing && !has('data_destruction') ? <OpButton op="issueCertificate" input={{ jobId: j.id, type: 'data_destruction' }} label="Issue data destruction" variant="primary" /> : null}{!has('recycling') ? <OpButton op="issueCertificate" input={{ jobId: j.id, type: 'recycling' }} label="Issue recycling" /> : null}</Track></li>
                })}</ul>
              </Section>
            ) : null}
            <form className="flex gap-2" action="/dashboard/platform/certificates">
              <input type="hidden" name="status" value={status} />
              <input name="q" defaultValue={q} placeholder="Number, verification code, job or client" className="h-9 w-72 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
              <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
            </form>
            <TabbedTable label="Certificates" path="/dashboard/platform/certificates" params={{ status, q }} data={data} empty="No certificates here." head={[{ label: 'Certificate' }, { label: 'Job' }, { label: 'Status' }, { label: 'Issued' }, { label: 'Verify' }, { label: '' }]} row={(c) => (
              <tr key={c.id}>
                <Td><span className="font-medium">{c.certificateNumber}</span><div className="text-xs text-muted-foreground">{label(c.type)}{c.replaces ? ` · replaces ${c.replaces.certificateNumber}` : ''}</div></Td>
                <Td>{c.job ? <RowLink href={`/dashboard/platform/jobs/${c.job.id}`}>{c.job.jobNumber}</RowLink> : '—'}<div className="text-xs text-muted-foreground">{c.organization?.name}</div></Td>
                <Td><Status value={c.status} />{c.revokedReason ? <div className="max-w-xs text-xs text-muted-foreground">{day(c.revokedAt)}: {c.revokedReason}</div> : null}</Td>
                <Td>{when(c.issuedAt)}<div className="text-xs text-muted-foreground">{c.issuedBy?.name}</div></Td>
                <Td><a className="font-mono text-xs underline" href={`/verify/${c.verificationCode}`} target="_blank">{c.verificationCode}</a></Td>
                <Td className="whitespace-nowrap text-right">
                  <OpButton op="staffDownloadFile" input={{ kind: 'certificate', id: c.id }} label="PDF" />
                  {issue && c.status === 'issued' ? <OpDrawer op="revokeCertificate" fixed={{ certificateId: c.id }} title={`Revoke ${c.certificateNumber}`} description="The verification page shows it as revoked. Reissue to give the client a corrected certificate from the job's current records." trigger="Revoke" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }, { name: 'reissue', label: 'Reissue a corrected certificate now', type: 'checkbox', defaultValue: true }]} submitLabel="Revoke" /> : null}
                </Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
