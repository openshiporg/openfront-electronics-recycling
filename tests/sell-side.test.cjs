// Sell side against the real scratch Postgres: bidding, eligibility, idempotency,
// awards and the two races (two bids at once on one open lot; two awards at once on
// one closed lot). Row locks, unique keys and command receipts are Postgres's job,
// so these run on the database, not on stubs.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, root } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, lots, staffCtx

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  lots = require(path.join(root, 'features/keystone/domain/lots.ts'))
  const staff = await f.staff(ctx.prisma)
  staffCtx = await ctx.as(staff.id)
})
test.after(async () => { if (ctx) await ctx.disconnect() })

const bidAs = async (user, args) => lots.placeBid(await ctx.as(user.id), { idempotencyKey: f.key(), ...args })

test('sealed bid: revise replaces the bid, withdraw removes it, one active bid per company', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const { user } = await f.buyer(ctx.prisma)
  await bidAs(user, { lotNumber: lot.lotNumber, amountMinor: 500000 })
  const revised = await bidAs(user, { lotNumber: lot.lotNumber, amountMinor: 450000 })
  const bids = await ctx.prisma.bid.findMany({ where: { lotId: lot.id }, orderBy: { createdAt: 'asc' } })
  assert.deepEqual(bids.map((b) => b.status), ['superseded', 'active'], 'a sealed bid may be revised down')
  assert.equal(bids[1].id, revised.bidId)
  assert.equal(bids[1].supersedesId, bids[0].id)
  await lots.withdrawBid(await ctx.as(user.id), { lotNumber: lot.lotNumber })
  assert.equal((await ctx.prisma.bid.findUnique({ where: { id: revised.bidId } })).status, 'withdrawn')
  assert.equal(await ctx.prisma.bid.count({ where: { lotId: lot.id, status: 'active' } }), 0)
})

test('open auction: increment enforced, outbid notice, soft close extends', { skip }, async () => {
  const s = await f.settings(ctx.prisma)
  const lot = await f.lot(ctx.prisma, { format: 'open_auction', openingBidMinor: 100000, bidIncrementMinor: 5000, closesAt: new Date(Date.now() + 30_000) })
  const a = await f.buyer(ctx.prisma)
  const b = await f.buyer(ctx.prisma)
  await assert.rejects(bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 99000 }), /at least 1000\.00/)
  await bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 100000 })
  await assert.rejects(bidAs(b.user, { lotNumber: lot.lotNumber, amountMinor: 104000 }), /at least 1050\.00/)
  const second = await bidAs(b.user, { lotNumber: lot.lotNumber, amountMinor: 105000 })
  const after = await ctx.prisma.lot.findUnique({ where: { id: lot.id } })
  assert.equal(after.currentAmountMinor, 105000)
  if (s.softCloseWindowMinutes > 0 && s.softCloseMaxExtensions > 0) {
    // The first bid lands inside the window and extends the close; that pushes the
    // close outside the window, so the second bid does not extend it again.
    assert.equal(after.extensionCount, 1)
    assert.ok(new Date(second.closesAt) > lot.closesAt)
    await ctx.prisma.lot.update({ where: { id: lot.id }, data: { closesAt: new Date(Date.now() + 20_000) } })
    const third = await bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 110000 })
    assert.equal((await ctx.prisma.lot.findUnique({ where: { id: lot.id } })).extensionCount, 2)
    assert.ok(new Date(third.closesAt).getTime() > Date.now() + s.softCloseExtensionMinutes * 60_000 - 5_000)
  }
  const outbid = await ctx.prisma.notification.count({ where: { userId: a.user.id, type: 'outbid' } })
  assert.equal(outbid, 1)
})

test('late bid is refused once the close has passed, even before the clock runs', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const { user } = await f.buyer(ctx.prisma)
  await ctx.prisma.lot.update({ where: { id: lot.id }, data: { closesAt: new Date(Date.now() - 500) } })
  await assert.rejects(bidAs(user, { lotNumber: lot.lotNumber, amountMinor: 1000 }), /closed/)
  assert.equal((await ctx.prisma.lot.findUnique({ where: { id: lot.id } })).status, 'closed', 'the bid call advanced the clock')
})

