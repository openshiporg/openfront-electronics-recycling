import { LOT_EDITABLE_WHEN_OPEN } from './rules/lifecycle'

/** Lot validate hook (§4.8). */
export async function validateLotInput(args: { operation: string; item?: any; resolvedData: any; addValidationError(m: string): void }) {
  const { item, resolvedData, addValidationError } = args
  const next = { ...(item ?? {}), ...resolvedData }
  if (next.opensAt && next.closesAt && new Date(next.closesAt) <= new Date(next.opensAt)) addValidationError('The close time must be after the open time.')
  if (next.format === 'fixed_price' && !(next.fixedPriceMinor > 0)) addValidationError('A fixed-price lot needs a price.')
  if (next.format === 'open_auction' && !(next.bidIncrementMinor > 0)) addValidationError('An open auction needs a bid increment.')
  if (next.format === 'fixed_price' && next.bidBasis === 'per_line') addValidationError('A fixed-price lot is sold as a whole; use lot total.')
  if (item && item.status !== 'draft') {
    const blocked = Object.keys(resolvedData).filter((key) => !LOT_EDITABLE_WHEN_OPEN.includes(key) && key !== 'updatedAt')
    if (['open', 'scheduled'].includes(item.status)) {
      if (blocked.length) addValidationError(`Once a lot is published only its description, photos and close time can change (not ${blocked.join(', ')}). Post an addendum for corrections.`)
      if (resolvedData.closesAt && item.closesAt && new Date(resolvedData.closesAt) < new Date(item.closesAt)) addValidationError('The close time can be extended, never shortened.')
    } else if (Object.keys(resolvedData).some((k) => !['description', 'conditionSummary', 'updatedAt', 'images'].includes(k))) {
      addValidationError('This lot is no longer open for changes.')
    }
  }
}

/** LotLine validate hook: frozen once the lot leaves draft. */
export async function lotLineMayChange(args: { operation: string; item?: any; resolvedData?: any; context: any; addValidationError(m: string): void }) {
  const lotId = args.resolvedData?.lot?.connect?.id ?? args.item?.lotId
  if (!lotId) return
  const lot = await args.context.prisma.lot.findUnique({ where: { id: lotId }, select: { status: true } })
  if (lot && lot.status !== 'draft') args.addValidationError('Lot lines are frozen once the lot is published. Post an addendum instead.')
}
