import { BULK, audit, clientIp, dbNow, fail, inTransaction, lockRow, nextNumber, requestHash, requireBuyer, str, userAgent, withCommandReceipt, type Ctx, type Tx } from '../lib/core'
import { awardOverrideProblem, bidEligibilityProblem, minimumOpenBid, perLineTotal, planPerLineAward, rankBids, softCloseExtension, type GridBid } from '../lib/rules/bidding'
import { awardInvoiceLines } from '../lib/rules/money'
import { sanitizationAllowsSale } from '../lib/rules/lifecycle'
import { addBusinessDays } from '../lib/rules/time'
import { afterCommit, companyUsers, getSettings, moneyText, notify, staffWith } from '../lib/services'
import { refreshLotHigh } from './buyers'
import { hasPermission } from '../access'
import { createInvoice } from './money'

// Lots, bids and awards (§3.2, §3.3, §3.6).

const LIVE_BID = ['active']

// ---------------------------------------------------------------- eligibility

export async function companyExposure(tx: Tx, companyId: string, excludeLotId?: string) {
  const unpaid = await tx.invoice.aggregate({ where: { buyerCompanyId: companyId, status: { in: ['open', 'partially_paid'] }, kind: 'lot_sale' }, _sum: { totalMinor: true, paidMinor: true } })
  const active = await tx.bid.aggregate({ where: { companyId, status: 'active', ...(excludeLotId ? { lotId: { not: excludeLotId } } : {}) }, _sum: { amountMinor: true } })
  const overdue = await tx.invoice.count({ where: { buyerCompanyId: companyId, isOverdue: true, status: { in: ['open', 'partially_paid'] } } })
  return { unpaidAwardsMinor: (unpaid._sum.totalMinor ?? 0) - (unpaid._sum.paidMinor ?? 0), otherActiveBidsMinor: active._sum.amountMinor ?? 0, hasOverdueInvoice: overdue > 0 }
}

/** "May this user bid?" for a given amount, read inside the bid transaction. */
async function assertMayBid(tx: Tx, input: { companyId: string; userId: string; lotId: string; amountMinor: number; skipTerms?: boolean }) {
  const settings = await getSettings(tx)
  await lockRow(tx, 'BuyerCompany', input.companyId)
  const company = await tx.buyerCompany.findUnique({ where: { id: input.companyId } })
  const user = await tx.user.findUnique({ where: { id: input.userId } })
  const exposure = await companyExposure(tx, input.companyId, input.lotId)
  const problem = bidEligibilityProblem({
    companyStatus: company.status,
    userActive: Boolean(user?.isActive),
    acceptedTermsVersion: input.skipTerms ? settings.wholesaleTermsVersion : user?.acceptedTermsVersion,
    currentTermsVersion: settings.wholesaleTermsVersion,
    spendLimitMinor: company.spendLimitMinor,
    bidAmountMinor: input.amountMinor,
    ...exposure,
  })
  if (problem) fail(problem.message)
  return { company, settings }
}

// ---------------------------------------------------------------- clock

/**
 * §3.6: opens due lots, closes due lots, runs auto-awards, expires stale bids,
 * marks invoices overdue, sends reminders. Every transition takes the row lock and
 * re-checks status, so several instances calling it at once do each thing once.
 */
export async function advanceLotClock(context: Pick<Ctx, 'prisma'>, onlyLotId?: string) {
  const prisma = context.prisma
  const [{ now }] = await prisma.$queryRawUnsafe('SELECT now() AS now')
  const scope = onlyLotId ? { id: onlyLotId } : {}
  const toOpen = await prisma.lot.findMany({ where: { ...scope, status: 'scheduled', opensAt: { lte: now } }, select: { id: true }, take: 100 })
  for (const { id } of toOpen) {
    await prisma.$transaction(async (tx: Tx) => {
      await lockRow(tx, 'Lot', id)
      const lot = await tx.lot.findUnique({ where: { id } })
      if (lot.status !== 'scheduled' || new Date(lot.opensAt) > new Date(now)) return
      await tx.lot.update({ where: { id }, data: { status: 'open' } })
      await audit(tx, { action: 'lot.opened', entityType: 'Lot', entityId: id })
    })
  }
  const toClose = await prisma.lot.findMany({ where: { ...scope, status: 'open', closesAt: { lte: now } }, select: { id: true }, take: 100 })
  for (const { id } of toClose) {
    await prisma.$transaction(async (tx: Tx) => {
      await lockRow(tx, 'Lot', id)
      const lot = await tx.lot.findUnique({ where: { id } })
      const [{ now: t }] = await tx.$queryRawUnsafe('SELECT now() AS now')
      if (lot.status !== 'open' || new Date(lot.closesAt) > new Date(t)) return
      await tx.lot.update({ where: { id }, data: { status: 'closed', closedAt: t } })
      await audit(tx, { action: 'lot.closed', entityType: 'Lot', entityId: id })
      const count = await tx.bid.count({ where: { lotId: id, status: 'active' } })
      await notify(tx, { userIds: await staffWith(tx, 'canAwardLots'), type: 'lot_closed', title: `${lot.lotNumber} closed with ${count} bid${count === 1 ? '' : 's'}`, body: `${lot.title} closed. ${count ? 'Review the bids and award.' : 'No bids; relist or cancel it.'}`, link: `/dashboard/platform/lots/${id}`, dedupeKey: `lot-closed:${id}` })
    }, { timeout: 20_000 })
    const lot = await prisma.lot.findUnique({ where: { id }, select: { awardMode: true, format: true, bidBasis: true } })
    if (lot?.awardMode === 'auto' && lot.bidBasis === 'lot_total') {
      try {
        await autoAward(context, id)
      } catch (error) {
        console.error('[clock] auto-award', id, (error as Error).message)
      }
    }
  }
  if (onlyLotId) return
  await expireStaleBids(context, new Date(now))
  await markOverdueInvoices(context, new Date(now))
  await sendLotReminders(context, new Date(now))
  await completeReleasedOrders(context, new Date(now))
}

async function expireStaleBids(context: Pick<Ctx, 'prisma'>, now: Date) {
  const settings = await getSettings(context.prisma)
  const lots = await context.prisma.lot.findMany({ where: { status: 'closed', bids: { some: { status: 'active' } } }, select: { id: true, closedAt: true, closesAt: true }, take: 100 })
  for (const lot of lots) {
    const closed = new Date(lot.closedAt ?? lot.closesAt)
    if (addBusinessDays(closed, settings.bidValidityBusinessDays, settings.timezone) > now) continue
    await context.prisma.$transaction(async (tx: Tx) => {
      await lockRow(tx, 'Lot', lot.id)
      const current = await tx.lot.findUnique({ where: { id: lot.id } })
      if (current.status !== 'closed') return
      const n = await tx.bid.updateMany({ where: { lotId: lot.id, status: 'active' }, data: { status: 'expired', activeKey: null } })
      if (n.count) await audit(tx, { action: 'lot.bids_expired', entityType: 'Lot', entityId: lot.id, after: { expired: n.count } })
    })
  }
}