test('ineligible buyers are refused: not approved, overdue invoice, over limit, terms not accepted', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const pending = await f.buyer(ctx.prisma, { company: { status: 'submitted' } })
  await assert.rejects(bidAs(pending.user, { lotNumber: lot.lotNumber, amountMinor: 1000 }), /must be approved/)

  const late = await f.buyer(ctx.prisma)
  await ctx.prisma.invoice.create({ data: { invoiceNumber: await f.nextNumber(ctx.prisma, 'invoice', 'INV-T'), kind: 'lot_sale', buyerCompanyId: late.company.id, status: 'open', totalMinor: 5000, paidMinor: 0, isOverdue: true, currencyCode: 'USD' } })
  await assert.rejects(bidAs(late.user, { lotNumber: lot.lotNumber, amountMinor: 1000 }), /overdue invoice/)

  const capped = await f.buyer(ctx.prisma, { company: { spendLimitMinor: 100000 } })
  await assert.rejects(bidAs(capped.user, { lotNumber: lot.lotNumber, amountMinor: 100001 }), /spending limit/)
  await bidAs(capped.user, { lotNumber: lot.lotNumber, amountMinor: 100000 })

  const s = await f.settings(ctx.prisma)
  if (!s.wholesaleTermsVersion) await ctx.prisma.storeSettings.update({ where: { id: s.id }, data: { wholesaleTermsVersion: '2026-1' } })
  const old = await f.buyer(ctx.prisma, { user: { acceptedTermsVersion: 'old-version' } })
  await assert.rejects(bidAs(old.user, { lotNumber: lot.lotNumber, amountMinor: 1000 }), /wholesale terms/)
})

test('idempotency: the same key twice gives one bid; the same key with a different amount is an error', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const { user } = await f.buyer(ctx.prisma)
  const userCtx = await ctx.as(user.id)
  const idempotencyKey = f.key()
  const first = await lots.placeBid(userCtx, { lotNumber: lot.lotNumber, amountMinor: 250000, idempotencyKey })
  const again = await lots.placeBid(userCtx, { lotNumber: lot.lotNumber, amountMinor: 250000, idempotencyKey })
  assert.equal(again.bidId, first.bidId)
  assert.equal(await ctx.prisma.bid.count({ where: { lotId: lot.id } }), 1)
  await assert.rejects(lots.placeBid(userCtx, { lotNumber: lot.lotNumber, amountMinor: 260000, idempotencyKey }), /different details/)
  assert.equal(await ctx.prisma.bid.count({ where: { lotId: lot.id } }), 1)
})

test('staff entry: a phoned bid is recorded as staff_entry with the note', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const { company } = await f.buyer(ctx.prisma)
  await assert.rejects(lots.placeBidForBuyer(staffCtx, { lotNumber: lot.lotNumber, amountMinor: 1000, companyId: company.id, note: '', idempotencyKey: f.key() }), /Write how the bid reached you/)
  const placed = await lots.placeBidForBuyer(staffCtx, { lotNumber: lot.lotNumber, amountMinor: 310000, companyId: company.id, note: 'Phoned by J. Ortiz, 10:42', idempotencyKey: f.key() })
  const bid = await ctx.prisma.bid.findUnique({ where: { id: placed.bidId } })
  assert.equal(bid.source, 'staff_entry')
  assert.equal(bid.staffNote, 'Phoned by J. Ortiz, 10:42')
  assert.equal(bid.placedById, staffCtx.session.itemId)
})

test('race: two buyers bid on one open lot at the same moment; the lock orders them and the high is right', { skip }, async () => {
  const lot = await f.lot(ctx.prisma, { format: 'open_auction', openingBidMinor: 100000, bidIncrementMinor: 1000, closesAt: new Date(Date.now() + 3_600_000) })
  const a = await f.buyer(ctx.prisma)
  const b = await f.buyer(ctx.prisma)
  const [ca, cb] = [await ctx.as(a.user.id), await ctx.as(b.user.id)]
  // Both bid the opening amount at once. The lot row lock orders them: the first wins
  // at 1,000.00 and the second must then be refused as below the new minimum.
  const results = await Promise.allSettled([
    lots.placeBid(ca, { lotNumber: lot.lotNumber, amountMinor: 100000, idempotencyKey: f.key() }),
    lots.placeBid(cb, { lotNumber: lot.lotNumber, amountMinor: 100000, idempotencyKey: f.key() }),
  ])
  const ok = results.filter((r) => r.status === 'fulfilled')
  const refused = results.filter((r) => r.status === 'rejected')
  assert.equal(ok.length, 1, 'exactly one opening bid is accepted')
  assert.equal(refused.length, 1)
  assert.match(refused[0].reason.message, /at least 1010\.00/)
  const after = await ctx.prisma.lot.findUnique({ where: { id: lot.id } })
  assert.equal(after.bidCount, 1)
  assert.equal(after.currentAmountMinor, 100000)

  // Two different amounts at once: both are valid in either order, both land, the high is right.
  // Two different amounts at once. 1,600.00 is valid in either order; 1,500.00 is
  // refused if 1,600.00 landed first. Either way the high and the counts must agree.
  const round2 = await Promise.allSettled([
    lots.placeBid(ca, { lotNumber: lot.lotNumber, amountMinor: 150000, idempotencyKey: f.key() }),
    lots.placeBid(cb, { lotNumber: lot.lotNumber, amountMinor: 160000, idempotencyKey: f.key() }),
  ])
  assert.equal(round2[1].status, 'fulfilled')
  if (round2[0].status === 'rejected') assert.match(round2[0].reason.message, /at least 1610\.00/)
  const final = await ctx.prisma.lot.findUnique({ where: { id: lot.id } })
  assert.equal(final.currentAmountMinor, 160000)
  const active = await ctx.prisma.bid.findMany({ where: { lotId: lot.id, status: 'active' } })
  assert.equal(new Set(active.map((b) => b.companyId)).size, active.length, 'one active bid per company')
  assert.equal(final.bidCount, active.length)
  assert.equal(Math.max(...active.map((b) => b.amountMinor)), 160000)
})

