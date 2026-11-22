import { notFound } from 'next/navigation'
import { PlatformPage, can, day, label, term, usd, when } from '../../lib/page'
import { ItemDrawer, OpButton, OpDrawer, SaveButton } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Track, Td } from '../../lib/ui'
import { Facts, RowLink, Status } from '../../lib/view'

const Q = `query Buyer($id: ID!) {
  buyerCompany(where: { id: $id }) {
    id legalName tradingName addressLine1 addressLine2 city region postalCode countryCode phone website taxId businessType monthlySpendBand destinationCountries
    status statusReason taxStatus spendLimitMinor strikes approvedAt submittedAt rejectedAt termsVersionAccepted termsAcceptedAt internalNotes
    approvedBy { name }
    categoriesOfInterest { id name }
    users(orderBy: [{ name: asc }]) { id name email phone buyerRole isActive acceptedTermsVersion }
    documents(orderBy: [{ createdAt: desc }]) { id type state expiresOn status reviewNote file { id filename } createdAt }
    messages(orderBy: [{ createdAt: desc }], take: 30) { id body fromStaff createdAt author { name } }
    orders(orderBy: [{ createdAt: desc }], take: 20) { id orderNumber status lot { lotNumber } invoice { totalMinor balanceMinor } }
    bids(orderBy: [{ submittedAt: desc }], take: 20) { id status amountMinor submittedAt lot { id lotNumber title } }
  }
  materialCategories(where: { isActive: { equals: true } }, orderBy: [{ name: asc }]) { id name }
}`

const o = (v: string[]) => v.map((x) => ({ value: x, label: term(x) }))

