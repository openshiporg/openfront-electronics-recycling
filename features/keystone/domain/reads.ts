import { fail, requireBuyer, requireClient, str, type Ctx } from '../lib/core'
import { bidEligibilityProblem, minimumOpenBid, rankBids } from '../lib/rules/bidding'
import { fileUrl, getSettings } from '../lib/services'
import { advanceLotClock, companyExposure } from './lots'
import { invoiceForCaller, paymentOptions, serializeSession } from './money'
import { orderForBuyer } from './orders'

// Read projections for the storefront. Every field is chosen here; nothing private leaks by default
// (§4.7: never reserve, other companies' bids or identities, internal notes; wire instructions only
// with an open invoice; pickup instructions only once the buyer's order is paid).

const PUBLIC_LOT_STATUSES = ['scheduled', 'open', 'closed', 'awarded', 'completed']
const richText = (doc: any) => (Array.isArray(doc) ? doc : [])

export async function storefrontSettings(context: Ctx) {
  const s = await getSettings(context.prisma)
  return {
    businessName: s.businessName,
    legalName: s.legalName,
    tagline: s.tagline,
    logoUrl: fileUrl(s.logoId),
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    timezone: s.timezone,
    currencyCode: s.currencyCode,
    weightUnit: s.weightUnit,
    publicLotVisibility: s.publicLotVisibility,
    rules: {
      defaultBidFormat: s.defaultBidFormat,
      softCloseWindowMinutes: s.softCloseWindowMinutes,
      softCloseExtensionMinutes: s.softCloseExtensionMinutes,
      bidValidityBusinessDays: s.bidValidityBusinessDays,
      buyerPremiumBps: s.buyerPremiumBps,
      salesTaxBps: s.salesTaxBps,
      cardFeeBps: s.cardFeeBps,
      cardMaxAmountMinor: s.cardMaxAmountMinor,
      paymentDueBusinessDays: s.paymentDueBusinessDays,
      restockingFeeBps: s.restockingFeeBps,
      strikesBeforeSuspension: s.strikesBeforeSuspension,
      removalBusinessDays: s.removalBusinessDays,
      storageFeePerPalletPerDayMinor: s.storageFeePerPalletPerDayMinor,
      claimWindowBusinessDays: s.claimWindowBusinessDays,
    },
    wholesaleTerms: richText(s.wholesaleTerms),
    wholesaleTermsVersion: s.wholesaleTermsVersion,
    serviceTerms: richText(s.serviceTerms),
    serviceTermsVersion: s.serviceTermsVersion,
    exportClause: s.exportClause,
  }
}

export async function publicCertifications(context: Ctx) {
  const rows = await context.prisma.certification.findMany({ where: { isPublic: true, OR: [{ expiresOn: null }, { expiresOn: { gte: new Date() } }] }, include: { facility: { select: { name: true } } }, orderBy: { name: 'asc' } })
  return rows.map((c: any) => ({ id: c.id, name: c.name === 'Other' ? c.otherName : c.name, certificateNumber: c.certificateNumber, certifyingBody: c.certifyingBody, facility: c.facility?.name ?? '', expiresOn: c.expiresOn, documentUrl: c.documentId ? fileUrl(c.documentId) : null }))
}

export async function publicAcceptedItems(context: Ctx) {
  const rows = await context.prisma.acceptedItem.findMany({ include: { category: { select: { name: true } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return rows.map((i: any) => ({ id: i.id, name: i.name, category: i.category?.name ?? '', accepted: i.accepted, feeType: i.feeType, feeMinor: i.feeMinor, notes: i.notes }))
}

export async function publicFacilities(context: Ctx) {
  const rows = await context.prisma.facility.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  return rows.map((f: any) => ({ id: f.id, name: f.name, code: f.code, addressLine1: f.addressLine1, addressLine2: f.addressLine2, city: f.city, region: f.region, postalCode: f.postalCode, countryCode: f.countryCode, phone: f.phone, hours: f.hours ?? {}, acceptsDropOff: f.acceptsDropOff }))
}

export async function publicGradeGuide(context: Ctx) {
  const rows = await context.prisma.gradeDefinition.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] })
  return rows.map((g: any) => ({ id: g.id, kind: g.kind, code: g.code, label: g.label, description: g.description }))
}

export async function publicCategories(context: Ctx) {
  const rows = await context.prisma.materialCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true, kind: true } })
  return rows
}

