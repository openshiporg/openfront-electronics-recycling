// Pure rules in features/keystone/lib/rules: bidding, money, sheets, lifecycle, time.
// Node's built-in runner; TypeScript is loaded through tsx. No database or network.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
require('tsx/cjs/api').register()

const root = path.resolve(__dirname, '..')
const load = (rel) => require(path.join(root, rel))
const bidding = load('features/keystone/lib/rules/bidding.ts')
const money = load('features/keystone/lib/rules/money.ts')
const sheets = load('features/keystone/lib/rules/sheets.ts')
const lifecycle = load('features/keystone/lib/rules/lifecycle.ts')
const time = load('features/keystone/lib/rules/time.ts')

// ---------------------------------------------------------------- bidding

test('bids rank by amount, then the earlier submission wins a tie', () => {
  const ranked = bidding.rankBids([
    { id: 'b', companyId: 'B', amountMinor: 500000, submittedAt: '2026-11-20T10:00:05Z' },
    { id: 'a', companyId: 'A', amountMinor: 500000, submittedAt: '2026-11-20T10:00:01Z' },
    { id: 'c', companyId: 'C', amountMinor: 520000, submittedAt: '2026-11-20T11:00:00Z' },
    { id: 'd', companyId: 'D', amountMinor: 100, submittedAt: '2026-11-20T09:00:00Z' },
  ])
  assert.deepEqual(ranked.map((b) => b.id), ['c', 'a', 'b', 'd'])
})

test('open auction minimum: opening bid first, then high bid plus the increment', () => {
  assert.equal(bidding.minimumOpenBid({ openingBidMinor: 100000, bidIncrementMinor: 5000, currentAmountMinor: null, bidCount: 0 }), 100000)
  assert.equal(bidding.minimumOpenBid({ openingBidMinor: 100000, bidIncrementMinor: 5000, currentAmountMinor: 120000, bidCount: 3 }), 125000)
  assert.equal(bidding.minimumOpenBid({ openingBidMinor: 0, bidIncrementMinor: 0, currentAmountMinor: 0, bidCount: 0 }), 1)
})

test('soft close extends only inside the window and only up to the maximum', () => {
  const closesAt = new Date('2026-11-21T15:00:00Z')
  const base = { closesAt, windowMinutes: 2, extensionMinutes: 2, extensionCount: 0, maxExtensions: 3 }
  assert.equal(bidding.softCloseExtension({ ...base, now: new Date('2026-11-21T14:55:00Z') }), null, 'outside the window')
  assert.equal(bidding.softCloseExtension({ ...base, now: new Date('2026-11-21T14:59:00Z') }).toISOString(), '2026-11-21T15:02:00.000Z')
  assert.equal(bidding.softCloseExtension({ ...base, extensionCount: 3, now: new Date('2026-11-21T14:59:00Z') }), null, 'max extensions reached')
  assert.equal(bidding.softCloseExtension({ ...base, now: new Date('2026-11-21T15:00:01Z') }), null, 'late bid gets no extension')
})

test('ineligible buyers are refused for each reason, in order', () => {
  const ok = { companyStatus: 'approved', userActive: true, acceptedTermsVersion: '2026-1', currentTermsVersion: '2026-1', hasOverdueInvoice: false, spendLimitMinor: null, unpaidAwardsMinor: 0, otherActiveBidsMinor: 0, bidAmountMinor: 1000 }
  assert.equal(bidding.bidEligibilityProblem(ok), null)
  assert.equal(bidding.bidEligibilityProblem({ ...ok, companyStatus: 'submitted' }).code, 'not_approved')
  assert.equal(bidding.bidEligibilityProblem({ ...ok, companyStatus: 'suspended' }).code, 'not_approved')
  assert.equal(bidding.bidEligibilityProblem({ ...ok, userActive: false }).code, 'inactive')
  assert.equal(bidding.bidEligibilityProblem({ ...ok, acceptedTermsVersion: '2025-4' }).code, 'terms')
  assert.equal(bidding.bidEligibilityProblem({ ...ok, hasOverdueInvoice: true }).code, 'overdue')
  assert.equal(bidding.bidEligibilityProblem({ ...ok, spendLimitMinor: 5000, unpaidAwardsMinor: 3000, otherActiveBidsMinor: 1500, bidAmountMinor: 1000 }).code, 'limit')
  assert.equal(bidding.bidEligibilityProblem({ ...ok, spendLimitMinor: 5500, unpaidAwardsMinor: 3000, otherActiveBidsMinor: 1500, bidAmountMinor: 1000 }), null)
})

