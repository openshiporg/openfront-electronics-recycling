import { createHash } from 'node:crypto'
import { createTransport } from 'nodemailer'
import { cleanSiteUrl, fail, requestOrigin, type Ctx, type Tx } from './core'
import { formatMinor } from './rules/money'

// ---------------------------------------------------------------- settings

export type Settings = Record<string, any> & {
  businessName: string
  timezone: string
  currencyCode: string
}

/** The singleton; created with working defaults the first time it is read. */
export async function getSettings(db: Tx): Promise<Settings> {
  const existing = await db.storeSettings.findUnique({ where: { id: 1 } })
  if (existing) return existing
  // Singleton row id 1; upsert so two first requests at once do not collide.
  return db.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
}

/** Money for people to read, in the store currency: "$17,300.00". Every message and notice uses this. */
export async function moneyText(db: Tx, minor: number | null | undefined) {
  const settings = await getSettings(db)
  return formatMinor(minor, settings.currencyCode || 'USD')
}

// ---------------------------------------------------------------- site address

let signedInOrigin = ''

/**
 * Base for links in email, notices and PDFs: Settings.storefrontUrl (onboarding sets it from its own
 * request), else the origin of the current staff request, else the last staff origin this server saw.
 * Only staff requests count: a link can go to someone else (an outbid notice, a reset email), so the
 * Host header of a buyer's or an anonymous request must never decide where it points.
 */
export async function siteBase(db: Tx, context?: Pick<Ctx, 'req' | 'session'> | null) {
  const settings = await getSettings(db)
  const saved = cleanSiteUrl(settings.storefrontUrl)
  if (context) await noteRequestOrigin({ prisma: db, req: context.req, session: context.session })
  return saved || signedInOrigin
}

/** Remembers the origin of a staff request, so the clock and the email sender have a base too. */
export async function noteRequestOrigin(context: Pick<Ctx, 'prisma' | 'req' | 'session'>) {
  const session: any = context.session
  if (session?.data?.kind === 'staff' && session?.data?.role?.canAccessDashboard) {
    const origin = requestOrigin(context)
    if (origin) signedInOrigin = origin
  }
}

// ---------------------------------------------------------------- files

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/csv|text\/plain|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream|application\/xml|text\/xml)$/

export type FileInput = { filename: string; mimeType: string; base64: string }

export function decodeUpload(file: FileInput | null | undefined) {
  if (!file || !file.base64) return null
  const filename = String(file.filename || 'upload').replace(/[^\w.\- ]+/g, '_').slice(0, 160)
  const mimeType = String(file.mimeType || 'application/octet-stream').toLowerCase()
  if (!ALLOWED_TYPES.test(mimeType)) fail('That file type is not accepted. Use PDF, an image, Excel or CSV.')
  const bytes = Buffer.from(String(file.base64), 'base64')
  if (!bytes.length) fail('The file is empty.')
  if (bytes.length > MAX_UPLOAD_BYTES) fail('Files must be 10 MB or smaller.')
  return { filename, mimeType, bytes }
}

export async function storeFile(db: Tx, input: { filename: string; mimeType: string; bytes: Buffer | Uint8Array; purpose: string; visibility?: 'public' | 'private'; ownerBuyerCompanyId?: string | null; ownerClientOrganizationId?: string | null; uploadedById?: string | null }) {
  const bytes = Buffer.from(input.bytes)
  return db.storedFile.create({
    data: {
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      purpose: input.purpose,
      visibility: input.visibility ?? 'private',
      ownerBuyerCompanyId: input.ownerBuyerCompanyId ?? '',
      ownerClientOrganizationId: input.ownerClientOrganizationId ?? '',
      uploadedById: input.uploadedById ?? null,
      data: bytes.toString('base64'),
    },
    select: { id: true, filename: true },
  })
}

export async function storeUpload(db: Tx, file: FileInput | null | undefined, meta: Omit<Parameters<typeof storeFile>[1], 'filename' | 'mimeType' | 'bytes'>) {
  const decoded = decodeUpload(file)
  if (!decoded) return null
  return storeFile(db, { ...decoded, ...meta })
}

export async function readFileBytes(db: Tx, id: string) {
  const row = await db.storedFile.findUnique({ where: { id } })
  if (!row) return null
  return { ...row, bytes: Buffer.from(row.data || '', 'base64') }
}