export async function publicSaleEvents(context: Ctx) {
  const rows = await context.prisma.saleEvent.findMany({ where: { status: 'published', closesAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }, orderBy: { opensAt: 'asc' }, take: 50 })
  return rows.map((e: any) => ({ id: e.id, title: e.title, slug: e.slug, description: e.description, opensAt: e.opensAt, closesAt: e.closesAt }))
}

async function lotCards(context: Ctx, where: any, withPrices: boolean, companyId?: string | null) {
  const lots = await context.prisma.lot.findMany({
    where: { status: { in: PUBLIC_LOT_STATUSES }, ...where },
    orderBy: [{ closesAt: 'asc' }],
    take: 200,
    include: { category: { select: { name: true, slug: true } }, saleEvent: { select: { id: true, title: true, slug: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 }, lines: { select: { quantity: true } } },
  })
  const myBids = companyId ? await context.prisma.bid.findMany({ where: { companyId, lotId: { in: lots.map((l: any) => l.id) }, status: { in: ['active', 'won', 'partially_won', 'lost'] } }, select: { lotId: true, status: true, amountMinor: true } }) : []
  return lots.map((l: any) => {
    const mine = myBids.find((b: any) => b.lotId === l.id)
    const sealed = l.format === 'sealed_bid'
    return {
      id: l.id,
      lotNumber: l.lotNumber,
      title: l.title,
      status: l.status,
      format: l.format,
      bidBasis: l.bidBasis,
      category: l.category?.name ?? '',
      categorySlug: l.category?.slug ?? '',
      saleEvent: l.saleEvent,
      imageUrl: l.images[0] ? fileUrl(l.images[0].imageId) : null,
      unitCount: l.lines.reduce((s: number, x: any) => s + (x.quantity ?? 0), 0),
      lineCount: l.lines.length,
      palletCount: l.palletCount,
      weight: l.weight != null ? Number(l.weight) : null,
      opensAt: l.opensAt,
      closesAt: l.closesAt,
      conditionSummary: l.conditionSummary,
      ...(withPrices ? { currentAmountMinor: sealed ? null : l.currentAmountMinor, bidCount: sealed ? null : l.bidCount, openingBidMinor: l.openingBidMinor, fixedPriceMinor: l.format === 'fixed_price' ? l.fixedPriceMinor : null, myBidStatus: mine?.status ?? null, myBidMinor: mine?.amountMinor ?? null } : {}),
    }
  })
}

export async function publicLots(context: Ctx, args: { category?: string | null; saleEventId?: string | null; status?: string | null } = {}) {
  const where: any = {}
  if (args.category) where.category = { slug: str(args.category, 120) }
  if (args.saleEventId) where.saleEventId = str(args.saleEventId, 60)
  if (args.status && PUBLIC_LOT_STATUSES.includes(args.status)) where.status = args.status
  return lotCards(context, where, false)
}

export async function publicLot(context: Ctx, args: { lotNumber: string }) {
  const lot = await context.prisma.lot.findUnique({ where: { lotNumber: str(args.lotNumber, 40) }, include: { category: { select: { name: true } }, images: { orderBy: { sortOrder: 'asc' } }, lines: { select: { quantity: true, manufacturer: true, categoryId: true } }, saleEvent: { select: { title: true, slug: true } } } })
  if (!lot || !PUBLIC_LOT_STATUSES.includes(lot.status)) return null
  const settings = await getSettings(context.prisma)
  const manufacturers = [...new Set(lot.lines.map((l: any) => l.manufacturer).filter(Boolean))].slice(0, 12)
  return {
    lotNumber: lot.lotNumber,
    title: lot.title,
    status: lot.status,
    format: lot.format,
    bidBasis: lot.bidBasis,
    category: lot.category?.name ?? '',
    saleEvent: lot.saleEvent,
    description: richText(lot.description),
    conditionSummary: lot.conditionSummary,
    images: lot.images.map((i: any) => ({ url: fileUrl(i.imageId), caption: i.caption })),
    unitCount: lot.lines.reduce((s: number, x: any) => s + (x.quantity ?? 0), 0),
    lineCount: lot.lines.length,
    manufacturers,
    palletCount: lot.palletCount,
    weight: lot.weight != null ? Number(lot.weight) : null,
    shippingTerms: lot.shippingTerms,
    exportAllowed: lot.exportAllowed,
    opensAt: lot.opensAt,
    closesAt: lot.closesAt,
    manifestVisibility: settings.publicLotVisibility,
  }
}

// ---------------------------------------------------------------- buyer

export async function myBuyerCompany(context: Ctx) {
  const { companyId, user } = await requireBuyer(context)
  const c = await context.prisma.buyerCompany.findUnique({ where: { id: companyId }, include: { documents: { orderBy: { createdAt: 'desc' } }, messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } } }, categoriesOfInterest: { select: { id: true, name: true } }, users: { select: { id: true, name: true, email: true, buyerRole: true, isActive: true } } } })
  const settings = await getSettings(context.prisma)
  const overdue = await context.prisma.invoice.findMany({ where: { buyerCompanyId: companyId, isOverdue: true, status: { in: ['open', 'partially_paid'] } }, select: { invoiceNumber: true, totalMinor: true, paidMinor: true, dueAt: true } })
  const exposure = await companyExposure(context.prisma, companyId)
  const problem = bidEligibilityProblem({ companyStatus: c.status, userActive: user.isActive, acceptedTermsVersion: user.acceptedTermsVersion, currentTermsVersion: settings.wholesaleTermsVersion, spendLimitMinor: c.spendLimitMinor, bidAmountMinor: 0, ...exposure })
  return {
    id: c.id,
    legalName: c.legalName,
    tradingName: c.tradingName,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    countryCode: c.countryCode,
    phone: c.phone,
    website: c.website,
    taxId: c.taxId,
    businessType: c.businessType,
    monthlySpendBand: c.monthlySpendBand,
    destinationCountries: c.destinationCountries ?? [],
    categoriesOfInterest: c.categoriesOfInterest,
    status: c.status,
    statusReason: ['needs_info', 'rejected', 'suspended'].includes(c.status) ? c.statusReason : '',
    rejectedAt: c.rejectedAt,
    taxStatus: c.taxStatus,
    spendLimitMinor: c.spendLimitMinor,
    exposureMinor: exposure.unpaidAwardsMinor + exposure.otherActiveBidsMinor,
    strikes: c.strikes,
    termsVersionAccepted: user.acceptedTermsVersion,
    currentTermsVersion: settings.wholesaleTermsVersion,
    mayBid: !problem,
    bidBlockedReason: problem?.message ?? null,
    overdueInvoices: overdue,
    documents: c.documents.map((d: any) => ({ id: d.id, type: d.type, status: d.status, state: d.state, expiresOn: d.expiresOn, reviewNote: d.reviewNote, fileUrl: fileUrl(d.fileId), createdAt: d.createdAt })),
    messages: c.messages.map((m: any) => ({ id: m.id, body: m.body, fromStaff: m.fromStaff, author: m.fromStaff ? settings.businessName : m.author?.name ?? '', createdAt: m.createdAt })),
    users: c.users,
    me: { id: user.id, name: user.name, email: user.email, buyerRole: user.buyerRole },
  }
}

