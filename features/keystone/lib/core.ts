import { createHash, randomBytes } from 'node:crypto'
import { hasPermission, type RolePermission, type Session } from '../access'

/** A refusal whose message is written for the person who asked. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export function fail(message: string): never {
  throw new DomainError(message)
}

export type Tx = any
export type Ctx = { prisma: any; session?: Session | null; req?: any; sudo(): any }

export function sessionOf(context: Ctx): Session | null {
  return (context.session as Session | undefined) ?? null
}

export function requireStaff(context: Ctx, ...anyOf: RolePermission[]): Session {
  const session = sessionOf(context)
  if (!session) fail('Sign in to continue.')
  if (!hasPermission(session, 'canAccessDashboard')) fail('Your account cannot use the dashboard.')
  if (anyOf.length && !anyOf.some((p) => hasPermission(session, p))) fail('Your role does not allow this.')
  return session
}

export function canStaff(context: Ctx, permission: RolePermission) {
  return hasPermission(sessionOf(context), permission)
}

/** The signed-in buyer and their company, read fresh from the database. */
export async function requireBuyer(context: Ctx, options: { admin?: boolean } = {}) {
  const session = sessionOf(context)
  if (!session) fail('Sign in to continue.')
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, name: true, email: true, kind: true, isActive: true, buyerRole: true, buyerCompanyId: true, acceptedTermsVersion: true },
  })
  if (!user || user.kind !== 'buyer' || !user.isActive) fail('This page is for buyer accounts.')
  if (!user.buyerCompanyId) fail('Your account is not linked to a buyer company.')
  if (options.admin && user.buyerRole !== 'admin') fail('Only your company admin can do this.')
  return { session, user, companyId: user.buyerCompanyId as string }
}

export async function requireClient(context: Ctx, options: { admin?: boolean } = {}) {
  const session = sessionOf(context)
  if (!session) fail('Sign in to continue.')
  const user = await context.prisma.user.findUnique({
    where: { id: session.itemId },
    select: { id: true, name: true, email: true, kind: true, isActive: true, clientRole: true, clientOrganizationId: true },
  })
  if (!user || user.kind !== 'client' || !user.isActive) fail('This page is for client accounts.')
  if (!user.clientOrganizationId) fail('Your account is not linked to an organisation.')
  if (options.admin && user.clientRole !== 'admin') fail('Only your organisation admin can do this.')
  return { session, user, organizationId: user.clientOrganizationId as string }
}

/** Bulk commands over many rows (a pallet of assets, a whole lot) get a longer timeout. */
export const BULK = { timeout: 180_000 }

/** Run a command in one transaction. Postgres row locks order competing writers. */
export async function inTransaction<T>(context: Ctx, fn: (tx: Tx) => Promise<T>, options: { timeout?: number } = {}): Promise<T> {
  return context.prisma.$transaction(fn, { timeout: options.timeout ?? 20_000, maxWait: 10_000 })
}

const LOCKABLE = new Set([
  'Lot', 'Bid', 'Award', 'Order', 'Invoice', 'Payment', 'PaymentSession', 'BuyerCompany', 'Asset', 'Job', 'Container',
  'Facility', 'Certificate', 'Settlement', 'Claim', 'OutboundShipment', 'ManifestImport', 'ErasureImport', 'SaleEvent', 'DockAppointment', 'Refund',
])

