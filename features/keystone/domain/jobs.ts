import { audit, dbNow, fail, inTransaction, lockRow, nextNumber, requireClient, str, type Ctx, type Tx } from '../lib/core'
import { AFTER_COLLECTION, jobCompletionProblem, jobTransition } from '../lib/rules/lifecycle'
import { createInvoice } from './money'
import { afterCommit, getSettings, notify, organizationUsers, staffWith, storeUpload, type FileInput } from '../lib/services'

// Jobs from request to completion (§3.5).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SERVICES = ['pickup', 'drop_off', 'data_destruction', 'onsite_shred', 'itad', 'recycling', 'witness_destruction']

type RequestInput = {
  type?: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  organizationName?: string
  site?: { addressLine1: string; addressLine2?: string; city: string; region?: string; postalCode: string; countryCode?: string; hasDock?: boolean; needsLiftgate?: boolean; accessNotes?: string; hours?: string }
  requestedDates?: string[]
  hasDataBearing?: boolean
  services?: string[]
  estimate?: Array<{ categoryId?: string | null; quantity: number; unit?: string; notes?: string }>
  notes?: string
  photos?: FileInput[]
  facilityId?: string | null
}

function cleanSite(site: RequestInput['site'], required: boolean) {
  if (!site) {
    if (required) fail('Enter the pickup address.')
    return null
  }
  const s = { addressLine1: str(site.addressLine1, 200), addressLine2: str(site.addressLine2, 200), city: str(site.city, 120), region: str(site.region, 120), postalCode: str(site.postalCode, 20), countryCode: str(site.countryCode, 2).toUpperCase() || 'US', hasDock: Boolean(site.hasDock), needsLiftgate: Boolean(site.needsLiftgate), accessNotes: str(site.accessNotes, 1000), hours: str(site.hours, 200) }
  if (required && (!s.addressLine1 || !s.city || !s.postalCode)) fail('Enter the street, city and postal code.')
  return s
}

