import { PlatformPage, can, label, usd } from '../../lib/page'
import { ItemDrawer, OpDrawer } from '../../lib/forms'
import { documentToText } from '../../lib/document'
import { listQuery, platformQuery } from '../../lib/platformRequest'
import { Notice, Section, Track } from '../../lib/ui'
import { Facts, RowLink } from '../../lib/view'

const SETTINGS = `query { s: storeSettings(where: { id: 1 }) {
  id businessName legalName tagline supportEmail supportPhone timezone currencyCode weightUnit storefrontUrl logo { id filename }
  publicLotVisibility defaultBidFormat defaultBidBasis defaultAwardMode softCloseWindowMinutes softCloseExtensionMinutes softCloseMaxExtensions bidValidityBusinessDays
  buyerPremiumBps salesTaxBps cardFeeBps cardMaxAmountMinor paymentDueBusinessDays paymentGraceBusinessDays restockingFeeBps strikesBeforeSuspension
  removalBusinessDays storageFeePerPalletPerDayMinor claimWindowBusinessDays claimVarianceBps defaultClientRevenueShareBps sanitizationVerificationSampleBps
  wireInstructions wholesaleTerms { document } wholesaleTermsVersion serviceTerms { document } serviceTermsVersion exportClause
  smtpHost smtpPort smtpUser smtpFrom
} }`

