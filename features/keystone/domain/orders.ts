import { audit, dbNow, fail, inTransaction, lockRow, nextNumber, requireBuyer, str, type Ctx, type Tx } from '../lib/core'
import { restockingFee, strikeOutcome, formatMinor } from '../lib/rules/money'
import { addBusinessDays } from '../lib/rules/time'
import { afterCommit, companyUsers, getSettings, notify, staffWith, storeUpload, type FileInput } from '../lib/services'
import { suspendCompany } from './buyers'
import { maybeCompleteLot } from './lots'
import { createInvoice, refundPayment } from './money'

// Sell-side orders, dock, claims (§3.4).

export async function orderForBuyer(context: Ctx, orderNumber: string) {
  const { companyId, user } = await requireBuyer(context)
  const order = await context.prisma.order.findUnique({ where: { orderNumber: str(orderNumber, 40) } })
  if (!order || order.companyId !== companyId) fail('Order not found.')
  return { order, user, companyId }
}

const COUNTRY = /^[A-Z]{2}$/

/** U13: how the goods leave, and where they go. */
export async function setOrderRelease(context: Ctx, args: { orderNumber: string; method: string; preferredDate?: string | null; driverName?: string; carrierName?: string; carrierReference?: string; destinationCountry: string; exportAcknowledged?: boolean }) {
  const { order, user } = await orderForBuyer(context, args.orderNumber)
  const method = args.method === 'freight' ? 'freight' : args.method === 'pickup' ? 'pickup' : fail('Choose own pickup or freight.')
  const destination = str(args.destinationCountry, 2).toUpperCase()
  if (!COUNTRY.test(destination)) fail('Choose the destination country.')
  const date = args.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(args.preferredDate) ? new Date(`${args.preferredDate}T12:00:00Z`) : null
  if (method === 'pickup' && !str(args.driverName, 120)) fail('Enter the name of the driver who will collect.')
  if (method === 'freight' && !str(args.carrierName, 120)) fail('Enter the carrier.')
  const settings = await getSettings(context.prisma)
  const lot = await context.prisma.lot.findUnique({ where: { id: order.lotId }, select: { exportAllowed: true } })
  const home = (await context.prisma.facility.findFirst({ where: { isActive: true }, select: { countryCode: true } }))?.countryCode || 'US'
  const exporting = destination !== home
  if (exporting && !lot?.exportAllowed) fail('This lot may not be exported. Choose a domestic destination.')
  if (exporting && !args.exportAcknowledged) fail('Confirm you have read the export clause.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', order.id)
    const current = await tx.order.findUnique({ where: { id: order.id } })
    if (!['awaiting_payment', 'paid', 'ready_for_release'].includes(current.status)) fail('This order can no longer be changed.')
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        releaseMethod: method,
        preferredPickupDate: method === 'pickup' ? date : null,
        freightPickupDate: method === 'freight' ? date : null,
        driverName: method === 'pickup' ? str(args.driverName, 120) : '',
        carrierName: method === 'freight' ? str(args.carrierName, 120) : '',
        carrierReference: method === 'freight' ? str(args.carrierReference, 120) : '',
        destinationCountry: destination,
        exportAcknowledgedAt: exporting ? new Date() : null,
        releaseDetailsSetAt: new Date(),
      },
    })
    await notify(tx, { userIds: await staffWith(tx, 'canDispatch'), type: 'release_details', title: `${current.orderNumber}: ${method === 'pickup' ? 'pickup' : 'freight'} details set`, body: `${method === 'pickup' ? `Driver ${str(args.driverName, 120)}` : `Carrier ${str(args.carrierName, 120)}`}${date ? `, preferred ${args.preferredDate}` : ''}. Destination ${destination}. ${settings.exportClause && exporting ? 'Export acknowledged.' : ''}`.trim(), link: `/dashboard/platform/orders/${order.id}` })
    await audit(tx, { actorId: user.id, action: 'order.release_details', entityType: 'Order', entityId: order.id, after: { method, destination } })
    return updated
  })
  afterCommit(context)
  return result
}

