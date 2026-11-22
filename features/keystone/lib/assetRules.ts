import { sanitizationAllowsSale } from './rules/lifecycle'

const FOR_SALE = ['ready_for_sale', 'allocated', 'sold']

/**
 * Asset validate hook (§4.8) for writes through the generated list API (updateAsset,
 * createAsset, context.db.Asset). `status` and `lotLine` are also closed to that API by
 * field access (models/fields.ts `status`, `readOnly`); this hook is the second wall, and
 * the one that still holds for a sudo write: an unsanitised data-bearing asset cannot be
 * put up for sale, put on a lot line, or have its flags changed to dodge the rule.
 * The domain mutations check the same rule under the asset row lock.
 */
export async function assertAssetMayChange(args: { operation: string; item?: any; resolvedData: any; addValidationError(m: string): void }) {
  const { item } = args
  // Keystone passes every field, with undefined for the ones this write does not set.
  const resolvedData: Record<string, any> = Object.fromEntries(Object.entries(args.resolvedData ?? {}).filter(([, v]) => v !== undefined))
  const next = { ...(item ?? {}), ...resolvedData }
  const lotLineSet = resolvedData.lotLine !== undefined ? Boolean(resolvedData.lotLine?.connect) : Boolean(item?.lotLineId)
  const forSale = FOR_SALE.includes(next.status) || lotLineSet
  if (forSale && !sanitizationAllowsSale({ isDataBearing: Boolean(next.isDataBearing), storageRemoved: Boolean(next.storageRemoved), sanitizationStatus: next.sanitizationStatus ?? 'pending' })) {
    args.addValidationError(item && FOR_SALE.includes(item.status) && !('status' in resolvedData) && resolvedData.lotLine === undefined
      ? 'This asset is for sale, so its data-bearing and storage details cannot be changed to fail the sanitisation rule.'
      : 'This asset is data-bearing and has not passed sanitisation, so it cannot be made ready for sale or put on a lot.')
  }
  if (item?.status === 'on_hold' && Object.keys(resolvedData).some((k) => !['testNotes', 'locationCode'].includes(k))) {
    args.addValidationError('This asset is on hold. Release the hold before changing it.')
  }
}