async function createJobRecord(tx: Tx, input: RequestInput & { organizationId: string; requestedById?: string | null; siteId?: string | null; uploadedById?: string | null }) {
  const type = input.type === 'drop_off' ? 'drop_off' : 'pickup'
  const site = cleanSite(input.site, type === 'pickup' && !input.siteId)
  const job = await tx.job.create({
    data: {
      jobNumber: await nextNumber(tx, 'job'),
      type,
      status: 'requested',
      organizationId: input.organizationId,
      siteId: input.siteId ?? null,
      facilityId: input.facilityId || (await tx.facility.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id || null,
      requestedById: input.requestedById ?? null,
      contactName: str(input.contactName, 120),
      contactEmail: str(input.contactEmail, 200).toLowerCase(),
      contactPhone: str(input.contactPhone, 40),
      siteAddress: (site ?? undefined) as any,
      accessDetails: site ? { hasDock: site.hasDock, needsLiftgate: site.needsLiftgate, accessNotes: site.accessNotes, hours: site.hours } : {},
      requestedDates: (input.requestedDates ?? []).map((d) => str(d, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 5),
      hasDataBearing: Boolean(input.hasDataBearing),
      servicesRequested: (input.services ?? []).filter((s) => SERVICES.includes(s)),
      internalNotes: str(input.notes, 4000),
      estimateLines: { create: (input.estimate ?? []).slice(0, 50).filter((l) => Number(l.quantity) > 0).map((l) => ({ categoryId: l.categoryId || null, quantity: Math.round(Number(l.quantity)), unit: ['units', 'pallets', 'lb', 'kg'].includes(String(l.unit)) ? l.unit : 'units', notes: str(l.notes, 300) })) },
    },
  })
  for (const photo of (input.photos ?? []).slice(0, 8)) {
    const stored = await storeUpload(tx, photo, { purpose: 'job_photo', ownerClientOrganizationId: input.organizationId, uploadedById: input.uploadedById ?? null })
    if (stored) await tx.jobPhoto.create({ data: { jobId: job.id, imageId: stored.id, stage: 'request', caption: '' } })
  }
  await notify(tx, { userIds: await staffWith(tx, 'canManageJobs'), type: 'job_requested', title: `New ${type === 'pickup' ? 'pickup' : 'drop-off'} request ${job.jobNumber}`, body: `${str(input.organizationName, 200) || 'A client'} asked for a ${type.replace('_', '-')}. Build and send the quote.`, link: `/dashboard/platform/jobs/${job.id}` })
  await audit(tx, { actorId: input.requestedById ?? null, action: 'job.requested', entityType: 'Job', entityId: job.id, after: { type } })
  return job
}

/** P3: a public request creates the organisation, a client admin login, and the job. */
export async function submitPickupRequest(context: Ctx, args: RequestInput & { password: string; organizationName: string }) {
  const email = str(args.contactEmail, 200).toLowerCase()
  if (!str(args.contactName, 120)) fail('Enter your name.')
  if (!EMAIL.test(email)) fail('Enter a valid email address.')
  if (!str(args.organizationName, 200)) fail('Enter your organisation name.')
  if (String(args.password || '').length < 10) fail('Use a password of at least 10 characters.')
  const exists = await context.prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) fail('An account with this email already exists. Sign in and request the pickup from your account.')
  const org = await context.prisma.clientOrganization.create({ data: { name: str(args.organizationName, 200), billingEmail: email, status: 'prospect', addressLine1: str(args.site?.addressLine1, 200), city: str(args.site?.city, 120), region: str(args.site?.region, 120), postalCode: str(args.site?.postalCode, 20), countryCode: str(args.site?.countryCode, 2).toUpperCase() || 'US' } })
  const user = await context.sudo().db.User.createOne({ data: { name: str(args.contactName, 120), email, password: String(args.password), phone: str(args.contactPhone, 40), kind: 'client', clientRole: 'admin', clientOrganization: { connect: { id: org.id } } } })
  const job = await inTransaction(context, (tx) => createJobRecord(tx, { ...args, organizationId: org.id, requestedById: user.id, uploadedById: user.id }))
  afterCommit(context)
  return { jobNumber: job.jobNumber, userId: user.id }
}

/** C1 (client) and K2 (staff, for a client who phoned). */
export async function requestJob(context: Ctx, args: RequestInput & { organizationId?: string | null; siteId?: string | null }) {
  const session = context.session
  const staff = session?.data?.role?.canManageJobs || session?.data?.role?.canManageClients
  if (staff) {
    const org = await context.prisma.clientOrganization.findUnique({ where: { id: str(args.organizationId, 60) } })
    if (!org) fail('Choose the client organisation.')
    const job = await inTransaction(context, (tx) => createJobRecord(tx, { ...args, organizationId: org.id, siteId: args.siteId || null, requestedById: session!.itemId, uploadedById: session!.itemId, contactName: str(args.contactName, 120) || org.name, contactEmail: str(args.contactEmail, 200) || org.billingEmail, organizationName: org.name }))
    afterCommit(context)
    return { jobNumber: job.jobNumber, jobId: job.id }
  }
  const { organizationId, user } = await requireClient(context)
  const org = await context.prisma.clientOrganization.findUnique({ where: { id: organizationId } })
  let siteId: string | null = null
  if (args.siteId) {
    const site = await context.prisma.clientSite.findUnique({ where: { id: str(args.siteId, 60) } })
    if (!site || site.organizationId !== organizationId) fail('Site not found.')
    siteId = site.id
  }
  const job = await inTransaction(context, (tx) => createJobRecord(tx, { ...args, contactName: str(args.contactName, 120) || user.name, contactEmail: str(args.contactEmail, 200) || user.email, organizationId, siteId, requestedById: user.id, uploadedById: user.id, organizationName: org.name }))
  afterCommit(context)
  return { jobNumber: job.jobNumber, jobId: job.id }
}

async function lockJob(tx: Tx, id: string) {
  await lockRow(tx, 'Job', id) || fail('Job not found.')
  return tx.job.findUnique({ where: { id } })
}

/** K1: build the quote and send it. */
export async function quoteJob(context: Ctx, args: { jobId: string; pricingModel: string; revenueShareBps?: number | null; buyoutAmountMinor?: number | null; lines: Array<{ description: string; quantity: number; unitPriceMinor: number; kind?: string }>; send?: boolean }) {
  const model = ['fee_for_service', 'revenue_share', 'buyout'].includes(args.pricingModel) ? args.pricingModel : fail('Choose a pricing model.')
  const settings = await getSettings(context.prisma)
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const next = jobTransition('quote', job.status)
    await tx.jobServiceLine.deleteMany({ where: { jobId: job.id } })
    for (const l of (args.lines ?? []).slice(0, 50)) {
      const quantity = Math.max(0, Number(l.quantity) || 0)
      const unit = Math.round(Number(l.unitPriceMinor) || 0)
      if (!str(l.description, 200)) fail('Every quote line needs a description.')
      await tx.jobServiceLine.create({ data: { jobId: job.id, description: str(l.description, 200), quantity, unitPriceMinor: unit, totalMinor: Math.round(quantity * unit), kind: ['pickup', 'audit', 'wipe', 'shred', 'recycling_fee', 'other'].includes(String(l.kind)) ? l.kind : 'other' } })
    }
    const share = model === 'revenue_share' ? Math.max(0, Math.min(10_000, Math.round(args.revenueShareBps ?? settings.defaultClientRevenueShareBps))) : null
    const buyout = model === 'buyout' ? Math.max(0, Math.round(args.buyoutAmountMinor ?? 0)) : null
    const send = args.send ?? true
    const updated = await tx.job.update({ where: { id: job.id }, data: { pricingModel: model, revenueShareBps: share, buyoutAmountMinor: buyout, ...(send ? { status: next, quoteSentAt: new Date() } : {}) } })
    if (send) {
      await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'job_quoted', title: `Your quote for ${job.jobNumber}`, body: 'Your quote is ready. Read it and accept it on your job page to book the collection.', link: `/client/jobs/${job.jobNumber}` })
      await audit(tx, { actorId: context.session!.itemId, action: 'job.quoted', entityType: 'Job', entityId: job.id, before: { status: job.status }, after: { status: next, pricingModel: model } })
    }
    return updated
  })
  afterCommit(context)
  return result
}

