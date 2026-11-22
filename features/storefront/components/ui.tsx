import Link from 'next/link'
import type { ReactNode } from 'react'
import { label } from '../lib/format'

export function PageHead({ title, lede, crumbs, children }: { title: ReactNode; lede?: ReactNode; crumbs?: Array<{ href?: string; label: string }>; children?: ReactNode }) {
  return (
    <div className="ar-page-head">
      <div className="ar-wrap ar-page-head-in">
        {crumbs?.length ? (
          <nav className="ar-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i}>
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                {i < crumbs.length - 1 ? <span aria-hidden="true"> /</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="ar-acct-head">
          <div>
            <h1>{title}</h1>
            {lede ? <p>{lede}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function SlashHead({ title, lede, as: Tag = 'h2' }: { title: ReactNode; lede?: ReactNode; as?: 'h1' | 'h2' }) {
  return (
    <div className="ar-slash-head">
      <span className="ar-slash" aria-hidden="true" />
      <div>
        <Tag>{title}</Tag>
        {lede ? <p>{lede}</p> : null}
      </div>
    </div>
  )
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'error' | 'ok'; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`ar-notice${tone === 'error' ? ' ar-notice-err' : tone === 'ok' ? ' ar-notice-ok' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </div>
  )
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="ar-empty">
      <h2>{title}</h2>
      {children ? <div>{children}</div> : null}
    </div>
  )
}

/** A failed read, in plain words, in place of the content. */
export function LoadError({ message }: { message: string }) {
  return (
    <Notice tone="error" title="This could not be loaded">
      {message} <Link className="ar-textlink" href="?">Try again</Link>
    </Notice>
  )
}

const GOOD = new Set(['approved', 'paid', 'won', 'completed', 'released', 'confirmed', 'captured', 'accepted', 'issued', 'closed', 'settled', 'ready_for_release'])
const BAD = new Set(['rejected', 'suspended', 'lost', 'void', 'defaulted', 'cancelled', 'canceled', 'failed', 'revoked', 'declined', 'expired', 'withdrawn'])
const ATTN = new Set(['needs_info', 'awaiting_payment', 'open', 'quoted', 'reported', 'requires_action', 'partially_paid', 'active', 'submitted'])

export function StatusPill({ status, text }: { status: string; text?: string }) {
  const tone = GOOD.has(status) ? ' ar-pill-ok' : BAD.has(status) ? ' ar-pill-bad' : ATTN.has(status) ? ' ar-pill-y' : ''
  return <span className={`ar-pill${tone}`}>{text ?? label(status)}</span>
}

/** Stage timeline: done, now, to come. */
export function Timeline({ stages, current, labels = {} }: { stages: string[]; current: string; labels?: Record<string, string> }) {
  const at = stages.indexOf(current)
  return (
    <ol className="ar-timeline" aria-label="Progress">
      {stages.map((s, i) => (
        <li key={s} data-state={at < 0 ? 'todo' : i < at ? 'done' : i === at ? 'now' : 'todo'} aria-current={i === at ? 'step' : undefined}>
          {labels[s] ?? label(s)}
        </li>
      ))}
    </ol>
  )
}

export function Tabs({ items, current }: { items: Array<{ href: string; label: string; key: string }>; current: string }) {
  return (
    <nav className="ar-tabs" aria-label="Sections">
      {items.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === current ? 'page' : undefined}>{t.label}</Link>
      ))}
    </nav>
  )
}