test('race: two sealed bids from different buyers at the same moment both stand', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const buyers = await Promise.all([f.buyer(ctx.prisma), f.buyer(ctx.prisma), f.buyer(ctx.prisma)])
  const ctxs = await Promise.all(buyers.map((b) => ctx.as(b.user.id)))
  await Promise.all(ctxs.map((c, i) => lots.placeBid(c, { lotNumber: lot.lotNumber, amountMinor: 200000 + i * 1000, idempotencyKey: f.key() })))
  const after = await ctx.prisma.lot.findUnique({ where: { id: lot.id } })
  assert.equal(after.bidCount, 3)
  assert.equal(after.currentAmountMinor, 202000)
})

test('award whole lot: order and invoice; the loser is told; a second award is refused', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const a = await f.buyer(ctx.prisma, { company: { taxStatus: 'taxable' } })
  const b = await f.buyer(ctx.prisma)
  const high = await bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 1000000 })
  await bidAs(b.user, { lotNumber: lot.lotNumber, amountMinor: 900000 })
  await assert.rejects(lots.awardLot(staffCtx, { lotId: lot.id, bidId: high.bidId }), /still open/)
  const closed = await f.closeLot(ctx.prisma, lot.id, lots.advanceLotClock)
  assert.equal(closed.status, 'closed')
  const [award] = await lots.awardLot(staffCtx, { lotId: lot.id, bidId: high.bidId })
  const s = await f.settings(ctx.prisma)
  const invoice = await ctx.prisma.invoice.findUnique({ where: { invoiceNumber: award.invoiceNumber }, include: { lines: true } })
  const premium = Math.round((1000000 * s.buyerPremiumBps) / 10000)
  const tax = Math.round(((1000000 + premium) * s.salesTaxBps) / 10000)
  assert.equal(invoice.subtotalMinor, 1000000)
  assert.equal(invoice.totalMinor, 1000000 + premium + tax)
  const order = await ctx.prisma.order.findUnique({ where: { orderNumber: award.orderNumber }, include: { lines: true } })
  assert.equal(order.status, 'awaiting_payment')
  assert.equal(order.lines.reduce((s, l) => s + l.totalMinor, 0), 1000000, 'lot total spread across lines')
  assert.equal((await ctx.prisma.lot.findUnique({ where: { id: lot.id } })).status, 'awarded')
  assert.equal(await ctx.prisma.notification.count({ where: { userId: b.user.id, type: 'lot_lost' } }), 1)
  assert.equal(await ctx.prisma.notification.count({ where: { userId: a.user.id, type: 'lot_won' } }), 1)
  await assert.rejects(lots.awardLot(staffCtx, { lotId: lot.id, bidId: high.bidId }), /awarded; it cannot be awarded/)
})

test('award below reserve needs the override and a note; not the highest needs a reason', { skip }, async () => {
  const lot = await f.lot(ctx.prisma, { reserveMinor: 800000 })
  const a = await f.buyer(ctx.prisma)
  const b = await f.buyer(ctx.prisma)
  const high = await bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 700000 })
  const low = await bidAs(b.user, { lotNumber: lot.lotNumber, amountMinor: 650000 })
  await f.closeLot(ctx.prisma, lot.id, lots.advanceLotClock)
  await assert.rejects(lots.awardLot(staffCtx, { lotId: lot.id, bidId: high.bidId }), /below the reserve/)
  await assert.rejects(lots.awardLot(staffCtx, { lotId: lot.id, bidId: high.bidId, confirmBelowReserve: true }), /note/)
  await assert.rejects(lots.awardLot(staffCtx, { lotId: lot.id, bidId: low.bidId, confirmBelowReserve: true, reason: '' }), /note|reason/)
  const [award] = await lots.awardLot(staffCtx, { lotId: lot.id, bidId: high.bidId, confirmBelowReserve: true, reason: 'Market price fell; owner approved' })
  const row = await ctx.prisma.award.findUnique({ where: { id: award.awardId } })
  assert.equal(row.isBelowReserve, true)
  assert.equal(row.overrideReason, 'Market price fell; owner approved')
})

