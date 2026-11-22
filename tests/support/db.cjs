// Real-database test harness. Builds a Keystone context over the shared scratch
// Postgres test database (scratch_openfront_electronics_recycling_tests), so locks,
// unique constraints and idempotency are exercised by Postgres itself.
//
// The connection base comes from TEST_DATABASE_URL, or from OPENFRONT_SCRATCH_DB_BASE
// (environment or ~/.config/openfront/scratch-db.env). It is never printed.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '../..')
const TEST_DB = 'scratch_openfront_electronics_recycling_tests'

function databaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  let base = process.env.OPENFRONT_SCRATCH_DB_BASE
  if (!base) {
    const file = path.join(os.homedir(), '.config/openfront/scratch-db.env')
    if (fs.existsSync(file)) {
      const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => /^\s*(export\s+)?OPENFRONT_SCRATCH_DB_BASE=/.test(l))
      if (line) base = line.replace(/^\s*(export\s+)?OPENFRONT_SCRATCH_DB_BASE=/, '').trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return base ? `${base.replace(/\/$/, '')}/${TEST_DB}?connection_limit=12` : null
}

const url = databaseUrl()
let contextPromise = null

/** Returns { sudo, prisma, as(user) } or null when no database is configured. */
async function getTestContext() {
  if (!url) return null
  if (contextPromise) return contextPromise
  contextPromise = (async () => {
    process.env.DATABASE_URL = url
    process.env.SESSION_SECRET ||= crypto.randomBytes(32).toString('hex')
    require('tsx/cjs/api').register()
    const { getContext } = require('@keystone-6/core/context')
    const config = require(path.join(root, 'features/keystone/index.ts')).default
    const PrismaModule = require(path.join(root, 'node_modules/.prisma/client'))
    const base = getContext({ ...config, db: { ...config.db, url } }, PrismaModule)
    const sudo = base.sudo()
    return {
      base,
      sudo,
      prisma: sudo.prisma,
      /** A context signed in as this user (session data read from the database). */
      async as(userId) {
        const user = await sudo.prisma.user.findUnique({ where: { id: userId }, include: { role: true } })
        const session = { itemId: user.id, listKey: 'User', data: { name: user.name, email: user.email, kind: user.kind, isActive: user.isActive, role: user.role } }
        return base.withSession(session)
      },
      async disconnect() { await sudo.prisma.$disconnect() },
    }
  })()
  return contextPromise
}

function skipReason() {
  return url ? false : 'no scratch database configured (set OPENFRONT_SCRATCH_DB_BASE or TEST_DATABASE_URL)'
}

/** A short unique suffix so parallel runs and re-runs never collide. */
const uid = () => crypto.randomBytes(4).toString('hex')

module.exports = { getTestContext, skipReason, uid, root }