/** S16: confirm pallets and weight, mark ready for release. */
export async function markOrderReady(context: Ctx, args: { orderId: string; palletCount?: number | null; weight?: number | null; dimensions?: string }) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', args.orderId) || fail('Order not found.')
    const order = await tx.order.findUnique({ where: { id: args.orderId } })
    if (order.status !== 'paid') fail(order.status === 'awaiting_payment' ? 'The order is not paid yet.' : `This order is ${order.status.replace(/_/g, ' ')}.`)
    const settings = await getSettings(tx)
    const now = await dbNow(tx)
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'ready_for_release',
        readyAt: now,
        removalDueAt: addBusinessDays(now, settings.removalBusinessDays, settings.timezone),
        palletCount: args.palletCount != null ? Math.max(0, Math.round(args.palletCount)) : order.palletCount,
        weight: args.weight != null ? Math.max(0, Number(args.weight)) : order.weight,
        dimensions: args.dimensions != null ? str(args.dimensions, 200) : order.dimensions,
      },
    })
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'order_ready', title: `${order.orderNumber} is ready for collection`, body: `Your goods are ready. Please collect within ${settings.removalBusinessDays} business days; storage is charged after that. The pickup address is on the order page.`, link: `/buyer/orders/${order.orderNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'order.ready', entityType: 'Order', entityId: order.id, before: { status: 'paid' }, after: { status: 'ready_for_release' } })
    return updated
  })
  afterCommit(context)
  return result
}

/** S18: hand over with driver name, bill of lading and signature. */
export async function releaseOrder(context: Ctx, args: { orderId: string; driverName: string; billOfLading?: string; signature?: FileInput | null }) {
  const driverName = str(args.driverName, 120) || fail('Enter the driver name.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', args.orderId) || fail('Order not found.')
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { lines: true } })
    if (order.status !== 'ready_for_release') fail('Mark the order ready before releasing it.')
    const settings = await getSettings(tx)
    const now = await dbNow(tx)
    const sig = await storeUpload(tx, args.signature, { purpose: 'driver_signature', ownerBuyerCompanyId: order.companyId, uploadedById: context.session!.itemId })
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'released', releasedAt: now, releasedById: context.session!.itemId, driverName, billOfLading: str(args.billOfLading, 120), driverSignatureId: sig?.id ?? null, claimWindowEndsAt: addBusinessDays(now, settings.claimWindowBusinessDays, settings.timezone) } })
    const lineIds = order.lines.map((l: any) => l.sourceLotLineId).filter(Boolean)
    const assets = await tx.asset.findMany({ where: { lotLineId: { in: lineIds }, status: 'sold' }, select: { id: true } })
    await tx.asset.updateMany({ where: { id: { in: assets.map((a: any) => a.id) } }, data: { status: 'released' } })
    for (const a of assets) await tx.custodyEvent.create({ data: { assetId: a.id, type: 'released_to_buyer', actorId: context.session!.itemId, occurredAt: now, signerName: driverName, signatureId: sig?.id ?? null, notes: `Order ${order.orderNumber}${args.billOfLading ? `, BOL ${args.billOfLading}` : ''}` } })
    await tx.dockAppointment.updateMany({ where: { orderId: order.id, status: { in: ['booked', 'arrived'] } }, data: { status: 'done' } })
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'order_released', title: `${order.orderNumber} has left our dock`, body: `Released to ${driverName}. Report any shortage or damage within ${settings.claimWindowBusinessDays} business days by email.`, link: `/buyer/orders/${order.orderNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'order.released', entityType: 'Order', entityId: order.id, after: { driverName, assets: assets.length } })
    return updated
  })
  afterCommit(context)
  return result
}

