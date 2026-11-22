import { notFound } from 'next/navigation'
import { PlatformPage, can, day, label, term, usd, when } from '../../lib/page'
import { DeleteButton, ItemDrawer, OpButton, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Track, Td } from '../../lib/ui'
import { Facts, RowLink, Status } from '../../lib/view'

const JOB = `query J($id: ID!) {
  job(where: { id: $id }) {
    id jobNumber type status holdFromStatus contactName contactEmail contactPhone siteAddress accessDetails requestedDates hasDataBearing servicesRequested
    pricingModel revenueShareBps buyoutAmountMinor quoteSentAt quoteAcceptedAt quoteSignatureName declineReason cancelReason
    scheduledDate windowStart windowEnd vehicle collectedAt clientSignerName receivedAt completedAt internalNotes totalWeight assetCount dataBearingCount sanitizedCount
    organization { id name } site { id name addressLine1 city region postalCode hasDock needsLiftgate accessNotes } facility { id name } driver { id name } requestedBy { name }
    estimateLines { id category { id name dataBearingDefault } quantity unit notes }
    serviceLines { id description quantity unitPriceMinor totalMinor kind }
    photos { id caption stage image { id filename } }
    containers(orderBy: [{ label: asc }]) { id label type sealNumber receivedSealNumber sealVerified sealException sealExceptionResolution itemCountDeclared grossWeight tareWeight netWeight status locationCode assetsCount }
    commodityLines { id category { id name } weight notes outboundLine { id } }
    custodyEvents(orderBy: [{ occurredAt: desc }], take: 30) { id type occurredAt actorName signerName locationText notes container { label } asset { assetNumber } }
    certificates(orderBy: [{ issuedAt: desc }]) { id certificateNumber type status issuedAt revokedReason }
    settlement { id settlementNumber status netMinor }
    invoices { id invoiceNumber kind status totalMinor balanceMinor }
  }
  materialCategories(orderBy: [{ name: asc }], take: 200) { id name }
  acceptedItems(where: { accepted: { equals: true } }, orderBy: [{ sortOrder: asc }], take: 200) { id name feeType feeMinor category { id } }
  users(where: { AND: [{ kind: { equals: staff } }, { isActive: { equals: true } }, { role: { canCollect: { equals: true } } }] }, orderBy: [{ name: asc }]) { id name }
}`

/** A first quote from what the client asked for: catalog fees per unit, a wipe line for data-bearing units, and the pickup. */
function draftQuote(j: any, items: any[]) {
  const lines: string[] = []
  const services: string[] = j.servicesRequested ?? []
  if (j.type === 'pickup' || services.includes('pickup')) lines.push('Pickup | 1 | 0.00 | pickup')
  let dataUnits = 0
  for (const e of j.estimateLines ?? []) {
    if (e.unit !== 'units') continue
    if (e.category?.dataBearingDefault) dataUnits += e.quantity
    const item = items.find((i) => i.category?.id === e.category?.id && i.feeType === 'per_item' && i.feeMinor > 0)
    if (item) lines.push(`${item.name} recycling fee | ${e.quantity} | ${(item.feeMinor / 100).toFixed(2)} | recycling_fee`)
  }
  if (dataUnits || services.includes('data_destruction')) lines.push(`Data destruction per device | ${dataUnits || 1} | 0.00 | wipe`)
  return lines.join('\n')
}

const LINE_COLUMNS = [{ key: 'description' }, { key: 'quantity', type: 'number' as const }, { key: 'unitPriceMinor', type: 'money' as const }, { key: 'kind' }]