async function markOverdueInvoices(context: Pick<Ctx, 'prisma'>, now: Date) {
  const settings = await getSettings(context.prisma)
  const candidates = await context.prisma.invoice.findMany({ where: { isOverdue: false, status: { in: ['open', 'partially_paid'] }, dueAt: { lt: now } }, select: { id: true, dueAt: true, invoiceNumber: true, buyerCompanyId: true, clientOrganizationId: true }, take: 200 })
  for (const inv of candidates) {
    const n = await context.prisma.invoice.updateMany({ where: { id: inv.id, isOverdue: false }, data: { isOverdue: true } })
    if (!n.count) continue
    if (inv.buyerCompanyId) {
      await context.prisma.$transaction(async (tx: Tx) => {
        await notify(tx, { userIds: await companyUsers(tx, inv.buyerCompanyId), type: 'invoice_overdue', title: `Invoice ${inv.invoiceNumber} is overdue`, body: `Invoice ${inv.invoiceNumber} is past due. Bidding is paused until it is paid. After ${settings.paymentGraceBusinessDays} more business days the order may be cancelled with a restocking fee.`, link: `/buyer/invoices/${inv.invoiceNumber}`, dedupeKey: `overdue:${inv.id}` })
        await notify(tx, { userIds: await staffWith(tx, 'canManagePayments'), type: 'invoice_overdue', title: `${inv.invoiceNumber} is overdue`, body: 'The buyer is blocked from bidding until it is paid.', link: '/dashboard/platform/invoices', dedupeKey: `overdue-staff:${inv.id}` })
      })
    }
  }
}

async function sendLotReminders(context: Pick<Ctx, 'prisma'>, now: Date) {
  const windows: Array<{ hours: number; field: 'reminder24SentAt' | 'reminder2SentAt' }> = [{ hours: 24, field: 'reminder24SentAt' }, { hours: 2, field: 'reminder2SentAt' }]
  for (const w of windows) {
    const lots = await context.prisma.lot.findMany({ where: { status: 'open', [w.field]: null, closesAt: { lte: new Date(now.getTime() + w.hours * 3_600_000), gt: now } }, select: { id: true, lotNumber: true, title: true, categoryId: true }, take: 50 })
    for (const lot of lots) {
      const claimed = await context.prisma.lot.updateMany({ where: { id: lot.id, [w.field]: null }, data: { [w.field]: now } })
      if (!claimed.count) continue
      await context.prisma.$transaction(async (tx: Tx) => {
        const bidders = await tx.bid.findMany({ where: { lotId: lot.id }, select: { companyId: true }, distinct: ['companyId'] })
        const bidderIds = new Set(bidders.map((b: any) => b.companyId))
        const interested = await tx.buyerCompany.findMany({ where: { status: 'approved', ...(lot.categoryId ? { categoriesOfInterest: { some: { id: lot.categoryId } } } : {}) }, select: { id: true } })
        const users: string[] = []
        for (const c of interested) if (!bidderIds.has(c.id)) users.push(...(await companyUsers(tx, c.id)))
        await notify(tx, { userIds: users, type: 'lot_closing', title: `${lot.lotNumber} closes in ${w.hours} hour${w.hours === 1 ? '' : 's'}`, body: `${lot.title} closes soon.`, link: `/lots/${lot.lotNumber}`, dedupeKey: `lot-reminder-${w.hours}:${lot.id}` })
      })
    }
  }
}

async function completeReleasedOrders(context: Pick<Ctx, 'prisma'>, now: Date) {
  const orders = await context.prisma.order.findMany({ where: { status: 'released', claimWindowEndsAt: { lte: now }, claims: { none: { status: { in: ['submitted', 'under_review', 'approved'] } } } }, select: { id: true, lotId: true }, take: 100 })
  for (const o of orders) {
    await context.prisma.$transaction(async (tx: Tx) => {
      await lockRow(tx, 'Order', o.id)
      const order = await tx.order.findUnique({ where: { id: o.id } })
      if (order.status !== 'released') return
      await tx.order.update({ where: { id: o.id }, data: { status: 'completed' } })
      await audit(tx, { action: 'order.completed', entityType: 'Order', entityId: o.id })
      await maybeCompleteLot(tx, o.lotId)
    })
  }
}

export async function maybeCompleteLot(tx: Tx, lotId: string) {
  await lockRow(tx, 'Lot', lotId)
  const lot = await tx.lot.findUnique({ where: { id: lotId } })
  if (lot.status !== 'awarded') return
  const open = await tx.order.count({ where: { lotId, status: { notIn: ['completed', 'cancelled', 'defaulted'] } } })
  const done = await tx.order.count({ where: { lotId, status: 'completed' } })
  if (!open && done) {
    await tx.lot.update({ where: { id: lotId }, data: { status: 'completed' } })
    await audit(tx, { action: 'lot.completed', entityType: 'Lot', entityId: lotId })
  }
}

// ---------------------------------------------------------------- publishing

export async function publishLot(context: Ctx, args: { lotId: string }) {
  const staffId = context.session!.itemId
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId }, include: { lines: { include: { assets: true } } } })
    if (lot.status !== 'draft') fail('Only a draft lot can be published.')
    if (!lot.lines.length) fail('Add at least one manifest line before publishing.')
    if (!lot.closesAt) fail('Set the close time.')
    const now = await dbNow(tx)
    const opensAt = lot.opensAt ? new Date(lot.opensAt) : now
    if (new Date(lot.closesAt) <= opensAt) fail('The close time must be after the open time.')
    if (new Date(lot.closesAt) <= now) fail('The close time has already passed.')
    if (lot.format === 'fixed_price' && !(lot.fixedPriceMinor > 0)) fail('Set the fixed price.')
    if (lot.format === 'open_auction' && !(lot.bidIncrementMinor > 0)) fail('Set the bid increment.')
    if (lot.format === 'fixed_price' && lot.bidBasis === 'per_line') fail('A fixed-price lot is sold as a whole.')
    const blocked = lot.lines.flatMap((l: any) => l.assets).filter((a: any) => !sanitizationAllowsSale(a))
    if (blocked.length) fail(`${blocked.length} allocated asset${blocked.length === 1 ? ' has' : 's have'} not passed sanitisation (${blocked.slice(0, 5).map((a: any) => a.assetNumber).join(', ')}).`)
    const status = opensAt <= now ? 'open' : 'scheduled'
    const updated = await tx.lot.update({ where: { id: lot.id }, data: { status, opensAt, publishedAt: now, originalClosesAt: lot.closesAt, extensionCount: 0, bidCount: 0, currentAmountMinor: null } })
    await audit(tx, { actorId: staffId, action: 'lot.published', entityType: 'Lot', entityId: lot.id, before: { status: 'draft' }, after: { status } })
    return updated
  })
  return result
}

