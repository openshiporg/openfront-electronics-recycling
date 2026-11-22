// Every GraphQL document the platform screens send is checked against the generated
// schema, so a renamed field or a wrong filter fails here instead of on the page.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildSchema, parse, validate } = require('graphql')

const root = path.join(__dirname, '..')
const schema = buildSchema(fs.readFileSync(path.join(root, 'schema.graphql'), 'utf8'))

function screens(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...screens(full))
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Pulls the literal documents out of listQuery(`...`) calls and readTabbedList({...}) specs. */
function documents(source) {
  const docs = []
  const consts = {}
  for (const m of source.matchAll(/const (\w+) = `([^`]*)`/g)) consts[m[1]] = m[2]
  for (const m of source.matchAll(/listQuery<[^>]*>\(\s*(?:`([^`]*)`|'([^']*)'|(\w+))/g)) {
    let text = m[1] ?? m[2] ?? consts[m[3]]
    if (text) text = text.replace(/\$\{(\w+)\}/g, (all, name) => consts[name] ?? all)
    if (text && !text.includes('${')) docs.push(text)
  }
  for (const m of source.matchAll(/readTabbedList<[^>]*>\(\{\s*list: '(\w+)', type: '(\w+)', fields: (?:'([^']*)'|(\w+))/g)) {
    const fields = m[3] ?? consts[m[4]]
    // The same shape readTabbedList sends (features/platform/lib/view.tsx).
    if (fields) docs.push(`query T($where: ${m[2]}WhereInput!, $take: Int, $skip: Int!, $orderBy: [${m[2]}OrderByInput!]!, $w0: ${m[2]}WhereInput!) { items: ${m[1]}(where: $where, take: $take, skip: $skip, orderBy: $orderBy) { ${fields} } total: ${m[1]}Count(where: $where) c0: ${m[1]}Count(where: $w0) }`)
  }
  return docs
}

const files = screens(path.join(root, 'features/platform')).filter((f) => !f.includes(`${path.sep}lib${path.sep}`))

test('platform screen queries match the schema', () => {
  let checked = 0
  const problems = []
  for (const file of files) {
    for (const doc of documents(fs.readFileSync(file, 'utf8'))) {
      checked++
      let errors
      try { errors = validate(schema, parse(doc)) } catch (e) { errors = [e] }
      for (const e of errors) problems.push(`${path.relative(root, file)}: ${e.message}`)
    }
  }
  assert.ok(checked >= 5, `only ${checked} documents found`)
  assert.deepEqual(problems, [])
})

test('every operation a screen runs exists, as a mutation or (with read) a query', () => {
  const ops = fs.readFileSync(path.join(root, 'features/keystone/mutations/operations.ts'), 'utf8')
  const kind = new Map([...ops.matchAll(/^  (\w+): ([mq])\(/gm)].map((m) => [m[1], m[2]]))
  const problems = []
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    const where = path.relative(root, file)
    // <OpButton|OpDrawer ... op="x" ... read ...> : read must match the op kind.
    for (const m of src.matchAll(/<Op(?:Button|Drawer|Form)\b([^>]*?)\bop="(\w+)"([^>]*)/g)) {
      const name = m[2]
      const read = /(?:^|\s)read(?=\s|\/|$)/.test(m[1] + m[3].split(/\/>|\bfields=/)[0])
      if (!kind.has(name)) problems.push(`${where}: ${name} does not exist`)
      else if (kind.get(name) === 'q' && !read) problems.push(`${where}: ${name} is a query; add read`)
      else if (kind.get(name) === 'm' && read) problems.push(`${where}: ${name} is a mutation; remove read`)
    }
    for (const m of src.matchAll(/runOperation\('(\w+)'/g)) if (kind.get(m[1]) !== 'm') problems.push(`${where}: runOperation ${m[1]} is not a mutation`)
    for (const m of src.matchAll(/(?:platformQuery<[^>]*>|readOperation)\('(\w+)'/g)) if (kind.get(m[1]) !== 'q') problems.push(`${where}: ${m[1]} is not a query`)
  }
  assert.deepEqual(problems, [])
})

test('every sidebar entry has a page, and every page is in the sidebar', () => {
  const nav = fs.readFileSync(path.join(root, 'features/platform/lib/navigation.ts'), 'utf8')
  const hrefs = [...nav.matchAll(/href: '\/platform\/([\w-]+)'/g)].map((m) => m[1])
  const base = path.join(root, 'app/dashboard/(admin)/platform')
  const missing = hrefs.filter((h) => !fs.existsSync(path.join(base, h, 'page.tsx')))
  assert.deepEqual(missing, [], 'sidebar entries without a page')
  const routes = fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []
  assert.deepEqual(routes.filter((r) => !hrefs.includes(r)), [], 'pages not in the sidebar')
})

test('docs/FEATURE-MATRIX.md is current and every §5.4 row is wired on its page', () => {
  const matrix = require(path.join(root, 'scripts/feature-matrix.cjs'))
  assert.equal(fs.readFileSync(path.join(root, 'docs/FEATURE-MATRIX.md'), 'utf8'), matrix.render(), 'run node scripts/feature-matrix.cjs')
  const rows = matrix.ROWS.filter((r) => r.length > 1)
  assert.equal(rows.length, 91, '30 storefront rows and 61 platform rows')
  // Screens that each platform route renders: the route wrapper's import, plus the client pieces that screen imports.
  const base = path.join(root, 'app/dashboard/(admin)/platform')
  const screenSource = (route) => {
    const wrapper = fs.readFileSync(path.join(base, route, 'page.tsx'), 'utf8')
    const imp = wrapper.match(/from '@\/(features\/platform\/[^']+)'/)[1]
    const seen = new Set()
    const read = (file) => {
      if (seen.has(file) || !fs.existsSync(file)) return ''
      seen.add(file)
      const src = fs.readFileSync(file, 'utf8')
      const local = [...src.matchAll(/from '\.\/(\w+)'/g)].map((m) => path.join(path.dirname(file), `${m[1]}.tsx`))
      return src + local.map(read).join('\n')
    }
    return read(path.join(root, `${imp}.tsx`))
  }
  const problems = []
  for (const [id, , ops, lists, route] of rows) {
    if (!/^[SKRYMT]\d/.test(id)) continue
    const src = route.split(', ').map(screenSource).join('\n')
    const opHit = ops.some((op) => new RegExp(`op="${op}"|Operation\\('${op}'|platformQuery<[^>]*>\\('${op}'|platformQuery\\('${op}'`).test(src))
    const listHit = lists.some((l) => src.includes(`listKey="${l}"`) || src.includes(`type: '${l}'`) || new RegExp(`\\b${l[0].toLowerCase()}${l.slice(1)}s?\\(`).test(src))
    if (!opHit && !listHit) problems.push(`${id} (${route}): none of ${[...ops, ...lists].join(', ')} is used`)
  }
  assert.deepEqual(problems, [])
})
