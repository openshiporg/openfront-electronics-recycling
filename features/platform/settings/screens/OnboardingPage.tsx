import { PlatformPage } from '../../lib/page'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { Notice, Section } from '../../lib/ui'
import { RowLink } from '../../lib/view'
import { OnboardingForm } from './OnboardingForm'

const STEP_LINK: Record<string, string> = { roles: 'team?tab=roles', settings: 'settings', facility: 'facilities', categories: 'catalog', grades: 'catalog?tab=grades', accepted: 'catalog?tab=accepted', terms: 'settings', payments: 'payment-providers' }

/** T8: set up the business in one pass. Safe to run again: it only adds what is missing. */
export default async function OnboardingPage() {
  return (
    <PlatformPage route="/platform/onboarding" title="Onboarding" meta="Roles, business details, a facility, the catalogue, terms and payment providers in one pass. Running it again only fills gaps.">
      {async () => {
        const [status, s] = await Promise.all([
          platformQuery<any>('onboardingStatus', {}),
          listQuery<any>('query { s: storeSettings(where: { id: 1 }) { businessName legalName supportEmail supportPhone timezone weightUnit wireInstructions storefrontUrl } facilitiesCount clientOrganizationsCount }'),
        ])
        if (!status.ok) return <Notice tone="alert">{status.error}</Notice>
        const st = s.ok ? s.data.s ?? {} : {}
        return (
          <>
            <Section title={status.data.complete ? 'Set up' : 'Still to do'}>
              <ul className="grid gap-1 text-sm">
                {status.data.steps.map((x: any) => <li key={x.key} className="flex items-center gap-2"><span className={x.done ? 'text-emerald-600' : 'text-amber-600'}>{x.done ? 'Done' : 'To do'}</span> <RowLink href={`/dashboard/platform/${STEP_LINK[x.key] ?? 'settings'}`}>{x.label}</RowLink></li>)}
                <li className="flex items-center gap-2"><span className={status.data.cardPayments ? 'text-emerald-600' : 'text-muted-foreground'}>{status.data.cardPayments ? 'On' : 'Off'}</span> <RowLink href="/dashboard/platform/payment-providers">Card payments</RowLink>{status.data.cardPayments ? null : <span className="text-muted-foreground">(bank transfer works without it)</span>}</li>
              </ul>
            </Section>
            <Section title="Run onboarding">
              <OnboardingForm defaults={{ ...st, hasFacility: s.ok && s.data.facilitiesCount > 0, hasStarter: s.ok && s.data.clientOrganizationsCount > 0 }} />
            </Section>
          </>
        )
      }}
    </PlatformPage>
  )
}