export async function publishSaleEvent(context: Ctx, args: { saleEventId: string; announce?: boolean }) {
  const staffId = context.session!.itemId
  const event = await context.prisma.saleEvent.findUnique({ where: { id: args.saleEventId }, include: { lots: { select: { id: true, status: true } } } })
  if (!event) fail('Sale event not found.')
  if (event.status === 'closed') fail('This sale event is closed.')
  const drafts = event.lots.filter((l: any) => l.status === 'draft')
  if (!event.lots.length) fail('Add lots to the sale event first.')
  const problems: string[] = []
  for (const lot of drafts) {
    try {
      await publishLot(context, { lotId: lot.id })
    } catch (error) {
      problems.push(`${(error as Error).message}`)
    }
  }
  if (problems.length && problems.length === drafts.length) fail(`No lot could be published: ${problems[0]}`)
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'SaleEvent', event.id)
    const current = await tx.saleEvent.findUnique({ where: { id: event.id }, include: { lots: { where: { status: { in: ['scheduled', 'open'] } }, select: { categoryId: true } } } })
    const updated = await tx.saleEvent.update({ where: { id: event.id }, data: { status: 'published' } })
    if ((args.announce ?? true) && !current.announcementSentAt) {
      const categoryIds = [...new Set(current.lots.map((l: any) => l.categoryId).filter(Boolean))] as string[]
      const companies = await tx.buyerCompany.findMany({ where: { status: 'approved', ...(categoryIds.length ? { OR: [{ categoriesOfInterest: { some: { id: { in: categoryIds } } } }, { categoriesOfInterest: { none: {} } }] } : {}) }, select: { id: true } })
      const users: string[] = []
      for (const c of companies) users.push(...(await companyUsers(tx, c.id)))
      await notify(tx, { userIds: users, type: 'sale_announced', title: `New sale: ${event.title}`, body: `${current.lots.length} lot${current.lots.length === 1 ? '' : 's'} open for bidding. ${event.description || ''}`.trim(), link: '/lots', dedupeKey: `sale:${event.id}` })
      await tx.saleEvent.update({ where: { id: event.id }, data: { announcementSentAt: new Date() } })
    }
    await audit(tx, { actorId: staffId, action: 'sale_event.published', entityType: 'SaleEvent', entityId: event.id, after: { problems } })
    return updated
  }, BULK)
  afterCommit(context)
  return { saleEvent: result, problems }
}

async function bidderUsers(tx: Tx, lotId: string) {
  const companies = await tx.bid.findMany({ where: { lotId }, select: { companyId: true }, distinct: ['companyId'] })
  const out: string[] = []
  for (const c of companies) out.push(...(await companyUsers(tx, c.companyId)))
  return out
}

export async function postLotAddendum(context: Ctx, args: { lotId: string; body: string }) {
  const body = str(args.body, 4000) || fail('Write the addendum.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } })
    if (!['scheduled', 'open', 'closed'].includes(lot.status)) fail('Addenda are for published lots.')
    const addendum = await tx.lotAddendum.create({ data: { lotId: lot.id, body, postedById: context.session!.itemId, postedAt: new Date() } })
    await notify(tx, { userIds: await bidderUsers(tx, lot.id), type: 'lot_addendum', title: `Update to ${lot.lotNumber}`, body: `${lot.title}: ${body}`, link: `/lots/${lot.lotNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'lot.addendum', entityType: 'Lot', entityId: lot.id, after: { body } })
    return addendum
  })
  afterCommit(context)
  return result
}

export async function extendLotClose(context: Ctx, args: { lotId: string; closesAt: string; reason?: string }) {
  const closesAt = new Date(args.closesAt)
  if (Number.isNaN(closesAt.getTime())) fail('Choose the new close time.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } })
    if (!['scheduled', 'open'].includes(lot.status)) fail('Only a scheduled or open lot can be extended.')
    if (closesAt <= new Date(lot.closesAt)) fail('The close time can be extended, never shortened.')
    const updated = await tx.lot.update({ where: { id: lot.id }, data: { closesAt } })
    await tx.lotAddendum.create({ data: { lotId: lot.id, body: `Closing time extended to ${closesAt.toISOString().slice(0, 16).replace('T', ' ')} UTC.${args.reason ? ` ${str(args.reason, 500)}` : ''}`, postedById: context.session!.itemId, postedAt: new Date() } })
    await notify(tx, { userIds: await bidderUsers(tx, lot.id), type: 'lot_extended', title: `${lot.lotNumber} now closes later`, body: `${lot.title} now closes at ${closesAt.toUTCString()}.`, link: `/lots/${lot.lotNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'lot.extended', entityType: 'Lot', entityId: lot.id, before: { closesAt: lot.closesAt }, after: { closesAt }, reason: str(args.reason, 500) })
    return updated
  })
  afterCommit(context)
  return result
}

async function freeLotAssets(tx: Tx, lotId: string) {
  const lines = await tx.lotLine.findMany({ where: { lotId }, select: { id: true } })
  const ids = lines.map((l: any) => l.id)
  if (!ids.length) return 0
  const n = await tx.asset.updateMany({ where: { lotLineId: { in: ids }, status: 'allocated' }, data: { status: 'ready_for_sale', lotLineId: null } })
  return n.count
}

export async function cancelLot(context: Ctx, args: { lotId: string; reason: string }) {
  const reason = str(args.reason, 500) || fail('Write why the lot is cancelled.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } })
    if (!['draft', 'scheduled', 'open', 'closed', 'unsold'].includes(lot.status)) fail('An awarded lot cannot be cancelled; default or cancel its orders instead.')
    const users = await bidderUsers(tx, lot.id)
    await tx.bid.updateMany({ where: { lotId: lot.id, status: 'active' }, data: { status: 'void', activeKey: null } })
    const freed = await freeLotAssets(tx, lot.id)
    const updated = await tx.lot.update({ where: { id: lot.id }, data: { status: 'cancelled', cancelReason: reason } })
    await notify(tx, { userIds: users, type: 'lot_cancelled', title: `${lot.lotNumber} was cancelled`, body: `${lot.title} was withdrawn from sale: ${reason}. Your bid is void.`, link: `/lots/${lot.lotNumber}` })
    await audit(tx, { actorId: context.session!.itemId, action: 'lot.cancelled', entityType: 'Lot', entityId: lot.id, before: { status: lot.status }, after: { status: 'cancelled', freedAssets: freed }, reason })
    return updated
  })
  afterCommit(context)
  return result
}

// ---------------------------------------------------------------- bidding

type BidArgs = { lotNumber: string; amountMinor?: number | null; lines?: Array<{ lotLineId: string; unitPriceMinor: number }> | null; idempotencyKey: string }

async function lotByNumber(db: Tx, lotNumber: string) {
  const lot = await db.lot.findUnique({ where: { lotNumber: str(lotNumber, 40) } })
  if (!lot) fail('Lot not found.')
  return lot
}

