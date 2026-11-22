import { PlatformPage, can, day, storeToday } from '../../lib/page'
import { DeleteButton, ItemDrawer, OpDrawer } from '../../lib/forms'
import { listQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Track, Td } from '../../lib/ui'

const NAMES = ['R2v3', 'e-Stewards', 'NAID AAA', 'ISO 14001', 'ISO 45001', 'ISO 9001', 'ISO 27001', 'RIOS', 'Other']

/** Y8: the recycler's own certifications. Public ones show on the website and on every certificate. */
export default async function CertificationsPage() {
  return (
    <PlatformPage route="/platform/certifications" title="Our certifications" meta="Only enter a certification you hold, with its certificate number from the certifying body.">
      {async (staff) => {
        const r = await listQuery<any>('query { certifications(orderBy: [{ expiresOn: asc }]) { id name otherName certificateNumber certifyingBody issuedOn expiresOn isPublic facility { id name } document { id filename } } facilities(orderBy: [{ name: asc }]) { id name } }')
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const manage = can(staff, 'canManageSettings', 'canManageDownstream')
        const upload = can(staff, 'canManageSettings', 'canIssueCertificates')
        const today = storeToday()
        const soon = storeToday(60)
        const fields = (c?: any) => [
          { name: 'name', label: 'Certification', type: 'select' as const, required: true, options: NAMES.map((n) => ({ value: n, label: n })), defaultValue: c?.name ?? 'R2v3' },
          { name: 'otherName', label: 'Name (when Other)', defaultValue: c?.otherName },
          { name: 'certificateNumber', label: 'Certificate number', required: true, defaultValue: c?.certificateNumber },
          { name: 'certifyingBody', label: 'Certifying body', required: true, defaultValue: c?.certifyingBody, placeholder: 'SERI / NSF / BSI' },
          { name: 'facility', label: 'Facility', type: 'select' as const, relation: true, options: r.data.facilities.map((f: any) => ({ value: f.id, label: f.name })), defaultValue: c?.facility?.id, hint: 'Leave empty if it covers the company.' },
          { name: 'issuedOn', label: 'Issued', type: 'date' as const, defaultValue: c?.issuedOn }, { name: 'expiresOn', label: 'Expires', type: 'date' as const, required: true, defaultValue: c?.expiresOn },
          { name: 'isPublic', label: 'Show on the website and certificates', type: 'checkbox' as const, defaultValue: c?.isPublic ?? true },
        ]
        const list = r.data.certifications
        return (
          <>
            {manage ? <Track><ItemDrawer listKey="Certification" title="Add a certification" trigger="Add certification" triggerVariant="primary" fields={fields()} /></Track> : null}
            {list.length ? (
              <DataTable label="Certifications" head={[{ label: 'Certification' }, { label: 'Number' }, { label: 'Body' }, { label: 'Facility' }, { label: 'Expires' }, { label: 'Document' }, { label: '' }]}>
                {list.map((c: any) => <tr key={c.id}>
                  <Td className="font-medium">{c.name === 'Other' ? c.otherName : c.name}{!c.isPublic ? <div className="text-xs text-muted-foreground">Not shown publicly</div> : null}</Td>
                  <Td className="font-mono text-xs">{c.certificateNumber || <span className="text-red-600">Missing</span>}</Td>
                  <Td>{c.certifyingBody}</Td><Td>{c.facility?.name ?? 'Company'}</Td>
                  <Td className={c.expiresOn && c.expiresOn < today ? 'text-red-600' : c.expiresOn && c.expiresOn < soon ? 'text-amber-600' : ''}>{day(c.expiresOn)}{c.expiresOn && c.expiresOn < today ? ' · expired' : ''}</Td>
                  <Td>{c.document ? <a className="text-xs underline" href={`/api/files/${c.document.id}`} target="_blank">{c.document.filename}</a> : '—'}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {manage ? <ItemDrawer listKey="Certification" id={c.id} title={`Edit ${c.name}`} trigger="Edit" fields={fields(c)} /> : null}
                    {upload ? <OpDrawer op="attachFile" fixed={{ target: 'certification_document', id: c.id }} title="Certificate document" description="The PDF from the certifying body." trigger="Upload" fields={[{ name: 'file', label: 'File', type: 'file', required: true, accept: 'application/pdf,image/*' }]} submitLabel="Upload" /> : null}
                    {manage ? <DeleteButton listKey="Certification" id={c.id} label="Remove" confirm={`Remove ${c.name}?`} /> : null}
                  </Td>
                </tr>)}
              </DataTable>
            ) : <Empty>No certifications entered.</Empty>}
          </>
        )
      }}
    </PlatformPage>
  )
}