export async function buyerLots(context: Ctx, args: { category?: string | null; format?: string | null; saleEventId?: string | null; closingWithinHours?: number | null } = {}) {
  const { companyId } = await requireBuyer(context)
  await advanceLotClock(context)
  const where: any = {}
  if (args.category) where.category = { slug: str(args.category, 120) }
  if (args.format && ['sealed_bid', 'open_auction', 'fixed_price'].includes(args.format)) where.format = args.format
  if (args.saleEventId) where.saleEventId = str(args.saleEventId, 60)
  if (args.closingWithinHours) where.closesAt = { lte: new Date(Date.now() + Number(args.closingWithinHours) * 3_600_000), gte: new Date() }
  return lotCards(context, where, true, companyId)
}

export async function buyerLot(context: Ctx, args: { lotNumber: string }) {
  const { companyId, user } = await requireBuyer(context)
  const found = await context.prisma.lot.findUnique({ where: { lotNumber: str(args.lotNumber, 40) }, select: { id: true } })
  if (!found) return null
  await advanceLotClock(context, found.id)
  const base = await publicLot(context, args)
  if (!base) return null
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: companyId } })
  const settings = await getSettings(context.prisma)
  const approved = company.status === 'approved'
  const lot = await context.prisma.lot.findUnique({ where: { id: found.id }, include: { lines: { orderBy: { lineNumber: 'asc' }, include: { category: { select: { name: true } } } }, addenda: { orderBy: { postedAt: 'asc' } }, facility: { select: { name: true, city: true, region: true, countryCode: true } } } })
  const showManifest = approved || settings.publicLotVisibility === 'full'
  const myBid = await context.prisma.bid.findFirst({ where: { lotId: lot.id, companyId, status: { in: ['active', 'won', 'partially_won', 'lost'] } }, orderBy: { submittedAt: 'desc' }, include: { lines: true } })
  let leading: boolean | null = null
  if (lot.format === 'open_auction' && myBid?.status === 'active') {
    const active = await context.prisma.bid.findMany({ where: { lotId: lot.id, status: 'active' }, select: { id: true, amountMinor: true, submittedAt: true, companyId: true } })
    leading = rankBids(active)[0]?.companyId === companyId
  }
  const sealed = lot.format === 'sealed_bid'
  const exposure = await companyExposure(context.prisma, companyId, lot.id)
  const problem = bidEligibilityProblem({ companyStatus: company.status, userActive: user.isActive, acceptedTermsVersion: user.acceptedTermsVersion, currentTermsVersion: settings.wholesaleTermsVersion, spendLimitMinor: company.spendLimitMinor, bidAmountMinor: 0, ...exposure })
  const blocked = problem?.message ?? null
  return {
    ...base,
    facility: lot.facility ? `${lot.facility.name}, ${[lot.facility.city, lot.facility.region].filter(Boolean).join(', ')}` : '',
    dimensions: lot.dimensions,
    warrantyDays: lot.warrantyDays,
    manifestVisible: showManifest,
    lines: showManifest ? lot.lines.map((l: any) => ({ id: l.id, lineNumber: l.lineNumber, category: l.category?.name ?? '', manufacturer: l.manufacturer, model: l.model, partNumber: l.partNumber, description: l.description, specs: l.specs ?? {}, cosmeticGrade: l.cosmeticGrade, functionalGrade: l.functionalGrade, quantity: l.quantity, unit: l.unit, serials: Array.isArray(l.serials) ? l.serials : [], notes: l.notes })) : [],
    addenda: lot.addenda.map((a: any) => ({ id: a.id, body: a.body, postedAt: a.postedAt })),
    currentAmountMinor: sealed ? null : lot.currentAmountMinor,
    bidCount: sealed ? null : lot.bidCount,
    openingBidMinor: lot.openingBidMinor,
    bidIncrementMinor: lot.bidIncrementMinor,
    minimumBidMinor: lot.format === 'open_auction' ? minimumOpenBid(lot) : lot.openingBidMinor ?? 0,
    fixedPriceMinor: lot.format === 'fixed_price' ? lot.fixedPriceMinor : null,
    reserveMet: lot.format === 'open_auction' && lot.reserveMinor != null ? (lot.currentAmountMinor ?? 0) >= lot.reserveMinor : null,
    extensionCount: lot.format === 'open_auction' ? lot.extensionCount : null,
    softCloseWindowMinutes: settings.softCloseWindowMinutes,
    myBid: myBid ? { id: myBid.id, amountMinor: myBid.amountMinor, status: myBid.status, source: myBid.source, submittedAt: myBid.submittedAt, lines: myBid.lines.map((l: any) => ({ lotLineId: l.lotLineId, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, status: l.status })) } : null,
    leading,
    mayBid: !blocked && lot.status === 'open',
    bidBlockedReason: blocked ?? (lot.status !== 'open' ? (lot.status === 'scheduled' ? 'Bidding has not opened yet.' : 'Bidding is closed.') : null),
    termsVersionRequired: user.acceptedTermsVersion === settings.wholesaleTermsVersion ? null : settings.wholesaleTermsVersion,
  }
}

