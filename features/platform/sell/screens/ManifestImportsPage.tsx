import { PlatformPage, label, term, when } from '../../lib/page'
import { OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, Track, Td } from '../../lib/ui'
import { param, readTabbedList, RowLink, Status, TabbedTable, type SearchParams } from '../../lib/view'
import { ManifestMapper, UploadManifest } from './ManifestMapper'

const SHEET = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'

/** S6: upload, map, check and commit a manifest into a draft lot (or assets onto a job). */
export default async function ManifestImportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const status = param(sp, 'status')
  const open = param(sp, 'import')
  const upload = (
    <UploadManifest title="Upload a manifest" description="Excel or CSV. Formulas are never run; the header row and columns are proposed for you to check." trigger="Upload manifest" fields={[
      { name: 'file', label: 'Spreadsheet', type: 'file', required: true, accept: SHEET },
    ]} />
  )
  return (
    <PlatformPage route="/platform/manifest-imports" title="Manifest imports" meta="Upload a spreadsheet, map its columns, check every row, then commit it into a draft lot." actions={upload}>
      {async () => {
        const opts = await listQuery<any>('query { lots(where: { status: { equals: draft } }, orderBy: [{ createdAt: desc }], take: 50) { id lotNumber title } saleEvents(where: { status: { not: { equals: closed } } }, take: 30) { id title } }')
        const drafts = opts.ok ? opts.data.lots : []
        const events = opts.ok ? opts.data.saleEvents : []
        const detail = open ? await listQuery<any>('query Imp($id: ID!) { manifestImport(where: { id: $id }) { id originalFilename status sheetName sheetNames headerRow headers mapping rowCount validCount errorCount rows purpose lot { id lotNumber } targetJob { id jobNumber } createdAt } }', { id: open }) : null
        const imp = detail?.ok ? detail.data.manifestImport : null
        const data = await readTabbedList<any>({ list: 'manifestImports', type: 'ManifestImport', fields: 'id originalFilename status purpose rowCount validCount errorCount createdAt uploadedBy { name } lot { id lotNumber } targetJob { id jobNumber }', current: status, page: Number(param(sp, 'page')) || 1, tabs: [
          { value: '', label: 'All', where: {} },
          ...['uploaded', 'mapped', 'validated', 'committed', 'discarded'].map((s) => ({ value: s, label: term(s).replace(/^./, (c) => c.toUpperCase()), where: { status: { equals: s } } })),
        ] })
        const rows: any[] = Array.isArray(imp?.rows) ? imp.rows : []
        return (
          <>
            {detail && !detail.ok ? <Notice tone="alert">{detail.error}</Notice> : null}
            {imp ? (
              <Section title={<>{imp.originalFilename} <Status value={imp.status} /></>} actions={<Track>
                {!['committed', 'discarded'].includes(imp.status) ? <OpButton op="discardManifest" input={{ importId: imp.id }} label="Discard" variant="danger" confirm="Discard this import?" /> : null}
                <RowLink href="/dashboard/platform/manifest-imports">Close</RowLink>
              </Track>}>
                <div className="grid gap-4">
                  <p className="text-sm text-muted-foreground">{imp.rowCount ?? 0} rows under the header{imp.validCount !== null ? ` · ${imp.validCount} ready · ${imp.errorCount} with errors` : ''}{imp.purpose === 'asset_import' && imp.targetJob ? ` · assets for ${imp.targetJob.jobNumber}` : ''}.</p>
                  {['uploaded', 'mapped', 'validated'].includes(imp.status) ? (
                    <ManifestMapper importId={imp.id} headers={imp.headers ?? []} mapping={imp.mapping ?? {}} sheetNames={imp.sheetNames ?? [imp.sheetName]} sheetName={imp.sheetName} headerRow={imp.headerRow ?? 0} />
                  ) : null}
                  {rows.length ? (
                    <DataTable label="Checked rows" head={[{ label: 'Row' }, { label: 'Item' }, { label: 'Qty', className: 'text-right' }, { label: 'Grade' }, { label: 'Result' }]}>
                      {rows.slice(0, 200).map((r: any) => (
                        <tr key={r.rowNumber}>
                          <Td className="tabular-nums">{r.rowNumber}</Td>
                          <Td>{[r.line?.manufacturer, r.line?.model].filter(Boolean).join(' ')}<div className="text-xs text-muted-foreground">{r.line?.description}</div></Td>
                          <Td className="text-right tabular-nums">{r.line?.quantity}</Td>
                          <Td>{[r.line?.cosmeticGrade, r.line?.functionalGrade].filter(Boolean).join(' / ')}</Td>
                          <Td>{r.valid ? <span className="text-emerald-700 dark:text-emerald-400">Ready</span> : <span className="text-red-600">{(r.errors ?? []).join(' ')}</span>}</Td>
                        </tr>
                      ))}
                    </DataTable>
                  ) : null}
                  {rows.length > 200 ? <p className="text-xs text-muted-foreground">Showing the first 200 of {rows.length} rows.</p> : null}
                  {imp.status === 'validated' ? (
                    <Track wrap>
                      <OpDrawer op="commitManifest" fixed={{ importId: imp.id }} title="Commit into a lot" description={imp.purpose === 'asset_import' ? 'Creates one asset per serial on the job.' : 'Adds each ready row as a line on a draft lot.'} trigger="Commit" triggerVariant="primary" fields={imp.purpose === 'asset_import' ? [
                        { name: 'skipInvalid', label: 'Skip rows with errors', type: 'checkbox', defaultValue: !imp.errorCount },
                      ] : [
                        { name: 'lotId', label: 'Add to draft lot', type: 'select', options: drafts.map((l: any) => ({ value: l.id, label: `${l.lotNumber} · ${l.title}` })), hint: 'Leave empty to make a new lot.' },
                        { name: 'newLotTitle', label: 'New lot title', wide: true, defaultValue: String(imp.originalFilename).replace(/\.[^.]+$/, '') },
                        { name: 'saleEventId', label: 'Sale event (new lot)', type: 'select', options: events.map((e: any) => ({ value: e.id, label: e.title })) },
                        { name: 'skipInvalid', label: 'Skip rows with errors', type: 'checkbox', defaultValue: !imp.errorCount },
                      ]} submitLabel="Commit" />
                    </Track>
                  ) : null}
                  {imp.lot ? <p className="text-sm">Committed into <RowLink href={`/dashboard/platform/lots/${imp.lot.id}`}>{imp.lot.lotNumber}</RowLink>.</p> : null}
                </div>
              </Section>
            ) : null}
            <TabbedTable label="Imports" path="/dashboard/platform/manifest-imports" params={{ status }} data={data} empty={<Empty>No imports yet.</Empty>} head={[{ label: 'File' }, { label: 'Status' }, { label: 'For' }, { label: 'Rows', className: 'text-right' }, { label: 'Errors', className: 'text-right' }, { label: 'Uploaded' }]} row={(i) => (
              <tr key={i.id}>
                <Td><RowLink href={`/dashboard/platform/manifest-imports?import=${i.id}${status ? `&status=${status}` : ''}`}>{i.originalFilename}</RowLink></Td>
                <Td><Status value={i.status} /></Td>
                <Td>{i.lot ? i.lot.lotNumber : i.targetJob ? i.targetJob.jobNumber : label(i.purpose)}</Td>
                <Td className="text-right tabular-nums">{i.rowCount ?? '—'}</Td>
                <Td className="text-right tabular-nums">{i.errorCount ?? '—'}</Td>
                <Td>{when(i.createdAt)}<div className="text-xs text-muted-foreground">{i.uploadedBy?.name}</div></Td>
              </tr>
            )} />
          </>
        )
      }}
    </PlatformPage>
  )
}
