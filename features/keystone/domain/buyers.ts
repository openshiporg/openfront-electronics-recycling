import { audit, dbNow, fail, inTransaction, lockRow, requireBuyer, str, type Ctx, type Tx } from '../lib/core'
import { afterCommit, companyUsers, getSettings, notify, staffWith, storeUpload, type FileInput } from '../lib/services'

// Buyer company lifecycle (§3.1).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BUSINESS_TYPES = ['refurbisher', 'reseller', 'exporter', 'recycler', 'broker', 'other']
const SPEND_BANDS = ['under_5k', 'from_5k_to_25k', 'from_25k_to_100k', 'over_100k']
const DOC_TYPES = ['resale_certificate', 'export_license', 'business_registration', 'w9', 'r2_certificate', 'other']

/** P7: create a buyer login and its draft company. */
export async function registerBuyer(context: Ctx, args: { name: string; email: string; password: string; phone?: string; legalName: string; countryCode?: string }) {
  const name = str(args.name, 120)
  const email = str(args.email, 200).toLowerCase()
  const legalName = str(args.legalName, 200)
  if (!name) fail('Enter your name.')
  if (!EMAIL.test(email)) fail('Enter a valid email address.')
  if (String(args.password || '').length < 10) fail('Use a password of at least 10 characters.')
  if (!legalName) fail("Enter your company's legal name.")
  const existing = await context.prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) fail('An account with this email already exists. Sign in instead.')
  const company = await context.prisma.buyerCompany.create({ data: { legalName, countryCode: str(args.countryCode, 2).toUpperCase() || 'US', status: 'draft', phone: str(args.phone, 40) } })
  const user = await context.sudo().db.User.createOne({
    data: { name, email, password: String(args.password), phone: str(args.phone, 40), kind: 'buyer', buyerRole: 'admin', buyerCompany: { connect: { id: company.id } } },
  })
  await audit(context.prisma, { actorId: user.id, action: 'buyer.registered', entityType: 'BuyerCompany', entityId: company.id })
  return { userId: user.id, companyId: company.id }
}

export async function saveBuyerApplication(context: Ctx, input: Record<string, any>) {
  const { companyId, user } = await requireBuyer(context, { admin: true })
  return inTransaction(context, async (tx) => {
    await lockRow(tx, 'BuyerCompany', companyId)
    const company = await tx.buyerCompany.findUnique({ where: { id: companyId } })
    if (!['draft', 'needs_info', 'rejected'].includes(company.status)) fail('Your application is with our team. Email us to change it.')
    const data: Record<string, any> = {}
    for (const key of ['legalName', 'tradingName', 'addressLine1', 'addressLine2', 'city', 'region', 'postalCode', 'phone', 'website', 'taxId']) {
      if (input[key] !== undefined) data[key] = str(input[key], 200)
    }
    if (input.countryCode !== undefined) data.countryCode = str(input.countryCode, 2).toUpperCase()
    if (input.businessType !== undefined) data.businessType = BUSINESS_TYPES.includes(input.businessType) ? input.businessType : null
    if (input.monthlySpendBand !== undefined) data.monthlySpendBand = SPEND_BANDS.includes(input.monthlySpendBand) ? input.monthlySpendBand : null
    if (Array.isArray(input.destinationCountries)) data.destinationCountries = input.destinationCountries.map((c: unknown) => str(c, 2).toUpperCase()).filter(Boolean).slice(0, 50)
    if (Array.isArray(input.categoryIds)) {
      const ids = input.categoryIds.map((c: unknown) => str(c, 60)).filter(Boolean).slice(0, 50)
      data.categoriesOfInterest = { set: ids.map((id: string) => ({ id })) }
    }
    if (data.legalName === '') fail("Your company's legal name cannot be empty.")
    const updated = await tx.buyerCompany.update({ where: { id: companyId }, data })
    await audit(tx, { actorId: user.id, action: 'buyer.application_saved', entityType: 'BuyerCompany', entityId: companyId })
    return updated
  })
}