/** S2 record, S3 users, S4 category interests, S5 documents, plus the application review (S1). */
export default async function BuyerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const read = await listQuery<any>(Q, { id })
  if (read.ok && !read.data.buyerCompany) notFound()
  const c = read.ok ? read.data.buyerCompany : null
  return (
    <PlatformPage route="/platform/buyers" title={c?.legalName ?? 'Buyer'} crumbs={[{ label: c?.legalName ?? 'Buyer' }]} meta={c ? `${label(c.status)}${c.statusReason ? ` · ${c.statusReason}` : ''}` : undefined}>
      {async (staff) => {
        if (!read.ok) return <Notice tone="alert">{read.error}</Notice>
        const manage = can(staff, 'canManageBuyers')
        const reviewing = ['submitted', 'under_review', 'needs_info'].includes(c.status)
        return (
          <>
            <Readouts items={[{ label: 'Status', value: term(c.status) }, { label: 'Tax', value: term(c.taxStatus) }, { label: 'Spend limit', value: c.spendLimitMinor === null ? 'None' : usd(c.spendLimitMinor) }, { label: 'Strikes', value: c.strikes, tone: c.strikes ? 'wait' : undefined }, { label: 'Terms', value: c.termsVersionAccepted || 'Not accepted' }]} />
            {manage ? (
              <Track wrap label="Buyer actions">
                {c.status === 'submitted' ? <OpButton op="reviewBuyerApplication" input={{ companyId: c.id, action: 'open' }} label="Start review" /> : null}
                {['submitted', 'under_review'].includes(c.status) ? <OpDrawer op="reviewBuyerApplication" fixed={{ companyId: c.id, action: 'approve' }} title="Approve" trigger="Approve" triggerVariant="primary" fields={[
                  { name: 'taxStatus', label: 'Tax status', type: 'select', required: true, options: o(['taxable', 'exempt_resale', 'export']), defaultValue: c.taxStatus },
                  { name: 'spendLimitMinor', label: 'Spend limit', type: 'money', defaultValue: c.spendLimitMinor },
                  { name: 'message', label: 'Message', type: 'textarea' },
                ]} submitLabel="Approve" /> : null}
                {['submitted', 'under_review'].includes(c.status) ? <OpDrawer op="reviewBuyerApplication" fixed={{ companyId: c.id, action: 'request_info' }} title="Ask for more information" trigger="Ask for information" fields={[{ name: 'message', label: 'What you need', type: 'textarea', required: true }]} submitLabel="Send" /> : null}
                {reviewing ? <OpDrawer op="reviewBuyerApplication" fixed={{ companyId: c.id, action: 'reject' }} title="Reject the application" trigger="Reject" triggerVariant="danger" fields={[{ name: 'message', label: 'Reason, sent to the buyer', type: 'textarea', required: true }]} submitLabel="Reject" /> : null}
                {c.status === 'approved' ? <OpDrawer op="suspendBuyer" fixed={{ companyId: c.id }} title="Suspend this buyer" description="Their active bids are withdrawn and they cannot bid until reinstated." trigger="Suspend" triggerVariant="danger" fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true }]} submitLabel="Suspend" /> : null}
                {c.status === 'suspended' ? <OpDrawer op="reinstateBuyer" fixed={{ companyId: c.id }} title="Reinstate" trigger="Reinstate" triggerVariant="primary" fields={[{ name: 'note', label: 'Note', type: 'textarea' }, { name: 'resetStrikes', label: 'Clear strikes', type: 'checkbox' }]} submitLabel="Reinstate" /> : null}
                <OpDrawer op="messageBuyer" fixed={{ companyId: c.id }} title="Message the buyer" trigger="Send message" fields={[{ name: 'body', label: 'Message', type: 'textarea', required: true }]} submitLabel="Send" />
              </Track>
            ) : null}

            <Section title="Company" actions={manage ? <ItemDrawer listKey="BuyerCompany" id={c.id} title="Edit company" trigger="Edit" fields={[
              { name: 'legalName', label: 'Legal name', required: true, defaultValue: c.legalName },
              { name: 'tradingName', label: 'Trading name', defaultValue: c.tradingName },
              { name: 'phone', label: 'Phone', defaultValue: c.phone },
              { name: 'website', label: 'Website', defaultValue: c.website },
              { name: 'taxId', label: 'Tax ID', defaultValue: c.taxId },
              { name: 'taxStatus', label: 'Tax status', type: 'select', required: true, options: o(['taxable', 'exempt_resale', 'export']), defaultValue: c.taxStatus },
              { name: 'spendLimitMinor', label: 'Spend limit', type: 'money', defaultValue: c.spendLimitMinor, hint: 'Empty means no limit.' },
              { name: 'internalNotes', label: 'Internal notes (staff only)', type: 'textarea', defaultValue: c.internalNotes },
            ]} /> : null}>
              <Facts items={[
                ['Trading as', c.tradingName], ['Address', [c.addressLine1, c.addressLine2, c.city, c.region, c.postalCode, c.countryCode].filter(Boolean).join(', ')], ['Phone', c.phone],
                ['Website', c.website], ['Tax ID', c.taxId], ['Business type', term(c.businessType)], ['Monthly spend', term(c.monthlySpendBand)],
                ['Ships to', Array.isArray(c.destinationCountries) ? c.destinationCountries.join(', ') : ''], ['Submitted', day(c.submittedAt)],
                ['Approved', c.approvedAt ? `${day(c.approvedAt)}${c.approvedBy ? ` by ${c.approvedBy.name}` : ''}` : ''], ['Internal notes', c.internalNotes],
              ]} />
            </Section>

            <Section title="Category interests" count={c.categoriesOfInterest.length} actions={manage ? <ItemDrawer listKey="BuyerCompany" id={c.id} title="Category interests" description="Sale announcements go to buyers following a category in the sale." trigger="Edit interests" fields={[
              { name: 'categoriesOfInterest', label: 'Categories', type: 'multiselect', relation: true, options: read.data.materialCategories.map((m: any) => ({ value: m.id, label: m.name })), defaultValue: c.categoriesOfInterest.map((m: any) => m.id) },
            ]} /> : null}>
              {c.categoriesOfInterest.length ? <p className="text-sm">{c.categoriesOfInterest.map((m: any) => m.name).join(', ')}</p> : <Empty>Gets every sale announcement.</Empty>}
            </Section>

            <Section title="Documents" count={c.documents.length}>
              {c.documents.length ? (
                <DataTable label="Documents" head={[{ label: 'Document' }, { label: 'Status' }, { label: 'Expires' }, { label: 'Note' }, { label: '' }]}>
                  {c.documents.map((d: any) => (
                    <tr key={d.id}>
                      <Td>{d.file ? <a className="underline-offset-2 hover:underline" href={`/api/files/${d.file.id}`} target="_blank" rel="noreferrer">{label(d.type)}</a> : label(d.type)}<div className="text-xs text-muted-foreground">{d.file?.filename}{d.state ? ` · ${d.state}` : ''}</div></Td>
                      <Td><Status value={d.status} /></Td>
                      <Td>{day(d.expiresOn)}</Td>
                      <Td className="max-w-xs">{d.reviewNote}</Td>
                      <Td className="whitespace-nowrap text-right">{manage ? <>
                        {d.status !== 'accepted' ? <OpDrawer op="reviewBuyerDocument" fixed={{ documentId: d.id, status: 'accepted' }} title={`Accept ${label(d.type)}`} trigger="Accept" triggerVariant="primary" fields={[{ name: 'expiresOn', label: 'Expires on', type: 'date', defaultValue: d.expiresOn }, { name: 'note', label: 'Note' }]} submitLabel="Accept" /> : <OpDrawer op="reviewBuyerDocument" fixed={{ documentId: d.id, status: 'accepted' }} title="Change expiry" trigger="Expiry" fields={[{ name: 'expiresOn', label: 'Expires on', type: 'date', defaultValue: d.expiresOn }, { name: 'note', label: 'Note', defaultValue: d.reviewNote }]} submitLabel="Save" />}
                        {d.status !== 'rejected' ? <OpDrawer op="reviewBuyerDocument" fixed={{ documentId: d.id, status: 'rejected' }} title={`Reject ${label(d.type)}`} trigger="Reject" triggerVariant="danger" fields={[{ name: 'note', label: 'Reason, sent to the buyer', type: 'textarea', required: true }]} submitLabel="Reject" /> : null}
                      </> : null}</Td>
                    </tr>
                  ))}
                </DataTable>
              ) : <Empty>No documents uploaded.</Empty>}
            </Section>

            <Section title="Users" count={c.users.length} actions={manage ? <ItemDrawer listKey="User" title="Add a buyer user" description="Give them this temporary password; they can change it with Forgot password." trigger="Add user" fixed={{ kind: 'buyer', buyerCompany: { connect: { id: c.id } } }} fields={[
              { name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone' },
              { name: 'buyerRole', label: 'Role', type: 'select', required: true, options: [{ value: 'admin', label: 'Admin (pays, manages users)' }, { value: 'bidder', label: 'Bidder' }], defaultValue: 'bidder' },
              { name: 'password', label: 'Temporary password', required: true, hint: 'At least 8 characters.' },
            ]} /> : null}>
              {c.users.length ? (
                <DataTable label="Users" head={[{ label: 'Name' }, { label: 'Role' }, { label: 'Terms' }, { label: 'Active' }, { label: '' }]}>
                  {c.users.map((u: any) => (
                    <tr key={u.id}>
                      <Td>{u.name}<div className="text-xs text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></Td>
                      <Td>{term(u.buyerRole)}</Td>
                      <Td>{u.acceptedTermsVersion || '—'}</Td>
                      <Td>{u.isActive ? 'Yes' : 'No'}</Td>
                      <Td className="whitespace-nowrap text-right">{manage ? <>
                        <SaveButton listKey="User" id={u.id} data={{ buyerRole: u.buyerRole === 'admin' ? 'bidder' : 'admin' }} label={u.buyerRole === 'admin' ? 'Make bidder' : 'Make admin'} />
                        <SaveButton listKey="User" id={u.id} data={{ isActive: !u.isActive }} label={u.isActive ? 'Remove access' : 'Restore access'} variant={u.isActive ? 'danger' : 'raised'} />
                      </> : null}</Td>
                    </tr>
                  ))}
                </DataTable>
              ) : <Empty>No users.</Empty>}
            </Section>

            <Section title="Bids" count={c.bids.length}>
              {c.bids.length ? <DataTable label="Recent bids" head={[{ label: 'Lot' }, { label: 'Amount', className: 'text-right' }, { label: 'Status' }, { label: 'Placed' }]}>{c.bids.map((b: any) => <tr key={b.id}><Td><RowLink href={`/dashboard/platform/lots/${b.lot.id}`}>{b.lot.lotNumber}</RowLink> <span className="text-muted-foreground">{b.lot.title}</span></Td><Td className="text-right tabular-nums">{usd(b.amountMinor)}</Td><Td><Status value={b.status} /></Td><Td>{when(b.submittedAt)}</Td></tr>)}</DataTable> : <Empty>No bids.</Empty>}
            </Section>

            <Section title="Orders" count={c.orders.length}>
              {c.orders.length ? <DataTable label="Orders" head={[{ label: 'Order' }, { label: 'Lot' }, { label: 'Status' }, { label: 'Balance', className: 'text-right' }]}>{c.orders.map((x: any) => <tr key={x.id}><Td><RowLink href={`/dashboard/platform/orders/${x.id}`}>{x.orderNumber}</RowLink></Td><Td>{x.lot?.lotNumber}</Td><Td><Status value={x.status} /></Td><Td className="text-right tabular-nums">{usd(x.invoice?.balanceMinor)}</Td></tr>)}</DataTable> : <Empty>No orders.</Empty>}
            </Section>

            <Section title="Messages" count={c.messages.length}>
              {c.messages.length ? <ul className="grid gap-2 text-sm">{c.messages.map((m: any) => <li key={m.id} className="rounded-[6px] border px-3 py-2"><div className="text-xs text-muted-foreground">{when(m.createdAt)} · {m.fromStaff ? `Staff (${m.author?.name ?? ''})` : m.author?.name}</div><p className="whitespace-pre-line">{m.body}</p></li>)}</ul> : <Empty>No messages.</Empty>}
            </Section>
          </>
        )
      }}
    </PlatformPage>
  )
}