test('per-line bids: totals by quantity, zero lines skipped, foreign and duplicate lines refused', () => {
  const lines = [{ id: 'l1', quantity: 40, lineNumber: 1 }, { id: 'l2', quantity: 10, lineNumber: 2 }]
  const priced = bidding.perLineTotal(lines, [{ lotLineId: 'l1', unitPriceMinor: 12500 }, { lotLineId: 'l2', unitPriceMinor: 0 }])
  assert.equal(priced.totalMinor, 500000)
  assert.equal(priced.lines.length, 1)
  assert.throws(() => bidding.perLineTotal(lines, [{ lotLineId: 'zz', unitPriceMinor: 1 }]), /does not belong/)
  assert.throws(() => bidding.perLineTotal(lines, [{ lotLineId: 'l1', unitPriceMinor: 1 }, { lotLineId: 'l1', unitPriceMinor: 2 }]), /twice/)
  assert.throws(() => bidding.perLineTotal(lines, [{ lotLineId: 'l1', unitPriceMinor: -5 }]), /invalid price/)
  assert.throws(() => bidding.perLineTotal(lines, [{ lotLineId: 'l1', unitPriceMinor: 0 }]), /at least one line/)
})

test('per-line award split groups lines by winning bid with totals; a line goes to one buyer', () => {
  const bids = [
    { id: 'A', companyId: 'ca', amountMinor: 0, submittedAt: '2026-11-20T10:00:00Z', lines: [{ id: 'a1', lotLineId: 'l1', unitPriceMinor: 12500, quantity: 40 }, { id: 'a2', lotLineId: 'l2', unitPriceMinor: 9000, quantity: 10 }] },
    { id: 'B', companyId: 'cb', amountMinor: 0, submittedAt: '2026-11-20T10:01:00Z', lines: [{ id: 'b2', lotLineId: 'l2', unitPriceMinor: 9500, quantity: 10 }] },
  ]
  const best = bidding.bestPerLine(bids)
  assert.equal(best.get('l2')[0].bidId, 'B')
  const plan = bidding.planPerLineAward(bids, [{ lotLineId: 'l1', bidId: 'A' }, { lotLineId: 'l2', bidId: 'B' }])
  assert.deepEqual(plan.map((g) => [g.bidId, g.totalMinor]), [['A', 500000], ['B', 95000]])
  assert.throws(() => bidding.planPerLineAward(bids, [{ lotLineId: 'l2', bidId: 'A' }, { lotLineId: 'l2', bidId: 'B' }]), /one buyer/)
  assert.throws(() => bidding.planPerLineAward(bids, [{ lotLineId: 'l1', bidId: 'B' }]), /no price/)
})

test('award below reserve needs the override and a note; not-highest needs a reason', () => {
  const base = { totalMinor: 90000, reserveMinor: 100000, confirmBelowReserve: false, isHighest: true, reason: '' }
  assert.match(bidding.awardOverrideProblem(base).message, /below the reserve/)
  assert.match(bidding.awardOverrideProblem({ ...base, confirmBelowReserve: true }).message, /note/)
  assert.equal(bidding.awardOverrideProblem({ ...base, confirmBelowReserve: true, reason: 'Market fell' }).message, null)
  assert.equal(bidding.awardOverrideProblem({ ...base, totalMinor: 100000 }).message, null)
  assert.match(bidding.awardOverrideProblem({ ...base, totalMinor: 100000, isHighest: false }).message, /other than the highest/)
})

// ---------------------------------------------------------------- money