/** SELECT ... FOR UPDATE on one row; returns false when the row does not exist. */
export async function lockRow(tx: Tx, table: string, id: string) {
  if (!LOCKABLE.has(table)) throw new Error(`Table ${table} is not lockable.`)
  const rows = await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`, id)
  return Array.isArray(rows) && rows.length > 0
}

export async function dbNow(tx: Tx): Promise<Date> {
  const rows = await tx.$queryRawUnsafe('SELECT now() AS now')
  return new Date(rows[0].now)
}

const SEQUENCES: Record<string, { seq: string; format: (n: number, year: number) => string }> = {
  job: { seq: 'job_number_seq', format: (n) => `JOB-${String(n).padStart(6, '0')}` },
  lot: { seq: 'lot_number_seq', format: (n, y) => `L-${y}-${String(n).padStart(4, '0')}` },
  order: { seq: 'order_number_seq', format: (n) => `SO-${String(n).padStart(6, '0')}` },
  invoice: { seq: 'invoice_number_seq', format: (n) => `INV-${String(n).padStart(6, '0')}` },
  certificate: { seq: 'certificate_number_seq', format: (n, y) => `CERT-${y}-${String(n).padStart(5, '0')}` },
  settlement: { seq: 'settlement_number_seq', format: (n) => `SET-${String(n).padStart(6, '0')}` },
  claim: { seq: 'claim_number_seq', format: (n) => `CLM-${String(n).padStart(5, '0')}` },
  shipment: { seq: 'shipment_number_seq', format: (n) => `OUT-${String(n).padStart(5, '0')}` },
  asset: { seq: 'asset_number_seq', format: (n) => `A-${String(n).padStart(7, '0')}` },
}
export type NumberKind = keyof typeof SEQUENCES

/** The next document number from a database sequence (created by the migration). */
export async function nextNumber(db: Tx, kind: NumberKind) {
  const spec = SEQUENCES[kind]
  const rows = await db.$queryRawUnsafe(`SELECT nextval('${spec.seq}')::int AS n, extract(year from now())::int AS y`)
  return spec.format(Number(rows[0].n), Number(rows[0].y))
}

export const SEQUENCE_NAMES = Object.values(SEQUENCES).map((s) => s.seq)

export async function audit(tx: Tx, input: { actorId?: string | null; actorLabel?: string; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown; reason?: string | null; ipAddress?: string | null }) {
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel ?? (input.actorId ? '' : 'System'),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: (input.before ?? null) as any,
      after: (input.after ?? null) as any,
      reason: input.reason ?? '',
      ipAddress: input.ipAddress ?? '',
      occurredAt: new Date(),
    },
  })
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonicalize(v)]))
  }
  return value
}

export function requestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

/**
 * Idempotency, adapted from Barbershop's CommandReceipt: the same key and payload
 * returns the stored result; the same key with a different payload is refused.
 */
export async function withCommandReceipt<T>(tx: Tx, input: { key?: string | null; eventType: string; aggregateType: string; aggregateId: string; actorId?: string | null; payload: unknown }, run: () => Promise<T>): Promise<T> {
  if (!input.key) return run()
  const key = String(input.key).slice(0, 200)
  if (key.length < 8) fail('The request key is too short.')
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'command-receipt', key)
  const payloadHash = requestHash({ eventType: input.eventType, aggregateId: input.aggregateId, payload: input.payload })
  const eventKey = `${input.eventType}:${input.actorId ?? 'anon'}:${key}`
  const existing = await tx.commandReceipt.findUnique({ where: { eventKey } })
  if (existing) {
    if (existing.payloadHash !== payloadHash) fail('This request was already sent with different details. Reload and try again.')
    return existing.result as T
  }
  const result = await run()
  await tx.commandReceipt.create({
    data: {
      eventKey,
      eventType: input.eventType,
      schemaVersion: 1,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorId: input.actorId ?? '',
      payload: input.payload as any,
      result: JSON.parse(JSON.stringify(result ?? null)),
      payloadHash,
      occurredAt: new Date(),
    },
  })
  return result
}

/** 12 characters from an unambiguous alphabet, 60 bits of entropy. */
export function verificationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(12)
  let out = ''
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

export function clientIp(context: Ctx) {
  const req = context.req
  const forwarded = req?.headers?.['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return String(value || req?.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64)
}

export function userAgent(context: Ctx) {
  return String(context.req?.headers?.['user-agent'] || '').slice(0, 300)
}

/** Resolvers return { success, error, data } so callers show the refusal. */
export async function command<T>(fn: () => Promise<T>): Promise<{ success: boolean; error: string | null; data: T | null }> {
  try {
    return { success: true, error: null, data: await fn() }
  } catch (error) {
    if (error instanceof DomainError || (error as Error)?.name === 'RuleError') return { success: false, error: (error as Error).message, data: null }
    const code = (error as any)?.code
    if (code === 'P2002') return { success: false, error: 'This was already done. Reload to see the latest state.', data: null }
    if (code === 'P2034' || code === 'P2028') return { success: false, error: 'Another change was saved at the same moment. Try again.', data: null }
    console.error('[command]', error)
    return { success: false, error: 'Something went wrong. Nothing was changed.', data: null }
  }
}

export function str(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function int(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

export function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v && typeof v === 'object' && v.constructor?.name === 'Decimal' ? Number(v.toString()) : v)))
}