export async function uploadBuyerDocument(context: Ctx, args: { type: string; file: FileInput; state?: string; expiresOn?: string }) {
  const { companyId, user } = await requireBuyer(context, { admin: true })
  const type = DOC_TYPES.includes(args.type) ? args.type : fail('Choose the document type.')
  const company = await context.prisma.buyerCompany.findUnique({ where: { id: companyId }, select: { status: true } })
  if (!['draft', 'needs_info', 'rejected', 'submitted'].includes(company.status)) fail('Email a new document to our team; they will add it to your account.')
  return inTransaction(context, async (tx) => {
    const stored = await storeUpload(tx, args.file, { purpose: 'buyer_document', ownerBuyerCompanyId: companyId, uploadedById: user.id })
    if (!stored) fail('Choose a file to upload.')
    const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(str(args.expiresOn, 10)) ? new Date(`${args.expiresOn}T00:00:00Z`) : null
    return tx.buyerDocument.create({ data: { companyId, type, fileId: stored.id, state: str(args.state, 2).toUpperCase(), expiresOn, status: 'submitted', uploadedById: user.id } })
  })
}

export async function submitBuyerApplication(context: Ctx, args: { acceptTermsVersion: string }) {
  const { companyId, user } = await requireBuyer(context, { admin: true })
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'BuyerCompany', companyId)
    const settings = await getSettings(tx)
    const company = await tx.buyerCompany.findUnique({ where: { id: companyId }, include: { documents: true } })
    if (company.status === 'rejected' && company.rejectedAt) {
      const now = await dbNow(tx)
      if (now.getTime() - new Date(company.rejectedAt).getTime() < 30 * 86_400_000) fail('You can apply again 30 days after the decision.')
    } else if (!['draft', 'needs_info'].includes(company.status)) fail('Your application is already with our team.')
    const missing = ['legalName', 'addressLine1', 'city', 'postalCode', 'countryCode', 'phone'].filter((k) => !company[k])
    if (!company.businessType) missing.push('business type')
    if (missing.length) fail(`Fill in: ${missing.join(', ')}.`)
    if (!company.documents.some((d: any) => d.status !== 'rejected')) fail('Upload at least one document, such as a resale certificate or business registration.')
    if (str(args.acceptTermsVersion, 40) !== settings.wholesaleTermsVersion) fail('Read and accept the current wholesale terms.')
    const now = await dbNow(tx)
    await tx.user.update({ where: { id: user.id }, data: { acceptedTermsVersion: settings.wholesaleTermsVersion, acceptedTermsAt: now } })
    const updated = await tx.buyerCompany.update({ where: { id: companyId }, data: { status: 'submitted', submittedAt: now, termsVersionAccepted: settings.wholesaleTermsVersion, termsAcceptedAt: now } })
    await notify(tx, { userIds: await staffWith(tx, 'canManageBuyers'), type: 'buyer_submitted', title: `New buyer application: ${company.legalName}`, body: `${company.legalName} applied to buy. Review their documents.`, link: `/dashboard/platform/buyers/${companyId}` })
    await audit(tx, { actorId: user.id, action: 'buyer.submitted', entityType: 'BuyerCompany', entityId: companyId, before: { status: company.status }, after: { status: 'submitted' } })
    return updated
  })
  afterCommit(context)
  return result
}

export async function replyToBuyerMessage(context: Ctx, args: { body: string }) {
  const { companyId, user } = await requireBuyer(context)
  const body = str(args.body, 4000)
  if (!body) fail('Write a reply.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'BuyerCompany', companyId)
    const company = await tx.buyerCompany.findUnique({ where: { id: companyId } })
    const message = await tx.buyerMessage.create({ data: { companyId, authorId: user.id, body, fromStaff: false } })
    if (company.status === 'needs_info') {
      await tx.buyerCompany.update({ where: { id: companyId }, data: { status: 'submitted', submittedAt: new Date() } })
      await audit(tx, { actorId: user.id, action: 'buyer.replied', entityType: 'BuyerCompany', entityId: companyId, before: { status: 'needs_info' }, after: { status: 'submitted' } })
    }
    await notify(tx, { userIds: await staffWith(tx, 'canManageBuyers'), type: 'buyer_message', title: `Reply from ${company.legalName}`, body: body.slice(0, 500), link: `/dashboard/platform/buyers/${companyId}` })
    return message
  })
  afterCommit(context)
  return result
}

