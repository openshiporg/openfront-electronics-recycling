// Every 'account' operation, called by the wrong kind of caller (signed out, staff,
// a buyer on client ops, a client on buyer ops), comes back as a plain refusal:
// a REFUSED GraphQL error for queries or { success:false, error } for mutations.
// Never "Unexpected error." and never an internal message.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, root } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, OPERATIONS

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  OPERATIONS = require(path.join(root, 'features/keystone/mutations/operations.ts')).OPERATIONS
})
test.after(async () => { if (ctx) await ctx.disconnect() })

const CLIENT_OPS = new Set(['myJobs', 'myJob', 'acceptJobQuote', 'declineJobQuote', 'downloadCertificate', 'downloadSettlement', 'requestJob'])
const SHARED_OPS = new Set(['myInvoices', 'myInvoice', 'downloadInvoice', 'initiateInvoicePaymentSession', 'completeInvoicePayment', 'reportBankTransfer'])
// Staff also use these on a client's behalf (P-rows), so staff get a field error instead.
const STAFF_TOO = new Set(['requestJob'])
const PLAIN = /^(Sign in to continue\.|This page is for (buyer|client) accounts\.|This page is for buyer and client accounts\.|Invoice not found\.|Your account is not active\.)$/

async function call(context, name, op) {
  const field = op.kind === 'query' ? `query { ${name}(input: {}) }` : `mutation { ${name}(input: {}) { success error } }`
  const out = await context.graphql.raw({ query: field })
  if (op.kind === 'query') {
    assert.ok(out.errors?.length, `${name}: expected a refusal`)
    return { message: out.errors[0].message, code: out.errors[0].extensions?.code }
  }
  if (out.errors?.length) return { message: out.errors[0].message, code: out.errors[0].extensions?.code }
  assert.equal(out.data[name].success, false, `${name}: expected a refusal`)
  return { message: out.data[name].error, code: 'REFUSED' }
}

test('account operations refuse the wrong kind of caller with a plain message', { skip }, async () => {
  const staffCtx = await ctx.as((await f.staff(ctx.prisma)).id)
  const buyer = await f.buyer(ctx.prisma)
  const buyerCtx = await ctx.as(buyer.user.id)
  const org = await ctx.prisma.clientOrganization.create({ data: { name: `Access check ${f.key().slice(0, 6)}`, legalName: 'Access check LLC' } })
  const clientUser = await ctx.prisma.user.create({ data: { name: 'Client person', email: `client-${f.key().slice(0, 8)}@example.org`, password: 'not-used-here-123', kind: 'client', clientOrganizationId: org.id, clientRole: 'admin' } })
  const clientCtx = await ctx.as(clientUser.id)
  const anon = ctx.base

  const account = Object.entries(OPERATIONS).filter(([, op]) => op.access === 'account')
  assert.ok(account.length >= 30)
  const problems = []
  for (const [name, op] of account) {
    const callers = [['signed out', anon]]
    if (!STAFF_TOO.has(name)) callers.push(['staff', staffCtx])
    if (CLIENT_OPS.has(name)) callers.push(['buyer', buyerCtx])
    else if (!SHARED_OPS.has(name)) callers.push(['client', clientCtx])
    for (const [who, context] of callers) {
      const r = await call(context, name, op)
      if (r.code !== 'REFUSED' || !PLAIN.test(r.message)) problems.push(`${name} as ${who}: [${r.code}] ${r.message}`)
    }
  }
  assert.deepEqual(problems, [])
})

// S3 / T1: buyer and client managers add portal users of their own kind only.
test('a buyer manager can add a buyer user, never a staff account or a client user', { skip }, async () => {
  const manager = await ctx.as((await f.staff(ctx.prisma, ['canAccessDashboard', 'canManageBuyers'])).id)
  const { company } = await f.buyer(ctx.prisma)
  const uid = Math.random().toString(36).slice(2, 8)
  const create = (data) => manager.graphql.raw({ query: 'mutation($data: UserCreateInput!) { createUser(data: $data) { id kind } }', variables: { data } })
  const ok = await create({ name: 'New Bidder', email: `bidder-${uid}@northgate.example`, password: 'long-enough-1', kind: 'buyer', buyerRole: 'bidder', buyerCompany: { connect: { id: company.id } } })
  assert.equal(ok.errors, undefined, ok.errors?.[0]?.message)
  assert.equal(ok.data.createUser.kind, 'buyer')

  const asStaff = await create({ name: 'Sneaky', email: `staff-${uid}@recycler.example`, password: 'long-enough-1', kind: 'staff' })
  assert.ok(asStaff.errors?.length, 'staff account must be refused')
  const noCompany = await create({ name: 'Loose', email: `loose-${uid}@northgate.example`, password: 'long-enough-1', kind: 'buyer' })
  assert.ok(noCompany.errors?.length, 'buyer user without a company must be refused')
  const role = await ctx.prisma.role.create({ data: { name: `Owner ${uid}`, canAccessDashboard: true, canManageUsers: true } })
  const withRole = await create({ name: 'Escalate', email: `esc-${uid}@northgate.example`, password: 'long-enough-1', kind: 'buyer', buyerCompany: { connect: { id: company.id } }, role: { connect: { id: role.id } } })
  assert.ok(withRole.errors?.length, 'a staff role on a buyer user must be refused')
  const org = await ctx.prisma.clientOrganization.create({ data: { name: `Org ${uid}` } })
  const client = await create({ name: 'Client', email: `client-${uid}@org.example`, password: 'long-enough-1', kind: 'client', clientOrganization: { connect: { id: org.id } } })
  assert.ok(client.errors?.length, 'a buyer manager cannot add client users')

  // Edits reach buyer users, not staff.
  const staffUser = await f.staff(ctx.prisma)
  const editStaff = await manager.graphql.raw({ query: 'mutation($id: ID!) { updateUser(where: { id: $id }, data: { isActive: false }) { id } }', variables: { id: staffUser.id } })
  assert.ok(editStaff.errors?.length || editStaff.data.updateUser === null, 'a buyer manager cannot deactivate staff')
  const editBuyer = await manager.graphql.raw({ query: 'mutation($id: ID!) { updateUser(where: { id: $id }, data: { buyerRole: admin }) { id buyerRole } }', variables: { id: ok.data.createUser.id } })
  assert.equal(editBuyer.errors, undefined, editBuyer.errors?.[0]?.message)
  assert.equal(editBuyer.data.updateUser.buyerRole, 'admin')
})