/** Shared by placeBid, placeBidForBuyer and the bid-sheet flow. */
export async function placeBidCore(context: Ctx, input: BidArgs & { companyId: string; userId: string; source: 'web' | 'bid_sheet' | 'staff_entry'; staffNote?: string; sheetFileId?: string | null; skipTerms?: boolean }) {
  const key = str(input.idempotencyKey, 200)
  if (key.length < 8) fail('The request key is too short.')
  const found = await lotByNumber(context.prisma, input.lotNumber)
  await advanceLotClock(context, found.id)
  const payload = { lotNumber: found.lotNumber, amountMinor: input.amountMinor ?? null, lines: input.lines ?? null, companyId: input.companyId, source: input.source }
  const result = await inTransaction(context, async (tx) => {
    return withCommandReceipt(tx, { key, eventType: 'bid.placed', aggregateType: 'Lot', aggregateId: found.id, actorId: input.userId, payload }, async () => {
      await lockRow(tx, 'Lot', found.id)
      const lot = await tx.lot.findUnique({ where: { id: found.id }, include: { lines: { select: { id: true, quantity: true, lineNumber: true } } } })
      const now = await dbNow(tx)
      if (lot.status !== 'open') fail(lot.status === 'scheduled' ? 'Bidding has not opened yet.' : 'Bidding on this lot has closed.')
      if (new Date(lot.closesAt) <= now) fail('Bidding on this lot has closed.')
      if (lot.format === 'fixed_price') fail('This lot is sold at a fixed price. Use Buy now.')

      let amount: number
      let lineRows: Array<{ lotLineId: string; unitPriceMinor: number; quantity: number }> = []
      if (lot.bidBasis === 'per_line') {
        if (!input.lines?.length) fail('Enter a price on at least one line.')
        try {
          const priced = perLineTotal(lot.lines, input.lines)
          amount = priced.totalMinor
          lineRows = priced.lines
        } catch (error) {
          fail((error as Error).message)
        }
      } else {
        amount = Math.round(Number(input.amountMinor))
        if (!Number.isSafeInteger(amount) || amount <= 0) fail('Enter your bid amount.')
      }
      if (lot.format === 'open_auction') {
        const min = minimumOpenBid(lot)
        if (amount < min) fail(`Your bid must be at least ${await moneyText(tx, min)}.`)
      } else if (lot.openingBidMinor && amount < lot.openingBidMinor) {
        fail(`The minimum bid is ${await moneyText(tx, lot.openingBidMinor)}.`)
      }
      const { settings } = await assertMayBid(tx, { companyId: input.companyId, userId: input.userId, lotId: lot.id, amountMinor: amount, skipTerms: input.skipTerms })

      const previous = await tx.bid.findFirst({ where: { lotId: lot.id, companyId: input.companyId, status: 'active' } })
      if (previous && lot.format === 'open_auction' && previous.amountMinor >= amount) fail('Your new bid must be higher than your current bid.')
      if (previous) await tx.bid.update({ where: { id: previous.id }, data: { status: 'superseded', activeKey: null } })
      const bid = await tx.bid.create({
        data: {
          lotId: lot.id,
          companyId: input.companyId,
          placedById: input.userId,
          amountMinor: amount,
          status: 'active',
          activeKey: `${lot.id}:${input.companyId}`,
          submittedAt: now,
          source: input.source,
          staffNote: str(input.staffNote, 1000),
          sheetFileId: input.sheetFileId ?? null,
          idempotencyKey: `${input.userId}:${key}`,
          requestHash: requestHash(payload),
          ipAddress: clientIp(context),
          userAgent: userAgent(context),
          supersedesId: previous?.id ?? null,
          lines: lineRows.length ? { create: lineRows.map((l) => ({ lotLineId: l.lotLineId, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, status: 'active' })) } : undefined,
        },
      })
      const leaderBefore = lot.format === 'open_auction' ? await tx.bid.findFirst({ where: { lotId: lot.id, status: 'active', id: { not: bid.id } }, orderBy: [{ amountMinor: 'desc' }, { submittedAt: 'asc' }] }) : null
      await refreshLotHigh(tx, lot.id)
      let closesAt = lot.closesAt
      if (lot.format === 'open_auction') {
        const extended = softCloseExtension({ now, closesAt: new Date(lot.closesAt), windowMinutes: settings.softCloseWindowMinutes, extensionMinutes: settings.softCloseExtensionMinutes, extensionCount: lot.extensionCount ?? 0, maxExtensions: settings.softCloseMaxExtensions })
        if (extended) {
          closesAt = extended
          await tx.lot.update({ where: { id: lot.id }, data: { closesAt: extended, extensionCount: (lot.extensionCount ?? 0) + 1 } })
        }
        if (leaderBefore && leaderBefore.companyId !== input.companyId) {
          await notify(tx, { userIds: await companyUsers(tx, leaderBefore.companyId), type: 'outbid', title: `You have been outbid on ${lot.lotNumber}`, body: `${lot.title}: the high bid is now ${await moneyText(tx, amount)}.`, link: `/lots/${lot.lotNumber}` })
        }
      }
      await audit(tx, { actorId: input.userId, action: input.source === 'staff_entry' ? 'bid.entered_by_staff' : 'bid.placed', entityType: 'Lot', entityId: lot.id, after: { bidId: bid.id, companyId: input.companyId, source: input.source, ...(lot.format === 'sealed_bid' ? {} : { amountMinor: amount }) }, ipAddress: clientIp(context) })
      return { bidId: bid.id, amountMinor: amount, closesAt: new Date(closesAt).toISOString(), status: 'active' }
    })
  })
  afterCommit(context)
  return result
}

export async function placeBid(context: Ctx, args: BidArgs) {
  const { companyId, user } = await requireBuyer(context)
  return placeBidCore(context, { ...args, companyId, userId: user.id, source: 'web' })
}

/** S12: a bid phoned or emailed in, recorded as staff entry with a note. */
export async function placeBidForBuyer(context: Ctx, args: BidArgs & { companyId: string; note: string }) {
  const note = str(args.note, 1000) || fail('Write how the bid reached you (for example "Phoned by J. Ortiz, 10:42").')
  const staffId = context.session!.itemId
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: str(args.companyId, 60) }, include: { users: { where: { isActive: true, kind: 'buyer' }, orderBy: { createdAt: 'asc' }, take: 1 } } })
  if (!company) fail('Buyer not found.')
  const result = await placeBidCore(context, { ...args, companyId: company.id, userId: staffId, source: 'staff_entry', staffNote: note, skipTerms: true })
  return result
}

export async function withdrawBid(context: Ctx, args: { lotNumber: string }) {
  const { companyId, user } = await requireBuyer(context)
  const found = await lotByNumber(context.prisma, args.lotNumber)
  await advanceLotClock(context, found.id)
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', found.id)
    const lot = await tx.lot.findUnique({ where: { id: found.id } })
    if (lot.format !== 'sealed_bid') fail('Only a sealed bid can be withdrawn.')
    if (lot.status !== 'open' || new Date(lot.closesAt) <= (await dbNow(tx))) fail('Bidding has closed; your bid stands.')
    const bid = await tx.bid.findFirst({ where: { lotId: lot.id, companyId, status: 'active' } })
    if (!bid) fail('You have no active bid on this lot.')
    await tx.bid.update({ where: { id: bid.id }, data: { status: 'withdrawn', activeKey: null } })
    await refreshLotHigh(tx, lot.id)
    await audit(tx, { actorId: user.id, action: 'bid.withdrawn', entityType: 'Lot', entityId: lot.id, after: { bidId: bid.id } })
    return { bidId: bid.id, status: 'withdrawn' }
  })
}