test('invoice totals with buyer premium and sales tax', () => {
  const { lines, taxExempt } = money.awardInvoiceLines({ items: [{ description: 'Lot', quantity: 1, unitPriceMinor: 1000000, totalMinor: 1000000 }], premiumBps: 500, taxBps: 825, taxStatus: 'taxable', exported: false })
  assert.equal(taxExempt, false)
  const totals = money.invoiceTotals(lines)
  assert.equal(totals.subtotalMinor, 1000000)
  assert.equal(totals.premiumMinor, 50000)
  assert.equal(totals.taxMinor, Math.round(1050000 * 0.0825))
  assert.equal(totals.totalMinor, 1000000 + 50000 + 86625)
})

test('tax exemption for resale certificates and exports', () => {
  for (const [taxStatus, exported, reason] of [['exempt_resale', false, 'resale certificate'], ['export', false, 'export'], ['taxable', true, 'export']]) {
    const out = money.awardInvoiceLines({ items: [{ description: 'Lot', quantity: 1, unitPriceMinor: 100000, totalMinor: 100000 }], premiumBps: 0, taxBps: 825, taxStatus, exported })
    assert.equal(out.taxExempt, true)
    assert.equal(out.taxExemptReason, reason)
    assert.equal(out.lines.some((l) => l.kind === 'tax'), false)
  }
})

test('card fee is added on the amount paid by card', () => {
  assert.equal(money.cardFee(1000000, 300), 30000)
  assert.equal(money.cardFee(0, 300), 0)
  const totals = money.invoiceTotals([{ kind: 'item', totalMinor: 1000000 }, { kind: 'card_fee', totalMinor: 30000 }])
  assert.equal(totals.feeMinor, 30000)
  assert.equal(totals.totalMinor, 1030000)
})

test('partial payment, paid, refunds and void give the right invoice status', () => {
  assert.equal(money.invoiceStatusFor({ totalMinor: 1000, paidMinor: 0, refundedMinor: 0 }), 'open')
  assert.equal(money.invoiceStatusFor({ totalMinor: 1000, paidMinor: 400, refundedMinor: 0 }), 'partially_paid')
  assert.equal(money.invoiceStatusFor({ totalMinor: 1000, paidMinor: 1000, refundedMinor: 0 }), 'paid')
  assert.equal(money.invoiceStatusFor({ totalMinor: 1000, paidMinor: 1000, refundedMinor: 300 }), 'partially_refunded')
  assert.equal(money.invoiceStatusFor({ totalMinor: 1000, paidMinor: 1000, refundedMinor: 1000 }), 'refunded')
  assert.equal(money.invoiceStatusFor({ totalMinor: 1000, paidMinor: 0, refundedMinor: 0, voided: true }), 'void')
})

test('refund cap: never more than captured minus refunded', () => {
  assert.equal(money.refundProblem({ capturedMinor: 1000, alreadyRefundedMinor: 0, requestedMinor: 1000 }), null)
  assert.match(money.refundProblem({ capturedMinor: 1000, alreadyRefundedMinor: 400, requestedMinor: 700 }), /At most 600/)
  assert.match(money.refundProblem({ capturedMinor: 1000, alreadyRefundedMinor: 0, requestedMinor: 0 }), /greater than zero/)
  assert.match(money.refundProblem({ capturedMinor: 1000, alreadyRefundedMinor: 0, requestedMinor: 10.5 }), /greater than zero/)
})

test('default flow: restocking fee and suspension on the third strike', () => {
  assert.equal(money.restockingFee(1000000, 1500), 150000)
  assert.deepEqual(money.strikeOutcome(0, 3), { strikes: 1, suspend: false })
  assert.deepEqual(money.strikeOutcome(1, 3), { strikes: 2, suspend: false })
  assert.deepEqual(money.strikeOutcome(2, 3), { strikes: 3, suspend: true })
})

test('settlement totals: client share minus service fees', () => {
  const t = money.settlementTotals([{ kind: 'asset_value', grossMinor: 100000, clientAmountMinor: 70000 }, { kind: 'service_fee', grossMinor: 25000, clientAmountMinor: 0 }])
  assert.deepEqual(t, { feesTotalMinor: 25000, clientShareTotalMinor: 70000, netMinor: 45000 })
})