export async function acceptWholesaleTerms(context: Ctx, args: { version: string }) {
  const { user, companyId } = await requireBuyer(context)
  const settings = await getSettings(context.prisma)
  if (str(args.version, 40) !== settings.wholesaleTermsVersion) fail('The terms changed again. Reload and read the current version.')
  const now = new Date()
  await context.prisma.user.update({ where: { id: user.id }, data: { acceptedTermsVersion: settings.wholesaleTermsVersion, acceptedTermsAt: now } })
  if (user.buyerRole === 'admin') await context.prisma.buyerCompany.update({ where: { id: companyId }, data: { termsVersionAccepted: settings.wholesaleTermsVersion, termsAcceptedAt: now } })
  await audit(context.prisma, { actorId: user.id, action: 'buyer.terms_accepted', entityType: 'User', entityId: user.id, after: { version: settings.wholesaleTermsVersion } })
  return { version: settings.wholesaleTermsVersion }
}

/** S1: open, approve, request information, reject. */
export async function reviewBuyerApplication(context: Ctx, args: { companyId: string; action: string; message?: string; taxStatus?: string; spendLimitMinor?: number | null }) {
  const staffId = context.session!.itemId
  const action = str(args.action, 20)
  const message = str(args.message, 4000)
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'BuyerCompany', args.companyId) || fail('Buyer not found.')
    const company = await tx.buyerCompany.findUnique({ where: { id: args.companyId } })
    const from = company.status
    const allowed: Record<string, string[]> = { open: ['submitted'], approve: ['submitted', 'under_review'], request_info: ['submitted', 'under_review'], reject: ['submitted', 'under_review', 'needs_info'] }
    if (!allowed[action]) fail('Choose open, approve, request information or reject.')
    if (!allowed[action].includes(from)) fail(`An application that is ${from.replace(/_/g, ' ')} cannot be moved that way.`)
    if ((action === 'request_info' || action === 'reject') && !message) fail('Write a message to the buyer.')
    const now = await dbNow(tx)
    const data: Record<string, any> = {}
    if (action === 'open') data.status = 'under_review'
    if (action === 'approve') {
      data.status = 'approved'
      data.approvedAt = now
      data.approvedById = staffId
      data.statusReason = ''
      if (args.taxStatus) data.taxStatus = ['taxable', 'exempt_resale', 'export'].includes(args.taxStatus) ? args.taxStatus : fail('Choose a tax status.')
      if (args.spendLimitMinor !== undefined) data.spendLimitMinor = args.spendLimitMinor == null ? null : Math.max(0, Math.round(Number(args.spendLimitMinor)))
    }
    if (action === 'request_info') {
      data.status = 'needs_info'
      data.statusReason = message
    }
    if (action === 'reject') {
      data.status = 'rejected'
      data.statusReason = message
      data.rejectedAt = now
    }
    const updated = await tx.buyerCompany.update({ where: { id: company.id }, data })
    if (message) await tx.buyerMessage.create({ data: { companyId: company.id, authorId: staffId, body: message, fromStaff: true } })
    const text: Record<string, [string, string]> = {
      approve: ['Your buyer account is approved', `${company.legalName} is approved to bid. Browse the open lots.`],
      request_info: ['We need more information', `Before we can approve ${company.legalName}: ${message}`],
      reject: ['Your buyer application', `We cannot approve ${company.legalName} at this time: ${message}`],
    }
    if (text[action]) await notify(tx, { userIds: await companyUsers(tx, company.id), type: `buyer_${action}`, title: text[action][0], body: text[action][1], link: action === 'approve' ? '/lots' : '/buyer' })
    await audit(tx, { actorId: staffId, action: `buyer.${action}`, entityType: 'BuyerCompany', entityId: company.id, before: { status: from }, after: { status: data.status ?? from, taxStatus: updated.taxStatus, spendLimitMinor: updated.spendLimitMinor }, reason: message })
    return updated
  })
  afterCommit(context)
  return result
}