async function clientJob(context: Ctx, jobNumber: string, admin = false) {
  const { organizationId, user } = await requireClient(context, { admin })
  const job = await context.prisma.job.findUnique({ where: { jobNumber: str(jobNumber, 40) } })
  if (!job || job.organizationId !== organizationId) fail('Job not found.')
  return { job, user }
}

/** C3: accept by typed name; the service terms version is recorded. */
export async function acceptJobQuote(context: Ctx, args: { jobNumber: string; signatureName: string; termsVersion: string }) {
  const { job, user } = await clientJob(context, args.jobNumber, true)
  const name = str(args.signatureName, 120)
  if (name.length < 2) fail('Type your full name to sign.')
  const settings = await getSettings(context.prisma)
  if (str(args.termsVersion, 40) !== settings.serviceTermsVersion) fail('The service terms changed. Reload and read the current version.')
  const result = await inTransaction(context, async (tx) => {
    const current = await lockJob(tx, job.id)
    const next = jobTransition('accept', current.status)
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, quoteAcceptedAt: new Date(), quoteAcceptedById: user.id, quoteSignatureName: name, quoteTermsVersion: settings.serviceTermsVersion } })
    await tx.clientOrganization.updateMany({ where: { id: job.organizationId, status: 'prospect' }, data: { status: 'active' } })
    await notify(tx, { userIds: await staffWith(tx, 'canDispatch'), type: 'job_accepted', title: `${job.jobNumber} accepted`, body: `${name} accepted the quote. Schedule the collection.`, link: '/dashboard/platform/dispatch' })
    await audit(tx, { actorId: user.id, action: 'job.accepted', entityType: 'Job', entityId: job.id, before: { status: current.status }, after: { status: next, signatureName: name, termsVersion: settings.serviceTermsVersion } })
    return updated
  })
  afterCommit(context)
  return result
}

