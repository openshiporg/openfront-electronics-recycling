import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { AccountShell, requireKind } from '../../components/AccountShell'
import { FileButton } from '../../components/FileButton'
import { QuoteBox } from '../../components/client/QuoteBox'
import { Empty, LoadError, Notice, StatusPill, Timeline } from '../../components/ui'
import { getStore, myJob, myJobs } from '../../lib/data/store'
import { date, dateTime, docParagraphs, label, money } from '../../lib/format'

const STAGE_LABELS: Record<string, string> = { requested: 'Requested', quoted: 'Quote sent', accepted: 'Accepted', scheduled: 'Scheduled', en_route: 'On the way', collected: 'Collected', received: 'At our facility', processing: 'Being processed', completed: 'Completed', settled: 'Settled', closed: 'Closed' }
const SERVICE_LABELS: Record<string, string> = { pickup: 'Collection', drop_off: 'Drop-off', itad: 'IT asset disposition', data_destruction: 'Data destruction', onsite_shred: 'On-site shredding', witness_destruction: 'Witnessed destruction', recycling: 'Recycling' }

type Custody = { type: string; occurredAt: string; container: string; facility: string; actor: string; signerName: string; location: string; notes: string }
/** Per-asset events (audited, moved, sanitised) come in hundreds; show them as one line per step and day. */
function groupCustody(events: Custody[], tz: string) {
  const out: Array<Custody & { count: number }> = []
  for (const e of events) {
    const last = out[out.length - 1]
    if (last && last.type === e.type && date(last.occurredAt, tz) === date(e.occurredAt, tz) && !e.signerName) { last.count++; if (last.container !== e.container) last.container = ''; continue }
    out.push({ ...e, count: 1 })
  }
  return out
}

function when(j: any, tz: string) {
  if (j.completedAt) return `Completed ${date(j.completedAt, tz)}`
  if (j.collectedAt) return `Collected ${date(j.collectedAt, tz)}`
  if (j.scheduledDate) return `${date(j.scheduledDate, 'UTC')}${j.windowStart ? `, ${j.windowStart}–${j.windowEnd}` : ''}`
  return `Requested ${date(j.createdAt, tz)}`
}