/** U8: buy now on a fixed-price lot, straight to awarded. */
export async function buyNow(context: Ctx, args: { lotNumber: string; idempotencyKey: string }) {
  const { companyId, user } = await requireBuyer(context)
  const key = str(args.idempotencyKey, 200)
  if (key.length < 8) fail('The request key is too short.')
  const found = await lotByNumber(context.prisma, args.lotNumber)
  await advanceLotClock(context, found.id)
  const result = await inTransaction(context, async (tx) => {
    return withCommandReceipt(tx, { key, eventType: 'lot.buy_now', aggregateType: 'Lot', aggregateId: found.id, actorId: user.id, payload: { lotNumber: found.lotNumber } }, async () => {
      await lockRow(tx, 'Lot', found.id)
      const lot = await tx.lot.findUnique({ where: { id: found.id } })
      if (lot.format !== 'fixed_price') fail('This lot is not sold at a fixed price.')
      if (lot.status !== 'open' || new Date(lot.closesAt) <= (await dbNow(tx))) fail('This lot is no longer available.')
      await assertMayBid(tx, { companyId, userId: user.id, lotId: lot.id, amountMinor: lot.fixedPriceMinor })
      const now = await dbNow(tx)
      const bid = await tx.bid.create({ data: { lotId: lot.id, companyId, placedById: user.id, amountMinor: lot.fixedPriceMinor, status: 'active', activeKey: `${lot.id}:${companyId}`, submittedAt: now, source: 'web', idempotencyKey: `${user.id}:${key}`, requestHash: requestHash({ lot: lot.id }), ipAddress: clientIp(context), userAgent: userAgent(context) } })
      await tx.lot.update({ where: { id: lot.id }, data: { status: 'closed', closedAt: now, bidCount: 1, currentAmountMinor: lot.fixedPriceMinor } })
      const award = await createWholeLotAward(tx, { lotId: lot.id, bidId: bid.id, actorId: null, reason: 'Buy now', confirmBelowReserve: true })
      return { orderNumber: award.orderNumber, invoiceNumber: award.invoiceNumber }
    })
  })
  afterCommit(context)
  return result
}

// ---------------------------------------------------------------- awards

async function lotForAward(tx: Tx, lotId: string) {
  await lockRow(tx, 'Lot', lotId) || fail('Lot not found.')
  const lot = await tx.lot.findUnique({ where: { id: lotId }, include: { lines: { orderBy: { lineNumber: 'asc' }, include: { assets: { select: { id: true, serialNumber: true } } } } } })
  if (lot.status !== 'closed') fail(lot.status === 'open' ? 'The lot is still open.' : `This lot is ${lot.status}; it cannot be awarded.`)
  return lot
}

/**
 * Creates the award, award lines, order (with snapshot lines), invoice, and marks
 * assets sold. One transaction. Award.activeLotKey and AwardLine.activeLotLineKey
 * are unique, so a second concurrent award on the same lot or line fails.
 */
async function createAwardRecords(tx: Tx, input: { lot: any; bid: any; lines: Array<{ lotLineId: string; bidLineId?: string | null; quantity: number; unitPriceMinor: number; totalMinor: number }>; actorId: string | null; reason: string; isBelowReserve: boolean; wholeLot: boolean }) {
  const settings = await getSettings(tx)
  const company = await tx.buyerCompany.findUnique({ where: { id: input.bid.companyId } })
  const now = await dbNow(tx)
  const total = input.lines.reduce((s, l) => s + l.totalMinor, 0)
  const award = await tx.award.create({
    data: {
      lotId: input.lot.id,
      bidId: input.bid.id,
      companyId: company.id,
      awardedById: input.actorId,
      awardedAt: now,
      amountMinor: total,
      isBelowReserve: input.isBelowReserve,
      overrideReason: input.reason,
      status: 'active',
      activeLotKey: input.wholeLot ? input.lot.id : null,
      lines: { create: input.lines.map((l) => ({ lotLineId: l.lotLineId, activeLotLineKey: l.lotLineId, bidLineId: l.bidLineId ?? null, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })) },
    },
  })
  const byLine = new Map(input.lot.lines.map((l: any) => [l.id, l]))
  const orderLines = input.lines.map((l, i) => {
    const src: any = byLine.get(l.lotLineId)
    const serials = Array.isArray(src.serials) && src.serials.length ? src.serials : src.assets.map((a: any) => a.serialNumber).filter(Boolean)
    return { lineNumber: src.lineNumber ?? i + 1, description: src.description || [src.manufacturer, src.model].filter(Boolean).join(' '), manufacturer: src.manufacturer, model: src.model, specs: src.specs ?? {}, grade: [src.cosmeticGrade, src.functionalGrade].filter(Boolean).join(' / '), quantity: l.quantity, unit: src.unit, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor, serials, sourceLotLineId: src.id }
  })
  const dueAt = addBusinessDays(now, settings.paymentDueBusinessDays, settings.timezone)
  const orderNumber = await nextNumber(tx, 'order')
  const order = await tx.order.create({
    data: {
      orderNumber,
      companyId: company.id,
      lotId: input.lot.id,
      status: 'awaiting_payment',
      paymentDueAt: dueAt,
      palletCount: input.wholeLot ? input.lot.palletCount : null,
      weight: input.wholeLot ? input.lot.weight : null,
      dimensions: input.wholeLot ? input.lot.dimensions : '',
      lines: { create: orderLines },
    },
  })
  await tx.award.update({ where: { id: award.id }, data: { orderId: order.id } })
  const items = orderLines.map((l) => ({ description: `Line ${l.lineNumber}: ${l.description}`, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor }))
  const lotLineItems = input.wholeLot && input.lot.bidBasis === 'lot_total' ? [{ description: `${input.lot.lotNumber}: ${input.lot.title}`, quantity: 1, unitPriceMinor: total, totalMinor: total }] : items
  const plan = awardInvoiceLines({ items: lotLineItems, premiumBps: settings.buyerPremiumBps, taxBps: settings.salesTaxBps, taxStatus: company.taxStatus, exported: false })
  const invoice = await createInvoice(tx, {
    kind: 'lot_sale',
    buyerCompanyId: company.id,
    orderId: order.id,
    lines: plan.lines,
    billTo: { legalName: company.legalName, addressLine1: company.addressLine1, addressLine2: company.addressLine2, city: company.city, region: company.region, postalCode: company.postalCode, countryCode: company.countryCode, taxId: company.taxId },
    taxExemptReason: plan.taxExemptReason,
    dueAt,
  })
  const invoiceNumber = invoice.invoiceNumber
  const lineIds = input.lines.map((l) => l.lotLineId)
  await tx.asset.updateMany({ where: { lotLineId: { in: lineIds }, status: 'allocated' }, data: { status: 'sold' } })
  const assets = await tx.asset.findMany({ where: { lotLineId: { in: lineIds } }, select: { id: true, lotLineId: true }, orderBy: { assetNumber: 'asc' } })
  // Spread each line's amount across its assets (remainder on the last) so client settlements can use it.
  for (const l of input.lines) {
    const own = assets.filter((a: any) => a.lotLineId === l.lotLineId)
    if (!own.length) continue
    const each = Math.floor(l.totalMinor / own.length)
    for (let i = 0; i < own.length; i++) await tx.asset.update({ where: { id: own[i].id }, data: { soldPriceMinor: i === own.length - 1 ? l.totalMinor - each * (own.length - 1) : each } })
  }
  for (const a of assets) await tx.custodyEvent.create({ data: { assetId: a.id, type: 'allocated', actorId: input.actorId, actorName: input.actorId ? '' : 'System', occurredAt: now, notes: `Sold on ${input.lot.lotNumber}, order ${orderNumber}` } })
  await notify(tx, { userIds: await companyUsers(tx, company.id), type: 'lot_won', title: `You won ${input.lot.lotNumber}`, body: `${input.lot.title}: invoice ${invoiceNumber} for ${await moneyText(tx, invoice.totalMinor)} is due ${dueAt.toDateString()}.`, link: `/buyer/invoices/${invoiceNumber}` })
  await audit(tx, { actorId: input.actorId, action: 'lot.awarded', entityType: 'Lot', entityId: input.lot.id, after: { awardId: award.id, companyId: company.id, amountMinor: total, orderNumber, invoiceNumber, isBelowReserve: input.isBelowReserve }, reason: input.reason })
  return { awardId: award.id, orderId: order.id, orderNumber, invoiceNumber }
}

