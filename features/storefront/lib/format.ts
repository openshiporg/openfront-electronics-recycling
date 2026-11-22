// Presentation helpers. Money is always integer minor units with the store currency;
// times are always shown in the store's time zone, with the zone named.

export function money(minor: number | null | undefined, currency = 'USD', opts: { whole?: boolean } = {}) {
  const value = (minor ?? 0) / 100
  const whole = opts.whole && Number.isInteger(value)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(value)
}

/** Parses "1,250.50" or "$1250" into minor units; null if not a price. */
export function toMinor(text: string): number | null {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return null
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

const ZONE_SHORT: Record<string, string> = { CST: 'CT', CDT: 'CT', EST: 'ET', EDT: 'ET', MST: 'MT', MDT: 'MT', PST: 'PT', PDT: 'PT', AKST: 'AKT', AKDT: 'AKT', HST: 'HT' }

function zoneName(date: Date, timeZone: string) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? ''
  return ZONE_SHORT[part] ?? part
}

function asDate(value: string | Date | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Fri 28 Nov, 3:00 PM CT" */
export function dateTime(value: string | Date | null | undefined, timeZone = 'America/Chicago') {
  const d = asDate(value)
  if (!d) return ''
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(',', '')
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(d)
  return `${day}, ${time} ${zoneName(d, timeZone)}`
}

/** "Fri 28 Nov 2026" */
export function date(value: string | Date | null | undefined, timeZone = 'America/Chicago') {
  const d = asDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(',', '')
}

/** For calendarDay strings ("2026-11-28") that must not shift with the zone. */
export function day(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d).replace(',', '')
}

export function remaining(ms: number) {
  if (ms <= 0) return 'Closed'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(sec).padStart(2, '0')}s`
}

const LABELS: Record<string, string> = {
  // lots and bids
  sealed_bid: 'Sealed bid', open_auction: 'Open auction', fixed_price: 'Fixed price', lot_total: 'Whole lot', per_line: 'By line',
  scheduled: 'Opens soon', open: 'Open', closed: 'Closed, result pending', awarded: 'Awarded', completed: 'Completed', unsold: 'Unsold', cancelled: 'Cancelled', draft: 'Draft',
  active: 'Active', superseded: 'Replaced', withdrawn: 'Withdrawn', won: 'Won', partially_won: 'Partly won', lost: 'Not this time', void: 'Void', expired: 'Expired', defaulted: 'Defaulted',
  web: 'Online', bid_sheet: 'Bid sheet', staff_entry: 'Entered by our team',
  // buyer company
  submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', needs_info: 'More information needed', rejected: 'Not approved', suspended: 'Suspended',
  taxable: 'Taxable', exempt_resale: 'Tax exempt (resale)', export: 'Export (no sales tax)',
  refurbisher: 'Refurbisher', reseller: 'Reseller', exporter: 'Exporter', recycler: 'Recycler', broker: 'Broker', other: 'Other',
  under_5k: 'Under $5,000', from_5k_to_25k: '$5,000 to $25,000', from_25k_to_100k: '$25,000 to $100,000', over_100k: 'Over $100,000',
  resale_certificate: 'Resale certificate', export_license: 'Export licence', business_registration: 'Business registration', w9: 'W-9', r2_certificate: 'R2 certificate', accepted: 'Accepted',
  // orders and invoices
  awaiting_payment: 'Awaiting payment', paid: 'Paid', ready_for_release: 'Ready to collect', released: 'Released', partially_paid: 'Partly paid', partially_refunded: 'Partly refunded', refunded: 'Refunded',
  lot_sale: 'Lot purchase', service: 'Services', settlement: 'Settlement', restocking: 'Restocking fee', storage: 'Storage',
  item: 'Item', premium: 'Buyer premium', tax: 'Sales tax', freight: 'Freight', card_fee: 'Card fee', adjustment: 'Adjustment',
  card: 'Card', ach: 'ACH', wire: 'Wire', cheque: 'Cheque', cash: 'Cash', reported: 'Reported, awaiting confirmation', confirmed: 'Confirmed', captured: 'Paid',
  pending: 'Pending', requires_action: 'Needs your action', failed: 'Failed', canceled: 'Cancelled', unknown: 'Being confirmed',
  pickup: 'Own pickup', drop_off: 'Drop-off', buyer_arranged: 'Buyer arranges freight', seller_quoted: 'We quote freight', pickup_only: 'Pickup only',
  // jobs
  requested: 'Requested', quoted: 'Quote sent', en_route: 'On the way', collected: 'Collected', received: 'Received at our facility', processing: 'Processing', settled: 'Settled', declined: 'Declined', on_hold: 'On hold',
  fee_for_service: 'Fee for service', revenue_share: 'Revenue share', buyout: 'Buyout',
  data_destruction: 'Certificate of data destruction', recycling: 'Certificate of recycling', data_destruction_cert: 'Certificate of data destruction',
  revoked: 'Revoked', issued: 'Valid', published: 'Published', disputed: 'Disputed',
  in_transit: 'In transit', missing: 'Missing', exception: 'Seal exception',
  custody_client_to_carrier: 'Collected from you', received_at_facility: 'Received at our facility',
  each: 'each', lb: 'lb', kg: 'kg', units: 'units', pallets: 'pallets',
}

/** Never show a raw enum: `awaiting_payment` reads "Awaiting payment". */
export function label(value: string | null | undefined) {
  if (!value) return ''
  if (LABELS[value]) return LABELS[value]
  const text = String(value).replace(/[_-]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

/** Keystone document JSON to plain paragraphs. */
export function docParagraphs(doc: any): Array<{ heading: boolean; text: string }> {
  if (!Array.isArray(doc)) return []
  const text = (n: any): string => (typeof n?.text === 'string' ? n.text : Array.isArray(n?.children) ? n.children.map(text).join('') : '')
  return doc.map((n) => ({ heading: n?.type === 'heading', text: text(n) })).filter((p) => p.text.trim())
}
