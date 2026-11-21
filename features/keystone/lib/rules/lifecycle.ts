// State machines (§3). Each table lists the statuses a transition may start from.

export const JOB_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  quote: { from: ['requested', 'quoted'], to: 'quoted' },
  accept: { from: ['quoted'], to: 'accepted' },
  decline: { from: ['quoted'], to: 'declined' },
  schedule: { from: ['accepted', 'scheduled'], to: 'scheduled' },
  depart: { from: ['scheduled'], to: 'en_route' },
  collect: { from: ['scheduled', 'en_route'], to: 'collected' },
  receive: { from: ['collected'], to: 'received' },
  start: { from: ['received'], to: 'processing' },
  complete: { from: ['received', 'processing'], to: 'completed' },
  settle: { from: ['completed'], to: 'settled' },
  close: { from: ['settled', 'completed'], to: 'closed' },
  cancel: { from: ['requested', 'quoted', 'accepted', 'scheduled', 'en_route'], to: 'cancelled' },
}

export const AFTER_COLLECTION = ['collected', 'received', 'processing', 'completed', 'settled']

export function jobTransition(action: keyof typeof JOB_TRANSITIONS | string, current: string) {
  const rule = JOB_TRANSITIONS[action]
  if (!rule) throw new Error(`Unknown job action ${action}.`)
  if (!rule.from.includes(current)) throw new Error(`A job that is ${current.replace(/_/g, ' ')} cannot be moved to ${rule.to.replace(/_/g, ' ')}.`)
  return rule.to
}

/** Asset may be marked ready for sale or put on a lot only when sanitisation allows. */
export function sanitizationAllowsSale(asset: { isDataBearing: boolean; sanitizationStatus: string; storageRemoved?: boolean }) {
  if (!asset.isDataBearing) return true
  if (asset.storageRemoved) return true
  return asset.sanitizationStatus === 'passed' || asset.sanitizationStatus === 'destroyed'
}

/** Sanitisation status from the records, oldest first (§4.8). */
export function sanitizationStatusFromRecords(isDataBearing: boolean, records: Array<{ method: string; result: string; completedAt?: Date | string | null; createdAt?: Date | string | null }>) {
  if (!records.length) return isDataBearing ? 'pending' : 'not_required'
  const sorted = [...records].sort((a, b) => new Date(a.completedAt ?? a.createdAt ?? 0).getTime() - new Date(b.completedAt ?? b.createdAt ?? 0).getTime())
  let state = isDataBearing ? 'pending' : 'not_required'
  for (const r of sorted) {
    if (r.result === 'failed') state = 'failed'
    else if (r.method === 'destroy') state = 'destroyed'
    else if (state !== 'destroyed') state = 'passed'
  }
  return state
}

/** A job may be completed only when every data-bearing asset is passed or destroyed. */
export function jobCompletionProblem(assets: Array<{ assetNumber: string; isDataBearing: boolean; sanitizationStatus: string; status: string }>) {
  const open = assets.filter((a) => a.isDataBearing && !['passed', 'destroyed'].includes(a.sanitizationStatus))
  if (open.length) return `${open.length} data-bearing asset${open.length === 1 ? '' : 's'} still need sanitisation (${open.slice(0, 5).map((a) => a.assetNumber).join(', ')}${open.length > 5 ? '…' : ''}).`
  return null
}

export const LOT_EDITABLE_WHEN_OPEN = ['title', 'description', 'conditionSummary', 'closesAt', 'images', 'palletCount', 'weight', 'dimensions', 'category', 'facility', 'slug', 'shippingTerms', 'exportAllowed', 'warrantyDays']
