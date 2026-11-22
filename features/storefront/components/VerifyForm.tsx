'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export function VerifyForm({ initial }: { initial: string }) {
  const router = useRouter()
  const [code, setCode] = useState(initial)
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return (
    <form className="ar-verify" onSubmit={(e) => { e.preventDefault(); if (clean) router.push(`/verify/${clean}`) }}>
      <label className="ar-field" style={{ flex: 1 }}><span>Certificate code</span><input className="ar-input ar-mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder="12 letters and numbers" autoCapitalize="characters" autoComplete="off" spellCheck={false} required /></label>
      <button type="submit" className="ar-btn ar-btn-primary" disabled={!clean}><Search size={18} aria-hidden="true" /> Verify</button>
    </form>
  )
}
