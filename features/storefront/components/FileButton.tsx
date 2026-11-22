'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { invoicePdfAction, orderDocumentAction } from '../lib/actions/buyer'
import { saveBase64 } from './lot/DownloadButton'

/** Downloads a PDF that a domain op renders ({ filename, mimeType, base64 }). */
export function FileButton({ what, id, kind, label }: { what: 'invoice' | 'order'; id: string; kind?: string; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div>
      <button type="button" className="ar-btn ar-btn-ghost ar-btn-sm" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        const r = what === 'invoice' ? await invoicePdfAction(id) : await orderDocumentAction(id, kind || 'packing_list')
        setBusy(false)
        if (r.ok) saveBase64(r.data); else setError(r.error)
      }}><Download size={16} aria-hidden="true" /> {busy ? 'Preparing…' : label}</button>
      {error ? <p className="ar-small" role="alert" style={{ color: 'var(--ar-red)', marginTop: 6 }}>{error}</p> : null}
    </div>
  )
}