export async function myBids(context: Ctx, args: { status?: string | null } = {}) {
  const { companyId } = await requireBuyer(context)
  const groups: Record<string, string[]> = { active: ['active'], won: ['won', 'partially_won'], lost: ['lost', 'expired', 'void', 'withdrawn', 'defaulted'] }
  const statuses = args.status && groups[args.status] ? groups[args.status] : ['active', 'won', 'partially_won', 'lost', 'expired', 'void', 'withdrawn', 'defaulted']
  const bids = await context.prisma.bid.findMany({ where: { companyId, status: { in: statuses } }, orderBy: { submittedAt: 'desc' }, take: 200, include: { lot: { select: { lotNumber: true, title: true, status: true, format: true, closesAt: true } }, placedBy: { select: { name: true } }, lines: { select: { id: true } } } })
  return bids.map((b: any) => ({ id: b.id, lotNumber: b.lot.lotNumber, lotTitle: b.lot.title, lotStatus: b.lot.status, format: b.lot.format, closesAt: b.lot.closesAt, amountMinor: b.amountMinor, status: b.status, source: b.source, placedBy: b.placedBy?.name ?? '', lineCount: b.lines.length, submittedAt: b.submittedAt }))
}

function invoiceCard(i: any) {
  return { id: i.id, invoiceNumber: i.invoiceNumber, kind: i.kind, status: i.status, totalMinor: i.totalMinor, paidMinor: i.paidMinor, balanceMinor: Math.max(0, i.totalMinor - i.paidMinor), currencyCode: i.currencyCode, issuedAt: i.issuedAt, dueAt: i.dueAt, isOverdue: i.isOverdue }
}