export async function declineJobQuote(context: Ctx, args: { jobNumber: string; reason?: string }) {
  const { job, user } = await clientJob(context, args.jobNumber, true)
  const result = await inTransaction(context, async (tx) => {
    const current = await lockJob(tx, job.id)
    const next = jobTransition('decline', current.status)
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, declineReason: str(args.reason, 1000) } })
    await notify(tx, { userIds: await staffWith(tx, 'canManageJobs'), type: 'job_declined', title: `${job.jobNumber} quote declined`, body: str(args.reason, 1000) || 'No reason given.', link: `/dashboard/platform/jobs/${job.id}` })
    await audit(tx, { actorId: user.id, action: 'job.declined', entityType: 'Job', entityId: job.id, reason: str(args.reason, 1000) })
    return updated
  })
  afterCommit(context)
  return result
}

/** Staff records acceptance given by phone or email (the client confirmed in writing). */
export async function recordJobAcceptance(context: Ctx, args: { jobId: string; signatureName: string; note: string }) {
  const name = str(args.signatureName, 120) || fail('Enter who accepted.')
  const note = str(args.note, 500) || fail('Write how the acceptance reached you.')
  const settings = await getSettings(context.prisma)
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const next = jobTransition('accept', job.status)
    await audit(tx, { actorId: context.session!.itemId, action: 'job.accepted_by_staff', entityType: 'Job', entityId: job.id, after: { signatureName: name }, reason: note })
    return tx.job.update({ where: { id: job.id }, data: { status: next, quoteAcceptedAt: new Date(), quoteSignatureName: `${name} (recorded by staff)`, quoteTermsVersion: settings.serviceTermsVersion } })
  })
}

/** K4: date, window, driver, vehicle. */
export async function scheduleJob(context: Ctx, args: { jobId: string; date: string; windowStart: string; windowEnd: string; driverId?: string | null; vehicle?: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(args.date, 10))) fail('Choose the date.')
  if (!/^\d{2}:\d{2}$/.test(str(args.windowStart, 5)) || !/^\d{2}:\d{2}$/.test(str(args.windowEnd, 5)) || args.windowEnd <= args.windowStart) fail('Choose a time window.')
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const next = jobTransition('schedule', job.status)
    if (job.type === 'pickup') {
      if (!args.driverId) fail('Choose the driver.')
      const driver = await tx.user.findUnique({ where: { id: args.driverId }, include: { role: true } })
      if (!driver?.isActive || !driver.role?.canCollect) fail('That person cannot drive collections.')
    }
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, scheduledDate: new Date(`${args.date}T12:00:00Z`), windowStart: args.windowStart, windowEnd: args.windowEnd, driverId: args.driverId || null, vehicle: str(args.vehicle, 120) } })
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'job_scheduled', title: `${job.jobNumber} is booked for ${args.date}`, body: `We will ${job.type === 'pickup' ? 'arrive' : 'expect you'} between ${args.windowStart} and ${args.windowEnd} on ${args.date}.`, link: `/client/jobs/${job.jobNumber}` })
    if (args.driverId) await notify(tx, { userIds: [args.driverId], type: 'stop_assigned', title: `New stop: ${job.jobNumber} on ${args.date}`, body: `${args.windowStart}-${args.windowEnd}`, link: '/dashboard/platform/driver' })
    await audit(tx, { actorId: context.session!.itemId, action: 'job.scheduled', entityType: 'Job', entityId: job.id, before: { status: job.status }, after: { status: next, date: args.date, driverId: args.driverId } })
    return updated
  })
  afterCommit(context)
  return result
}

function assertDriver(context: Ctx, job: any) {
  const role = context.session?.data?.role
  // A drop-off is handed over at the dock: receiving records it like a collection.
  if (!role?.canCollect && !role?.canDispatch && !(role?.canReceive && job.type === 'drop_off')) fail('Only the driver or dispatch can record a collection.')
  if (job.driverId && job.driverId !== context.session!.itemId && !role?.canDispatch) fail('This stop is assigned to another driver.')
}

