'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { replyAction } from '../../lib/actions/buyer'

export function ReplyBox() {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form className="ar-form" style={{ marginTop: 12 }} onSubmit={async (e) => {
      e.preventDefault()
      setBusy(true); setMsg(null)
      const r = await replyAction(body)
      setBusy(false)
      if (r.ok) { setBody(''); setMsg({ ok: true, text: 'Sent. We reply by email and here.' }); router.refresh() }
      else setMsg({ ok: false, text: r.error })
    }}>
      <label className="ar-field"><span>Reply</span><textarea className="ar-textarea" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={4000} /></label>
      {msg ? <p className="ar-small" role={msg.ok ? 'status' : 'alert'} style={{ color: msg.ok ? 'var(--ar-green)' : 'var(--ar-red)' }}>{msg.text}</p> : null}
      <div><button className="ar-btn ar-btn-primary" type="submit" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send reply'}</button></div>
    </form>
  )
}