/** K1 quote, K3 acceptance, K4 schedule, the job's containers, custody, certificates and money. */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PlatformPage route="/platform/jobs" title="Job" crumbs={[{ label: 'Requests and jobs', href: '/dashboard/platform/jobs' }]}>
      {async (staff) => {
        const r = await listQuery<any>(JOB, { id })
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const j = r.data.job
        if (!j) notFound()
        const jobs = can(staff, 'canManageJobs')
        const dispatch = can(staff, 'canDispatch')
        const collect = can(staff, 'canCollect', 'canDispatch')
        const certs = can(staff, 'canIssueCertificates')
        const s = j.status
        const commodity = can(staff, 'canAuditAssets', 'canReceive', 'canManageDownstream') && !['closed', 'cancelled', 'declined'].includes(s)
        const commodityFields = (c?: any) => [
          { name: 'category', label: 'Material', type: 'select' as const, relation: true, required: true, options: r.data.materialCategories.map((m: any) => ({ value: m.id, label: m.name })), defaultValue: c?.category?.id },
          { name: 'weight', label: 'Weight', type: 'decimal' as const, required: true, defaultValue: c?.weight },
          { name: 'notes', label: 'Notes', defaultValue: c?.notes },
        ]
        const address = j.site ? [j.site.addressLine1, j.site.city, j.site.region, j.site.postalCode].filter(Boolean).join(', ') : j.siteAddress ? [j.siteAddress.addressLine1, j.siteAddress.city, j.siteAddress.region, j.siteAddress.postalCode].filter(Boolean).join(', ') : ''
        const quoteDefaults = j.serviceLines.length
          ? j.serviceLines.map((l: any) => [l.description, Number(l.quantity), (l.unitPriceMinor / 100).toFixed(2), l.kind].join(' | ')).join('\n')
          : draftQuote(j, r.data.acceptedItems ?? [])
        const quoteFields = [
          { name: 'pricingModel', label: 'Pricing', type: 'select' as const, required: true, options: [{ value: 'fee_for_service', label: 'Fee for service' }, { value: 'revenue_share', label: 'Revenue share' }, { value: 'buyout', label: 'Buyout (we pay the client)' }], defaultValue: j.pricingModel || 'fee_for_service' },
          { name: 'revenueShareBps', label: 'Client share of resale (%)', type: 'percent' as const, defaultValue: j.revenueShareBps ?? undefined, hint: 'Revenue share only.' },
          { name: 'buyoutAmountMinor', label: 'Buyout amount', type: 'money' as const, defaultValue: j.buyoutAmountMinor ?? undefined, hint: 'Buyout only.' },
          { name: 'lines', label: 'Service lines (description | qty | unit price | kind)', type: 'lines' as const, columns: LINE_COLUMNS, defaultValue: quoteDefaults, hint: 'Drafted from the request and your catalog fees. Fill in any 0.00 price before sending. Kinds: pickup, audit, wipe, shred, recycling_fee, other', wide: true },
          { name: 'send', label: 'Send the quote to the client now', type: 'checkbox' as const, defaultValue: true },
        ]
        return (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{j.jobNumber} <Status value={s} /></h2>
                <p className="text-sm text-muted-foreground">{j.organization?.name} · {label(j.type)}{j.facility ? ` · ${j.facility.name}` : ''}{j.hasDataBearing ? ' · data-bearing' : ''}</p>
              </div>
              <Track wrap>
                {jobs && ['requested', 'quoted'].includes(s) ? <OpDrawer op="quoteJob" fixed={{ jobId: j.id }} title={s === 'quoted' ? 'Revise the quote' : 'Quote this job'} description="The client accepts it in their portal, or you record their acceptance." trigger={s === 'quoted' ? 'Revise quote' : 'Quote'} triggerVariant="primary" fields={quoteFields} submitLabel="Save quote" /> : null}
                {jobs && s === 'quoted' ? <OpDrawer op="recordJobAcceptance" fixed={{ jobId: j.id }} title="Record the client's acceptance" description="When the client accepted by phone, email or a signed PDF." trigger="Record acceptance" fields={[{ name: 'signatureName', label: 'Accepted by', required: true, defaultValue: j.contactName }, { name: 'note', label: 'How they accepted', type: 'textarea', required: true, placeholder: 'Signed PDF returned by email on 21 Nov.' }]} submitLabel="Record" /> : null}
                {dispatch && ['accepted', 'scheduled'].includes(s) ? <OpDrawer op="scheduleJob" fixed={{ jobId: j.id }} title={s === 'scheduled' ? 'Reschedule' : 'Schedule the pickup'} trigger={s === 'scheduled' ? 'Reschedule' : 'Schedule'} triggerVariant="primary" fields={[
                  { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: j.scheduledDate?.slice(0, 10) || (Array.isArray(j.requestedDates) ? j.requestedDates[0] : undefined) },
                  { name: 'windowStart', label: 'Window from', type: 'time', required: true, defaultValue: j.windowStart || '09:00' },
                  { name: 'windowEnd', label: 'Window to', type: 'time', required: true, defaultValue: j.windowEnd || '12:00' },
                  { name: 'driverId', label: 'Driver', type: 'select', options: r.data.users.map((u: any) => ({ value: u.id, label: u.name })), defaultValue: j.driver?.id },
                  { name: 'vehicle', label: 'Vehicle', defaultValue: j.vehicle },
                ]} submitLabel="Schedule" /> : null}
                {collect && s === 'scheduled' ? <OpButton op="startJobRoute" input={{ jobId: j.id }} label="Start route" /> : null}
                {collect && ['scheduled', 'en_route'].includes(s) ? <RowLink href={`/dashboard/platform/driver?job=${j.id}`}>Collect on the driver screen</RowLink> : null}
                {can(staff, 'canReceive') && ['collected', 'received', 'scheduled', 'en_route', 'accepted'].includes(s) ? <RowLink href={`/dashboard/platform/receiving?job=${j.id}`}>Receive</RowLink> : null}
                {can(staff, 'canAuditAssets', 'canManageJobs') && s === 'received' ? <OpButton op="startProcessing" input={{ jobId: j.id }} label="Start processing" /> : null}
                {can(staff, 'canAuditAssets') && ['received', 'processing'].includes(s) ? <RowLink href={`/dashboard/platform/audit?job=${j.id}`}>Audit assets</RowLink> : null}
                {certs && s === 'processing' ? <OpButton op="completeJob" input={{ jobId: j.id }} label="Complete" confirm="Complete the job? Every data-bearing asset must have passed sanitisation." /> : null}
                {can(staff, 'canManageJobs', 'canManagePayments') && ['accepted', 'scheduled', 'collected', 'received', 'processing', 'completed'].includes(s) && j.pricingModel === 'fee_for_service' ? <OpButton op="invoiceJob" input={{ jobId: j.id }} label="Invoice the service" /> : null}
                {can(staff, 'canManageJobs', 'canManageSettlements') && ['completed', 'settled'].includes(s) ? <OpButton op="closeJob" input={{ jobId: j.id }} label="Close" confirm="Close the job? Nothing more can change on it." /> : null}
                {jobs && !['completed', 'settled', 'closed', 'cancelled', 'declined'].includes(s) ? <OpDrawer op="setJobHold" fixed={{ jobId: j.id, hold: s !== 'on_hold' }} title={s === 'on_hold' ? 'Release the hold' : 'Put on hold'} trigger={s === 'on_hold' ? 'Release hold' : 'Hold'} fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: s !== 'on_hold' }]} submitLabel={s === 'on_hold' ? 'Release' : 'Hold'} /> : null}
                {jobs && ['requested', 'quoted', 'accepted', 'scheduled', 'on_hold'].includes(s) ? <OpDrawer op="cancelJob" fixed={{ jobId: j.id }} title="Cancel the job" description="The client is told." trigger="Cancel" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} submitLabel="Cancel job" /> : null}
              </Track>
            </div>
            {s === 'on_hold' ? <Notice>On hold from {label(j.holdFromStatus)}.</Notice> : null}
            {j.declineReason ? <Notice>Declined by the client: {j.declineReason}</Notice> : null}
            {j.cancelReason ? <Notice>Cancelled: {j.cancelReason}</Notice> : null}
            <Readouts items={[{ label: 'Containers', value: j.containers.length }, { label: 'Weight', value: j.totalWeight ? Number(j.totalWeight).toFixed(1) : '—' }, { label: 'Assets', value: j.assetCount ?? 0 }, { label: 'Data-bearing', value: j.dataBearingCount ?? 0 }, { label: 'Sanitised', value: j.sanitizedCount ?? 0, tone: j.dataBearingCount && j.sanitizedCount < j.dataBearingCount ? 'wait' : undefined }]} />
            <Section title="Request">
              <Facts items={[
                ['Contact', `${j.contactName} ${j.contactEmail ? `· ${j.contactEmail}` : ''} ${j.contactPhone ? `· ${j.contactPhone}` : ''}`], ['Address', address], ['Access', [j.site?.hasDock ? 'Dock' : '', j.site?.needsLiftgate ? 'Liftgate' : '', j.site?.accessNotes || j.accessDetails || ''].filter(Boolean).join(' · ')],
                ['Wants', Array.isArray(j.requestedDates) ? j.requestedDates.map((d: string) => day(d)).join(', ') : ''], ['Services', (j.servicesRequested ?? []).map(label).join(', ')], ['Requested by', j.requestedBy?.name],
                ['Scheduled', j.scheduledDate ? `${day(j.scheduledDate)} ${j.windowStart}–${j.windowEnd}` : ''], ['Driver', j.driver ? `${j.driver.name}${j.vehicle ? ` · ${j.vehicle}` : ''}` : ''], ['Collected', j.collectedAt ? `${when(j.collectedAt)} · signed by ${j.clientSignerName}` : ''],
              ]} />
              {j.estimateLines.length ? <ul className="mt-3 text-sm">{j.estimateLines.map((e: any) => <li key={e.id}>{e.quantity} {e.unit} {e.category?.name ?? ''} {e.notes}</li>)}</ul> : null}
              {j.photos.length ? <div className="mt-2 flex flex-wrap gap-2 text-sm">{j.photos.filter((p: any) => p.image).map((p: any) => <a key={p.id} className="underline" href={`/api/files/${p.image.id}`} target="_blank">{p.caption || p.image.filename} <span className="text-muted-foreground">{label(p.stage)}</span></a>)}</div> : null}
            </Section>
            <Section title="Quote" actions={j.quoteSentAt ? <span className="text-xs text-muted-foreground">Sent {when(j.quoteSentAt)}{j.quoteAcceptedAt ? ` · accepted ${when(j.quoteAcceptedAt)} by ${j.quoteSignatureName}` : ''}</span> : null}>
              {j.serviceLines.length ? (
                <DataTable label="Service lines" head={[{ label: 'Service' }, { label: 'Qty', className: 'text-right' }, { label: 'Unit', className: 'text-right' }, { label: 'Total', className: 'text-right' }]}>
                  {j.serviceLines.map((l: any) => <tr key={l.id}><Td>{l.description}</Td><Td className="text-right tabular-nums">{Number(l.quantity)}</Td><Td className="text-right tabular-nums">{usd(l.unitPriceMinor)}</Td><Td className="text-right tabular-nums">{usd(l.totalMinor)}</Td></tr>)}
                </DataTable>
              ) : <Empty>Not quoted yet.</Empty>}
              {j.pricingModel ? <p className="mt-2 text-sm">{term(j.pricingModel)}{j.revenueShareBps ? ` · client gets ${j.revenueShareBps / 100}% of resale` : ''}{j.buyoutAmountMinor ? ` · buyout ${usd(j.buyoutAmountMinor)}` : ''}</p> : null}
            </Section>
            <Section title="Containers" count={j.containers.length}>
              {j.containers.length ? (
                <DataTable label="Containers" head={[{ label: 'Label' }, { label: 'Seal' }, { label: 'Weight', className: 'text-right' }, { label: 'Status' }, { label: 'Assets', className: 'text-right' }]}>
                  {j.containers.map((c: any) => <tr key={c.id}><Td>{c.label} <span className="text-xs text-muted-foreground">{label(c.type)}</span></Td><Td>{c.sealNumber || '—'}{c.receivedSealNumber && c.receivedSealNumber !== c.sealNumber ? <div className="text-xs text-red-600">arrived {c.receivedSealNumber}</div> : null}{c.sealException ? <div className="text-xs text-red-600">{c.sealExceptionResolution ? `Resolved: ${c.sealExceptionResolution}` : 'Seal exception'}</div> : null}</Td><Td className="text-right tabular-nums">{c.netWeight ?? c.grossWeight ?? '—'}</Td><Td><Status value={c.status} />{c.locationCode ? <div className="text-xs text-muted-foreground">{c.locationCode}</div> : null}</Td><Td className="text-right tabular-nums">{c.assetsCount}</Td></tr>)}
                </DataTable>
              ) : <Empty>Nothing collected yet.</Empty>}
            </Section>
            <Section title="Commodities by weight" count={j.commodityLines.length} actions={commodity ? <ItemDrawer listKey="CommodityLine" fixed={{ job: { connect: { id: j.id } } }} title="Add a commodity line" description="Material that is recycled by weight, not audited per serial." trigger="Add commodity" fields={commodityFields()} /> : null}>
              {j.commodityLines.length ? (
                <DataTable label="Commodity lines" head={[{ label: 'Material' }, { label: 'Weight', className: 'text-right' }, { label: 'Notes' }, { label: 'Shipped' }, { label: '' }]}>
                  {j.commodityLines.map((c: any) => <tr key={c.id}><Td>{c.category?.name ?? '—'}</Td><Td className="text-right tabular-nums">{c.weight}</Td><Td>{c.notes}</Td><Td>{c.outboundLine ? 'Yes' : '—'}</Td><Td className="whitespace-nowrap text-right">{commodity && !c.outboundLine ? <><ItemDrawer listKey="CommodityLine" id={c.id} title="Edit commodity line" trigger="Edit" fields={commodityFields(c)} /><DeleteButton listKey="CommodityLine" id={c.id} label="Remove" confirm="Remove this commodity line?" /></> : null}</Td></tr>)}
                </DataTable>
              ) : <Empty>No commodity lines.</Empty>}
            </Section>
            <Section title="Certificates" count={j.certificates.length} actions={certs && ['completed', 'settled', 'closed'].includes(s) ? <Track>
              <OpButton op="issueCertificate" input={{ jobId: j.id, type: 'data_destruction' }} label="Issue data destruction certificate" />
              <OpButton op="issueCertificate" input={{ jobId: j.id, type: 'recycling' }} label="Issue recycling certificate" />
            </Track> : null}>
              {j.certificates.length ? <ul className="grid gap-1 text-sm">{j.certificates.map((c: any) => <li key={c.id}><RowLink href={`/dashboard/platform/certificates?certificate=${c.id}`}>{c.certificateNumber}</RowLink> {label(c.type)} <Status value={c.status} /> {day(c.issuedAt)}</li>)}</ul> : <Empty>None issued.</Empty>}
            </Section>
            <Section title="Money">
              <ul className="grid gap-1 text-sm">
                {j.invoices.map((i: any) => <li key={i.id}>{i.invoiceNumber} {label(i.kind)} <Status value={i.status} /> {usd(i.totalMinor)} {i.balanceMinor ? `(${usd(i.balanceMinor)} due)` : ''}</li>)}
                {j.settlement ? <li><RowLink href={`/dashboard/platform/settlements?status=all&settlement=${j.settlement.id}`}>{j.settlement.settlementNumber}</RowLink> <Status value={j.settlement.status} /> net {usd(j.settlement.netMinor)}</li> : can(staff, 'canManageSettlements') && j.pricingModel && ['received', 'processing', 'completed'].includes(s) ? <li><OpButton op="buildSettlement" input={{ jobId: j.id }} label="Build settlement" /></li> : null}
                {!j.invoices.length && !j.settlement ? <li className="text-muted-foreground">No invoices or settlement yet.</li> : null}
              </ul>
            </Section>
            <Section title="Chain of custody" actions={<RowLink href={`/dashboard/platform/custody?job=${j.id}`}>Full record</RowLink>}>
              {j.custodyEvents.length ? <ol className="grid gap-1 text-sm">{j.custodyEvents.map((e: any) => <li key={e.id}><span className="tabular-nums text-muted-foreground">{when(e.occurredAt)}</span> {label(e.type)}{e.container ? ` · ${e.container.label}` : ''}{e.asset ? ` · ${e.asset.assetNumber}` : ''} · {e.actorName}{e.signerName ? ` · signed ${e.signerName}` : ''}{e.notes ? ` · ${e.notes}` : ''}</li>)}</ol> : <Empty>No custody events yet.</Empty>}
            </Section>
          </div>
        )
      }}
    </PlatformPage>
  )
}