export async function myInvoices(context: Ctx) {
  const user = context.session ? await context.prisma.user.findUnique({ where: { id: context.session.itemId }, select: { kind: true } }) : null
  const where = user?.kind === 'client' ? { clientOrganizationId: (await requireClient(context)).organizationId } : { buyerCompanyId: (await requireBuyer(context)).companyId }
  const rows = await context.prisma.invoice.findMany({ where: { ...where, status: { not: 'void' } }, orderBy: { issuedAt: 'desc' }, take: 200 })
  return rows.map(invoiceCard)
}

export async function myInvoice(context: Ctx, args: { invoiceNumber: string }) {
  const { invoice } = await invoiceForCaller(context, args.invoiceNumber)
  const full = await context.prisma.invoice.findUnique({ where: { id: invoice.id }, include: { lines: { orderBy: { createdAt: 'asc' } }, payments: { orderBy: { createdAt: 'asc' } }, paymentSessions: { orderBy: { createdAt: 'desc' }, take: 5 }, order: { select: { orderNumber: true } }, job: { select: { jobNumber: true } } } })
  const open = ['open', 'partially_paid'].includes(full.status)
  const options = open ? await paymentOptions(context.prisma, full) : null
  return {
    ...invoiceCard(full),
    billTo: full.billTo ?? {},
    subtotalMinor: full.subtotalMinor,
    premiumMinor: full.premiumMinor,
    taxMinor: full.taxMinor,
    freightMinor: full.freightMinor,
    feeMinor: full.feeMinor,
    otherMinor: full.otherMinor,
    refundedMinor: full.refundedMinor,
    taxExemptReason: full.taxExemptReason,
    orderNumber: full.order?.orderNumber ?? null,
    jobNumber: full.job?.jobNumber ?? null,
    lines: full.lines.map((l: any) => ({ id: l.id, kind: l.kind, description: l.description, quantity: Number(l.quantity), unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })),
    payments: full.payments.map((p: any) => ({ id: p.id, method: p.method, amountMinor: p.amountMinor, status: p.status, bankReference: p.bankReference, paidOn: p.paidOn, rejectionReason: p.rejectionReason, createdAt: p.createdAt })),
    latestSession: serializeSession(full.paymentSessions[0]),
    // Wire instructions only while the caller has this open invoice.
    paymentOptions: options,
  }
}