/** S20: default an unpaid order past due plus grace. */
export async function defaultOrder(context: Ctx, args: { orderId: string; reason?: string; waiveFee?: boolean }) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', args.orderId) || fail('Order not found.')
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { invoice: true, award: true } })
    if (order.status !== 'awaiting_payment') fail('Only an unpaid order can be defaulted.')
    const settings = await getSettings(tx)
    const now = await dbNow(tx)
    const graceEnds = addBusinessDays(new Date(order.paymentDueAt), settings.paymentGraceBusinessDays, settings.timezone)
    if (graceEnds > now) fail(`The grace period runs until ${graceEnds.toDateString()}.`)
    const invoice = order.invoice
    if (invoice) {
      await lockRow(tx, 'Invoice', invoice.id)
      if ((invoice.paidMinor ?? 0) > 0) fail('This invoice has a part payment. Refund it or cancel the order instead.')
      await tx.paymentSession.updateMany({ where: { invoiceId: invoice.id, status: { in: ['pending', 'requires_action'] } }, data: { status: 'canceled', openKey: null } })
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'void', voidReason: 'Order defaulted', isOverdue: false } })
    }
    let restockingNumber: string | null = null
    if (!args.waiveFee) {
      const fee = restockingFee(order.award?.amountMinor ?? invoice?.subtotalMinor ?? 0, settings.restockingFeeBps)
      if (fee > 0) {
        const company = await tx.buyerCompany.findUnique({ where: { id: order.companyId } })
        const restocking = await createInvoice(tx, { kind: 'restocking', buyerCompanyId: order.companyId, lines: [{ kind: 'service', description: `Restocking fee (${settings.restockingFeeBps / 100}%) on ${order.orderNumber}`, quantity: 1, unitPriceMinor: fee, totalMinor: fee }], billTo: { legalName: company.legalName, countryCode: company.countryCode } })
        await tx.order.update({ where: { id: order.id }, data: { restockingInvoiceId: restocking.id } })
        restockingNumber = restocking.invoiceNumber
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { status: 'defaulted', cancelReason: str(args.reason, 500) || 'Not paid' } })
    if (order.award) await tx.award.update({ where: { id: order.award.id }, data: { status: 'defaulted', activeLotKey: null } })
    const awardLines = order.award ? await tx.awardLine.findMany({ where: { awardId: order.award.id } }) : []
    await tx.awardLine.updateMany({ where: { awardId: order.award?.id ?? '' }, data: { activeLotLineKey: null } })
    if (order.award?.bidId) await tx.bid.update({ where: { id: order.award.bidId }, data: { status: 'defaulted' } })
    const lineIds = awardLines.map((l: any) => l.lotLineId)
    await tx.asset.updateMany({ where: { lotLineId: { in: lineIds }, status: 'sold' }, data: { status: 'allocated' } })
    const company = await tx.buyerCompany.findUnique({ where: { id: order.companyId } })
    const strikes = strikeOutcome(company.strikes ?? 0, settings.strikesBeforeSuspension)
    await tx.buyerCompany.update({ where: { id: company.id }, data: { strikes: strikes.strikes } })
    if (strikes.suspend && company.status === 'approved') await suspendCompany(tx, company.id, `${strikes.strikes} unpaid orders`, context.session!.itemId)
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'order_defaulted', title: `${order.orderNumber} was cancelled for non-payment`, body: `Invoice ${invoice?.invoiceNumber ?? ''} was not paid. ${restockingNumber ? `A restocking invoice ${restockingNumber} has been issued.` : ''} This is strike ${strikes.strikes} of ${settings.strikesBeforeSuspension}.`, link: '/buyer' })
    await audit(tx, { actorId: context.session!.itemId, action: 'order.defaulted', entityType: 'Order', entityId: order.id, after: { restockingInvoice: restockingNumber, strikes: strikes.strikes, suspended: strikes.suspend }, reason: str(args.reason, 500) })
    // Leave the lot awarded until staff re-awards or declines; if nothing else is live, it shows as ready to re-award.
    const live = await tx.award.count({ where: { lotId: order.lotId, status: 'active' } })
    if (!live) await tx.lot.update({ where: { id: order.lotId }, data: { status: 'unsold' } })
    return { order: await tx.order.findUnique({ where: { id: order.id } }), restockingInvoiceNumber: restockingNumber, strikes: strikes.strikes, suspended: strikes.suspend }
  })
  afterCommit(context)
  return result
}

