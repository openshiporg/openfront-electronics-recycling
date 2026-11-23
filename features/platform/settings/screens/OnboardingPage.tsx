import { PlatformPage } from '../../lib/page'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { Notice, Section } from '../../lib/ui'
import { OnboardingForm } from './OnboardingForm'
import { OnboardingChecklist } from './OnboardingChecklist'

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
              <OnboardingChecklist initial={status.data} />
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