function orderCard(o: any) {
  return { id: o.id, orderNumber: o.orderNumber, status: o.status, lotNumber: o.lot?.lotNumber ?? '', lotTitle: o.lot?.title ?? '', totalMinor: o.invoice?.totalMinor ?? null, invoiceNumber: o.invoice?.invoiceNumber ?? null, paymentDueAt: o.paymentDueAt, readyAt: o.readyAt, removalDueAt: o.removalDueAt, releasedAt: o.releasedAt, createdAt: o.createdAt }
}

export async function myOrders(context: Ctx) {
  const { companyId } = await requireBuyer(context)
  const rows = await context.prisma.order.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 200, include: { lot: { select: { lotNumber: true, title: true } }, invoice: { select: { invoiceNumber: true, totalMinor: true } } } })
  return rows.map(orderCard)
}

export async function myOrder(context: Ctx, args: { orderNumber: string }) {
  const { order: base } = await orderForBuyer(context, args.orderNumber)
  const o = await context.prisma.order.findUnique({ where: { id: base.id }, include: { lot: { include: { facility: true } }, invoice: { select: { invoiceNumber: true, totalMinor: true, paidMinor: true, status: true } }, lines: { orderBy: { lineNumber: 'asc' } }, dockAppointment: true, claims: { select: { claimNumber: true, status: true, resolution: true, approvedAmountMinor: true } } } })
  const settings = await getSettings(context.prisma)
  const paid = ['paid', 'ready_for_release', 'released', 'completed'].includes(o.status)
  const f = o.lot?.facility
  return {
    ...orderCard(o),
    lines: o.lines.map((l: any) => ({ lineNumber: l.lineNumber, description: l.description, manufacturer: l.manufacturer, model: l.model, grade: l.grade, quantity: l.quantity, unit: l.unit, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor, serialCount: Array.isArray(l.serials) ? l.serials.length : 0 })),
    palletCount: o.palletCount,
    weight: o.weight != null ? Number(o.weight) : null,
    dimensions: o.dimensions,
    shippingTerms: o.lot?.shippingTerms ?? '',
    exportAllowed: o.lot?.exportAllowed ?? true,
    // Pickup address and instructions only once paid.
    pickup: paid && f ? { facility: f.name, addressLine1: f.addressLine1, addressLine2: f.addressLine2, city: f.city, region: f.region, postalCode: f.postalCode, countryCode: f.countryCode, phone: f.phone, hours: f.hours ?? {}, instructions: f.pickupInstructions } : null,
    release: { method: o.releaseMethod, preferredPickupDate: o.preferredPickupDate, driverName: o.driverName, carrierName: o.carrierName, carrierReference: o.carrierReference, freightPickupDate: o.freightPickupDate, destinationCountry: o.destinationCountry, exportAcknowledgedAt: o.exportAcknowledgedAt, setAt: o.releaseDetailsSetAt },
    dockAppointment: o.dockAppointment && o.dockAppointment.status !== 'cancelled' ? { startsAt: o.dockAppointment.startsAt, endsAt: o.dockAppointment.endsAt, status: o.dockAppointment.status } : null,
    billOfLading: o.billOfLading,
    claimWindowEndsAt: o.claimWindowEndsAt,
    claims: o.claims,
    exportClause: settings.exportClause,
    documentsAvailable: paid,
    invoiceStatus: o.invoice?.status ?? null,
  }
}

// ---------------------------------------------------------------- client

const CLIENT_STAGES = ['requested', 'quoted', 'accepted', 'scheduled', 'en_route', 'collected', 'received', 'processing', 'completed', 'settled', 'closed']

function jobCard(j: any) {
  return { id: j.id, jobNumber: j.jobNumber, type: j.type, status: j.status, scheduledDate: j.scheduledDate, windowStart: j.windowStart, windowEnd: j.windowEnd, collectedAt: j.collectedAt, completedAt: j.completedAt, createdAt: j.createdAt, site: j.siteAddress ? [j.siteAddress.addressLine1, j.siteAddress.city].filter(Boolean).join(', ') : '' }
}

export async function myJobs(context: Ctx) {
  const { organizationId } = await requireClient(context)
  const org = await context.prisma.clientOrganization.findUnique({ where: { id: organizationId }, include: { sites: { orderBy: { name: 'asc' } } } })
  const jobs = await context.prisma.job.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 200 })
  return { organization: { id: org.id, name: org.name, status: org.status }, sites: org.sites.map((s: any) => ({ id: s.id, name: s.name, addressLine1: s.addressLine1, city: s.city, postalCode: s.postalCode })), jobs: jobs.map(jobCard) }
}