/** Voids the company's active bids on open lots and recomputes those lots (§3.1). */
export async function voidCompanyBids(tx: Tx, companyId: string, reason: string) {
  const bids = await tx.bid.findMany({ where: { companyId, status: 'active', lot: { status: { in: ['open', 'scheduled'] } } }, select: { id: true, lotId: true } })
  const lotIds = [...new Set(bids.map((b: any) => b.lotId))] as string[]
  for (const lotId of lotIds.sort()) {
    await lockRow(tx, 'Lot', lotId)
    await tx.bid.updateMany({ where: { lotId, companyId, status: 'active' }, data: { status: 'void', activeKey: null, staffNote: reason } })
    await refreshLotHigh(tx, lotId)
  }
  return bids.length
}

export async function refreshLotHigh(tx: Tx, lotId: string) {
  const top = await tx.bid.findFirst({ where: { lotId, status: 'active' }, orderBy: [{ amountMinor: 'desc' }, { submittedAt: 'asc' }] })
  const count = await tx.bid.count({ where: { lotId, status: 'active' } })
  await tx.lot.update({ where: { id: lotId }, data: { currentAmountMinor: top?.amountMinor ?? null, bidCount: count } })
}

export async function suspendCompany(tx: Tx, companyId: string, reason: string, actorId: string | null) {
  const company = await tx.buyerCompany.findUnique({ where: { id: companyId } })
  if (company.status !== 'approved') fail('Only an approved buyer can be suspended.')
  await tx.buyerCompany.update({ where: { id: companyId }, data: { status: 'suspended', statusReason: reason } })
  const voided = await voidCompanyBids(tx, companyId, `Voided: buyer suspended (${reason})`)
  await notify(tx, { userIds: await companyUsers(tx, companyId), type: 'buyer_suspended', title: 'Your buyer account is suspended', body: `${company.legalName} cannot bid until reinstated: ${reason}. Open orders can still be paid.`, link: '/buyer' })
  await audit(tx, { actorId, action: 'buyer.suspended', entityType: 'BuyerCompany', entityId: companyId, before: { status: 'approved' }, after: { status: 'suspended', voidedBids: voided }, reason })
  return voided
}

export async function suspendBuyer(context: Ctx, args: { companyId: string; reason: string }) {
  const reason = str(args.reason, 500) || fail('Write the reason for the suspension.')
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'BuyerCompany', args.companyId) || fail('Buyer not found.')
    await suspendCompany(tx, args.companyId, reason, context.session!.itemId)
    return tx.buyerCompany.findUnique({ where: { id: args.companyId } })
  })
  afterCommit(context)
  return result
}

export async function reinstateBuyer(context: Ctx, args: { companyId: string; note?: string; resetStrikes?: boolean }) {
  const result = await inTransaction(context, async (tx) => {
    await lockRow(tx, 'BuyerCompany', args.companyId) || fail('Buyer not found.')
    const company = await tx.buyerCompany.findUnique({ where: { id: args.companyId } })
    if (company.status !== 'suspended') fail('Only a suspended buyer can be reinstated.')
    const updated = await tx.buyerCompany.update({ where: { id: company.id }, data: { status: 'approved', statusReason: '', ...(args.resetStrikes ? { strikes: 0 } : {}) } })
    await notify(tx, { userIds: await companyUsers(tx, company.id), type: 'buyer_reinstated', title: 'Your buyer account is active again', body: `${company.legalName} can bid again.`, link: '/lots' })
    await audit(tx, { actorId: context.session!.itemId, action: 'buyer.reinstated', entityType: 'BuyerCompany', entityId: company.id, before: { status: 'suspended' }, after: { status: 'approved' }, reason: str(args.note, 500) })
    return updated
  })
  afterCommit(context)
  return result
}

