import { PlatformPage, can, label, term, when } from '../../lib/page'
import { OpDrawer, SelectAll } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Td } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, type SearchParams } from '../../lib/view'
import { ErasureImport } from './ErasureImport'
import { SampleDraw } from './SampleDraw'

const TECHNIQUES = ['overwrite', 'block_erase', 'crypto_erase', 'secure_erase', 'degauss', 'shred', 'crush', 'disintegrate']

/** R5 record, R6 import an erasure report, R7 verify a sample. NIST 800-88: clear, purge, destroy. */
export default async function SanitizationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const result = param(sp, 'result') || 'all'
  return (
    <PlatformPage route="/platform/sanitization" title="Data sanitisation" meta="Every data-bearing asset is cleared, purged or destroyed before it can be sold or certified.">
      {async (staff) => {
        const r = await listQuery<any>(`query P { pending: assets(where: { AND: [{ isDataBearing: { equals: true } }, { storageRemoved: { equals: false } }, { sanitizationStatus: { in: [pending, failed] } }, { status: { notIn: [sold, released, downstream, returned] } }] }, orderBy: [{ createdAt: asc }], take: 200) { id assetNumber serialNumber manufacturer model sanitizationStatus job { id jobNumber } category { name } }
          unverified: sanitizationRecordsCount(where: { AND: [{ verifiedBy: null }, { result: { equals: passed } }] }) }`)
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const sanitize = can(staff, 'canSanitize')
        const data = await readTabbedList<any>({ list: 'sanitizationRecords', type: 'SanitizationRecord', fields: 'id method technique standard tool toolVersion reportReference result failureReason witnessName completedAt verifiedAt verificationNote createdAt reportFile { id filename } operator { name } verifiedBy { name } asset { id assetNumber serialNumber job { id jobNumber } }', current: result, orderBy: [{ createdAt: 'desc' }], page: Number(param(sp, 'page')) || 1, tabs: [
          { value: 'all', label: 'All', where: {} },
          { value: 'passed', label: 'Passed', where: { result: { equals: 'passed' } } },
          { value: 'failed', label: 'Failed', where: { result: { equals: 'failed' } } },
          { value: 'unverified', label: 'Not verified', where: { AND: [{ result: { equals: 'passed' } }, { verifiedBy: null }] } },
          { value: 'verified', label: 'Verified', where: { NOT: { verifiedBy: null } } },
        ] })
        return (
          <>
            <Section title="Waiting for sanitisation" count={r.data.pending.length} actions={sanitize && r.data.pending.length ? <OpDrawer selection="assetIds" op="recordSanitization" title="Record sanitisation" description="For the ticked assets. Destroy covers shred, crush and disintegrate." trigger="Record for ticked" triggerVariant="primary" fields={[
              { name: 'method', label: 'Method', type: 'select', required: true, options: ['clear', 'purge', 'destroy'].map((m) => ({ value: m, label: term(m) })), defaultValue: 'purge' },
              { name: 'technique', label: 'Technique', type: 'select', required: true, options: TECHNIQUES.map((t) => ({ value: t, label: term(t) })), defaultValue: 'crypto_erase' },
              { name: 'standard', label: 'Standard', defaultValue: 'NIST SP 800-88 Rev. 1' },
              { name: 'tool', label: 'Tool' }, { name: 'toolVersion', label: 'Tool version' }, { name: 'reportReference', label: 'Report reference' },
              { name: 'result', label: 'Result', type: 'select', required: true, options: [{ value: 'passed', label: 'Passed' }, { value: 'failed', label: 'Failed' }], defaultValue: 'passed' },
              { name: 'failureReason', label: 'Why it failed', hint: 'Failed only.' },
              { name: 'witnessName', label: 'Witness', hint: 'For witnessed destruction.' },
              { name: 'completedAt', label: 'Completed', type: 'datetime' },
              { name: 'reportFile', label: 'Tool report', type: 'file' },
            ]} submitLabel="Record" /> : null}>
              {r.data.pending.length ? (
                <DataTable label="Assets to sanitise" head={[{ label: <SelectAll group="assetIds" /> }, { label: 'Asset' }, { label: 'Item' }, { label: 'Job' }, { label: 'Status' }]}>
                  {r.data.pending.map((a: any) => <tr key={a.id}><Td><input type="checkbox" data-select="assetIds" value={a.id} aria-label={`Select ${a.assetNumber}`} /></Td><Td><span className="font-mono text-xs">{a.assetNumber}</span> {a.serialNumber}</Td><Td>{[a.manufacturer, a.model].filter(Boolean).join(' ')} <span className="text-xs text-muted-foreground">{a.category?.name}</span></Td><Td>{a.job ? <RowLink href={`/dashboard/platform/jobs/${a.job.id}`}>{a.job.jobNumber}</RowLink> : '—'}</Td><Td><Status value={a.sanitizationStatus} /></Td></tr>)}
                </DataTable>
              ) : <Empty>Nothing waiting.</Empty>}
            </Section>
            {sanitize ? <Section title="Import an erasure report"><ErasureImport /></Section> : null}
            {can(staff, 'canVerifySanitization') ? <Section title="Verify a sample" count={r.data.unverified}><p className="mb-2 text-sm text-muted-foreground">{r.data.unverified} passed record(s) not yet verified. The sample size follows the verification rate in Settings.</p><SampleDraw /></Section> : null}
            <TabbedTable label="Sanitisation records" tabKey="result" path="/dashboard/platform/sanitization" params={{ result }} data={data} empty="No records." head={[{ label: 'Asset' }, { label: 'Method' }, { label: 'Result' }, { label: 'By' }, { label: 'When' }, { label: 'Verified' }]} row={(x) => (
              <tr key={x.id}>
                <Td><span className="font-mono text-xs">{x.asset?.assetNumber}</span> {x.asset?.serialNumber}{x.asset?.job ? <div className="text-xs text-muted-foreground">{x.asset.job.jobNumber}</div> : null}</Td>
                <Td>{term(x.method)} · {label(x.technique)}<div className="text-xs text-muted-foreground">{[x.standard, x.tool, x.toolVersion, x.reportReference].filter(Boolean).join(' · ')}</div>{x.reportFile ? <a className="text-xs underline" href={`/api/files/${x.reportFile.id}`} target="_blank">{x.reportFile.filename}</a> : null}</Td>
                <Td><Status value={x.result} />{x.failureReason ? <div className="text-xs text-red-600">{x.failureReason}</div> : null}</Td>
                <Td>{x.operator?.name ?? '—'}{x.witnessName ? <div className="text-xs text-muted-foreground">Witness {x.witnessName}</div> : null}</Td>
                <Td>{when(x.completedAt || x.createdAt)}</Td>
                <Td>{x.verifiedBy ? <>{x.verifiedBy.name}<div className="text-xs text-muted-foreground">{when(x.verifiedAt)}</div></> : '—'}</Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