// ---------------------------------------------------------------- sheets

test('manifest header row is detected below title rows and mapped by name', () => {
  const rows = [['Northgate ITAD — Lot manifest'], ['Prepared 2026-11-20', ''], ['Line', 'Make', 'Model', 'Serial Number', 'CPU', 'RAM', 'Qty', 'Grade', 'Warehouse bin'], [1, 'Dell', 'Latitude 5420', 'ABC123', 'i5-1145G7', '16', 1, 'B', 'R4']]
  const headerIndex = sheets.detectHeaderRow(rows)
  assert.equal(headerIndex, 2)
  const mapping = sheets.proposeMapping(rows[headerIndex])
  assert.equal(mapping.manufacturer, 1)
  assert.equal(mapping.model, 2)
  assert.equal(mapping.serial, 3)
  assert.equal(mapping.quantity, 6)
  const [row] = sheets.applyManifestMapping(rows[headerIndex], rows.slice(headerIndex + 1), mapping, headerIndex + 2)
  assert.equal(row.valid, true)
  assert.deepEqual(row.line.serials, ['ABC123'])
  assert.equal(row.line.specs.ramGb, 16)
  assert.deepEqual(row.line.extra, { 'Warehouse bin': 'R4' }, 'unmapped columns are kept')
})

test('spec columns export with plain headers and import from both the plain headers and the old keys', () => {
  assert.equal(sheets.specLabel('cpu'), 'Processor')
  assert.equal(sheets.specLabel('ramGb'), 'RAM (GB)')
  assert.equal(sheets.specLabel('storageGb'), 'Storage (GB)')
  assert.equal(sheets.specLabel('batteryHealth'), 'Battery health')
  assert.deepEqual(sheets.specKeysOf([{ specs: { batteryHealth: '90%', ramGb: 8 } }, { specs: { cpu: 'i5' } }]), ['cpu', 'ramGb', 'batteryHealth'])
  for (const headers of [['Description', 'Qty', 'Processor', 'RAM (GB)', 'Storage (GB)', 'Storage type', 'Screen (in)'], ['description', 'quantity', 'cpu', 'ramGb', 'storageGb', 'storageType', 'screenIn']]) {
    const mapping = sheets.proposeMapping(headers)
    assert.deepEqual([mapping.cpu, mapping.ramGb, mapping.storageGb, mapping.storageType, mapping.screenIn], [2, 3, 4, 5, 6], headers.join(','))
    const [row] = sheets.applyManifestMapping(headers, [['Dell Latitude 5420', 1, 'i5-1145G7', '16', '256', 'SSD', '14']], mapping, 2)
    assert.deepEqual(row.line.specs, { cpu: 'i5-1145G7', ramGb: 16, storageGb: 256, storageType: 'SSD', screenIn: 14 })
    assert.deepEqual(row.line.extra, {})
  }
})

test('manifest rows with errors are marked with the reason; blank rows are skipped', () => {
  const headers = ['Description', 'Qty']
  const out = sheets.applyManifestMapping(headers, [['Dell OptiPlex 7090', 'two'], ['', ''], ['', '3'], ['HP EliteDesk 800', '0']], { description: 0, quantity: 1 }, 2)
  assert.equal(out.length, 3)
  assert.match(out[0].errors[0], /not a whole number/)
  assert.match(out[1].errors[0], /no description/)
  assert.match(out[2].errors[0], /zero/)
})

