import { PlatformPage, label, when } from '../../lib/page'
import { OpButton } from '../../lib/forms'
import { param, readTabbedList, RowLink, TabbedTable, Td, type SearchParams } from '../../lib/view'

const GROUPS: Record<string, string[]> = {
  movement: ['collected', 'handed_to_carrier', 'received', 'moved', 'released_to_buyer', 'shipped_downstream', 'returned_to_client'],
  seals: ['seal_verified', 'seal_exception'],
  processing: ['audited', 'sanitized', 'verified', 'allocated'],
  holds: ['hold_placed', 'hold_released'],
}

/** Y3: every hand-off, seal check, process step and hold, by job, container or asset. Append-only. */
export default async function CustodyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const group = param(sp, 'type') || 'all'
  const jobId = param(sp, 'job')
  const q = param(sp, 'q')
  return (
    <PlatformPage route="/platform/custody" title="Chain of custody" meta="Recorded automatically by each step; it cannot be edited.">
      {async () => {
        const where: any = { AND: [] as any[] }
        if (jobId) where.AND.push({ job: { id: { equals: jobId } } })
        if (q) where.AND.push({ OR: [{ job: { jobNumber: { contains: q, mode: 'insensitive' } } }, { container: { label: { contains: q, mode: 'insensitive' } } }, { asset: { serialNumber: { contains: q, mode: 'insensitive' } } }, { asset: { assetNumber: { contains: q, mode: 'insensitive' } } }] })
        const data = await readTabbedList<any>({ list: 'custodyEvents', type: 'CustodyEvent', fields: 'id type occurredAt actorName signerName locationText notes signature { id } job { id jobNumber organization { name } } container { label } asset { assetNumber serialNumber } facility { name }', current: group, where, orderBy: [{ occurredAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'all', label: 'All', where: {} },
          ...Object.entries(GROUPS).map(([value, types]) => ({ value, label: value[0].toUpperCase() + value.slice(1), where: { type: { in: types } } })),
        ] })
        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <form className="flex gap-2" action="/dashboard/platform/custody">
                <input type="hidden" name="type" value={group} />
                {jobId ? <input type="hidden" name="job" value={jobId} /> : null}
                <input name="q" defaultValue={q} placeholder="Job, container label, serial" className="h-9 w-64 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
                <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
                {jobId ? <RowLink href="/dashboard/platform/custody">Every job</RowLink> : null}
              </form>
              {jobId ? <OpButton op="exportAssets" input={{ jobId }} label="Asset list for this job" /> : null}
            </div>
            <TabbedTable label="Custody events" tabKey="type" path="/dashboard/platform/custody" params={{ type: group, job: jobId, q }} data={data} empty="No events." head={[{ label: 'When' }, { label: 'Event' }, { label: 'Job' }, { label: 'What' }, { label: 'Who' }, { label: 'Where' }]} row={(e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap tabular-nums">{when(e.occurredAt)}</Td>
                <Td>{label(e.type)}{e.notes ? <div className="max-w-xs text-xs text-muted-foreground">{e.notes}</div> : null}</Td>
                <Td>{e.job ? <RowLink href={`/dashboard/platform/jobs/${e.job.id}`}>{e.job.jobNumber}</RowLink> : '—'}<div className="text-xs text-muted-foreground">{e.job?.organization?.name}</div></Td>
                <Td>{e.container ? `Container ${e.container.label}` : ''}{e.asset ? <span className="font-mono text-xs"> {e.asset.assetNumber} {e.asset.serialNumber}</span> : ''}</Td>
                <Td>{e.actorName}{e.signerName ? <div className="text-xs text-muted-foreground">Signed: {e.signerName}{e.signature ? <> · <a className="underline" href={`/api/files/${e.signature.id}`} target="_blank">signature</a></> : null}</div> : null}</Td>
                <Td>{e.facility?.name ?? e.locationText ?? '—'}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