export async function myJob(context: Ctx, args: { jobNumber: string }) {
  const { organizationId, user } = await requireClient(context)
  const j = await context.prisma.job.findUnique({ where: { jobNumber: str(args.jobNumber, 40) }, include: { serviceLines: true, estimateLines: { include: { category: { select: { name: true } } } }, containers: { orderBy: { label: 'asc' } }, custodyEvents: { orderBy: { occurredAt: 'asc' }, include: { container: { select: { label: true } }, facility: { select: { name: true } }, actor: { select: { name: true } } } }, certificates: { orderBy: { issuedAt: 'desc' } }, settlement: true, driver: { select: { name: true } }, assets: { select: { isDataBearing: true, sanitizationStatus: true, disposition: true, weight: true } } } })
  if (!j || j.organizationId !== organizationId) fail('Job not found.')
  const settings = await getSettings(context.prisma)
  const showSettlement = j.settlement && ['published', 'disputed', 'paid', 'closed'].includes(j.settlement.status)
  const assets = j.assets
  return {
    ...jobCard(j),
    stages: CLIENT_STAGES,
    contactName: j.contactName,
    requestedDates: j.requestedDates ?? [],
    servicesRequested: j.servicesRequested ?? [],
    estimate: j.estimateLines.map((l: any) => ({ category: l.category?.name ?? '', quantity: l.quantity, unit: l.unit, notes: l.notes })),
    quote: j.quoteSentAt ? { sentAt: j.quoteSentAt, pricingModel: j.pricingModel, revenueShareBps: j.revenueShareBps, buyoutAmountMinor: j.buyoutAmountMinor, lines: j.serviceLines.map((l: any) => ({ description: l.description, quantity: Number(l.quantity), unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })), totalMinor: j.serviceLines.reduce((s: number, l: any) => s + (l.totalMinor ?? 0), 0), acceptedAt: j.quoteAcceptedAt, signatureName: j.quoteSignatureName, termsVersion: settings.serviceTermsVersion, terms: richText(settings.serviceTerms), canRespond: j.status === 'quoted' && user.clientRole === 'admin' } : null,
    declineReason: j.declineReason,
    cancelReason: j.cancelReason,
    driver: j.driver?.name ?? '',
    vehicle: j.vehicle,
    clientSignerName: j.clientSignerName,
    containers: j.containers.map((c: any) => ({ label: c.label, type: c.type, sealNumber: c.sealNumber, sealVerified: c.sealVerified, grossWeight: c.grossWeight != null ? Number(c.grossWeight) : null, tareWeight: c.tareWeight != null ? Number(c.tareWeight) : null, status: c.status })),
    custody: j.custodyEvents.map((e: any) => ({ type: e.type, occurredAt: e.occurredAt, container: e.container?.label ?? '', facility: e.facility?.name ?? '', actor: e.actor?.name || e.actorName, signerName: e.signerName, location: e.locationText, notes: e.notes })),
    summary: { assets: assets.length, dataBearing: assets.filter((a: any) => a.isDataBearing).length, sanitized: assets.filter((a: any) => ['passed', 'destroyed'].includes(a.sanitizationStatus)).length, reused: assets.filter((a: any) => ['resale', 'parts'].includes(a.disposition)).length, recycled: assets.filter((a: any) => a.disposition === 'recycle').length },
    certificates: j.certificates.map((c: any) => ({ certificateNumber: c.certificateNumber, type: c.type, status: c.status, issuedAt: c.issuedAt, verificationCode: c.verificationCode, revokedReason: c.revokedReason })),
    settlement: showSettlement ? { settlementNumber: j.settlement.settlementNumber, status: j.settlement.status, feesTotalMinor: j.settlement.feesTotalMinor, clientShareTotalMinor: j.settlement.clientShareTotalMinor, netMinor: j.settlement.netMinor, publishedAt: j.settlement.publishedAt, paidAt: j.settlement.paidAt, payoutMethod: j.settlement.payoutMethod } : null,
  }
}