async function finishLotAfterAward(tx: Tx, lotId: string, winners: Map<string, 'won' | 'partially_won'>) {
  const bids = await tx.bid.findMany({ where: { lotId, status: 'active' }, select: { id: true } })
  for (const b of bids) {
    const outcome = winners.get(b.id) ?? 'lost'
    await tx.bid.update({ where: { id: b.id }, data: { status: outcome, activeKey: null } })
  }
  const losers = await tx.bid.findMany({ where: { lotId, status: 'lost' }, select: { companyId: true }, distinct: ['companyId'] })
  const lot = await tx.lot.findUnique({ where: { id: lotId } })
  const winnerCompanies = new Set((await tx.award.findMany({ where: { lotId, status: 'active' }, select: { companyId: true } })).map((a: any) => a.companyId))
  for (const l of losers) {
    if (winnerCompanies.has(l.companyId)) continue
    await notify(tx, { userIds: await companyUsers(tx, l.companyId), type: 'lot_lost', title: `${lot.lotNumber} was awarded to another buyer`, body: `Thank you for bidding on ${lot.title}.`, link: '/buyer/bids', dedupeKey: `lost:${lotId}:${l.companyId}` })
  }
  const lines = await tx.lotLine.findMany({ where: { lotId }, select: { id: true } })
  const unawarded = await tx.lotLine.findMany({ where: { lotId, from_AwardLine_lotLine: { none: { activeLotLineKey: { not: null } } } }, select: { id: true } })
  if (unawarded.length) await tx.asset.updateMany({ where: { lotLineId: { in: unawarded.map((l: any) => l.id) }, status: 'allocated' }, data: { status: 'ready_for_sale', lotLineId: null } })
  await tx.lot.update({ where: { id: lotId }, data: { status: unawarded.length === lines.length ? 'unsold' : 'awarded' } })
}

async function createWholeLotAward(tx: Tx, input: { lotId: string; bidId: string; actorId: string | null; reason: string; confirmBelowReserve: boolean }) {
  const lot = await lotForAward(tx, input.lotId)
  const bid = await tx.bid.findUnique({ where: { id: input.bidId }, include: { lines: true } })
  if (!bid || bid.lotId !== lot.id || bid.status !== 'active') fail('That bid is no longer valid.')
  const ranked = rankBids(await tx.bid.findMany({ where: { lotId: lot.id, status: 'active' } }))
  const isHighest = ranked[0]?.id === bid.id
  const guard = awardOverrideProblem({ totalMinor: bid.amountMinor, reserveMinor: lot.reserveMinor, confirmBelowReserve: input.confirmBelowReserve, isHighest, reason: input.reason })
  if (guard.message) fail(guard.message)
  let lines: Array<{ lotLineId: string; bidLineId?: string | null; quantity: number; unitPriceMinor: number; totalMinor: number }>
  if (lot.bidBasis === 'per_line' && bid.lines.length) {
    lines = bid.lines.map((l: any) => ({ lotLineId: l.lotLineId, bidLineId: l.id, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.unitPriceMinor * l.quantity }))
  } else {
    // Lot total: the whole amount is carried on the lines in proportion to quantity, the remainder on the first line.
    const qty = lot.lines.reduce((s: number, l: any) => s + l.quantity, 0) || 1
    let left = bid.amountMinor
    lines = lot.lines.map((l: any, i: number) => {
      const share = i === lot.lines.length - 1 ? left : Math.floor((bid.amountMinor * l.quantity) / qty)
      left -= share
      return { lotLineId: l.id, quantity: l.quantity, unitPriceMinor: l.quantity ? Math.floor(share / l.quantity) : share, totalMinor: share }
    })
  }
  const created = await createAwardRecords(tx, { lot, bid, lines, actorId: input.actorId, reason: input.reason, isBelowReserve: guard.below, wholeLot: true })
  await finishLotAfterAward(tx, lot.id, new Map([[bid.id, 'won']]))
  return created
}

async function autoAward(context: Pick<Ctx, 'prisma'>, lotId: string) {
  await context.prisma.$transaction(async (tx: Tx) => {
    const lot = await tx.lot.findUnique({ where: { id: lotId } })
    if (lot.status !== 'closed') return
    const ranked = rankBids(await tx.bid.findMany({ where: { lotId, status: 'active' } }))
    const top = ranked[0]
    if (!top) return
    if (lot.reserveMinor && top.amountMinor < lot.reserveMinor) return
    await createWholeLotAward(tx, { lotId, bidId: top.id, actorId: null, reason: '', confirmBelowReserve: false })
  }, { timeout: 30_000 })
}

