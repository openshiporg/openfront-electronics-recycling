import { PlatformPage, can, label, usd } from '../../lib/page'
import { OpButton, OpDrawer, SelectAll } from '../../lib/forms'
import { Track } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, Td, type SearchParams } from '../../lib/view'

const FIELDS = 'id assetNumber serialNumber clientAssetTag manufacturer model status disposition sanitizationStatus isDataBearing storageRemoved holdReason locationCode fairMarketValueMinor soldPriceMinor childrenCount category { name } job { id jobNumber } organization { name } cosmeticGrade { code } functionalGrade { code } lotLine { lot { id lotNumber } } parent { assetNumber }'

/** R2 import (via the audit bench), R3 search and export, R8 disposition and holds. */
export default async function AssetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status') || 'all'
  const q = param(sp, 'q')
  const jobId = param(sp, 'job')
  const san = param(sp, 'san')
  return (
    <PlatformPage route="/platform/assets" title="Assets" meta="Every audited item by serial. Search by serial, asset number or client tag.">
      {async (staff) => {
        const where: any = { AND: [] as any[] }
        if (q) where.AND.push({ OR: [{ serialNumber: { contains: q, mode: 'insensitive' } }, { assetNumber: { contains: q, mode: 'insensitive' } }, { clientAssetTag: { contains: q, mode: 'insensitive' } }, { model: { contains: q, mode: 'insensitive' } }] })
        if (jobId) where.AND.push({ job: { id: { equals: jobId } } })
        if (san) where.AND.push({ sanitizationStatus: { equals: san } })
        const data = await readTabbedList<any>({ list: 'assets', type: 'Asset', fields: FIELDS, current: status, where, orderBy: [{ createdAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'all', label: 'All', where: {} },
          { value: 'audited', label: 'Audited', where: { status: { in: ['received', 'audited'] } } },
          { value: 'ready_for_sale', label: 'Ready for sale', where: { status: { equals: 'ready_for_sale' } } },
          { value: 'allocated', label: 'On a lot', where: { status: { in: ['allocated', 'sold'] } } },
          { value: 'released', label: 'Gone', where: { status: { in: ['released', 'recycling', 'downstream', 'returned'] } } },
          { value: 'on_hold', label: 'On hold', where: { status: { equals: 'on_hold' } } },
        ] })
        const manage = can(staff, 'canAuditAssets', 'canManageLots')
        const exportInput = { jobId: jobId || null, search: q || null, status: ['all', 'audited', 'allocated', 'released'].includes(status) ? null : status }
        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <form className="flex flex-wrap gap-2" action="/dashboard/platform/assets">
                <input type="hidden" name="status" value={status} />
                {jobId ? <input type="hidden" name="job" value={jobId} /> : null}
                <input name="q" defaultValue={q} placeholder="Serial, asset number, client tag" className="h-9 w-64 max-w-full rounded-[6px] border bg-background px-3 text-sm" />
                <select name="san" defaultValue={san} className="h-9 rounded-[6px] border bg-background px-3 text-sm"><option value="">Any sanitisation</option>{['pending', 'passed', 'failed', 'destroyed', 'not_required'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
                <button className="h-9 rounded-[6px] border px-3 text-sm">Search</button>
                {jobId ? <RowLink href="/dashboard/platform/assets">Every job</RowLink> : null}
              </form>
              <Track wrap>
                <OpButton op="exportAssets" input={exportInput} label="Export to Excel" />
                {jobId ? <OpButton op="exportAssets" input={{ ...exportInput, forClient: true }} label="Client asset list" /> : null}
                {can(staff, 'canAuditAssets') ? <RowLink href={`/dashboard/platform/audit${jobId ? `?job=${jobId}` : ''}`}>Audit or import</RowLink> : null}
              </Track>
            </div>
            {manage ? (
              <Track wrap>
                <span className="text-sm text-muted-foreground">With the ticked assets:</span>
                <OpDrawer selection="assetIds" op="setAssetDisposition" title="Set disposition" trigger="Disposition" fields={[{ name: 'disposition', label: 'Disposition', type: 'select', required: true, options: ['undecided', 'resale', 'parts', 'recycle', 'return'].map((d) => ({ value: d, label: label(d) })) }]} submitLabel="Set" />
                <OpDrawer selection="assetIds" op="placeAssetHold" title="Place a hold" description="Held assets cannot be sold, shipped or returned until released." trigger="Hold" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Client asked us to keep these for litigation.' }]} submitLabel="Hold" />
                <OpDrawer selection="assetIds" op="releaseAssetHold" title="Release the hold" trigger="Release hold" fields={[{ name: 'note', label: 'Note', type: 'textarea' }]} submitLabel="Release" />
                {can(staff, 'canSanitize') ? <RowLink href="/dashboard/platform/sanitization">Record sanitisation</RowLink> : null}
              </Track>
            ) : null}
            <TabbedTable label="Assets" path="/dashboard/platform/assets" params={{ status, q, job: jobId, san }} data={data} empty="No assets match." head={[{ label: <SelectAll group="assetIds" /> }, { label: 'Asset' }, { label: 'Item' }, { label: 'Job' }, { label: 'Grade' }, { label: 'Data' }, { label: 'Status' }, { label: 'Value', className: 'text-right' }]} row={(a) => (
              <tr key={a.id}>
                <Td><input type="checkbox" data-select="assetIds" value={a.id} aria-label={`Select ${a.assetNumber}`} /></Td>
                <Td><span className="font-mono text-xs">{a.assetNumber}</span><div>{a.serialNumber || '—'}</div>{a.clientAssetTag ? <div className="text-xs text-muted-foreground">Tag {a.clientAssetTag}</div> : null}{a.parent ? <div className="text-xs text-muted-foreground">Pulled from {a.parent.assetNumber}</div> : null}</Td>
                <Td>{[a.manufacturer, a.model].filter(Boolean).join(' ') || '—'}<div className="text-xs text-muted-foreground">{a.category?.name}{a.childrenCount ? ` · ${a.childrenCount} drive(s)` : ''}{a.locationCode ? ` · ${a.locationCode}` : ''}</div></Td>
                <Td>{a.job ? <RowLink href={`/dashboard/platform/jobs/${a.job.id}`}>{a.job.jobNumber}</RowLink> : '—'}<div className="text-xs text-muted-foreground">{a.organization?.name}</div></Td>
                <Td>{[a.cosmeticGrade?.code, a.functionalGrade?.code].filter(Boolean).join(' / ') || '—'}</Td>
                <Td>{a.isDataBearing ? <><Status value={a.sanitizationStatus} />{a.storageRemoved ? <div className="text-xs text-muted-foreground">Storage pulled</div> : null}</> : <span className="text-xs text-muted-foreground">None</span>}</Td>
                <Td><Status value={a.status} /><div className="text-xs text-muted-foreground">{label(a.disposition)}</div>{a.holdReason ? <div className="max-w-[14rem] text-xs text-red-600">{a.holdReason}</div> : null}{a.lotLine?.lot ? <RowLink href={`/dashboard/platform/lots/${a.lotLine.lot.id}`}>{a.lotLine.lot.lotNumber}</RowLink> : null}</Td>
                <Td className="text-right tabular-nums">{a.soldPriceMinor ? usd(a.soldPriceMinor) : a.fairMarketValueMinor ? usd(a.fairMarketValueMinor) : '—'}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
