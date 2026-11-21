import { sanitizationAllowsSale } from './rules/lifecycle'

/** Asset validate hook (§4.8): the data-bearing flag cannot be cleared to dodge the sanitisation gate on an allocated asset. */
export async function assertAssetMayChange(args: { operation: string; item?: any; resolvedData: any; addValidationError(m: string): void }) {
  const { item, resolvedData } = args
  if (!item) return
  const next = { ...item, ...resolvedData }
  if (['ready_for_sale', 'allocated', 'sold'].includes(item.status) && !sanitizationAllowsSale(next)) {
    args.addValidationError('This asset is for sale, so its data-bearing and storage details cannot be changed to fail the sanitisation rule.')
  }
  if (item.status === 'on_hold' && Object.keys(resolvedData).some((k) => !['testNotes', 'locationCode'].includes(k))) {
    args.addValidationError('This asset is on hold. Release the hold before changing it.')
  }
}