/** S5: accept or reject a document; an accepted resale certificate makes the company tax-exempt. */
export async function reviewBuyerDocument(context: Ctx, args: { documentId: string; status: string; note?: string; expiresOn?: string | null }) {
  const status = ['accepted', 'rejected'].includes(args.status) ? args.status : fail('Choose accept or reject.')
  return inTransaction(context, async (tx) => {
    const doc = await tx.buyerDocument.findUnique({ where: { id: str(args.documentId, 60) } })
    if (!doc) fail('Document not found.')
    await lockRow(tx, 'BuyerCompany', doc.companyId)
    const expiresOn = args.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(args.expiresOn) ? new Date(`${args.expiresOn}T00:00:00Z`) : doc.expiresOn
    const updated = await tx.buyerDocument.update({ where: { id: doc.id }, data: { status, reviewNote: str(args.note, 500), expiresOn } })
    if (status === 'accepted' && doc.type === 'resale_certificate') {
      const company = await tx.buyerCompany.findUnique({ where: { id: doc.companyId } })
      if (company.taxStatus === 'taxable' && (!expiresOn || expiresOn > new Date())) await tx.buyerCompany.update({ where: { id: doc.companyId }, data: { taxStatus: 'exempt_resale' } })
    }
    await audit(tx, { actorId: context.session!.itemId, action: `buyer_document.${status}`, entityType: 'BuyerDocument', entityId: doc.id, reason: str(args.note, 500) })
    return updated
  })
}

/** Staff message to a buyer, shown on their account home and emailed. */
export async function messageBuyer(context: Ctx, args: { companyId: string; body: string }) {
  const body = str(args.body, 4000) || fail('Write a message.')
  const result = await inTransaction(context, async (tx) => {
    const company = await tx.buyerCompany.findUnique({ where: { id: args.companyId } })
    if (!company) fail('Buyer not found.')
    const message = await tx.buyerMessage.create({ data: { companyId: company.id, authorId: context.session!.itemId, body, fromStaff: true } })
    await notify(tx, { userIds: await companyUsers(tx, company.id), type: 'buyer_message', title: `Message from ${(await getSettings(tx)).businessName}`, body, link: '/buyer' })
    return message
  })
  afterCommit(context)
  return result
}

/** BuyerDocument expiry (§4.8): an expired resale certificate makes the company taxable. Called by the clock. */
export async function expireBuyerDocuments(context: Pick<Ctx, 'prisma'>, now: Date) {
  const due = await context.prisma.buyerDocument.findMany({ where: { status: 'accepted', expiresOn: { lte: now }, expiryHandledAt: null }, take: 50 })
  for (const doc of due) {
    await context.prisma.$transaction(async (tx: Tx) => {
      await lockRow(tx, 'BuyerCompany', doc.companyId)
      const claimed = await tx.buyerDocument.updateMany({ where: { id: doc.id, expiryHandledAt: null }, data: { expiryHandledAt: now } })
      if (!claimed.count) return
      if (doc.type !== 'resale_certificate') return
      const others = await tx.buyerDocument.count({ where: { companyId: doc.companyId, type: 'resale_certificate', status: 'accepted', OR: [{ expiresOn: null }, { expiresOn: { gt: now } }] } })
      const company = await tx.buyerCompany.findUnique({ where: { id: doc.companyId } })
      if (!others && company.taxStatus === 'exempt_resale') {
        await tx.buyerCompany.update({ where: { id: doc.companyId }, data: { taxStatus: 'taxable' } })
        await notify(tx, { userIds: await companyUsers(tx, doc.companyId), type: 'resale_certificate_expired', title: 'Your resale certificate has expired', body: 'Sales tax will be added to new invoices until you send us a current resale certificate.', link: '/buyer' })
        await audit(tx, { action: 'buyer.tax_status_expired', entityType: 'BuyerCompany', entityId: doc.companyId, before: { taxStatus: 'exempt_resale' }, after: { taxStatus: 'taxable' } })
      }
    })
  }
}