test('a manifest row corrected by hand is re-checked with the same rules and marked edited', () => {
  const [bad] = sheets.applyManifestMapping(['Make', 'Model', 'Qty'], [['Lenovo', 'T480', 'ten']], { manufacturer: 0, model: 1, quantity: 2 }, 7)
  assert.equal(bad.valid, false)
  const fixed = sheets.correctManifestRow(bad, { quantity: '10', cosmeticGrade: 'C' })
  assert.equal(fixed.valid, true)
  assert.equal(fixed.edited, true)
  assert.equal(fixed.rowNumber, 7)
  assert.deepEqual([fixed.line.manufacturer, fixed.line.model, fixed.line.quantity, fixed.line.cosmeticGrade], ['Lenovo', 'T480', 10, 'C'])
  assert.match(sheets.correctManifestRow(bad, { quantity: 'eleven' }).errors[0], /Quantity "eleven" is not a whole number/)
  assert.match(sheets.correctManifestRow(fixed, { quantity: '0' }).errors[0], /zero/)
  const blank = sheets.correctManifestRow(fixed, { manufacturer: '', model: '', description: '' })
  assert.match(blank.errors[0], /no description, model or manufacturer/)
  const serials = sheets.correctManifestRow(bad, { quantity: '', serials: 'A1, A2;A3' })
  assert.deepEqual([serials.line.serials, serials.line.quantity, serials.valid], [['A1', 'A2', 'A3'], 3, true])
})

test('export neutralises formula injection', () => {
  assert.equal(sheets.neutralizeCell('=HYPERLINK("http://x")'), `'=HYPERLINK("http://x")`)
  assert.equal(sheets.neutralizeCell('+1'), `'+1`)
  assert.equal(sheets.neutralizeCell('-2'), `'-2`)
  assert.equal(sheets.neutralizeCell('@SUM(A1)'), `'@SUM(A1)`)
  assert.equal(sheets.neutralizeCell('Dell'), 'Dell')
  assert.equal(sheets.neutralizeCell(42), 42)
  assert.deepEqual(sheets.neutralizeRows([['=1', 'ok']]), [[`'=1`, 'ok']])
})

test('sheet size limits and money cells', () => {
  assert.equal(sheets.MAX_SHEET_BYTES, 10 * 1024 * 1024)
  assert.ok(sheets.MAX_SHEET_ROWS >= sheets.STORED_ROW_CAP)
  assert.equal(sheets.parseMoneyCell('$1,250.50'), 125050)
  assert.equal(sheets.parseMoneyCell(12.5), 1250)
  assert.equal(sheets.parseMoneyCell('=1+1'), null)
  assert.equal(sheets.parseMoneyCell('-5'), null)
  assert.equal(sheets.parseMoneyCell(''), null)
})

test('erasure report results and techniques', () => {
  assert.equal(sheets.erasureResult('Successful'), 'passed')
  assert.equal(sheets.erasureResult('FAILED - bad sectors'), 'failed')
  assert.equal(sheets.erasureResult('pending'), null)
  assert.deepEqual(sheets.erasureTechnique('NIST 800-88 Purge (Crypto Erase)'), { method: 'purge', technique: 'crypto_erase' })
  assert.deepEqual(sheets.erasureTechnique('DoD 3-pass'), { method: 'clear', technique: 'overwrite' })
})

// ---------------------------------------------------------------- lifecycle

test('job transition guards', () => {
  assert.equal(lifecycle.jobTransition('accept', 'quoted'), 'accepted')
  assert.throws(() => lifecycle.jobTransition('accept', 'requested'), /cannot be moved/)
  assert.throws(() => lifecycle.jobTransition('complete', 'collected'), /cannot be moved/)
  assert.throws(() => lifecycle.jobTransition('cancel', 'collected'), /cannot be moved/, 'goods in custody: no cancel')
  assert.throws(() => lifecycle.jobTransition('fly', 'quoted'), /Unknown/)
})

test('sanitisation gate: unsanitised data-bearing assets cannot be sold; failed then destroyed', () => {
  assert.equal(lifecycle.sanitizationAllowsSale({ isDataBearing: true, sanitizationStatus: 'pending' }), false)
  assert.equal(lifecycle.sanitizationAllowsSale({ isDataBearing: true, sanitizationStatus: 'failed' }), false)
  assert.equal(lifecycle.sanitizationAllowsSale({ isDataBearing: true, sanitizationStatus: 'passed' }), true)
  assert.equal(lifecycle.sanitizationAllowsSale({ isDataBearing: true, sanitizationStatus: 'pending', storageRemoved: true }), true)
  assert.equal(lifecycle.sanitizationAllowsSale({ isDataBearing: false, sanitizationStatus: 'not_required' }), true)
  const status = lifecycle.sanitizationStatusFromRecords(true, [
    { method: 'clear', result: 'failed', completedAt: '2026-11-20T10:00:00Z' },
    { method: 'destroy', result: 'passed', completedAt: '2026-11-20T11:00:00Z' },
  ])
  assert.equal(status, 'destroyed')
  assert.equal(lifecycle.sanitizationStatusFromRecords(true, []), 'pending')
  assert.equal(lifecycle.sanitizationStatusFromRecords(true, [{ method: 'purge', result: 'failed', completedAt: '2026-11-20T10:00:00Z' }]), 'failed')
})