test('per-line award split: each buyer gets their lines and their own invoice', { skip }, async () => {
  const lot = await f.lot(ctx.prisma, { bidBasis: 'per_line' })
  const [l1, l2] = lot.lines
  const a = await f.buyer(ctx.prisma)
  const b = await f.buyer(ctx.prisma)
  const bidA = await bidAs(a.user, { lotNumber: lot.lotNumber, lines: [{ lotLineId: l1.id, unitPriceMinor: 12500 }, { lotLineId: l2.id, unitPriceMinor: 9000 }] })
  const bidB = await bidAs(b.user, { lotNumber: lot.lotNumber, lines: [{ lotLineId: l2.id, unitPriceMinor: 9500 }] })
  assert.equal(bidA.amountMinor, 40 * 12500 + 10 * 9000)
  await f.closeLot(ctx.prisma, lot.id, lots.advanceLotClock)
  const awards = await lots.awardLot(staffCtx, { lotId: lot.id, lines: [{ lotLineId: l1.id, bidId: bidA.bidId }, { lotLineId: l2.id, bidId: bidB.bidId }] })
  assert.equal(awards.length, 2)
  const rows = await ctx.prisma.award.findMany({ where: { lotId: lot.id }, orderBy: { amountMinor: 'desc' } })
  assert.deepEqual(rows.map((r) => r.amountMinor), [500000, 95000])
  const bids = await ctx.prisma.bid.findMany({ where: { id: { in: [bidA.bidId, bidB.bidId] } } })
  assert.equal(bids.find((x) => x.id === bidA.bidId).status, 'partially_won')
  assert.equal(bids.find((x) => x.id === bidB.bidId).status, 'won')
  await assert.rejects(lots.awardLot(staffCtx, { lotId: lot.id, lines: [{ lotLineId: l2.id, bidId: bidA.bidId }] }), /cannot be awarded/)
})

test('race: two awards on the same lot at the same moment; exactly one wins', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const a = await f.buyer(ctx.prisma)
  const b = await f.buyer(ctx.prisma)
  const bidA = await bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 400000 })
  const bidB = await bidAs(b.user, { lotNumber: lot.lotNumber, amountMinor: 390000 })
  await f.closeLot(ctx.prisma, lot.id, lots.advanceLotClock)
  const other = await ctx.as((await f.staff(ctx.prisma)).id)
  const results = await Promise.allSettled([
    lots.awardLot(staffCtx, { lotId: lot.id, bidId: bidA.bidId }),
    lots.awardLot(other, { lotId: lot.id, bidId: bidB.bidId, reason: 'Preferred buyer for this category' }),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'one award')
  const refused = results.find((r) => r.status === 'rejected')
  assert.ok(refused, 'the other award is refused')
  assert.match(refused.reason.message, /cannot be awarded|no longer valid|Unique constraint/)
  assert.equal(await ctx.prisma.award.count({ where: { lotId: lot.id, status: 'active' } }), 1)
  assert.equal(await ctx.prisma.order.count({ where: { lotId: lot.id } }), 1)
  assert.equal(await ctx.prisma.invoice.count({ where: { order: { lotId: lot.id } } }), 1)
})

test('decline all bids leaves the lot unsold; relist makes a linked draft', { skip }, async () => {
  const lot = await f.lot(ctx.prisma)
  const a = await f.buyer(ctx.prisma)
  await bidAs(a.user, { lotNumber: lot.lotNumber, amountMinor: 1000 })
  await f.closeLot(ctx.prisma, lot.id, lots.advanceLotClock)
  await lots.declineLotBids(staffCtx, { lotId: lot.id, reason: 'Below market' })
  assert.equal((await ctx.prisma.lot.findUnique({ where: { id: lot.id } })).status, 'unsold')
  assert.equal(await ctx.prisma.bid.count({ where: { lotId: lot.id, status: 'lost' } }), 1)
  const relisted = await lots.relistLot(staffCtx, { lotId: lot.id })
  const copy = await ctx.prisma.lot.findUnique({ where: { id: relisted.id ?? relisted.lotId }, include: { lines: true } })
  assert.equal(copy.status, 'draft')
  assert.equal(copy.relistedFromId, lot.id)
  assert.equal(copy.lines.length, lot.lines.length)
})