export async function startJobRoute(context: Ctx, args: { jobId: string }) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    assertDriver(context, job)
    const next = jobTransition('depart', job.status)
    await audit(tx, { actorId: context.session!.itemId, action: 'job.en_route', entityType: 'Job', entityId: job.id })
    return tx.job.update({ where: { id: job.id }, data: { status: next } })
  })
}

/** K5: containers with seals, photos, client signature. */
export async function collectJob(context: Ctx, args: { jobId: string; containers: Array<{ label: string; type?: string; sealNumber?: string; itemCountDeclared?: number | null; grossWeight?: number | null }>; signerName: string; signature?: FileInput | null; photos?: FileInput[]; notes?: string }) {
  const signer = str(args.signerName, 120) || fail("Enter the client signer's name.")
  if (!args.containers?.length) fail('Add at least one container.')
  if (!args.signature?.base64) fail('Ask the client to sign.')
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    assertDriver(context, job)
    const next = jobTransition('collect', job.status)
    const now = await dbNow(tx)
    const sig = await storeUpload(tx, args.signature, { purpose: 'client_signature', ownerClientOrganizationId: job.organizationId, uploadedById: context.session!.itemId })
    const labels = new Set<string>()
    for (const c of args.containers.slice(0, 200)) {
      const label = str(c.label, 60) || fail('Every container needs a label.')
      if (labels.has(label)) fail(`Container ${label} appears twice.`)
      labels.add(label)
      const container = await tx.container.create({ data: { jobId: job.id, label, type: ['pallet', 'gaylord', 'box', 'cage', 'tote'].includes(String(c.type)) ? c.type : 'pallet', sealNumber: str(c.sealNumber, 60), itemCountDeclared: c.itemCountDeclared != null ? Math.max(0, Math.round(c.itemCountDeclared)) : null, grossWeight: c.grossWeight != null ? Math.max(0, Number(c.grossWeight)) : null, status: 'collected' } })
      await tx.custodyEvent.create({ data: { jobId: job.id, containerId: container.id, type: 'collected', actorId: context.session!.itemId, occurredAt: now, signerName: signer, signatureId: sig?.id ?? null, locationText: job.siteAddress ? [job.siteAddress.addressLine1, job.siteAddress.city].filter(Boolean).join(', ') : '', notes: c.sealNumber ? `Seal ${c.sealNumber}` : '' } })
    }
    for (const photo of (args.photos ?? []).slice(0, 12)) {
      const stored = await storeUpload(tx, photo, { purpose: 'job_photo', ownerClientOrganizationId: job.organizationId, uploadedById: context.session!.itemId })
      if (stored) await tx.jobPhoto.create({ data: { jobId: job.id, imageId: stored.id, stage: 'collection', caption: '' } })
    }
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, collectedAt: now, clientSignerName: signer, clientSignatureId: sig?.id ?? null } })
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'job_collected', title: `${job.jobNumber} collected`, body: `${labels.size} container${labels.size === 1 ? '' : 's'} collected and signed for by ${signer}. Follow the chain of custody on your job page.`, link: `/client/jobs/${job.jobNumber}` })
    await notify(tx, { userIds: await staffWith(tx, 'canReceive'), type: 'containers_inbound', title: `${labels.size} container${labels.size === 1 ? '' : 's'} inbound on ${job.jobNumber}`, body: 'Scan, check seals and weigh on arrival.', link: '/dashboard/platform/receiving' })
    await audit(tx, { actorId: context.session!.itemId, action: 'job.collected', entityType: 'Job', entityId: job.id, after: { containers: labels.size, signer } })
    return updated
  })
  afterCommit(context)
  return result
}