/** C1 */
export async function ClientHome() {
  await requireKind('client', '/client')
  const [store, result] = await Promise.all([getStore(), myJobs()])
  const tz = store.ok ? store.data.timezone : 'America/New_York'
  if (!result.ok) return <AccountShell kind="client" tab="jobs" title="Your jobs"><LoadError message={result.error} /></AccountShell>
  const { organization, jobs } = result.data
  const needsYou = jobs.filter((j: any) => j.status === 'quoted')
  return (
    <AccountShell kind="client" tab="jobs" title={organization.name} lede="Your collections, their chain of custody, and the certificates for each." actions={<Link className="ar-btn ar-btn-primary" href="/request-pickup"><Plus size={18} aria-hidden="true" /> Request another pickup</Link>}>
      {needsYou.length ? (
        <div style={{ marginBottom: 18 }}>
          <Notice title={needsYou.length === 1 ? 'A quote is waiting for you' : `${needsYou.length} quotes are waiting for you`}>
            {needsYou.map((j: any, i: number) => <span key={j.jobNumber}>{i ? ', ' : ''}<Link className="ar-textlink" href={`/client/jobs/${j.jobNumber}`}>{j.jobNumber}</Link></span>)}. Accept it to book the collection.
          </Notice>
        </div>
      ) : null}
      {!jobs.length ? (
        <Empty title="No jobs yet"><Link className="ar-textlink" href="/request-pickup">Request your first pickup</Link></Empty>
      ) : (
        <div className="ar-table-wrap">
          <table className="ar-table">
            <thead><tr><th scope="col">Job</th><th scope="col">Type</th><th scope="col">Site</th><th scope="col">When</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {jobs.map((j: any) => (
                <tr key={j.id}>
                  <td data-label="Job"><Link className="ar-textlink" href={`/client/jobs/${j.jobNumber}`}>{j.jobNumber}</Link></td>
                  <td data-label="Type">{j.type === 'drop_off' ? 'Drop-off' : 'Pickup'}</td>
                  <td data-label="Site">{j.site || '—'}</td>
                  <td data-label="When">{when(j, tz)}</td>
                  <td data-label="Status"><StatusPill status={j.status} text={j.status === 'quoted' ? 'Quote to accept' : STAGE_LABELS[j.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  )
}

/** C2, C3, C4 */
export async function ClientJobPage({ params, searchParams }: { params: Promise<{ jobNumber: string }>; searchParams: Promise<{ new?: string }> }) {
  const { jobNumber: raw } = await params
  const { new: isNew } = await searchParams
  const jobNumber = decodeURIComponent(raw)
  await requireKind('client', `/client/jobs/${jobNumber}`)
  const [store, result] = await Promise.all([getStore(), myJob(jobNumber)])
  const s = store.ok ? store.data : null
  const tz = s?.timezone || 'America/New_York'
  const cur = s?.currencyCode || 'USD'
  const wu = s?.weightUnit || 'lb'
  if (!result.ok) {
    if (/not found/i.test(result.error)) notFound()
    return <AccountShell kind="client" tab="jobs" title={`Job ${jobNumber}`}><LoadError message={result.error} /></AccountShell>
  }
  const j = result.data
  const q = j.quote
  const stopped = ['declined', 'cancelled', 'on_hold'].includes(j.status)
  return (
    <AccountShell kind="client" tab="jobs" title={`Job ${j.jobNumber}`} lede={<span className="ar-meta-line"><StatusPill status={j.status} text={STAGE_LABELS[j.status]} /><span>{j.type === 'drop_off' ? 'Drop-off' : 'Pickup'}</span>{j.site ? <span>{j.site}</span> : null}</span>} crumbs={[{ href: '/client', label: 'Jobs' }, { label: j.jobNumber }]}>
      <div className="ar-stack" style={{ display: 'grid', gap: 18 }}>
        {isNew ? <Notice tone="ok" title={`Request ${j.jobNumber} sent`}>We build your quote and email you when it is ready, usually within one business day. You accept it here.</Notice> : null}
        {stopped ? (
          <Notice tone={j.status === 'on_hold' ? undefined : 'error'} title={j.status === 'declined' ? 'You declined this quote' : j.status === 'cancelled' ? 'This job was cancelled' : 'This job is on hold'}>{j.declineReason || j.cancelReason || 'Email us if you have questions.'}</Notice>
        ) : (
          <section className="ar-panel" aria-label="Progress"><Timeline stages={j.stages} current={j.status} labels={STAGE_LABELS} /></section>
        )}

        <div className="ar-split">
          <div className="ar-stack" style={{ display: 'grid', gap: 18 }}>
            {q ? (
              <section className="ar-panel" aria-labelledby="quote-title">
                <div className="ar-panel-head"><h2 id="quote-title">Quote</h2><span className="ar-small ar-muted">Sent {date(q.sentAt, tz)}</span></div>
                <p style={{ marginBottom: 12 }}>
                  {q.pricingModel === 'revenue_share' ? <>Fee for service, and you receive <strong>{(q.revenueShareBps ?? 0) / 100}%</strong> of what your equipment resells for, on a settlement statement.</>
                    : q.pricingModel === 'buyout' ? <>We buy the equipment outright for <strong className="ar-y">{money(q.buyoutAmountMinor ?? 0, cur)}</strong>.</>
                    : 'Fee for service.'}
                </p>
                {q.lines.length ? (
                  <div className="ar-table-wrap">
                    <table className="ar-table">
                      <thead><tr><th scope="col">Service</th><th scope="col" className="ar-num">Qty</th><th scope="col" className="ar-num">Unit</th><th scope="col" className="ar-num">Amount</th></tr></thead>
                      <tbody>{q.lines.map((l: any, i: number) => <tr key={i}><td data-label="Service">{l.description}</td><td data-label="Qty" className="ar-num">{l.quantity}</td><td data-label="Unit" className="ar-num">{money(l.unitPriceMinor, cur)}</td><td data-label="Amount" className="ar-num">{money(l.totalMinor, cur)}</td></tr>)}</tbody>
                      <tfoot><tr><th scope="row" colSpan={3}>Total fees</th><td className="ar-num"><strong>{money(q.totalMinor, cur)}</strong></td></tr></tfoot>
                    </table>
                  </div>
                ) : null}
                {q.acceptedAt ? <p className="ar-small ar-muted" style={{ marginTop: 12 }}>Accepted {dateTime(q.acceptedAt, tz)} by {q.signatureName}.</p> : null}
              </section>
            ) : (
              <section className="ar-panel"><h2 style={{ marginBottom: 8 }}>Quote</h2><p className="ar-muted">We are preparing your quote.</p></section>
            )}

            {j.containers.length ? (
              <section className="ar-panel" aria-labelledby="cont-title">
                <h2 id="cont-title" style={{ marginBottom: 12 }}>Containers and weights</h2>
                <div className="ar-table-wrap">
                  <table className="ar-table">
                    <thead><tr><th scope="col">Container</th><th scope="col">Seal</th><th scope="col" className="ar-num">Gross</th><th scope="col" className="ar-num">Net</th><th scope="col">Status</th></tr></thead>
                    <tbody>{j.containers.map((c: any) => <tr key={c.label}><td data-label="Container">{c.label}<div className="ar-small ar-muted">{label(c.type)}</div></td><td data-label="Seal">{c.sealNumber || '—'}{c.sealNumber ? <div className="ar-small ar-muted">{c.sealVerified ? 'Verified on arrival' : 'Not yet checked'}</div> : null}</td><td data-label="Gross" className="ar-num">{c.grossWeight != null ? `${c.grossWeight.toLocaleString('en-US')} ${wu}` : '—'}</td><td data-label="Net" className="ar-num">{c.grossWeight != null && c.tareWeight != null ? `${(c.grossWeight - c.tareWeight).toLocaleString('en-US')} ${wu}` : '—'}</td><td data-label="Status"><StatusPill status={c.status} /></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {j.custody.length ? (
              <section className="ar-panel" aria-labelledby="cust-title">
                <h2 id="cust-title" style={{ marginBottom: 12 }}>Chain of custody</h2>
                <ol className="ar-custody">
                  {groupCustody(j.custody, tz).map((e, i) => (
                    <li key={i}><time className="ar-small ar-muted">{dateTime(e.occurredAt, tz)}</time><strong>{label(e.type)}{e.count > 1 ? ` · ${e.count} items` : ''}</strong>{[e.container && `Container ${e.container}`, e.facility, e.location, e.actor && `by ${e.actor}`, e.signerName && `signed by ${e.signerName}`].filter(Boolean).join(' · ')}{e.notes && e.count === 1 ? <div className="ar-small ar-muted">{e.notes}</div> : null}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {j.summary.assets ? (
              <section className="ar-panel" aria-labelledby="sum-title">
                <h2 id="sum-title" style={{ marginBottom: 12 }}>What happened to it</h2>
                <dl className="ar-grid-3" style={{ margin: 0 }}>
                  <div className="ar-stat"><dt>Assets logged</dt><dd className="ar-num">{j.summary.assets}</dd></div>
                  <div className="ar-stat"><dt>Data devices sanitised</dt><dd className="ar-num">{j.summary.sanitized} of {j.summary.dataBearing}</dd></div>
                  <div className="ar-stat"><dt>Reused / recycled</dt><dd className="ar-num">{j.summary.reused} / {j.summary.recycled}</dd></div>
                </dl>
              </section>
            ) : null}
          </div>

          <aside className="ar-stack" style={{ display: 'grid', gap: 18, alignContent: 'start' }} aria-label="Actions and documents">
            {q?.canRespond ? <QuoteBox jobNumber={j.jobNumber} termsVersion={q.termsVersion} terms={docParagraphs(q.terms).map((p) => p.text)} /> : j.status === 'quoted' ? <Notice title="Quote waiting">An administrator on your account can accept it.</Notice> : null}

            <section className="ar-bidbox" style={{ position: 'static' }}>
              <h2>Certificates</h2>
              {j.certificates.length ? (
                <ul className="ar-list" style={{ marginTop: 8 }}>
                  {j.certificates.map((c: any) => (
                    <li key={c.certificateNumber} style={{ display: 'grid', gap: 6 }}>
                      <div><strong>{c.certificateNumber}</strong> <StatusPill status={c.status} /></div>
                      <span className="ar-small ar-muted">{label(c.type)} · issued {date(c.issuedAt, tz)}</span>
                      {c.revokedReason ? <span className="ar-small" style={{ color: 'var(--ar-red)' }}>{c.revokedReason}</span> : null}
                      <div className="ar-actions"><FileButton what="certificate" id={c.certificateNumber} label="Certificate PDF" />{c.verificationCode ? <Link className="ar-textlink ar-small" href={`/verify/${c.verificationCode}`}>Public check page</Link> : null}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="ar-small ar-muted" style={{ marginTop: 8 }}>Certificates of data destruction and recycling are issued when processing is complete.</p>}
            </section>

            {j.settlement ? (
              <section className="ar-panel">
                <div className="ar-panel-head"><h2>Settlement</h2><StatusPill status={j.settlement.status} /></div>
                <dl className="ar-dl">
                  <dt>Your share</dt><dd className="ar-num">{money(j.settlement.clientShareTotalMinor, cur)}</dd>
                  <dt>Fees</dt><dd className="ar-num">{money(j.settlement.feesTotalMinor, cur)}</dd>
                  <dt>Net to you</dt><dd className="ar-num ar-y"><strong>{money(j.settlement.netMinor, cur)}</strong></dd>
                  {j.settlement.paidAt ? <><dt>Paid</dt><dd>{date(j.settlement.paidAt, tz)}{j.settlement.payoutMethod ? ` by ${label(j.settlement.payoutMethod)}` : ''}</dd></> : null}
                </dl>
                <div style={{ marginTop: 12 }}><FileButton what="settlement" id={j.settlement.settlementNumber} label={`Statement ${j.settlement.settlementNumber}`} /></div>
              </section>
            ) : null}

            <section className="ar-panel">
              <h2 style={{ marginBottom: 10 }}>Request</h2>
              <dl className="ar-dl">
                <dt>Contact</dt><dd>{j.contactName}</dd>
                {j.requestedDates.length ? <><dt>Dates asked</dt><dd>{j.requestedDates.map((d: string) => date(`${d}T12:00:00Z`, 'UTC')).join(', ')}</dd></> : null}
                {j.servicesRequested.length ? <><dt>Services</dt><dd>{j.servicesRequested.map((x: string) => SERVICE_LABELS[x] ?? label(x)).join(', ')}</dd></> : null}
                {j.estimate.length ? <><dt>Estimate</dt><dd>{j.estimate.map((e: any) => `${e.quantity} ${e.unit} ${e.category || 'other'}`).join(', ')}</dd></> : null}
                {j.driver ? <><dt>Driver</dt><dd>{j.driver}{j.vehicle ? `, ${j.vehicle}` : ''}</dd></> : null}
                {j.clientSignerName ? <><dt>Signed out by</dt><dd>{j.clientSignerName}</dd></> : null}
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </AccountShell>
  )
}
