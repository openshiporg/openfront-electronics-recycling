import Link from 'next/link'
import { PlatformPage, usd, when, label } from '../../lib/page'
import { platformQuery } from '../../lib/platformRequest'
import { DataTable, Empty, Notice, Readouts, Section, Td } from '../../lib/ui'

type Summary = { tasks: Array<{ key: string; label: string; count: number; href: string }>; closingSoon?: Array<{ id: string; lotNumber: string; title: string; closesAt: string; format: string; bidCount: number }>; collectedTodayMinor?: number }

/** T9: what needs doing now, for the signed-in role. */
export default async function TodayPage() {
  return (
    <PlatformPage route="/platform/today" title="Today" meta="Work waiting for your role, oldest first in each queue.">
      {async () => {
        const result = await platformQuery<Summary>('todaySummary')
        if (!result.ok) return <Notice tone="alert">{result.error}</Notice>
        const s = result.data
        return (
          <>
            {s.collectedTodayMinor !== undefined ? <Readouts items={[{ label: 'Collected today', value: usd(s.collectedTodayMinor), tone: 'live' }, { label: 'Queues with work', value: s.tasks.length }]} /> : null}
            <Section title="Needs doing" count={s.tasks.reduce((n, t) => n + t.count, 0)}>
              {s.tasks.length ? (
                <ul className="divide-y rounded-[6px] border">
                  {s.tasks.map((t) => (
                    <li key={t.key}>
                      <Link href={t.href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                        <span>{t.label}</span>
                        <span className="font-semibold tabular-nums">{t.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <Empty>Nothing is waiting for your role right now.</Empty>}
            </Section>
            {s.closingSoon ? (
              <Section title="Lots closing next" count={s.closingSoon.length}>
                {s.closingSoon.length ? (
                  <DataTable label="Lots closing next" head={[{ label: 'Lot' }, { label: 'Format' }, { label: 'Bids', className: 'text-right' }, { label: 'Closes' }]}>
                    {s.closingSoon.map((l) => (
                      <tr key={l.id}>
                        <Td><Link className="font-medium hover:underline" href={`/dashboard/platform/lots/${l.id}`}>{l.lotNumber}</Link> <span className="text-muted-foreground">{l.title}</span></Td>
                        <Td>{label(l.format)}</Td>
                        <Td className="text-right tabular-nums">{l.bidCount}</Td>
                        <Td>{when(l.closesAt)}</Td>
                      </tr>
                    ))}
                  </DataTable>
                ) : <Empty>No open lots.</Empty>}
              </Section>
            ) : null}
          </>
        )
      }}
    </PlatformPage>
  )
}