test('certificate issue is blocked until every data-bearing asset is done', () => {
  assert.match(lifecycle.jobCompletionProblem([{ assetNumber: 'A-1', isDataBearing: true, sanitizationStatus: 'pending', status: 'audited' }]), /1 data-bearing asset still/)
  assert.equal(lifecycle.jobCompletionProblem([{ assetNumber: 'A-1', isDataBearing: true, sanitizationStatus: 'destroyed', status: 'recycling' }, { assetNumber: 'A-2', isDataBearing: false, sanitizationStatus: 'not_required', status: 'audited' }]), null)
})

test('business days skip weekends', () => {
  const friday = new Date('2026-11-20T15:00:00Z')
  assert.equal(time.addBusinessDays(friday, 1).toISOString().slice(0, 10), '2026-11-23')
  assert.equal(time.addBusinessDays(friday, 3).toISOString().slice(0, 10), '2026-11-25')
})

test('password reset link: buyers and clients go to the storefront page, staff to the dashboard', () => {
  const { passwordResetUrl } = load('features/keystone/lib/mail.ts')
  assert.equal(passwordResetUrl('https://riverbend-itad.com/', 'buyer', 'a b', 'ops+northgate@riverbend-itad.com'), 'https://riverbend-itad.com/reset-password?token=a%20b&email=ops%2Bnorthgate%40riverbend-itad.com')
  assert.equal(passwordResetUrl('https://riverbend-itad.com', 'client', 't', 'x@y.com'), 'https://riverbend-itad.com/reset-password?token=t&email=x%40y.com')
  assert.equal(passwordResetUrl('https://riverbend-itad.com', 'staff', 't', 'x@y.com'), 'https://riverbend-itad.com/dashboard/reset?token=t&email=x%40y.com')
})

// ---------------------------------------------------------------- dock slots

test('dock slots follow the facility hours in its time zone, across DST', () => {
  const hours = { mon: '07:30-16:30', fri: '07:30-15:00', sat: null }
  const mon = time.dockSlots({ date: '2026-11-23', hours, slotMinutes: 60, perWindow: 2, timeZone: 'America/New_York', booked: [] })
  assert.equal(mon.open, true)
  assert.equal(mon.slots.length, 9) // 07:30 … 15:30
  assert.equal(mon.slots[0].startsAt.toISOString(), '2026-11-23T12:30:00.000Z') // EST, UTC-5
  const summer = time.dockSlots({ date: '2026-07-06', hours, slotMinutes: 60, perWindow: 1, timeZone: 'America/New_York', booked: [] })
  assert.equal(summer.slots[0].startsAt.toISOString(), '2026-07-06T11:30:00.000Z') // EDT, UTC-4
  assert.equal(time.dockSlots({ date: '2026-11-28', hours, slotMinutes: 60, perWindow: 1, timeZone: 'America/New_York', booked: [] }).open, false)
})

test('a dock slot counts overlapping bookings against its capacity', () => {
  const hours = { tue: '08:00-10:00' }
  const booked = [{ startsAt: '2026-11-24T13:00:00Z', endsAt: '2026-11-24T14:00:00Z' }, { startsAt: '2026-11-24T13:00:00Z', endsAt: '2026-11-24T14:00:00Z' }]
  const day = time.dockSlots({ date: '2026-11-24', hours, slotMinutes: 60, perWindow: 2, timeZone: 'America/New_York', booked })
  assert.deepEqual(day.slots.map((s) => [s.taken, s.free]), [[2, 0], [0, 2]])
})
