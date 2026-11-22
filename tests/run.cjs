#!/usr/bin/env node
// npm test: runs every tests/*.test.cjs file in its own node --test process
// (Keystone's context does not survive the directory form). DB groups skip
// themselves when no test database is configured (see tests/support/db.cjs).
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const dir = __dirname
const only = process.argv.slice(2)
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.cjs')).filter((f) => !only.length || only.some((o) => f.includes(o))).sort()
let failed = 0
for (const file of files) {
  const started = Date.now()
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-timeout=1200000', path.join(dir, file)], { cwd: path.join(dir, '..'), encoding: 'utf8', env: process.env })
  const output = `${run.stdout}${run.stderr}`.split('\n').filter((l) => !/postgres(ql)?:\/\//.test(l)).join('\n')
  const ok = run.status === 0
  if (!ok) { failed++; process.stdout.write(output) }
  const summary = output.match(/ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)[\s\S]*?ℹ skipped (\d+)/)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file}${summary ? `  pass ${summary[1]} fail ${summary[2]} skipped ${summary[3]}` : ''}  ${((Date.now() - started) / 1000).toFixed(0)}s`)
}
console.log(failed ? `\n${failed} file(s) failed` : `\nall ${files.length} files passed`)
process.exit(failed ? 1 : 0)