/** K6: scan, check seal, weigh. A seal mismatch opens an exception. */
export async function receiveContainer(context: Ctx, args: { containerId?: string | null; jobId?: string | null; label?: string | null; receivedSealNumber?: string; grossWeight: number; tareWeight?: number | null; locationCode?: string; unexpected?: boolean; notes?: string }) {
  const gross = Number(args.grossWeight)
  if (!Number.isFinite(gross) || gross <= 0) fail('Enter the gross weight.')
  const result = await inTransaction(context, async (tx) => {
    let container = args.containerId ? await tx.container.findUnique({ where: { id: args.containerId } }) : null
    if (!container && args.jobId && args.label) container = await tx.container.findFirst({ where: { jobId: args.jobId, label: str(args.label, 60) } })
    let job
    if (!container) {
      if (!args.unexpected || !args.jobId) fail('Container not found. Record it as unexpected on its job.')
      job = await lockJob(tx, args.jobId)
      container = await tx.container.create({ data: { jobId: job.id, label: str(args.label, 60) || 'Unlabelled', status: 'unexpected', sealException: 'Container arrived that was not on the collection record.' } })
    } else {
      job = await lockJob(tx, container.jobId)
    }
    await lockRow(tx, 'Container', container.id)
    if (container.status === 'received' || container.status === 'processed') fail(`${container.label} was already received.`)
    if (!['collected', 'received'].includes(job.status)) fail(`${job.jobNumber} is ${job.status.replace(/_/g, ' ')}; it cannot receive containers.`)
    const seal = str(args.receivedSealNumber, 60)
    const sealOk = !container.sealNumber || seal === container.sealNumber
    const exception = !sealOk ? `Seal ${seal || '(none)'} does not match ${container.sealNumber}.` : container.sealException
    const now = await dbNow(tx)
    const facility = job.facilityId
    const tare = args.tareWeight != null ? Math.max(0, Number(args.tareWeight)) : null
    const updated = await tx.container.update({ where: { id: container.id }, data: { status: exception ? (container.status === 'unexpected' ? 'unexpected' : 'collected') : 'received', receivedSealNumber: seal, sealVerified: sealOk && Boolean(container.sealNumber), sealException: exception || '', grossWeight: gross, tareWeight: tare, locationCode: str(args.locationCode, 40) } })
    await tx.custodyEvent.create({ data: { jobId: job.id, containerId: container.id, type: exception ? 'seal_exception' : container.sealNumber ? 'seal_verified' : 'received', actorId: context.session!.itemId, occurredAt: now, facilityId: facility, notes: [exception, `Gross ${gross}${tare != null ? `, tare ${tare}` : ''}`, str(args.notes, 300)].filter(Boolean).join('. ') } })
    if (exception) await notify(tx, { userIds: await staffWith(tx, 'canIssueCertificates'), type: 'seal_exception', title: `Seal exception on ${job.jobNumber}`, body: `${container.label}: ${exception}`, link: '/dashboard/platform/receiving' })
    await advanceJobReceipt(tx, job.id, context.session!.itemId)
    await audit(tx, { actorId: context.session!.itemId, action: exception ? 'container.exception' : 'container.received', entityType: 'Container', entityId: container.id, after: { grossWeight: gross, seal, exception } })
    return updated
  })
  afterCommit(context)
  return result
}

/** The job moves to received once every container is received or has a resolved exception. */
async function advanceJobReceipt(tx: Tx, jobId: string, actorId: string) {
  const job = await tx.job.findUnique({ where: { id: jobId }, include: { containers: true } })
  if (job.status !== 'collected') return
  const open = job.containers.filter((c: any) => !(c.status === 'received' || c.status === 'processed' || (c.sealException && c.sealExceptionResolution) || c.status === 'missing'))
  if (open.length) return
  await tx.job.update({ where: { id: jobId }, data: { status: 'received', receivedAt: new Date() } })
  await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'job_received', title: `${job.jobNumber} arrived at our facility`, body: 'Every container is checked in. Processing starts next.', link: `/client/jobs/${job.jobNumber}` })
  await audit(tx, { actorId, action: 'job.received', entityType: 'Job', entityId: jobId })
}

