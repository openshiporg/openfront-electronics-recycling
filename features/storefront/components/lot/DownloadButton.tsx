'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadAction } from '../../lib/actions/lots'

export function saveBase64(file: { filename: string; mimeType: string; base64: string }) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = file.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function DownloadButton({ kind, lotNumber, label, block }: { kind: 'manifest' | 'bidSheet'; lotNumber: string; label: string; block?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div>
      <button type="button" className={`ar-btn ar-btn-ghost ar-btn-sm${block ? ' ar-btn-block' : ''}`} disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        const r = await downloadAction(kind, lotNumber)
        setBusy(false)
        if (r.ok) saveBase64(r.data)
        else setError(r.error)
      }}>
        <Download size={16} aria-hidden="true" /> {busy ? 'Preparing…' : label}
      </button>
      {error ? <p className="ar-small" role="alert" style={{ color: 'var(--ar-red)', marginTop: 6 }}>{error}</p> : null}
    </div>
  )
}
