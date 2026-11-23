// Access sweep against the real scratch Postgres. Callers: the nine staff roles that
// onboarding creates, an approved buyer, a client user and a signed-out caller.
// Each one lists every Keystone list through GraphQL and calls every custom
// operation with empty input. Checks:
// - nobody ever gets "Unexpected error.", a stack trace, a Prisma message or an
//   internal error code;
// - a buyer, a client and a signed-out caller read no rows from any list and get a
//   plain refusal from every staff operation;
// - a staff role without the permission gets "Your role does not allow this.".
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getTestContext, skipReason, root } = require('./support/db.cjs')
const f = require('./support/fixtures.cjs')

const skip = skipReason()
let ctx, OPERATIONS, ROLES

// Lists an outside caller may read rows from, and why. Everything else must return none.
const PUBLIC_ROWS = {
  // The signed-in user reads their own User row (session and portal header).
  users: ['buyer', 'client'],
  // A buyer reads their own company; a client their own organisation.
  buyerCompanies: ['buyer'],
  clientOrganizations: ['client'],
}

// Signs of an internal failure leaking to the caller.
const LEAK = /Unexpected error|Something went wrong|prisma|invalid `|\bat \w+ \(|\.ts:\d+|stack|KS_PRISMA_ERROR|INTERNAL_SERVER_ERROR|Cannot read properties|is not a function|undefined|null/i
const PLAIN_REFUSAL = /^(Sign in to continue\.|Your account cannot use the dashboard\.|Your role does not allow this\.|This page is for (buyer|client) accounts\.|This page is for buyer and client accounts\.|Your account is not active\.|Access denied.*)$/

test.before(async () => {
  if (skip) return
  ctx = await getTestContext()
  OPERATIONS = require(path.join(root, 'features/keystone/mutations/operations.ts')).OPERATIONS
  ROLES = require(path.join(root, 'features/keystone/domain/onboarding.ts')).ROLES
})
test.after(async () => { if (ctx) await ctx.disconnect() })

// Every Keystone list query: a root field "x" next to its "xCount".
async function listNames() {
  const out = await ctx.sudo.graphql.raw({ query: '{ __schema { queryType { fields { name } } } }' })
  const fields = new Set(out.data.__schema.queryType.fields.map((x) => x.name))
  return [...fields].filter((n) => fields.has(`${n}Count`)).map((n) => ({ key: n, gql: { listQueryName: n, listQueryCountName: `${n}Count` } }))
}

async function readList(context, l) {
  const out = await context.graphql.raw({ query: `query { ${l.gql.listQueryName}(take: 5) { id } ${l.gql.listQueryCountName} }` })
  return { rows: out.data?.[l.gql.listQueryName]?.length ?? 0, ids: (out.data?.[l.gql.listQueryName] ?? []).map((r) => r.id), count: out.data?.[l.gql.listQueryCountName] ?? 0, error: out.errors?.[0] }
}

async function callOp(context, name, op) {
  const field = op.kind === 'query' ? `query { ${name}(input: {}) }` : `mutation { ${name}(input: {}) { success error } }`
  const out = await context.graphql.raw({ query: field })
  if (out.errors?.length) return { ok: false, message: out.errors[0].message, code: out.errors[0].extensions?.code ?? '' }
  if (op.kind === 'mutation') return { ok: out.data[name].success, message: out.data[name].error ?? '', code: out.data[name].success ? '' : 'REFUSED' }
  return { ok: true, message: '', code: '' }
}

async function callers() {
  const staff = []
  for (const role of ROLES) {
    const r = await ctx.prisma.role.create({ data: { name: `${role.name} ${f.key().slice(0, 6)}`, ...Object.fromEntries(role.permissions.map((p) => [p, true])) } })
    const u = await ctx.prisma.user.create({ data: { name: `${role.name} sweep`, email: `sweep-${f.key().slice(0, 10)}@recycler.example`, password: 'x'.repeat(60), kind: 'staff', roleId: r.id, isActive: true } })
    staff.push({ who: role.name, kind: 'staff', permissions: new Set(role.permissions), context: await ctx.as(u.id) })
  }
  const buyer = await f.buyer(ctx.prisma)
  const org = await ctx.prisma.clientOrganization.create({ data: { name: `Sweep client ${f.key().slice(0, 6)}`, legalName: 'Sweep client LLC' } })
  const clientUser = await ctx.prisma.user.create({ data: { name: 'Sweep client person', email: `sweep-client-${f.key().slice(0, 8)}@example.org`, password: 'x'.repeat(60), kind: 'client', clientOrganizationId: org.id, clientRole: 'admin', isActive: true } })
  return [
    ...staff,
    { who: 'buyer', kind: 'buyer', own: { users: buyer.user.id, buyerCompanies: buyer.company.id }, context: await ctx.as(buyer.user.id) },
    { who: 'client', kind: 'client', own: { users: clientUser.id, clientOrganizations: org.id }, context: await ctx.as(clientUser.id) },
    { who: 'signed out', kind: 'anon', context: ctx.base },
  ]
}

test('every caller, every list and every operation: plain answers, and outsiders see nothing', { skip }, async () => {
  // Populate sale data as well as the account fixtures below.
  await f.lot(ctx.prisma)
  const all = await callers()
  const names = await listNames()
  assert.ok(names.length >= 50, `expected the full model set, got ${names.length}`)
  const ops = Object.entries(OPERATIONS)
  assert.ok(ops.length >= 120)
  const problems = []

  for (const c of all) {
    for (const l of names) {
      const r = await readList(c.context, l)
      if (r.error && LEAK.test(r.error.message)) problems.push(`list ${l.key} as ${c.who}: ${r.error.message}`)
      if (c.kind !== 'staff') {
        const allowed = (PUBLIC_ROWS[l.key] ?? []).includes(c.kind)
        if ((r.rows > 0 || r.count > 0) && !allowed) problems.push(`list ${l.key} as ${c.who}: read ${r.rows} row(s), count ${r.count}`)
        if (allowed && (r.count > 1 || r.ids.some((id) => id !== c.own[l.key]))) problems.push(`list ${l.key} as ${c.who}: returned another account's row`)
      }
    }

    console.log(`sweep ${c.who}: ${names.length} lists checked; starting ${ops.length} operations`)
    for (const [name, op] of ops) {
      const r = await callOp(c.context, name, op)
      if (r.message && LEAK.test(r.message)) problems.push(`op ${name} as ${c.who}: [${r.code}] ${r.message}`)
      if (r.code && r.code !== 'REFUSED') problems.push(`op ${name} as ${c.who}: code ${r.code} (${r.message})`)
      if (Array.isArray(op.access)) {
        const allowed = c.kind === 'staff' && op.access.some((p) => c.permissions.has(p))
        if (!allowed && (r.ok || !PLAIN_REFUSAL.test(r.message))) problems.push(`op ${name} as ${c.who}: ${r.ok ? 'was allowed' : `refused as "${r.message}"`}`)
      }
      if (op.access === 'account' && c.kind === 'anon' && (r.ok || r.message !== 'Sign in to continue.')) problems.push(`op ${name} signed out: ${r.ok ? 'was allowed' : `"${r.message}"`}`)
    }
  }
  console.log(`sweep complete: ${all.length} callers × ${names.length} lists and ${ops.length} operations`)
  assert.deepEqual(problems, [])
})