export async function waiveRestockingFee(context: Ctx, args: { orderId: string; reason: string }) {
  const reason = str(args.reason, 500) || fail('Write why the fee is waived.')
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', args.orderId) || fail('Order not found.')
    const order = await tx.order.findUnique({ where: { id: args.orderId } })
    if (!order.restockingInvoiceId) fail('This order has no restocking invoice.')
    await lockRow(tx, 'Invoice', order.restockingInvoiceId)
    const invoice = await tx.invoice.findUnique({ where: { id: order.restockingInvoiceId } })
    if ((invoice.paidMinor ?? 0) > 0) fail('The restocking fee has been paid; refund it instead.')
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'void', waived: true, voidReason: `Waived: ${reason}`, isOverdue: false } })
    await audit(tx, { actorId: context.session!.itemId, action: 'order.restocking_waived', entityType: 'Order', entityId: order.id, reason })
    return tx.invoice.findUnique({ where: { id: invoice.id } })
  })
}

/** Staff: cancel an order (refund first if paid). */
export async function cancelOrder(context: Ctx, args: { orderId: string; reason: string }) {
  const reason = str(args.reason, 500) || fail('Write why the order is cancelled.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', args.orderId) || fail('Order not found.')
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { invoice: true, award: true } })
    if (!['awaiting_payment', 'paid', 'ready_for_release'].includes(order.status)) fail(`This order is ${order.status.replace(/_/g, ' ')}.`)
    if (order.invoice) {
      await lockRow(tx, 'Invoice', order.invoice.id)
      const inv = await tx.invoice.findUnique({ where: { id: order.invoice.id } })
      if ((inv.paidMinor ?? 0) - (inv.refundedMinor ?? 0) > 0) fail('Refund the payments on this order first (Payments page), then cancel.')
      await tx.paymentSession.updateMany({ where: { invoiceId: inv.id, status: { in: ['pending', 'requires_action'] } }, data: { status: 'canceled', openKey: null } })
      if (inv.status !== 'refunded') await tx.invoice.update({ where: { id: inv.id }, data: { status: 'void', voidReason: `Order cancelled: ${reason}`, isOverdue: false } })
    }
    await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled', cancelReason: reason } })
    if (order.award) {
      await tx.award.update({ where: { id: order.award.id }, data: { status: 'cancelled', activeLotKey: null } })
      const lines = await tx.awardLine.findMany({ where: { awardId: order.award.id } })
      await tx.awardLine.updateMany({ where: { awardId: order.award.id }, data: { activeLotLineKey: null } })
      await tx.asset.updateMany({ where: { lotLineId: { in: lines.map((l: any) => l.lotLineId) }, status: 'sold' }, data: { status: 'ready_for_sale', lotLineId: null } })
    }
    const live = await tx.award.count({ where: { lotId: order.lotId, status: 'active' } })
    if (!live) await tx.lot.update({ where: { id: order.lotId }, data: { status: 'unsold' } })
    else await maybeCompleteLot(tx, order.lotId)
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'order_cancelled', title: `${order.orderNumber} was cancelled`, body: reason, link: `/buyer/orders/${order.orderNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'order.cancelled', entityType: 'Order', entityId: order.id, reason })
    return tx.order.findUnique({ where: { id: order.id } })
  })
  afterCommit(context)
  return result
}

// ---------------------------------------------------------------- dock (S17, K8)

export async function bookDockAppointment(context: Ctx, args: { facilityId: string; startsAt: string; orderId?: string | null; jobId?: string | null; driverName?: string; vehicle?: string; notes?: string; appointmentId?: string | null }) {
  const startsAt = new Date(args.startsAt)
  if (Number.isNaN(startsAt.getTime())) fail('Choose the slot.')
  if (!args.orderId && !args.jobId) fail('Link the slot to an order or a drop-off job.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Facility', args.facilityId) || fail('Facility not found.')
    const facility = await tx.facility.findUnique({ where: { id: args.facilityId } })
    if (!facility.isActive) fail('This facility is not active.')
    const minutes = Math.max(15, facility.dockSlotMinutes || 60)
    const slotStart = new Date(Math.floor(startsAt.getTime() / (minutes * 60_000)) * minutes * 60_000)
    const endsAt = new Date(slotStart.getTime() + minutes * 60_000)
    if (slotStart.getTime() < Date.now() - minutes * 60_000) fail('That slot is in the past.')
    const taken = await tx.dockAppointment.count({ where: { facilityId: facility.id, status: { in: ['booked', 'arrived'] }, startsAt: { lt: endsAt }, endsAt: { gt: slotStart }, ...(args.appointmentId ? { id: { not: args.appointmentId } } : {}) } })
    if (taken >= Math.max(1, facility.dockSlotsPerWindow || 1)) fail('That slot is full. Choose another time.')
    if (args.orderId) {
      const order = await tx.order.findUnique({ where: { id: args.orderId } })
      if (!order) fail('Order not found.')
      if (!['paid', 'ready_for_release'].includes(order.status)) fail('Book a pickup slot once the order is paid.')
    }
    const data = { facilityId: facility.id, startsAt: slotStart, endsAt, orderId: args.orderId || null, jobId: args.jobId || null, driverName: str(args.driverName, 120), vehicle: str(args.vehicle, 120), notes: str(args.notes, 500), status: 'booked' }
    let appt
    if (args.appointmentId) {
      await lockRow(tx, 'DockAppointment', args.appointmentId) || fail('Appointment not found.')
      appt = await tx.dockAppointment.update({ where: { id: args.appointmentId }, data })
    } else {
      if (args.orderId) {
        const existing = await tx.dockAppointment.findUnique({ where: { orderId: args.orderId } })
        if (existing) {
          appt = await tx.dockAppointment.update({ where: { id: existing.id }, data })
        }
      }
      appt = appt ?? (await tx.dockAppointment.create({ data }))
    }
    if (args.orderId) {
      const order = await tx.order.findUnique({ where: { id: args.orderId } })
      await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'dock_booked', title: `Pickup booked for ${order.orderNumber}`, body: `Your pickup is booked at ${facility.name} on ${slotStart.toUTCString()}. ${facility.pickupInstructions || ''}`.trim(), link: `/buyer/orders/${order.orderNumber}` })
    }
    await audit(tx, { actorId: context.session!.itemId, action: args.appointmentId ? 'dock.moved' : 'dock.booked', entityType: 'DockAppointment', entityId: appt.id, after: { startsAt: slotStart } })
    return appt
  })
  afterCommit(context)
  return result
}

export async function setDockAppointmentStatus(context: Ctx, args: { appointmentId: string; status: string }) {
  const status = ['arrived', 'done', 'cancelled', 'no_show'].includes(args.status) ? args.status : fail('Choose arrived, done, cancelled or no-show.')
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'DockAppointment', args.appointmentId) || fail('Appointment not found.')
    const appt = await tx.dockAppointment.findUnique({ where: { id: args.appointmentId } })
    if (['done', 'cancelled'].includes(appt.status)) fail(`This appointment is already ${appt.status}.`)
    await audit(tx, { actorId: context.session!.itemId, action: `dock.${status}`, entityType: 'DockAppointment', entityId: appt.id })
    return tx.dockAppointment.update({ where: { id: appt.id }, data: { status } })
  })
}

/** Free and taken slots for a facility on a day. */
export async function dockDay(context: Ctx, args: { facilityId: string; date: string }) {
  const facility = await context.prisma.facility.findUnique({ where: { id: args.facilityId } })
  if (!facility) fail('Facility not found.')
  const day = /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : new Date().toISOString().slice(0, 10)
  const start = new Date(`${day}T00:00:00Z`)
  const end = new Date(start.getTime() + 86_400_000)
  const appointments = await context.prisma.dockAppointment.findMany({ where: { facilityId: facility.id, startsAt: { gte: start, lt: end } }, include: { order: { select: { id: true, orderNumber: true, company: { select: { legalName: true } } } }, job: { select: { id: true, jobNumber: true, organization: { select: { name: true } } } } }, orderBy: { startsAt: 'asc' } })
  return { facility: { id: facility.id, name: facility.name, slotMinutes: facility.dockSlotMinutes, perWindow: facility.dockSlotsPerWindow, hours: facility.hours }, appointments }
}

// ---------------------------------------------------------------- claims (S19)

export async function openClaim(context: Ctx, args: { orderId: string; reason: string; description: string; requestedAmountMinor?: number | null; lines?: Array<{ lineNumber: number; quantity: number; note?: string }>; photos?: FileInput[] }) {
  const reason = ['shortage', 'wrong_item', 'misgraded', 'dead_on_arrival', 'damage', 'other'].includes(args.reason) ? args.reason : fail('Choose the reason.')
  const description = str(args.description, 4000) || fail("Write what the buyer reported.")
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Order', args.orderId) || fail('Order not found.')
    const order = await tx.order.findUnique({ where: { id: args.orderId } })
    if (!['released', 'completed'].includes(order.status)) fail('Claims are for orders that have been released.')
    const settings = await getSettings(tx)
    const now = await dbNow(tx)
    const lateNote = order.claimWindowEndsAt && new Date(order.claimWindowEndsAt) < now ? ' (reported after the claim window)' : ''
    const claim = await tx.claim.create({
      data: {
        claimNumber: await nextNumber(tx, 'claim'),
        orderId: order.id,
        companyId: order.companyId,
        openedById: context.session!.itemId,
        reason,
        description: description + lateNote,
        lines: (args.lines ?? []).map((l) => ({ lineNumber: Math.round(l.lineNumber), quantity: Math.max(0, Math.round(l.quantity)), note: str(l.note, 300) })),
        requestedAmountMinor: args.requestedAmountMinor != null ? Math.max(0, Math.round(args.requestedAmountMinor)) : null,
        status: 'submitted',
      },
    })
    for (const photo of (args.photos ?? []).slice(0, 12)) {
      const stored = await storeUpload(tx, photo, { purpose: 'claim_photo', ownerBuyerCompanyId: order.companyId, uploadedById: context.session!.itemId })
      if (stored) await tx.claimPhoto.create({ data: { claimId: claim.id, imageId: stored.id, caption: '' } })
    }
    await notify(tx, { userIds: await companyUsers(tx, order.companyId), type: 'claim_opened', title: `Claim ${claim.claimNumber} recorded`, body: `We recorded your claim on ${order.orderNumber} and will reply within ${settings.claimWindowBusinessDays} business days.`, link: `/buyer/orders/${order.orderNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'claim.opened', entityType: 'Claim', entityId: claim.id, after: { orderId: order.id, reason } })
    return claim
  })
  afterCommit(context)
  return result
}

