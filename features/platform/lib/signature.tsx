'use client'

import { useEffect, useRef, useState } from 'react'
import { Pill } from './ui'

export type SignatureFile = { filename: string; mimeType: string; base64: string }

/**
 * Finger or mouse signature, returned as a PNG file input for the domain op
 * (collectJob, releaseOrder). Works at phone width.
 */
export function SignaturePad({ onChange, label = 'Signature' }: { onChange: (file: SignatureFile | null) => void; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    const canvas = ref.current!
    const ratio = window.devicePixelRatio || 1
    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width * ratio; canvas.height = height * ratio
      const ctx = canvas.getContext('2d')!
      ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
    }
    fit()
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }
  const finish = () => {
    if (!drawing.current) return
    drawing.current = false
    const data = ref.current!.toDataURL('image/png').split(',')[1]
    setSigned(true)
    onChange({ filename: 'signature.png', mimeType: 'image/png', base64: data })
  }
  const clear = () => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas.getBoundingClientRect()
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
    setSigned(false); onChange(null)
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <canvas
        ref={ref}
        aria-label={`${label} pad`}
        className="h-36 w-full touch-none rounded-[6px] border bg-white"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const ctx = ref.current!.getContext('2d')!; const [x, y] = point(e); ctx.beginPath(); ctx.moveTo(x, y) }}
        onPointerMove={(e) => { if (!drawing.current) return; const ctx = ref.current!.getContext('2d')!; const [x, y] = point(e); ctx.lineTo(x, y); ctx.stroke() }}
        onPointerUp={finish}
        onPointerLeave={finish}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{signed ? 'Signed.' : 'Sign inside the box.'}</span>
        <Pill size="sm" onClick={clear}>Clear</Pill>
      </div>
    </div>
  )
}