/** S13: award a whole lot to one bid, or split a per-line lot. */
export async function awardLot(context: Ctx, args: { lotId: string; bidId?: string | null; lines?: Array<{ lotLineId: string; bidId: string }> | null; reason?: string; confirmBelowReserve?: boolean }) {
  const actorId = context.session!.itemId
  const reason = str(args.reason, 1000)
  const result = await inTransaction(context, async (tx) => {
    if (args.lines?.length) {
      const lot = await lotForAward(tx, args.lotId)
      if (lot.bidBasis !== 'per_line') fail('Split awards are for per-line lots.')
      const bids: GridBid[] = await tx.bid.findMany({ where: { lotId: lot.id, status: 'active' }, include: { lines: true } })
      let plan
      try {
        plan = planPerLineAward(bids, args.lines)
      } catch (error) {
        fail((error as Error).message)
      }
      const total = plan.reduce((s, g) => s + g.totalMinor, 0)
      const guard = awardOverrideProblem({ totalMinor: total, reserveMinor: lot.reserveMinor, confirmBelowReserve: Boolean(args.confirmBelowReserve), isHighest: true, reason })
      if (guard.message) fail(guard.message)
      const winners = new Map<string, 'won' | 'partially_won'>()
      const created = []
      for (const group of plan) {
        const bid = bids.find((b) => b.id === group.bidId)!
        created.push(await createAwardRecords(tx, { lot, bid, lines: group.lines, actorId, reason, isBelowReserve: guard.below, wholeLot: false }))
        winners.set(group.bidId, group.lines.length === bid.lines.length ? 'won' : 'partially_won')
      }
      await finishLotAfterAward(tx, lot.id, winners)
      return created
    }
    if (!args.bidId) fail('Choose the winning bid.')
    return [await createWholeLotAward(tx, { lotId: args.lotId, bidId: args.bidId, actorId, reason, confirmBelowReserve: Boolean(args.confirmBelowReserve) })]
  }, BULK)
  afterCommit(context)
  return result
}

export async function declineLotBids(context: Ctx, args: { lotId: string; reason?: string }) {
  const result = await inTransaction(context, async (tx) => {
    const lot = await lotForAward(tx, args.lotId)
    await finishLotAfterAward(tx, lot.id, new Map())
    await audit(tx, { actorId: context.session!.itemId, action: 'lot.declined', entityType: 'Lot', entityId: lot.id, reason: str(args.reason, 500) })
    return tx.lot.findUnique({ where: { id: lot.id } })
  })
  afterCommit(context)
  return result
}

/** S14: relist an unsold lot as a new linked draft with the same lines and assets. */
export async function relistLot(context: Ctx, args: { lotId: string }) {
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId }, include: { lines: { include: { assets: { select: { id: true, status: true } } } }, images: true } })
    if (!['unsold', 'cancelled'].includes(lot.status)) fail('Only an unsold or cancelled lot can be relisted.')
    const existing = await tx.lot.findFirst({ where: { relistedFromId: lot.id, status: { notIn: ['cancelled'] } } })
    if (existing) fail(`This lot was already relisted as ${existing.lotNumber}.`)
    const copy = await tx.lot.create({
      data: {
        lotNumber: await nextNumber(tx, 'lot'),
        title: lot.title, slug: '', categoryId: lot.categoryId, description: lot.description, conditionSummary: lot.conditionSummary, facilityId: lot.facilityId,
        status: 'draft', format: lot.format, bidBasis: lot.bidBasis, awardMode: lot.awardMode, openingBidMinor: lot.openingBidMinor, reserveMinor: lot.reserveMinor, bidIncrementMinor: lot.bidIncrementMinor, fixedPriceMinor: lot.fixedPriceMinor,
        palletCount: lot.palletCount, weight: lot.weight, dimensions: lot.dimensions, shippingTerms: lot.shippingTerms, exportAllowed: lot.exportAllowed, warrantyDays: lot.warrantyDays, relistedFromId: lot.id,
        images: { create: lot.images.map((i: any) => ({ imageId: i.imageId, caption: i.caption, sortOrder: i.sortOrder })) },
      },
    })
    for (const line of lot.lines) {
      const { id: _id, lotId: _l, createdAt: _c, updatedAt: _u, assets, ...rest } = line
      const created = await tx.lotLine.create({ data: { ...rest, specs: rest.specs ?? {}, serials: rest.serials ?? [], extra: rest.extra ?? {}, lotId: copy.id } })
      const free = assets.filter((a: any) => a.status === 'ready_for_sale').map((a: any) => a.id)
      if (free.length) await tx.asset.updateMany({ where: { id: { in: free } }, data: { status: 'allocated', lotLineId: created.id } })
    }
    await audit(tx, { actorId: context.session!.itemId, action: 'lot.relisted', entityType: 'Lot', entityId: lot.id, after: { newLotId: copy.id, lotNumber: copy.lotNumber } })
    return copy
  })
}

/** S14 / S20: after a default, award to the next valid bid. */
export async function reAwardToRunnerUp(context: Ctx, args: { lotId: string; bidId?: string | null; reason?: string; confirmBelowReserve?: boolean }) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId } })
    if (!['awarded', 'unsold'].includes(lot.status)) fail('Re-award is for a lot whose order defaulted.')
    if (lot.bidBasis !== 'lot_total') fail('Re-award to a runner-up is for lot-total lots; relist a per-line lot.')
    const live = await tx.award.count({ where: { lotId: lot.id, status: 'active' } })
    if (live) fail('This lot still has an active award.')
    const settings = await getSettings(tx)
    const closedAt = new Date(lot.closedAt ?? lot.closesAt)
    if (addBusinessDays(closedAt, settings.bidValidityBusinessDays + settings.paymentDueBusinessDays + settings.paymentGraceBusinessDays, settings.timezone) < (await dbNow(tx))) fail('The remaining bids are no longer binding. Relist the lot.')
    const candidates = rankBids(await tx.bid.findMany({ where: { lotId: lot.id, status: 'lost' } }))
    const pick = args.bidId ? candidates.find((b: any) => b.id === args.bidId) : candidates[0]
    if (!pick) fail('There is no runner-up bid to award.')
    const company = await tx.buyerCompany.findUnique({ where: { id: pick.companyId } })
    if (company.status !== 'approved') fail(`${company.legalName} is ${company.status} and cannot be awarded.`)
    await tx.bid.update({ where: { id: pick.id }, data: { status: 'active' } })
    await tx.lot.update({ where: { id: lot.id }, data: { status: 'closed' } })
    const lines = await tx.lotLine.findMany({ where: { lotId: lot.id }, select: { id: true } })
    await tx.asset.updateMany({ where: { lotLineId: { in: lines.map((l: any) => l.id) }, status: { in: ['allocated', 'ready_for_sale'] } }, data: { status: 'allocated' } })
    const award = await createWholeLotAward(tx, { lotId: lot.id, bidId: pick.id, actorId: context.session!.itemId, reason: str(args.reason, 500) || 'Re-awarded to the next-ranked bid after a default', confirmBelowReserve: Boolean(args.confirmBelowReserve) })
    return award
  })
  afterCommit(context)
  return result
}

// ---------------------------------------------------------------- inventory to lot