/** Review, approve with a refund, deny, resolve. Assets come back when goods are returned. */
export async function resolveClaim(context: Ctx, args: { claimId: string; action: string; resolution?: string; approvedAmountMinor?: number | null; note?: string; returnedAssetIds?: string[]; paymentId?: string | null; idempotencyKey?: string }) {
  const action = str(args.action, 20)
  const note = str(args.note, 2000)
  const claim = await context.prisma.claim.findUnique({ where: { id: str(args.claimId, 60) }, include: { order: { include: { invoice: { include: { payments: true } } } } } })
  if (!claim) fail('Claim not found.')
  if (action === 'review') {
    if (claim.status !== 'submitted') fail('This claim is already being handled.')
    return context.prisma.claim.update({ where: { id: claim.id }, data: { status: 'under_review' } })
  }
  if (action === 'deny') {
    if (!['submitted', 'under_review'].includes(claim.status)) fail('This claim is already decided.')
    if (!note) fail('Write the reason for the denial.')
    const result = await inTransaction(context, async (tx) => {
      await lockRow(tx, 'Claim', claim.id)
      const updated = await tx.claim.update({ where: { id: claim.id }, data: { status: 'denied', resolution: 'denied', resolutionNote: note, resolvedById: context.session!.itemId, resolvedAt: new Date() } })
      await notify(tx, { userIds: await companyUsers(tx, claim.companyId), type: 'claim_denied', title: `Claim ${claim.claimNumber} was not approved`, body: note, link: `/buyer/orders/${claim.order.orderNumber}` })
      await audit(tx, { actorId: context.session!.itemId, action: 'claim.denied', entityType: 'Claim', entityId: claim.id, reason: note })
      return updated
    })
    afterCommit(context)
    return result
  }
  if (action === 'approve') {
    if (!['submitted', 'under_review'].includes(claim.status)) fail('This claim is already decided.')
    const resolution = ['refund', 'partial_refund', 'return_and_refund'].includes(String(args.resolution)) ? String(args.resolution) : fail('Choose refund, partial refund, or return and refund.')
    const amount = Math.round(Number(args.approvedAmountMinor))
    if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter the approved amount.')
    const payments = (claim.order.invoice?.payments ?? []).filter((p: any) => ['captured', 'confirmed', 'partially_refunded'].includes(p.status))
    const payment = args.paymentId ? payments.find((p: any) => p.id === args.paymentId) : payments.sort((a: any, b: any) => (b.amountMinor - b.refundedMinor) - (a.amountMinor - a.refundedMinor))[0]
    if (!payment) fail('The order has no received payment to refund.')
    await context.prisma.claim.update({ where: { id: claim.id }, data: { status: 'approved', resolution, approvedAmountMinor: amount, resolutionNote: note, resolvedById: context.session!.itemId } })
    const refund = await refundPayment(context, { paymentId: payment.id, amountMinor: amount, reason: `Claim ${claim.claimNumber}: ${note || resolution}`, idempotencyKey: str(args.idempotencyKey, 200) || `claim-${claim.id}`, claimId: claim.id })
    const result = await inTransaction(context, async (tx) => {
      await lockRow(tx, 'Claim', claim.id)
      if (resolution === 'return_and_refund' && args.returnedAssetIds?.length) {
        const ids = args.returnedAssetIds.map((i) => str(i, 60))
        await tx.asset.updateMany({ where: { id: { in: ids }, status: { in: ['released', 'sold'] } }, data: { status: 'ready_for_sale', lotLineId: null } })
        for (const id of ids) await tx.custodyEvent.create({ data: { assetId: id, type: 'received', actorId: context.session!.itemId, occurredAt: new Date(), notes: `Returned on claim ${claim.claimNumber}` } })
      }
      const updated = await tx.claim.update({ where: { id: claim.id }, data: { status: 'resolved', resolvedAt: new Date() } })
      await notify(tx, { userIds: await companyUsers(tx, claim.companyId), type: 'claim_approved', title: `Claim ${claim.claimNumber} approved`, body: `We approved ${formatMinor(amount)} on your claim${refund?.status === 'succeeded' ? ' and sent the refund' : ''}.`, link: `/buyer/orders/${claim.order.orderNumber}` })
      await audit(tx, { actorId: context.session!.itemId, action: 'claim.approved', entityType: 'Claim', entityId: claim.id, after: { resolution, amountMinor: amount, refundId: refund?.id } })
      return updated
    })
    afterCommit(context)
    return result
  }
  fail('Choose review, approve or deny.')
}