const pct = (bps: number | null | undefined) => `${((bps ?? 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
const days = (n: number) => `${n} business day${n === 1 ? '' : 's'}`

/** T3: every rule in §1.5, terms, bank instructions, email. Item 5: a plain email status; nothing waits on it. */
export default async function SettingsPage() {
  return (
    <PlatformPage route="/platform/settings" title="Settings" meta="The rules the site runs on. Changes apply to new bids, invoices and jobs; existing ones keep the rule they started with.">
      {async (staff) => {
        const [r, status] = await Promise.all([listQuery<any>(SETTINGS), platformQuery<any>('serviceStatus', {})])
        if (!r.ok) return <Notice tone="alert">{r.error}</Notice>
        const s = r.data.s
        if (!s) return <Notice tone="alert">Settings have not been created. Run onboarding first.</Notice>
        const manage = can(staff, 'canManageSettings')
        const edit = (title: string, fields: any[], description?: string) => manage ? <ItemDrawer listKey="StoreSettings" id="1" title={title} description={description} trigger="Edit" fields={fields} /> : null
        const email = status.ok ? status.data.email : null
        return (
          <div className="grid gap-5">
            <Section title="Email" actions={edit('Email (SMTP)', [
              { name: 'smtpHost', label: 'SMTP host', defaultValue: s.smtpHost, placeholder: 'smtp.yourprovider.com' },
              { name: 'smtpPort', label: 'Port', type: 'number', defaultValue: s.smtpPort ?? 587 },
              { name: 'smtpUser', label: 'User', defaultValue: s.smtpUser },
              { name: 'smtpPassword', label: 'Password', type: 'password', omitEmpty: true, hint: 'Leave empty to keep the current one.' },
              { name: 'smtpFrom', label: 'From address', type: 'email', defaultValue: s.smtpFrom, placeholder: 'notifications@yourdomain.com' },
            ], 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM in the server environment take precedence over these.')}>
              {!status.ok ? <Notice tone="alert">{status.error}</Notice> : email.configured ? (
                <p className="text-sm">Email is on. Sending through <span className="font-mono">{email.host}:{email.port}</span> from <span className="font-mono">{email.from}</span>, set in the {email.source === 'environment' ? 'server environment' : 'fields below'}. {email.notificationsEmailed} sent{email.notificationsFailed ? `, ${email.notificationsFailed} failed` : ''}.</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  <p><span className="font-medium">Outgoing email is not set up.</span> Nothing waits on it: every notice still appears in the person&apos;s notification list in their portal or dashboard, and every action works. Password-reset links are only sent by email, so until this is set, staff reset a portal user&apos;s password from their account page.</p>
                  <p>Missing: SMTP {email.missing.join(', ')}. To turn it on, set the SMTP host, port, user, password and from address with the Edit button here, or in the server environment as <span className="font-mono">SMTP_HOST</span>, <span className="font-mono">SMTP_PORT</span>, <span className="font-mono">SMTP_USER</span>, <span className="font-mono">SMTP_PASSWORD</span> and <span className="font-mono">SMTP_FROM</span>.</p>
                  {email.notificationsNotEmailed ? <p className="text-muted-foreground">{email.notificationsNotEmailed} notification(s) so far were shown in-app only.</p> : null}
                </div>
              )}
              {s.smtpHost ? <p className="mt-2 text-xs text-muted-foreground">Saved here: {s.smtpHost}{s.smtpPort ? `:${s.smtpPort}` : ''}{s.smtpUser ? ` as ${s.smtpUser}` : ''}{s.smtpFrom ? `, from ${s.smtpFrom}` : ''}.</p> : null}
            </Section>

            <Section title="Business" actions={<Track>
              {edit('Business details', [
                { name: 'businessName', label: 'Business name', required: true, defaultValue: s.businessName }, { name: 'legalName', label: 'Legal name', defaultValue: s.legalName },
                { name: 'tagline', label: 'Tagline', defaultValue: s.tagline, wide: true },
                { name: 'supportEmail', label: 'Support email', type: 'email', defaultValue: s.supportEmail }, { name: 'supportPhone', label: 'Support phone', defaultValue: s.supportPhone },
                { name: 'timezone', label: 'Time zone', required: true, defaultValue: s.timezone, hint: 'IANA name, for example America/Chicago.' },
                { name: 'weightUnit', label: 'Weight unit', type: 'select', options: [{ value: 'lb', label: 'Pounds' }, { value: 'kg', label: 'Kilograms' }], defaultValue: s.weightUnit },
                { name: 'storefrontUrl', label: 'Public site address', defaultValue: s.storefrontUrl, placeholder: 'https://recycle.example.com', wide: true, hint: 'Links in email, notices and certificates start with this. Empty: the address staff are using.' },
              ])}
              {manage ? <OpDrawer op="attachFile" fixed={{ target: 'logo' }} title="Logo" trigger="Logo" fields={[{ name: 'file', label: 'Image', type: 'file', required: true, accept: 'image/*' }]} submitLabel="Upload" /> : null}
            </Track>}>
              <Facts items={[['Name', s.businessName], ['Legal name', s.legalName], ['Tagline', s.tagline], ['Support', [s.supportEmail, s.supportPhone].filter(Boolean).join(' · ')], ['Time zone', s.timezone], ['Currency', s.currencyCode], ['Weight', s.weightUnit], ['Public site', s.storefrontUrl], ['Logo', s.logo ? <a key="l" className="underline" href={`/api/files/${s.logo.id}`} target="_blank">{s.logo.filename}</a> : '']]} />
            </Section>

            <Section title="Selling and bidding" actions={edit('Selling and bidding', [
              { name: 'publicLotVisibility', label: 'Lots shown to the public', type: 'select', options: [{ value: 'teaser', label: 'Teaser (title, photos, count)' }, { value: 'full', label: 'Full manifest' }, { value: 'hidden', label: 'Hidden' }], defaultValue: s.publicLotVisibility },
              { name: 'defaultBidFormat', label: 'Default format', type: 'select', options: [{ value: 'sealed_bid', label: 'Sealed bid' }, { value: 'open_auction', label: 'Open ascending' }, { value: 'fixed_price', label: 'Fixed price' }], defaultValue: s.defaultBidFormat },
              { name: 'defaultBidBasis', label: 'Default bid basis', type: 'select', options: [{ value: 'lot_total', label: 'Lot total' }, { value: 'per_line', label: 'Per line' }], defaultValue: s.defaultBidBasis },
              { name: 'defaultAwardMode', label: 'Default award', type: 'select', options: [{ value: 'manual', label: 'Staff award' }, { value: 'auto', label: 'Highest valid bid at close' }], defaultValue: s.defaultAwardMode },
              { name: 'softCloseWindowMinutes', label: 'Soft close window (minutes)', type: 'number', required: true, defaultValue: s.softCloseWindowMinutes },
              { name: 'softCloseExtensionMinutes', label: 'Extend by (minutes)', type: 'number', required: true, defaultValue: s.softCloseExtensionMinutes },
              { name: 'softCloseMaxExtensions', label: 'Most extensions', type: 'number', required: true, defaultValue: s.softCloseMaxExtensions },
              { name: 'bidValidityBusinessDays', label: 'Bids stay valid (business days after close)', type: 'number', required: true, defaultValue: s.bidValidityBusinessDays },
              { name: 'buyerPremiumBps', label: 'Buyer premium (%)', type: 'percent', defaultValue: s.buyerPremiumBps },
              { name: 'strikesBeforeSuspension', label: 'Defaults before suspension', type: 'number', required: true, defaultValue: s.strikesBeforeSuspension },
            ])}>
              <Facts items={[['Public lots', label(s.publicLotVisibility)], ['Default format', `${label(s.defaultBidFormat)}, ${label(s.defaultBidBasis)}, ${s.defaultAwardMode === 'manual' ? 'staff award' : 'auto award'}`], ['Soft close', `Bids in the last ${s.softCloseWindowMinutes} min extend by ${s.softCloseExtensionMinutes} min, at most ${s.softCloseMaxExtensions} times`], ['Bid validity', days(s.bidValidityBusinessDays)], ['Buyer premium', pct(s.buyerPremiumBps)], ['Suspension', `after ${s.strikesBeforeSuspension} defaults`]]} />
            </Section>

            <Section title="Payment, removal and claims" actions={edit('Payment, removal and claims', [
              { name: 'paymentDueBusinessDays', label: 'Payment due (business days)', type: 'number', required: true, defaultValue: s.paymentDueBusinessDays },
              { name: 'paymentGraceBusinessDays', label: 'Grace before default (business days)', type: 'number', required: true, defaultValue: s.paymentGraceBusinessDays },
              { name: 'salesTaxBps', label: 'Sales tax (%)', type: 'percent', defaultValue: s.salesTaxBps, hint: 'Not charged to buyers with an accepted resale certificate.' },
              { name: 'cardFeeBps', label: 'Card fee (%)', type: 'percent', defaultValue: s.cardFeeBps },
              { name: 'cardMaxAmountMinor', label: 'Largest card payment', type: 'money', defaultValue: s.cardMaxAmountMinor, hint: 'Empty for no cap.' },
              { name: 'restockingFeeBps', label: 'Restocking fee on default (%)', type: 'percent', defaultValue: s.restockingFeeBps },
              { name: 'removalBusinessDays', label: 'Removal window (business days after payment)', type: 'number', required: true, defaultValue: s.removalBusinessDays },
              { name: 'storageFeePerPalletPerDayMinor', label: 'Storage fee per pallet per day', type: 'money', defaultValue: s.storageFeePerPalletPerDayMinor },
              { name: 'claimWindowBusinessDays', label: 'Claim window (business days after release)', type: 'number', required: true, defaultValue: s.claimWindowBusinessDays },
              { name: 'claimVarianceBps', label: 'Claim threshold (% of the order)', type: 'percent', defaultValue: s.claimVarianceBps },
              { name: 'wireInstructions', label: 'Bank transfer instructions', type: 'textarea', defaultValue: s.wireInstructions, wide: true, hint: 'Shown only to a buyer or client with an open invoice.' },
            ])}>
              <Facts items={[['Due', `${days(s.paymentDueBusinessDays)}, then ${days(s.paymentGraceBusinessDays)} grace`], ['Tax', pct(s.salesTaxBps)], ['Card fee', `${pct(s.cardFeeBps)}${s.cardMaxAmountMinor ? `, cards up to ${usd(s.cardMaxAmountMinor)}` : ''}`], ['Restocking fee', pct(s.restockingFeeBps)], ['Removal', `${days(s.removalBusinessDays)}, then ${usd(s.storageFeePerPalletPerDayMinor)} per pallet per day`], ['Claims', `${days(s.claimWindowBusinessDays)}, over ${pct(s.claimVarianceBps)} of the order`], ['Bank instructions', s.wireInstructions ? 'Set' : <span key="w" className="text-red-600">Not set: buyers see no transfer details</span>]]} />
            </Section>

            <Section title="Recycling services" actions={edit('Recycling services', [
              { name: 'defaultClientRevenueShareBps', label: 'Default client revenue share (%)', type: 'percent', defaultValue: s.defaultClientRevenueShareBps },
              { name: 'sanitizationVerificationSampleBps', label: 'Sanitisation verification sample (%)', type: 'percent', defaultValue: s.sanitizationVerificationSampleBps },
            ])}>
              <Facts items={[['Client revenue share', pct(s.defaultClientRevenueShareBps)], ['Verification sample', pct(s.sanitizationVerificationSampleBps)]]} />
              <p className="mt-2 text-sm text-muted-foreground">Accepted items and their fees are under <RowLink href="/dashboard/platform/catalog">Catalogue</RowLink>; hours and dock capacity under <RowLink href="/dashboard/platform/facilities">Facilities</RowLink>.</p>
            </Section>

            <Section title="Terms" actions={edit('Terms', [
              { name: 'wholesaleTerms', label: 'Wholesale terms (buyers)', type: 'document', defaultValue: documentToText(s.wholesaleTerms?.document), wide: true },
              { name: 'wholesaleTermsVersion', label: 'Wholesale terms version', defaultValue: s.wholesaleTermsVersion, hint: 'Change it and every buyer must accept again before bidding.' },
              { name: 'serviceTerms', label: 'Service terms (clients)', type: 'document', defaultValue: documentToText(s.serviceTerms?.document), wide: true },
              { name: 'serviceTermsVersion', label: 'Service terms version', defaultValue: s.serviceTermsVersion },
              { name: 'exportClause', label: 'Export clause', type: 'textarea', defaultValue: s.exportClause, wide: true },
            ])}>
              <Facts items={[['Wholesale terms', `Version ${s.wholesaleTermsVersion}${documentToText(s.wholesaleTerms?.document) ? '' : ' (empty)'}`], ['Service terms', `Version ${s.serviceTermsVersion}${documentToText(s.serviceTerms?.document) ? '' : ' (empty)'}`], ['Export clause', s.exportClause ? 'Set' : '']]} />
            </Section>
          </div>
        )
      }}
    </PlatformPage>
  )
}