/** K7: resolve a seal exception, or mark a container missing. */
export async function resolveSealException(context: Ctx, args: { containerId: string; resolution: string; markMissing?: boolean }) {
  const resolution = str(args.resolution, 1000) || fail('Write how the exception was resolved.')
  const result = await inTransaction(context, async (tx) => {
    const container = await tx.container.findUnique({ where: { id: args.containerId } })
    if (!container) fail('Container not found.')
    await lockJob(tx, container.jobId)
    await lockRow(tx, 'Container', container.id)
    if (!container.sealException && !args.markMissing) fail('This container has no open exception.')
    const status = args.markMissing ? 'missing' : container.grossWeight ? 'received' : container.status
    const updated = await tx.container.update({ where: { id: container.id }, data: { sealExceptionResolution: resolution, status, sealException: container.sealException || (args.markMissing ? 'Container did not arrive.' : '') } })
    await tx.custodyEvent.create({ data: { jobId: container.jobId, containerId: container.id, type: args.markMissing ? 'seal_exception' : 'received', actorId: context.session!.itemId, occurredAt: new Date(), notes: `Exception resolved: ${resolution}` } })
    await advanceJobReceipt(tx, container.jobId, context.session!.itemId)
    await audit(tx, { actorId: context.session!.itemId, action: 'container.exception_resolved', entityType: 'Container', entityId: container.id, reason: resolution })
    return updated
  })
  afterCommit(context)
  return result
}

/** K3: cancel before collection. */
export async function cancelJob(context: Ctx, args: { jobId: string; reason: string }) {
  const reason = str(args.reason, 1000) || fail('Write why the job is cancelled.')
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const next = jobTransition('cancel', job.status)
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, cancelReason: reason } })
    await tx.dockAppointment.updateMany({ where: { jobId: job.id, status: 'booked' }, data: { status: 'cancelled' } })
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'job_cancelled', title: `${job.jobNumber} was cancelled`, body: reason, link: `/client/jobs/${job.jobNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'job.cancelled', entityType: 'Job', entityId: job.id, before: { status: job.status }, reason })
    return updated
  })
  afterCommit(context)
  return result
}

/** K3: hold and release (after collection only). */
export async function setJobHold(context: Ctx, args: { jobId: string; hold: boolean; reason?: string }) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    if (args.hold) {
      if (!AFTER_COLLECTION.includes(job.status)) fail('Only a job that has been collected can be put on hold; cancel it instead.')
      const reason = str(args.reason, 500) || fail('Write the reason for the hold.')
      await audit(tx, { actorId: context.session!.itemId, action: 'job.hold', entityType: 'Job', entityId: job.id, reason })
      return tx.job.update({ where: { id: job.id }, data: { status: 'on_hold', holdFromStatus: job.status } })
    }
    if (job.status !== 'on_hold') fail('This job is not on hold.')
    await audit(tx, { actorId: context.session!.itemId, action: 'job.hold_released', entityType: 'Job', entityId: job.id })
    return tx.job.update({ where: { id: job.id }, data: { status: job.holdFromStatus || 'received', holdFromStatus: '' } })
  })
}

export async function startProcessing(context: Ctx, args: { jobId: string }) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const next = jobTransition('start', job.status)
    await audit(tx, { actorId: context.session!.itemId, action: 'job.processing', entityType: 'Job', entityId: job.id })
    return tx.job.update({ where: { id: job.id }, data: { status: next } })
  })
}

/** Y1: complete when every data-bearing asset is passed or destroyed and certificates are issued. */
export async function completeJob(context: Ctx, args: { jobId: string }) {
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const assets = await tx.asset.findMany({ where: { jobId: job.id }, select: { assetNumber: true, isDataBearing: true, sanitizationStatus: true, status: true } })
    const problem = jobCompletionProblem(assets)
    if (problem) fail(problem)
    const certs = await tx.certificate.findMany({ where: { jobId: job.id, status: 'issued' }, select: { type: true } })
    if (assets.some((a: any) => a.isDataBearing) && !certs.some((c: any) => c.type === 'data_destruction')) fail('Issue the data destruction certificate first.')
    if (!certs.some((c: any) => c.type === 'recycling')) fail('Issue the recycling certificate first.')
    const next = jobTransition('complete', job.status)
    const updated = await tx.job.update({ where: { id: job.id }, data: { status: next, completedAt: new Date() } })
    await tx.container.updateMany({ where: { jobId: job.id, status: 'received' }, data: { status: 'processed' } })
    await notify(tx, { userIds: await organizationUsers(tx, job.organizationId), type: 'job_completed', title: `${job.jobNumber} is complete`, body: 'Processing is finished. Your certificates are ready to download.', link: `/client/jobs/${job.jobNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'job.completed', entityType: 'Job', entityId: job.id, before: { status: job.status }, after: { status: next } })
    return updated
  })
  afterCommit(context)
  return result
}

