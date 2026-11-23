// Separate Node processes must not mutate this database's singleton settings together.
const test = require('node:test')
const assert = require('node:assert/strict')
const { fork } = require('node:child_process')
const { once } = require('node:events')
const { skipReason } = require('./support/db.cjs')

if (process.env.ER_LOCK_CHILD === '1') {
  ;(async () => {
    const { getTestContext } = require('./support/db.cjs')
    process.send('attempting')
    const ctx = await getTestContext()
    process.send('acquired')
    process.once('message', async () => {
      await ctx.disconnect()
      process.disconnect()
    })
  })().catch(() => process.exit(1))
} else {
  test('database advisory lock serializes independent test processes', { skip: skipReason(), timeout: 120_000 }, async () => {
    const children = []
    const start = () => {
      const child = fork(__filename, [], { env: { ...process.env, ER_LOCK_CHILD: '1' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
      children.push(child)
      const messages = []
      child.on('message', (m) => messages.push(m))
      return { child, messages }
    }
    const waitFor = async (c, message) => {
      while (!c.messages.includes(message)) {
        assert.equal(c.child.exitCode, null, 'lock worker exited before acquiring the lock')
        await Promise.race([once(c.child, 'message'), once(c.child, 'exit').then(() => { throw new Error('Lock worker exited early') })])
      }
    }
    try {
      const first = start()
      await waitFor(first, 'acquired')
      const second = start()
      await waitFor(second, 'attempting')
      await new Promise((r) => setTimeout(r, 1500))
      assert.equal(second.messages.includes('acquired'), false, 'second process must wait while first owns the lock')
      first.child.send('release')
      await waitFor(second, 'acquired')
      second.child.send('release')
      await once(second.child, 'exit')
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
    }
  })
}