/** S7: build a draft lot from ready-for-sale assets, grouping identical items into lines. */
export async function createLotFromAssets(context: Ctx, args: { assetIds: string[]; title: string; categoryId?: string | null; facilityId?: string | null; saleEventId?: string | null; format?: string; bidBasis?: string }) {
  const title = str(args.title, 200) || fail('Give the lot a title.')
  const ids = [...new Set((args.assetIds || []).map((i) => str(i, 60)).filter(Boolean))].sort()
  if (!ids.length) fail('Choose at least one asset.')
  const settings = await getSettings(context.prisma)
  return inTransaction(context, async (tx) => {
    for (const id of ids) await lockRow(tx, 'Asset', id) || fail('An asset was not found.')
    const assets = await tx.asset.findMany({ where: { id: { in: ids } }, include: { category: true, cosmeticGrade: true, functionalGrade: true } })
    for (const a of assets) {
      if (a.status !== 'ready_for_sale') fail(`${a.assetNumber} is ${a.status.replace(/_/g, ' ')}, not ready for sale.`)
      if (a.lotLineId) fail(`${a.assetNumber} is already on a lot.`)
      if (!sanitizationAllowsSale(a)) fail(`${a.assetNumber} has not passed sanitisation.`)
    }
    const format = ['sealed_bid', 'open_auction', 'fixed_price'].includes(String(args.format)) ? String(args.format) : settings.defaultBidFormat
    const bidBasis = ['lot_total', 'per_line'].includes(String(args.bidBasis)) ? String(args.bidBasis) : settings.defaultBidBasis
    const lot = await tx.lot.create({ data: { lotNumber: await nextNumber(tx, 'lot'), title, slug: '', categoryId: args.categoryId || assets[0].categoryId, facilityId: args.facilityId || null, saleEventId: args.saleEventId || null, status: 'draft', format, bidBasis: format === 'fixed_price' ? 'lot_total' : bidBasis, awardMode: settings.defaultAwardMode, description: [{ type: 'paragraph', children: [{ text: '' }] }], weight: assets.reduce((s: number, a: any) => s + Number(a.weight ?? 0), 0) || null } })
    const groups = new Map<string, any[]>()
    for (const a of assets) {
      const key = [a.categoryId, a.manufacturer, a.model, a.cosmeticGrade?.code, a.functionalGrade?.code, JSON.stringify(a.specs ?? {})].join('|')
      groups.set(key, [...(groups.get(key) ?? []), a])
    }
    let n = 0
    for (const group of groups.values()) {
      const a = group[0]
      const line = await tx.lotLine.create({ data: { lotId: lot.id, lineNumber: ++n, categoryId: a.categoryId, manufacturer: a.manufacturer, model: a.model, partNumber: a.partNumber, description: [a.manufacturer, a.model].filter(Boolean).join(' ') || a.category?.name || 'Item', specs: a.specs ?? {}, cosmeticGrade: a.cosmeticGrade?.label ?? '', functionalGrade: a.functionalGrade?.label ?? '', quantity: group.length, unit: 'each', serials: group.map((g: any) => g.serialNumber).filter(Boolean) } })
      await tx.asset.updateMany({ where: { id: { in: group.map((g: any) => g.id) } }, data: { status: 'allocated', lotLineId: line.id } })
    }
    await audit(tx, { actorId: context.session!.itemId, action: 'lot.created_from_assets', entityType: 'Lot', entityId: lot.id, after: { assets: ids.length, lines: n } })
    return lot
  }, BULK)
}

/** Move assets off a draft lot back to inventory. */
export async function removeAssetsFromLot(context: Ctx, args: { lotId: string; assetIds: string[] }) {
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'Lot', args.lotId) || fail('Lot not found.')
    const lot = await tx.lot.findUnique({ where: { id: args.lotId }, include: { lines: { include: { assets: { select: { id: true } } } } } })
    if (lot.status !== 'draft') fail('Assets can only be removed from a draft lot.')
    const ids = new Set(args.assetIds)
    for (const line of lot.lines) {
      const leaving = line.assets.filter((a: any) => ids.has(a.id)).map((a: any) => a.id)
      if (!leaving.length) continue
      await tx.asset.updateMany({ where: { id: { in: leaving } }, data: { status: 'ready_for_sale', lotLineId: null } })
      const left = line.assets.length - leaving.length
      if (left <= 0) await tx.lotLine.delete({ where: { id: line.id } })
      else {
        const serials = (await tx.asset.findMany({ where: { lotLineId: line.id }, select: { serialNumber: true } })).map((a: any) => a.serialNumber).filter(Boolean)
        await tx.lotLine.update({ where: { id: line.id }, data: { quantity: left, serials } })
      }
    }
    return tx.lot.findUnique({ where: { id: lot.id } })
  })
}

// ---------------------------------------------------------------- bid board (S11)

export async function lotBidBoard(context: Ctx, args: { lotId: string }) {
  await advanceLotClock(context, args.lotId)
  const lot = await context.prisma.lot.findUnique({ where: { id: str(args.lotId, 60) }, include: { lines: { orderBy: { lineNumber: 'asc' } } } })
  if (!lot) fail('Lot not found.')
  const hidden = lot.format === 'sealed_bid' && ['open', 'scheduled'].includes(lot.status) && !hasPermission(context.session ?? null, 'canSeeSealedBidAmountsBeforeClose')
  const active = await context.prisma.bid.count({ where: { lotId: lot.id, status: 'active' } })
  if (hidden) return { lotId: lot.id, status: lot.status, sealed: true, activeCount: active, bids: [], lines: [], reserveMinor: null }
  const bids = await context.prisma.bid.findMany({ where: { lotId: lot.id }, include: { company: { select: { id: true, legalName: true, status: true, strikes: true } }, placedBy: { select: { name: true, kind: true } }, lines: true }, orderBy: [{ submittedAt: 'asc' }] })
  const ranked = rankBids(bids.filter((b: any) => b.status === 'active' || b.status === 'lost' || b.status === 'won' || b.status === 'partially_won'))
  const rankOf = new Map(ranked.map((b: any, i: number) => [b.id, i + 1]))
  const perLine = lot.lines.map((line: any) => {
    const offers = bids.filter((b: any) => b.status === 'active').flatMap((b: any) => b.lines.filter((l: any) => l.lotLineId === line.id).map((l: any) => ({ bidId: b.id, bidLineId: l.id, companyId: b.companyId, company: b.company.legalName, unitPriceMinor: l.unitPriceMinor, totalMinor: l.unitPriceMinor * l.quantity, submittedAt: b.submittedAt })))
    offers.sort((a: any, b: any) => b.unitPriceMinor - a.unitPriceMinor || new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    return { lotLineId: line.id, lineNumber: line.lineNumber, description: line.description, quantity: line.quantity, offers }
  })
  return {
    lotId: lot.id,
    status: lot.status,
    sealed: false,
    activeCount: active,
    reserveMinor: lot.reserveMinor,
    bids: bids.map((b: any) => ({ id: b.id, companyId: b.companyId, company: b.company.legalName, companyStatus: b.company.status, strikes: b.company.strikes, amountMinor: b.amountMinor, status: b.status, source: b.source, staffNote: b.staffNote, placedBy: b.placedBy?.name ?? '', submittedAt: b.submittedAt, rank: rankOf.get(b.id) ?? null, lineCount: b.lines.length })),
    lines: perLine,
  }
}