export function fileUrl(id: string | null | undefined) {
  return id ? `/api/files/${id}` : null
}

export function asDownload(filename: string, mimeType: string, bytes: Buffer | Uint8Array) {
  return { filename, mimeType, base64: Buffer.from(bytes).toString('base64') }
}

// ---------------------------------------------------------------- notifications and email

export function smtpConfig(settings: Settings) {
  const host = process.env.SMTP_HOST || settings.smtpHost
  if (!host) return null
  return {
    host,
    port: Number(process.env.SMTP_PORT || settings.smtpPort || 587),
    user: process.env.SMTP_USER || settings.smtpUser || '',
    pass: process.env.SMTP_PASSWORD || settings.smtpPassword || '',
    from: process.env.SMTP_FROM || settings.smtpFrom || settings.supportEmail || '',
  }
}

export async function emailConfigured(db: Tx) {
  return Boolean(smtpConfig(await getSettings(db)))
}

export type NotifyInput = { userIds: string[]; type: string; title: string; body: string; link?: string; dedupeKey?: string }

/**
 * Writes Notification rows inside the caller's transaction. Email goes out after
 * commit through deliverPendingEmail; without SMTP the row is kept as `skipped`
 * and the person still sees the result on their account pages.
 */
export async function notify(tx: Tx, input: NotifyInput) {
  const settings = await getSettings(tx)
  const configured = Boolean(smtpConfig(settings))
  const userIds = [...new Set(input.userIds.filter(Boolean))]
  if (!userIds.length) return
  // One insert for every recipient: a notice to all staff must not cost a round trip each inside a lock.
  // dedupeKey is unique, so a repeat of the same notice is skipped per user.
  await tx.notification.createMany({
    data: userIds.map((userId) => ({ userId, type: input.type, title: input.title, body: input.body, link: input.link ?? '', dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null, emailStatus: configured ? 'queued' : 'skipped' })),
    skipDuplicates: true,
  })
}

export async function staffWith(tx: Tx, permission: string) {
  const users = await tx.user.findMany({ where: { kind: 'staff', isActive: true, role: { [permission]: true } }, select: { id: true } })
  return users.map((u: any) => u.id)
}

export async function companyUsers(tx: Tx, companyId: string) {
  const users = await tx.user.findMany({ where: { buyerCompanyId: companyId, isActive: true }, select: { id: true } })
  return users.map((u: any) => u.id)
}

export async function organizationUsers(tx: Tx, organizationId: string) {
  const users = await tx.user.findMany({ where: { clientOrganizationId: organizationId, isActive: true }, select: { id: true } })
  return users.map((u: any) => u.id)
}

let delivering = false

/** Sends queued notification email. Called after commits and by the ticker. */
export async function deliverPendingEmail(context: Pick<Ctx, 'prisma'> & Partial<Pick<Ctx, 'req' | 'session'>>) {
  if (delivering) return
  delivering = true
  try {
    const settings = await getSettings(context.prisma)
    const smtp = smtpConfig(settings)
    if (!smtp) return
    const pending = await context.prisma.notification.findMany({ where: { emailStatus: 'queued' }, take: 50, orderBy: { createdAt: 'asc' }, include: { user: { select: { email: true, name: true } } } })
    if (!pending.length) return
    const transport = createTransport({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined })
    const base = await siteBase(context.prisma, context)
    for (const n of pending) {
      const claimed = await context.prisma.notification.updateMany({ where: { id: n.id, emailStatus: 'queued' }, data: { emailStatus: 'sent' } })
      if (!claimed.count) continue
      try {
        if (!n.user?.email) throw new Error('No email address')
        const link = n.link ? `${base}${n.link}` : ''
        await transport.sendMail({
          from: smtp.from ? `${settings.businessName} <${smtp.from}>` : undefined,
          to: n.user.email,
          subject: n.title,
          text: `${n.body}${link ? `\n\n${link}` : ''}\n\n${settings.businessName}`,
        })
      } catch (error) {
        await context.prisma.notification.update({ where: { id: n.id }, data: { emailStatus: 'failed', emailError: String((error as Error).message || error).slice(0, 300) } })
      }
    }
  } catch (error) {
    console.error('[email]', error)
  } finally {
    delivering = false
  }
}

export function afterCommit(context: Pick<Ctx, 'prisma'> & Partial<Pick<Ctx, 'req' | 'session'>>) {
  void deliverPendingEmail(context)
}
