/** Shared organisation form spec (plain data, usable from server components). */
export function orgFields(o: any = {}, managers: Array<{ value: string; label: string }> = []) {
  return [
    { name: 'name', label: 'Name', required: true, defaultValue: o.name },
    { name: 'legalName', label: 'Legal name', defaultValue: o.legalName },
    { name: 'industry', label: 'Industry', defaultValue: o.industry, placeholder: 'Hospital, school district, bank…' },
    { name: 'billingEmail', label: 'Billing email', type: 'email' as const, defaultValue: o.billingEmail },
    { name: 'addressLine1', label: 'Address', defaultValue: o.addressLine1 }, { name: 'addressLine2', label: 'Address line 2', defaultValue: o.addressLine2 },
    { name: 'city', label: 'City', defaultValue: o.city }, { name: 'region', label: 'State or region', defaultValue: o.region },
    { name: 'postalCode', label: 'Postal code', defaultValue: o.postalCode }, { name: 'countryCode', label: 'Country', defaultValue: o.countryCode ?? 'US' },
    { name: 'taxId', label: 'Tax id', defaultValue: o.taxId },
    { name: 'status', label: 'Status', type: 'select' as const, options: [{ value: 'prospect', label: 'Prospect' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], defaultValue: o.status ?? 'active' },
    { name: 'defaultPricingModel', label: 'Default pricing', type: 'select' as const, options: [{ value: 'fee_for_service', label: 'Fee for service' }, { value: 'revenue_share', label: 'Revenue share' }, { value: 'buyout', label: 'Buyout' }], defaultValue: o.defaultPricingModel ?? 'fee_for_service' },
    { name: 'defaultRevenueShareBps', label: 'Client revenue share (%)', type: 'percent' as const, defaultValue: o.defaultRevenueShareBps, hint: 'Empty uses the store default.' },
    ...(managers.length ? [{ name: 'accountManager', label: 'Account manager', type: 'select' as const, relation: true, options: managers, defaultValue: o.accountManager?.id }] : []),
    { name: 'notes', label: 'Notes', type: 'textarea' as const, defaultValue: o.notes, wide: true },
  ]
}

export function siteFields(s: any = {}) {
  return [
    { name: 'name', label: 'Site name', required: true, defaultValue: s.name, placeholder: 'Main campus' },
    { name: 'addressLine1', label: 'Address', required: true, defaultValue: s.addressLine1 }, { name: 'addressLine2', label: 'Address line 2', defaultValue: s.addressLine2 },
    { name: 'city', label: 'City', defaultValue: s.city }, { name: 'region', label: 'State or region', defaultValue: s.region }, { name: 'postalCode', label: 'Postal code', defaultValue: s.postalCode },
    { name: 'contactName', label: 'On-site contact', defaultValue: s.contactName }, { name: 'contactPhone', label: 'Contact phone', defaultValue: s.contactPhone },
    { name: 'hours', label: 'Hours', defaultValue: s.hours },
    { name: 'hasDock', label: 'Loading dock', type: 'checkbox' as const, defaultValue: s.hasDock ?? false },
    { name: 'needsLiftgate', label: 'Needs a liftgate', type: 'checkbox' as const, defaultValue: s.needsLiftgate ?? false },
    { name: 'accessNotes', label: 'Access notes', type: 'textarea' as const, defaultValue: s.accessNotes, wide: true },
  ]
}
