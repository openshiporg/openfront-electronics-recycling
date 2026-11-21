import { createHash } from 'node:crypto'
import { createTransport } from 'nodemailer'
import { fail, type Ctx, type Tx } from './core'

// ---------------------------------------------------------------- settings

export type Settings = Record<string, any> & {
  businessName: string
  timezone: string
  currencyCode: string
}

/** The singleton; created with working defaults the first time it is read. */
export async function getSettings(db: Tx): Promise<Settings> {
  const existing = await db.storeSettings.findFirst()
  if (existing) return existing
  return db.storeSettings.create({ data: {} })
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

function smtpConfig(settings: Settings) {
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
  for (const userId of [...new Set(input.userIds.filter(Boolean))]) {
    const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${userId}` : null
    if (dedupeKey) {
      const exists = await tx.notification.findUnique({ where: { dedupeKey }, select: { id: true } })
      if (exists) continue
    }
    await tx.notification.create({
      data: { userId, type: input.type, title: input.title, body: input.body, link: input.link ?? '', dedupeKey, emailStatus: configured ? 'queued' : 'skipped' },
    })
  }
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
export async function deliverPendingEmail(context: Pick<Ctx, 'prisma'>) {
  if (delivering) return
  delivering = true
  try {
    const settings = await getSettings(context.prisma)
    const smtp = smtpConfig(settings)
    if (!smtp) return
    const pending = await context.prisma.notification.findMany({ where: { emailStatus: 'queued' }, take: 50, orderBy: { createdAt: 'asc' }, include: { user: { select: { email: true, name: true } } } })
    if (!pending.length) return
    const transport = createTransport({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined })
    const base = (process.env.SMTP_STORE_LINK || settings.storefrontUrl || '').replace(/\/$/, '')
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

export function afterCommit(context: Pick<Ctx, 'prisma'>) {
  void deliverPendingEmail(context)
}