export async function closeJob(context: Ctx, args: { jobId: string }) {
  return inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    const next = jobTransition('close', job.status)
    const unpaid = await tx.invoice.count({ where: { jobId: job.id, status: { in: ['open', 'partially_paid'] } } })
    if (unpaid) fail('This job has an unpaid invoice.')
    if (job.settlementId) {
      const s = await tx.settlement.findUnique({ where: { id: job.settlementId } })
      if (!['paid', 'closed'].includes(s.status)) fail('Record the settlement payout first.')
      await tx.settlement.update({ where: { id: s.id }, data: { status: 'closed' } })
    }
    await audit(tx, { actorId: context.session!.itemId, action: 'job.closed', entityType: 'Job', entityId: job.id })
    return tx.job.update({ where: { id: job.id }, data: { status: next } })
  })
}

/** Raise the service invoice for a fee-for-service job from its quote lines. */
export async function invoiceJob(context: Ctx, args: { jobId: string }) {
  const result = await inTransaction(context, async (tx) => {
    const job = await lockJob(tx, args.jobId)
    if (!['accepted', 'scheduled', 'en_route', 'collected', 'received', 'processing', 'completed', 'settled'].includes(job.status)) fail('Invoice a job once the quote is accepted.')
    const existing = await tx.invoice.findFirst({ where: { jobId: job.id, kind: 'service', status: { not: 'void' } } })
    if (existing) fail(`This job already has invoice ${existing.invoiceNumber}.`)
    const lines = await tx.jobServiceLine.findMany({ where: { jobId: job.id } })
    const billable = lines.filter((l: any) => (l.totalMinor ?? 0) > 0)
    if (!billable.length) fail('The quote has no charges to invoice.')
    const org = await tx.clientOrganization.findUnique({ where: { id: job.organizationId } })
    const settings = await getSettings(tx)
    const taxable = billable.reduce((s: number, l: any) => s + l.totalMinor, 0)
    const tax = Math.round((taxable * settings.salesTaxBps) / 10_000)
    const invoiceLines = billable.map((l: any) => ({ kind: 'service', description: l.description, quantity: Number(l.quantity), unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor }))
    if (tax > 0) invoiceLines.push({ kind: 'tax', description: `Sales tax (${settings.salesTaxBps / 100}%)`, quantity: 1, unitPriceMinor: tax, totalMinor: tax })
    const invoice = await createInvoice(tx, { kind: 'service', clientOrganizationId: org.id, jobId: job.id, lines: invoiceLines, billTo: { legalName: org.legalName || org.name, addressLine1: org.addressLine1, city: org.city, region: org.region, postalCode: org.postalCode, countryCode: org.countryCode, email: org.billingEmail } })
    await notify(tx, { userIds: await organizationUsers(tx, org.id), type: 'invoice_issued', title: `Invoice ${invoice.invoiceNumber} for ${job.jobNumber}`, body: `Your invoice is ready. Pay by card or bank transfer.`, link: `/client/invoices/${invoice.invoiceNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'job.invoiced', entityType: 'Job', entityId: job.id, after: { invoiceNumber: invoice.invoiceNumber } })
    return invoice
  })
  afterCommit(context)
  return result
}
