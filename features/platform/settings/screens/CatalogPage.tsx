import { PlatformPage, can, label, usd } from '../../lib/page'
import { DeleteButton, ItemDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Section, StatusTabs, Td } from '../../lib/ui'
import { param, type SearchParams } from '../../lib/view'

const Q = `query {
  categories: materialCategories(orderBy: [{ sortOrder: asc }, { name: asc }]) { id name slug kind r2Category isFocusMaterial dataBearingDefault sortOrder isActive parent { id name } }
  grades: gradeDefinitions(orderBy: [{ kind: asc }, { sortOrder: asc }]) { id kind code label description sortOrder }
  accepted: acceptedItems(orderBy: [{ sortOrder: asc }, { name: asc }]) { id name accepted feeType feeMinor notes sortOrder category { id name } }
}`

const TABS = [{ value: 'categories', label: 'Categories' }, { value: 'grades', label: 'Grades' }, { value: 'accepted', label: 'Accepted items and fees' }]

/** T5: categories, grade scales, and what is accepted (with any fee). */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const tab = param(sp, 'tab') || 'categories'
  return (
    <PlatformPage route="/platform/catalog" title="Catalogue" meta="Categories drive lots, audits and downstream approvals. Grades are the scale buyers see. Accepted items are what the public site lists.">
      {async (staff) => {
        const r = await listQuery<any>(Q)
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const manage = can(staff, 'canManageSettings')
        const { categories, grades, accepted } = r.data
        const catOpts = categories.map((c: any) => ({ value: c.id, label: c.name }))
        const catFields = (c: any = {}) => [
          { name: 'name', label: 'Name', required: true, defaultValue: c.name }, { name: 'slug', label: 'Slug', required: true, defaultValue: c.slug, placeholder: 'laptops' },
          { name: 'kind', label: 'Kind', type: 'select' as const, options: ['equipment', 'component', 'commodity'].map((v) => ({ value: v, label: label(v) })), defaultValue: c.kind ?? 'equipment' },
          { name: 'parent', label: 'Parent', type: 'select' as const, relation: true, options: catOpts.filter((o: any) => o.value !== c.id), defaultValue: c.parent?.id },
          { name: 'r2Category', label: 'R2 category', defaultValue: c.r2Category, hint: 'For example FM (focus material) or data-bearing device.' },
          { name: 'sortOrder', label: 'Order', type: 'number' as const, defaultValue: c.sortOrder ?? 0 },
          { name: 'isFocusMaterial', label: 'R2 focus material', type: 'checkbox' as const, defaultValue: c.isFocusMaterial ?? false },
          { name: 'dataBearingDefault', label: 'Data-bearing by default', type: 'checkbox' as const, defaultValue: c.dataBearingDefault ?? false },
          { name: 'isActive', label: 'Active', type: 'checkbox' as const, defaultValue: c.isActive ?? true },
        ]
        const gradeFields = (g: any = {}) => [
          { name: 'kind', label: 'Scale', type: 'select' as const, options: [{ value: 'cosmetic', label: 'Cosmetic' }, { value: 'functional', label: 'Functional' }], defaultValue: g.kind ?? 'cosmetic' },
          { name: 'code', label: 'Code', required: true, defaultValue: g.code, placeholder: 'A' }, { name: 'label', label: 'Label', required: true, defaultValue: g.label, placeholder: 'Like new' },
          { name: 'sortOrder', label: 'Order', type: 'number' as const, defaultValue: g.sortOrder ?? 0 },
          { name: 'description', label: 'What it means', type: 'textarea' as const, defaultValue: g.description, wide: true },
        ]
        const itemFields = (a: any = {}) => [
          { name: 'name', label: 'Item', required: true, defaultValue: a.name, placeholder: 'CRT monitors' },
          { name: 'category', label: 'Category', type: 'select' as const, relation: true, options: catOpts, defaultValue: a.category?.id },
          { name: 'accepted', label: 'We accept it', type: 'checkbox' as const, defaultValue: a.accepted ?? true },
          { name: 'feeType', label: 'Fee', type: 'select' as const, options: [{ value: 'free', label: 'Free' }, { value: 'per_item', label: 'Per item' }, { value: 'per_weight', label: 'Per weight unit' }], defaultValue: a.feeType ?? 'free' },
          { name: 'feeMinor', label: 'Fee amount', type: 'money' as const, defaultValue: a.feeMinor ?? 0 },
          { name: 'sortOrder', label: 'Order', type: 'number' as const, defaultValue: a.sortOrder ?? 0 },
          { name: 'notes', label: 'Notes', defaultValue: a.notes, wide: true },
        ]
        const tabs = <StatusTabs label="Catalogue" hrefFor={(v) => `/dashboard/platform/catalog?tab=${v}`} tabs={TABS.map((t) => ({ ...t, count: t.value === 'categories' ? categories.length : t.value === 'grades' ? grades.length : accepted.length }))} current={tab} />
        return (
          <>
            {tabs}
            {tab === 'categories' ? (
              <Section title="Categories" count={categories.length} actions={manage ? <ItemDrawer listKey="MaterialCategory" title="Add a category" trigger="Add category" triggerVariant="primary" fields={catFields()} /> : null}>
                {categories.length ? <DataTable label="Categories" head={[{ label: 'Category' }, { label: 'Kind' }, { label: 'R2' }, { label: 'Data-bearing' }, { label: 'Active' }, { label: '' }]}>
                  {categories.map((c: any) => <tr key={c.id}><Td><span className="font-medium">{c.name}</span>{c.parent ? <span className="text-xs text-muted-foreground"> in {c.parent.name}</span> : null}<div className="font-mono text-xs text-muted-foreground">{c.slug}</div></Td><Td>{label(c.kind)}</Td><Td>{[c.r2Category, c.isFocusMaterial ? 'focus material' : ''].filter(Boolean).join(' · ') || '—'}</Td><Td>{c.dataBearingDefault ? 'Yes' : 'No'}</Td><Td>{c.isActive ? 'Yes' : 'No'}</Td>
                    <Td className="text-right">{manage ? <ItemDrawer listKey="MaterialCategory" id={c.id} title={`Edit ${c.name}`} trigger="Edit" fields={catFields(c)} /> : null}</Td></tr>)}
                </DataTable> : <Empty>No categories.</Empty>}
              </Section>
            ) : null}
            {tab === 'grades' ? (['cosmetic', 'functional'] as const).map((kind) => {
              const rows = grades.filter((g: any) => g.kind === kind)
              return (
                <Section key={kind} title={`${label(kind)} grades`} count={rows.length} actions={manage ? <ItemDrawer listKey="GradeDefinition" title={`Add a ${kind} grade`} trigger="Add grade" fields={gradeFields({ kind })} /> : null}>
                  {rows.length ? <DataTable label={`${kind} grades`} head={[{ label: 'Code' }, { label: 'Label' }, { label: 'Meaning' }, { label: '' }]}>
                    {rows.map((g: any) => <tr key={g.id}><Td className="font-mono">{g.code}</Td><Td>{g.label}</Td><Td className="max-w-md text-xs">{g.description}</Td><Td className="whitespace-nowrap text-right">{manage ? <><ItemDrawer listKey="GradeDefinition" id={g.id} title={`Edit ${g.code}`} trigger="Edit" fields={gradeFields(g)} /><DeleteButton listKey="GradeDefinition" id={g.id} confirm={`Remove grade ${g.code}? Assets already graded keep it.`} /></> : null}</Td></tr>)}
                  </DataTable> : <Empty>No {kind} grades.</Empty>}
                </Section>
              )
            }) : null}
            {tab === 'accepted' ? (
              <Section title="Accepted items" count={accepted.length} actions={manage ? <ItemDrawer listKey="AcceptedItem" title="Add an item" trigger="Add item" triggerVariant="primary" fields={itemFields()} /> : null}>
                {accepted.length ? <DataTable label="Accepted items" head={[{ label: 'Item' }, { label: 'Category' }, { label: 'Accepted' }, { label: 'Fee' }, { label: '' }]}>
                  {accepted.map((a: any) => <tr key={a.id}><Td>{a.name}{a.notes ? <div className="text-xs text-muted-foreground">{a.notes}</div> : null}</Td><Td>{a.category?.name ?? '—'}</Td><Td>{a.accepted ? 'Yes' : <span className="text-red-600">No</span>}</Td><Td>{a.feeType === 'free' ? 'Free' : `${usd(a.feeMinor)} ${a.feeType === 'per_item' ? 'each' : 'per unit weight'}`}</Td>
                    <Td className="whitespace-nowrap text-right">{manage ? <><ItemDrawer listKey="AcceptedItem" id={a.id} title={`Edit ${a.name}`} trigger="Edit" fields={itemFields(a)} /><DeleteButton listKey="AcceptedItem" id={a.id} confirm={`Remove ${a.name}?`} /></> : null}</Td></tr>)}
                </DataTable> : <Empty>Nothing listed.</Empty>}
              </Section>
            ) : null}
          </>
        )
      }}
    </PlatformPage>
  )
}
