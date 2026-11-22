import { randomBytes } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { fail, nextNumber, type Ctx } from '../lib/core'
import { getSettings, type FileInput } from '../lib/services'
import { renderPdf } from '../lib/pdf'
import { registerBuyer, saveBuyerApplication, uploadBuyerDocument, submitBuyerApplication, reviewBuyerApplication, reviewBuyerDocument } from './buyers'
import { requestJob, quoteJob, acceptJobQuote, scheduleJob, startJobRoute, collectJob, receiveContainer, completeJob } from './jobs'
import { auditAsset, recordSanitization, verifySanitization, setAssetDisposition, issueCertificate } from './process'
import { createLotFromAssets, publishSaleEvent, placeBid, advanceLotClock, awardLot } from './lots'
import { recordOfflinePayment } from './money'

// §4.11 "full" template: working records for a recycler that wants to see every
// screen with real data on day one. Everything goes through the same domain
// functions staff, clients and buyers use, so numbers, custody events, audit log,
// notifications and every lifecycle rule are real. Safe to run twice: the second
// run finds the first buyer company and stops.

type Person = { id: string; name: string; email: string }
type Login = { portal: 'buyer' | 'client' | 'staff'; name: string; email: string; organisation: string; status?: string; role?: string }

const doc = (text: string) => [{ type: 'paragraph', children: [{ text }] }]
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const DAY = 86_400_000

// ---------------------------------------------------------------- files

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf: Buffer) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** A pen-stroke signature image (grayscale PNG), different for each signer. */
function signaturePng(name: string): FileInput {
  const w = 320, h = 96
  const seed = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0)
  const px = Buffer.alloc((w + 1) * h, 255)
  for (let r = 0; r < h; r++) px[r * (w + 1)] = 0
  const dot = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.round(x + dx), yy = Math.round(y + dy)
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) px[yy * (w + 1) + 1 + xx] = 30
    }
  }
  for (let t = 0; t < 1; t += 0.0004) {
    const x = 20 + t * 270
    const y = 50 + Math.sin(t * (14 + (seed % 7))) * 22 * (1 - t * 0.5) + Math.sin(t * 61 + seed) * 6
    dot(x, y)
  }
  for (let x = 30; x < 290; x += 0.5) dot(x, 82)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(px)), pngChunk('IEND', Buffer.alloc(0))])
  return { filename: `signature-${slugify(name)}.png`, mimeType: 'image/png', base64: png.toString('base64') }
}

async function resaleCertificatePdf(company: string, state: string, number: string): Promise<FileInput> {
  const bytes = await renderPdf({
    header: `${state} sales and use tax resale certificate`,
    blocks: [
      { kind: 'title', text: 'Resale certificate' },
      { kind: 'pairs', pairs: [['Purchaser', company], ['State', state], ['Permit number', number], ['Type of business', 'Wholesale purchase of used IT equipment for resale']] },
      { kind: 'text', text: 'The purchaser certifies that the property purchased is for resale in the regular course of business.' },
      { kind: 'signature', label: 'Authorised signature' },
    ],
  })
  return { filename: `resale-certificate-${state}.pdf`, mimeType: 'application/pdf', base64: Buffer.from(bytes).toString('base64') }
}

// ---------------------------------------------------------------- people

const BUYERS = [
  { key: 'northgate', person: 'Dana Ruiz', legalName: 'Northgate Refurbishing LLC', tradingName: 'Northgate Refurb', businessType: 'refurbisher', band: 'from_25k_to_100k', address: ['4410 Industrial Pkwy', 'Columbus', 'OH', '43228'], phone: '(614) 555-0142', website: 'northgaterefurb.com', taxId: '82-4417730', state: 'OH', permit: '98-213447', outcome: 'approve', taxStatus: 'exempt_resale' },
  { key: 'bluewater', person: 'Marcus Feld', legalName: 'Bluewater IT Asset Trading Inc.', tradingName: 'Bluewater ITAD', businessType: 'reseller', band: 'over_100k', address: ['220 Harbor Point Blvd, Suite 300', 'Cleveland', 'OH', '44114'], phone: '(216) 555-0187', website: 'bluewaterita.com', taxId: '47-1022815', state: 'OH', permit: '98-551203', outcome: 'approve', taxStatus: 'taxable' },
  { key: 'copperline', person: 'Aisha Okafor', legalName: 'Copperline Electronics Recovery LLC', tradingName: '', businessType: 'recycler', band: 'from_5k_to_25k', address: ['1875 Rail Yard Rd', 'Fort Wayne', 'IN', '46803'], phone: '(260) 555-0119', website: 'copperline-recovery.com', taxId: '35-2290614', state: 'IN', permit: '0031874620', outcome: 'submitted', taxStatus: 'taxable' },
  { key: 'atlas', person: 'Tom Brannigan', legalName: 'Atlas Device Brokers LLC', tradingName: 'Atlas Devices', businessType: 'broker', band: 'from_5k_to_25k', address: ['9 Commerce Sq', 'Pittsburgh', 'PA', '15222'], phone: '(412) 555-0164', website: 'atlasdevices.com', taxId: '23-3318842', state: 'PA', permit: '7240-1188', outcome: 'request_info', taxStatus: 'taxable' },
] as const

const CLIENTS = [
  { key: 'meridian', name: 'Meridian Health Partners', legalName: 'Meridian Health Partners, Inc.', industry: 'Healthcare', person: 'Laura Chen', phone: '(614) 555-0110', sites: [
    { name: 'Riverside main campus', addressLine1: '1200 Riverside Dr', city: 'Columbus', region: 'OH', postalCode: '43215', contactName: 'Laura Chen', contactPhone: '(614) 555-0110', hasDock: true, needsLiftgate: false, accessNotes: 'Loading dock B behind the parking garage. Check in with security.', hours: 'Mon-Fri 7:00-15:00' },
    { name: 'Westside clinic', addressLine1: '3380 W Broad St', city: 'Columbus', region: 'OH', postalCode: '43204', contactName: 'Ray Ortiz', contactPhone: '(614) 555-0133', hasDock: false, needsLiftgate: true, accessNotes: 'Street-level entrance; equipment is in the basement storage room.', hours: 'Mon-Fri 8:00-16:00' },
  ] },
  { key: 'larkspur', name: 'Larkspur Community Credit Union', legalName: 'Larkspur Community Credit Union', industry: 'Financial services', person: 'Gary Whitfield', phone: '(937) 555-0176', sites: [
    { name: 'Operations centre', addressLine1: '75 Commerce Center Dr', city: 'Dayton', region: 'OH', postalCode: '45402', contactName: 'Gary Whitfield', contactPhone: '(937) 555-0176', hasDock: true, needsLiftgate: false, accessNotes: 'Server room equipment staged at the rear dock.', hours: 'Mon-Fri 8:00-17:00' },
  ] },
  { key: 'halvorsen', name: 'Halvorsen Engineering Group', legalName: 'Halvorsen Engineering Group LLC', industry: 'Engineering', person: 'Ingrid Halvorsen', phone: '(513) 555-0158', sites: [
    { name: 'Head office', addressLine1: '600 Vine St, Floor 12', city: 'Cincinnati', region: 'OH', postalCode: '45202', contactName: 'Ingrid Halvorsen', contactPhone: '(513) 555-0158', hasDock: false, needsLiftgate: true, accessNotes: 'Freight elevator booked through building management, 24 h notice.', hours: 'Mon-Fri 9:00-17:00' },
  ] },
] as const

const STAFF = [
  { key: 'driver', name: 'Marcus Bell', role: 'Driver' },
  { key: 'technician', name: 'Priya Natarajan', role: 'Technician' },
] as const

// ---------------------------------------------------------------- equipment

type AssetPlan = { category: string; manufacturer: string; model: string; partNumber?: string; specs: Record<string, string | number>; weight: number; count: number; grades: Array<[string, string]>; wipe: 'purge' | 'shred' | 'clear' | 'none' | 'shred_after_fail'; pending?: number; failed?: number; disposition: 'resale' | 'recycle' | 'undecided' }

const JOB_ONE: AssetPlan[] = [
  { category: 'Laptops', manufacturer: 'Dell', model: 'Latitude 5420', specs: { cpu: 'Core i5-1145G7', ramGb: 16, storage: '256 GB NVMe SSD', screen: '14" FHD' }, weight: 3.4, count: 24, grades: [['A', 'F1'], ['B', 'F1'], ['B', 'F1'], ['B', 'F2']], wipe: 'purge', disposition: 'resale' },
  { category: 'Desktops', manufacturer: 'HP', model: 'EliteDesk 800 G6 SFF', specs: { cpu: 'Core i5-10500', ramGb: 16, storage: '512 GB SSD' }, weight: 11.8, count: 12, grades: [['B', 'F1'], ['A', 'F1']], wipe: 'purge', disposition: 'resale' },
  { category: 'Monitors', manufacturer: 'Dell', model: 'P2419H', specs: { size: '24"', resolution: '1920x1080' }, weight: 11.2, count: 10, grades: [['B', 'F1'], ['C', 'F1']], wipe: 'none', disposition: 'resale' },
  { category: 'Laptops', manufacturer: 'Lenovo', model: 'ThinkPad T480', specs: { cpu: 'Core i5-8350U', ramGb: 8, storage: '256 GB SSD' }, weight: 3.6, count: 6, grades: [['D', 'F4']], wipe: 'shred', disposition: 'recycle' },
  { category: 'Hard drives', manufacturer: 'Seagate', model: 'Exos 7E8 2TB', partNumber: 'ST2000NM0055', specs: { capacity: '2 TB', interface: 'SATA 6Gb/s' }, weight: 1.4, count: 8, grades: [['C', 'F3']], wipe: 'shred_after_fail', failed: 2, disposition: 'recycle' },
  { category: 'Mobile phones', manufacturer: 'Apple', model: 'iPhone 11', specs: { storage: '64 GB', carrier: 'Unlocked' }, weight: 0.4, count: 10, grades: [['B', 'F1'], ['A', 'F1'], ['C', 'F2']], wipe: 'purge', disposition: 'resale' },
]

const JOB_TWO: AssetPlan[] = [
  { category: 'Desktops', manufacturer: 'Dell', model: 'OptiPlex 7090 Micro', specs: { cpu: 'Core i5-10500T', ramGb: 16, storage: '256 GB SSD' }, weight: 2.9, count: 20, grades: [['B', 'F1'], ['A', 'F1']], wipe: 'purge', pending: 6, disposition: 'resale' },
  { category: 'Servers', manufacturer: 'Dell', model: 'PowerEdge R640', specs: { cpu: '2x Xeon Silver 4214', ramGb: 192, storage: '4x 1.2 TB SAS' }, weight: 37.5, count: 6, grades: [['B', 'F1']], wipe: 'purge', pending: 2, disposition: 'undecided' },
  { category: 'Networking', manufacturer: 'Cisco', model: 'Catalyst 2960X-48FPD-L', partNumber: 'WS-C2960X-48FPD-L', specs: { ports: '48x 1G PoE+, 2x 10G SFP+' }, weight: 11.9, count: 8, grades: [['B', 'F1']], wipe: 'clear', disposition: 'undecided' },
  { category: 'Laptops', manufacturer: 'Lenovo', model: 'ThinkPad T14 Gen 2', specs: { cpu: 'Core i5-1135G7', ramGb: 16, storage: '512 GB SSD' }, weight: 3.3, count: 16, grades: [['B', 'F1'], ['C', 'F2']], wipe: 'purge', pending: 3, failed: 1, disposition: 'undecided' },
]

const SERIAL_PREFIX: Record<string, string> = { Dell: '', HP: 'MXL', Lenovo: 'PF', Seagate: 'ZC', Apple: 'F2L', Cisco: 'FOC' }
function serialFor(manufacturer: string) {
  const alphabet = 'BCDFGHJKLMNPQRSTVWXYZ0123456789'
  const bytes = randomBytes(10)
  const body = [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
  return manufacturer === 'Dell' ? body.slice(0, 7) : `${SERIAL_PREFIX[manufacturer] ?? ''}${body.slice(0, 8)}`
}

// ---------------------------------------------------------------- run

export type StarterResult = {
  skipped?: boolean
  password?: string
  logins: Login[]
  records: Record<string, unknown>
}

export async function seedStarterRecords(context: Ctx, options: { password?: string; supportEmail?: string; businessName: string }): Promise<StarterResult> {
  const base: any = context
  if (typeof base.withSession !== 'function') fail('Starter records need a signed-in session.')
  const prisma = context.prisma
  const ownerId = context.session!.itemId
  const settings = await getSettings(prisma)

  // Logins use plus-addresses on the business's own support mailbox, so any email
  // these accounts receive lands with the operator, never with a stranger.
  const mailbox = String(options.supportEmail || settings.supportEmail || '').toLowerCase()
  const [local, domain] = mailbox.includes('@') ? mailbox.split('@') : ['accounts', `${slugify(options.businessName) || 'recycler'}.local`]
  const emailFor = (tag: string) => `${local}+${tag}@${domain}`

  const already = await prisma.user.findUnique({ where: { email: emailFor('northgate') }, select: { id: true } })
  if (already) {
    const logins: Login[] = [
      ...BUYERS.map((b) => ({ portal: 'buyer' as const, name: b.person, email: emailFor(b.key), organisation: b.legalName })),
      ...CLIENTS.map((c) => ({ portal: 'client' as const, name: c.person, email: emailFor(c.key), organisation: c.name })),
      ...STAFF.map((s) => ({ portal: 'staff' as const, name: s.name, email: emailFor(s.key), organisation: options.businessName, role: s.role })),
    ]
    return { skipped: true, logins, records: { note: 'Starter records already exist. Passwords were shown when they were created; reset them from Team or the sign-in page.' } }
  }

  const password = options.password && options.password.length >= 10 ? options.password : `${randomBytes(9).toString('base64url')}-Rc1`
  const logins: Login[] = []
  const records: Record<string, any> = {}

  const sessionFor = async (userId: string) => {
    const u = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, buyerCompany: { select: { id: true, status: true } }, clientOrganization: { select: { id: true, status: true } } } })
    return base.withSession({ itemId: u.id, listKey: 'User', data: { name: u.name, email: u.email, kind: u.kind, isActive: u.isActive, buyerRole: u.buyerRole, clientRole: u.clientRole, onboardingStatus: u.onboardingStatus, buyerCompany: u.buyerCompany, clientOrganization: u.clientOrganization, role: u.role } }) as Ctx
  }
  const owner = await sessionFor(ownerId)
  const sudo = base.sudo()

  // Staff: a driver and a technician, on the onboarding roles.
  const staff: Record<string, Person> = {}
  for (const s of STAFF) {
    const role = await prisma.role.findFirst({ where: { name: s.role } })
    if (!role) fail(`The ${s.role} role is missing; run onboarding first.`)
    const user = await sudo.db.User.createOne({ data: { name: s.name, email: emailFor(s.key), password, kind: 'staff', role: { connect: { id: role.id } } } })
    staff[s.key] = { id: user.id, name: s.name, email: emailFor(s.key) }
    logins.push({ portal: 'staff', name: s.name, email: emailFor(s.key), organisation: options.businessName, role: s.role })
  }
  const technician = await sessionFor(staff.technician.id)
  const driver = await sessionFor(staff.driver.id)

  // Grades and categories from onboarding.
  const grades = new Map<string, string>((await prisma.gradeDefinition.findMany()).map((g: any) => [`${g.kind}:${g.code}`, g.id]))
  const categories = new Map<string, string>((await prisma.materialCategory.findMany()).map((c: any) => [c.name, c.id]))
  const cat = (name: string) => categories.get(name) ?? null

  // ------------------------------------------------ buyers (P7 + S1)
  const buyerUsers: Record<string, { userId: string; companyId: string }> = {}
  for (const b of BUYERS) {
    const email = emailFor(b.key)
    const reg = await registerBuyer(base, { name: b.person, email, password, phone: b.phone, legalName: b.legalName, countryCode: 'US' })
    const asBuyer = await sessionFor(reg.userId)
    await saveBuyerApplication(asBuyer, {
      tradingName: b.tradingName, addressLine1: b.address[0], city: b.address[1], region: b.address[2], postalCode: b.address[3], countryCode: 'US', phone: b.phone, website: b.website, taxId: b.taxId,
      businessType: b.businessType, monthlySpendBand: b.band, destinationCountries: ['US', 'CA'], categoryIds: [cat('Laptops'), cat('Desktops'), cat('Servers'), cat('Networking')].filter(Boolean),
    })
    await uploadBuyerDocument(asBuyer, { type: 'resale_certificate', file: await resaleCertificatePdf(b.legalName, b.state, b.permit), state: b.state, expiresOn: new Date(Date.now() + 700 * DAY).toISOString().slice(0, 10) })
    await submitBuyerApplication(asBuyer, { acceptTermsVersion: settings.wholesaleTermsVersion })
    if (b.outcome === 'approve') {
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: 'open' })
      const docs = await prisma.buyerDocument.findMany({ where: { companyId: reg.companyId } })
      for (const d of docs) await reviewBuyerDocument(owner, { documentId: d.id, status: 'accepted', note: 'Permit number checked with the state register.' })
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: 'approve', taxStatus: b.taxStatus, spendLimitMinor: b.key === 'northgate' ? 25_000_000 : null, message: `Welcome aboard. ${b.legalName} is approved to bid on every open lot.` })
    } else if (b.outcome === 'request_info') {
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: 'open' })
      await reviewBuyerApplication(owner, { companyId: reg.companyId, action: 'request_info', message: 'The resale certificate you uploaded has expired on the state register. Please upload your current Pennsylvania certificate (REV-1220) so we can finish the review.' })
    }
    buyerUsers[b.key] = { userId: reg.userId, companyId: reg.companyId }
    const status = (await prisma.buyerCompany.findUnique({ where: { id: reg.companyId }, select: { status: true } })).status
    logins.push({ portal: 'buyer', name: b.person, email, organisation: b.legalName, status })
  }
  records.buyers = BUYERS.map((b) => b.legalName)

  // ------------------------------------------------ clients (T1, T2)
  const orgs: Record<string, { id: string; userId: string; siteIds: string[] }> = {}
  for (const c of CLIENTS) {
    const site0 = c.sites[0]
    const org = await sudo.db.ClientOrganization.createOne({ data: { name: c.name, legalName: c.legalName, industry: c.industry, billingEmail: emailFor(`${c.key}-ap`), addressLine1: site0.addressLine1, city: site0.city, region: site0.region, postalCode: site0.postalCode, countryCode: 'US', status: 'active', defaultPricingModel: c.key === 'meridian' ? 'revenue_share' : 'fee_for_service', accountManager: { connect: { id: ownerId } } } })
    const siteIds: string[] = []
    for (const s of c.sites) siteIds.push((await sudo.db.ClientSite.createOne({ data: { ...s, countryCode: 'US', organization: { connect: { id: org.id } } } })).id)
    const user = await sudo.db.User.createOne({ data: { name: c.person, email: emailFor(c.key), password, phone: c.phone, kind: 'client', clientRole: 'admin', clientOrganization: { connect: { id: org.id } } } })
    orgs[c.key] = { id: org.id, userId: user.id, siteIds }
    logins.push({ portal: 'client', name: c.person, email: emailFor(c.key), organisation: c.name })
  }

  // ------------------------------------------------ jobs (K1-K7)
  const today = new Date()
  const dateIn = (days: number) => new Date(today.getTime() + days * DAY).toISOString().slice(0, 10)
  const siteOf = (key: keyof typeof orgs, i = 0) => {
    const s = CLIENTS.find((c) => c.key === key)!.sites[i]
    return { addressLine1: s.addressLine1, city: s.city, region: s.region, postalCode: s.postalCode, countryCode: 'US', hasDock: s.hasDock, needsLiftgate: s.needsLiftgate, accessNotes: s.accessNotes, hours: s.hours }
  }
  const newJob = async (key: keyof typeof orgs, siteIndex: number, notes: string, estimate: Array<[string, number, string]>) => {
    const c = CLIENTS.find((x) => x.key === key)!
    const out = await requestJob(owner, { organizationId: orgs[key].id, siteId: orgs[key].siteIds[siteIndex], contactName: c.sites[siteIndex].contactName, contactEmail: emailFor(key), contactPhone: c.sites[siteIndex].contactPhone, site: siteOf(key, siteIndex), requestedDates: [dateIn(3), dateIn(4)], hasDataBearing: true, services: ['pickup', 'data_destruction', 'itad'], estimate: estimate.map(([category, quantity, unit]) => ({ categoryId: cat(category), quantity, unit })), notes })
    return out.jobId as string
  }
  const acceptAs = async (key: keyof typeof orgs, jobId: string) => {
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    const c = CLIENTS.find((x) => x.key === key)!
    await acceptJobQuote(await sessionFor(orgs[key].userId), { jobNumber: job.jobNumber, signatureName: c.person, termsVersion: settings.serviceTermsVersion })
  }
  const collect = async (jobId: string, key: keyof typeof orgs, containers: Array<{ label: string; type: string; sealNumber: string; itemCountDeclared: number; grossWeight: number }>) => {
    await scheduleJob(owner, { jobId, date: dateIn(0), windowStart: '08:00', windowEnd: '10:00', driverId: staff.driver.id, vehicle: 'Box truck 2 (26 ft, liftgate)' })
    await startJobRoute(driver, { jobId })
    const signer = CLIENTS.find((x) => x.key === key)!.sites[0].contactName
    // Container labels are unique across the facility, so they carry the job number.
    const { jobNumber } = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } })
    containers = containers.map((c) => ({ ...c, label: `${jobNumber}-${c.label}` }))
    await collectJob(driver, { jobId, containers, signerName: signer, signature: signaturePng(signer), notes: 'Loaded and shrink-wrapped on site.' })
    const rows = await prisma.container.findMany({ where: { jobId }, orderBy: { label: 'asc' } })
    for (const r of rows) {
      const plan = containers.find((c) => c.label === r.label)!
      await receiveContainer(owner, { containerId: r.id, receivedSealNumber: plan.sealNumber, grossWeight: plan.grossWeight, tareWeight: plan.type === 'gaylord' ? 48 : 42, locationCode: `IN-${r.label.slice(-2)}` })
    }
    return rows.map((r: any) => r.id as string)
  }
  const auditPlans = async (jobId: string, containerIds: string[], plans: AssetPlan[]) => {
    const created: Array<{ id: string; plan: AssetPlan; index: number }> = []
    let n = 0
    for (const plan of plans) {
      for (let i = 0; i < plan.count; i++) {
        const [cos, fn] = plan.grades[i % plan.grades.length]
        const asset = await auditAsset(technician, {
          jobId, containerId: containerIds[n++ % containerIds.length], categoryId: cat(plan.category), manufacturer: plan.manufacturer, model: plan.model, partNumber: plan.partNumber ?? '',
          serialNumber: serialFor(plan.manufacturer), clientAssetTag: plan.category === 'Hard drives' ? '' : `MHP-${String(10_400 + n).padStart(6, '0')}`, specs: plan.specs,
          isDataBearing: plan.wipe !== 'none', cosmeticGradeId: grades.get(`cosmetic:${cos}`) ?? null, functionalGradeId: grades.get(`functional:${fn}`) ?? null,
          testNotes: fn === 'F1' ? 'Powers on, passes diagnostics.' : fn === 'F2' ? 'Battery health under 70%.' : fn === 'F4' ? 'No POST; board fault.' : 'Spins up; SMART not read.',
          weight: plan.weight, locationCode: `AUD-${(n % 4) + 1}`,
        })
        created.push({ id: asset.id, plan, index: i })
      }
    }
    return created
  }
  const wipe = async (assets: Array<{ id: string; plan: AssetPlan; index: number }>) => {
    const done = (a: { plan: AssetPlan; index: number }) => a.index >= (a.plan.pending ?? 0) + (a.plan.wipe === 'purge' ? a.plan.failed ?? 0 : 0)
    const byWipe = (w: AssetPlan['wipe']) => assets.filter((a) => a.plan.wipe === w)
    const purge = byWipe('purge')
    const passedPurge = purge.filter(done).map((a) => a.id)
    const failedPurge = purge.filter((a) => a.index >= (a.plan.pending ?? 0) && a.index < (a.plan.pending ?? 0) + (a.plan.failed ?? 0)).map((a) => a.id)
    const reportReference = `BDE-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(2).toString('hex').toUpperCase()}`
    if (passedPurge.length) await recordSanitization(technician, { assetIds: passedPurge, method: 'purge', technique: 'crypto_erase', standard: 'NIST SP 800-88 Rev. 1', tool: 'Blancco Drive Eraser', toolVersion: '7.11', reportReference, result: 'passed' })
    if (failedPurge.length) await recordSanitization(technician, { assetIds: failedPurge, method: 'purge', technique: 'crypto_erase', standard: 'NIST SP 800-88 Rev. 1', tool: 'Blancco Drive Eraser', toolVersion: '7.11', reportReference, result: 'failed', failureReason: 'Drive reported a frozen security state; erase did not complete.' })
    const clear = byWipe('clear').map((a) => a.id)
    if (clear.length) await recordSanitization(technician, { assetIds: clear, method: 'clear', technique: 'overwrite', standard: 'NIST SP 800-88 Rev. 1', tool: 'Factory reset and NVRAM erase', reportReference, result: 'passed' })
    const shred = byWipe('shred').map((a) => a.id)
    if (shred.length) await recordSanitization(technician, { assetIds: shred, method: 'destroy', technique: 'shred', standard: 'NIST SP 800-88 Rev. 1', tool: 'SSI Q55 shredder', reportReference, result: 'passed', witnessName: 'Laura Chen' })
    const retry = byWipe('shred_after_fail')
    const firstFails = retry.filter((a) => a.index < (a.plan.failed ?? 0)).map((a) => a.id)
    if (firstFails.length) await recordSanitization(technician, { assetIds: firstFails, method: 'clear', technique: 'overwrite', standard: 'NIST SP 800-88 Rev. 1', tool: 'WipeDrive', toolVersion: '9.2', reportReference, result: 'failed', failureReason: 'Bad sectors; overwrite stopped at 61%.' })
    if (retry.length) await recordSanitization(technician, { assetIds: retry.map((a) => a.id), method: 'destroy', technique: 'shred', standard: 'NIST SP 800-88 Rev. 1', tool: 'SSI Q55 shredder', reportReference, result: 'passed', witnessName: 'Laura Chen' })
    // Second-person verification on a share of the passed records (R7).
    const toVerify = await prisma.sanitizationRecord.findMany({ where: { assetId: { in: assets.map((a) => a.id) }, result: 'passed' }, orderBy: { createdAt: 'asc' }, take: 6 })
    for (const r of toVerify) await verifySanitization(owner, { recordId: r.id, confirmed: true, note: 'Spot check: drive reads as blank.' })
  }

  // Job 1: Meridian, collected, processed, certified and complete.
  const job1 = await newJob('meridian', 0, 'Annual refresh from the Riverside campus. Two pallets of laptops and desktops, one gaylord of loose drives and phones.', [['Laptops', 30, 'units'], ['Desktops', 12, 'units'], ['Monitors', 10, 'units'], ['Hard drives', 8, 'units'], ['Mobile phones', 10, 'units']])
  await quoteJob(owner, { jobId: job1, pricingModel: 'revenue_share', revenueShareBps: 7000, lines: [{ description: 'Collection, Columbus metro', quantity: 1, unitPriceMinor: 0, kind: 'pickup' }, { description: 'Serial-level audit and grading', quantity: 70, unitPriceMinor: 0, kind: 'audit' }, { description: 'Drive shredding with certificate', quantity: 8, unitPriceMinor: 500, kind: 'shred' }] })
  await acceptAs('meridian', job1)
  const c1 = await collect(job1, 'meridian', [
    { label: 'MHP-P01', type: 'pallet', sealNumber: 'S-448120', itemCountDeclared: 30, grossWeight: 214 },
    { label: 'MHP-P02', type: 'pallet', sealNumber: 'S-448121', itemCountDeclared: 22, grossWeight: 362 },
    { label: 'MHP-G01', type: 'gaylord', sealNumber: 'S-448122', itemCountDeclared: 18, grossWeight: 71 },
  ])
  const assets1 = await auditPlans(job1, c1, JOB_ONE)
  await wipe(assets1)
  for (const disposition of ['resale', 'recycle'] as const) {
    const ids = assets1.filter((a) => a.plan.disposition === disposition && !(a.plan.grades[a.index % a.plan.grades.length][1] === 'F4' && disposition === 'resale')).map((a) => a.id)
    if (ids.length) await setAssetDisposition(owner, { assetIds: ids, disposition })
  }
  const cert1 = await issueCertificate(owner, { jobId: job1, type: 'data_destruction' })
  const cert2 = await issueCertificate(owner, { jobId: job1, type: 'recycling' })
  await completeJob(owner, { jobId: job1 })

  // Job 2: Larkspur, received and in processing, some drives still to wipe.
  const job2 = await newJob('larkspur', 0, 'Branch desktop refresh and the old server rack from the operations centre.', [['Desktops', 20, 'units'], ['Servers', 6, 'units'], ['Networking', 8, 'units'], ['Laptops', 16, 'units']])
  await quoteJob(owner, { jobId: job2, pricingModel: 'fee_for_service', lines: [{ description: 'Collection, Dayton', quantity: 1, unitPriceMinor: 17_500, kind: 'pickup' }, { description: 'Serial-level audit', quantity: 50, unitPriceMinor: 400, kind: 'audit' }, { description: 'On-site witnessed wipe, per drive', quantity: 50, unitPriceMinor: 800, kind: 'wipe' }] })
  await acceptAs('larkspur', job2)
  const c2 = await collect(job2, 'larkspur', [
    { label: 'LCU-G01', type: 'gaylord', sealNumber: 'S-448210', itemCountDeclared: 28, grossWeight: 186 },
    { label: 'LCU-P01', type: 'pallet', sealNumber: 'S-448211', itemCountDeclared: 22, grossWeight: 412 },
  ])
  const assets2 = await auditPlans(job2, c2, JOB_TWO)
  await wipe(assets2)
  const readyOptiplex = assets2.filter((a) => a.plan.model.startsWith('OptiPlex') && a.index >= (a.plan.pending ?? 0)).map((a) => a.id)
  if (readyOptiplex.length) await setAssetDisposition(owner, { assetIds: readyOptiplex, disposition: 'resale' })

  // Job 3: Halvorsen, accepted and scheduled for a driver.
  const job3 = await newJob('halvorsen', 0, 'Office move: workstations and monitors from floor 12.', [['Desktops', 25, 'units'], ['Monitors', 30, 'units']])
  await quoteJob(owner, { jobId: job3, pricingModel: 'fee_for_service', lines: [{ description: 'Collection, Cincinnati CBD (freight elevator)', quantity: 1, unitPriceMinor: 22_500, kind: 'pickup' }, { description: 'Hard drive shredding', quantity: 25, unitPriceMinor: 500, kind: 'shred' }, { description: 'Monitor recycling fee', quantity: 30, unitPriceMinor: 500, kind: 'recycling_fee' }] })
  await acceptAs('halvorsen', job3)
  await scheduleJob(owner, { jobId: job3, date: dateIn(2), windowStart: '09:00', windowEnd: '11:00', driverId: staff.driver.id, vehicle: 'Box truck 1 (20 ft, liftgate)' })

  // Job 4: Meridian Westside clinic, quoted and waiting for the client.
  const job4 = await newJob('meridian', 1, 'Clinic workstation swap. Client wants a quote before the budget meeting.', [['Laptops', 14, 'units'], ['Printers', 3, 'units']])
  await quoteJob(owner, { jobId: job4, pricingModel: 'revenue_share', revenueShareBps: 7000, lines: [{ description: 'Collection, liftgate required', quantity: 1, unitPriceMinor: 9_500, kind: 'pickup' }, { description: 'Printer recycling fee', quantity: 3, unitPriceMinor: 1_500, kind: 'recycling_fee' }] })

  const jobNumbers = await prisma.job.findMany({ where: { id: { in: [job1, job2, job3, job4] } }, select: { id: true, jobNumber: true, status: true } })
  records.jobs = [job1, job2, job3, job4].map((id) => jobNumbers.find((j: any) => j.id === id)).map((j: any) => ({ jobNumber: j.jobNumber, status: j.status }))
  records.certificates = [cert1.certificateNumber, cert2.certificateNumber]
  records.assets = await prisma.asset.count({ where: { jobId: { in: [job1, job2] } } })

  // ------------------------------------------------ downstream vendors (Y3)
  const vendors = [
    { name: 'Great Lakes Metals Recovery', addressLine1: '3100 Ship Canal Rd', city: 'Toledo', region: 'OH', postalCode: '43611', contactName: 'Jim Kowalczyk', contactEmail: 'compliance@greatlakesmetals.com', certifications: [{ name: 'R2v3', number: 'R2-24-11873', expiresOn: '2027-09-30' }, { name: 'ISO 14001', number: 'EMS-558120', expiresOn: '2027-03-31' }], categories: ['Circuit boards', 'Cables and wire', 'Mixed e-scrap', 'Hard drives'], notes: 'Shredded drive fragments and boards. Smelter downstream: Aurubis Hamburg.' },
    { name: 'Ridgeway Battery Solutions', addressLine1: '88 Furnace Run', city: 'Ellwood City', region: 'PA', postalCode: '16117', contactName: 'Sandra Pike', contactEmail: 'receiving@ridgewaybattery.com', certifications: [{ name: 'R2v3', number: 'R2-23-10442', expiresOn: '2026-12-31' }, { name: 'e-Stewards', number: 'ES-1187', expiresOn: '2027-05-31' }], categories: ['Batteries', 'CRT'], notes: 'Lithium-ion and lead-acid. Ship in UN-rated drums only.' },
  ]
  for (const v of vendors) {
    const { categories: names, ...data } = v
    await sudo.db.DownstreamVendor.createOne({ data: { ...data, countryCode: 'US', status: 'approved', approvedOn: new Date(today.getTime() - 120 * DAY).toISOString().slice(0, 10), reviewDueOn: new Date(today.getTime() + 245 * DAY).toISOString().slice(0, 10), approvedCategories: { connect: names.map(cat).filter(Boolean).map((id) => ({ id })) } } })
  }
  records.downstreamVendors = vendors.map((v) => v.name)

  // ------------------------------------------------ sale event and lots (S8-S14)
  const facility = await prisma.facility.findFirst({ orderBy: { createdAt: 'asc' } })
  const eventCloses = new Date(today.getTime() + 5 * DAY)
  eventCloses.setUTCHours(19, 0, 0, 0)
  const event = await prisma.saleEvent.create({ data: { title: `${today.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} enterprise IT sale`, slug: `enterprise-it-sale-${today.toISOString().slice(0, 10)}-${randomBytes(2).toString('hex')}`, description: 'Off-lease laptops, desktops and data-centre equipment from healthcare and finance clients. Every data-bearing device is wiped to NIST 800-88 or destroyed, with serial-level manifests.', opensAt: today, closesAt: eventCloses, status: 'draft' } })
  const closeAt = (days: number, hour = 19) => { const d = new Date(today.getTime() + days * DAY); d.setUTCHours(hour, 0, 0, 0); return d }

  const lotData = (title: string, fields: Record<string, any>) => ({ title, slug: slugify(title), saleEventId: event.id, facilityId: facility?.id ?? null, status: 'draft', awardMode: 'manual', shippingTerms: 'buyer_arranged', exportAllowed: true, ...fields })
  const manualLot = async (title: string, fields: Record<string, any>, lines: Array<{ category: string; manufacturer: string; model: string; description: string; quantity: number; cosmeticGrade: string; functionalGrade: string; specs?: Record<string, any> }>) => {
    return prisma.lot.create({ data: { lotNumber: await nextNumber(prisma, 'lot'), ...lotData(title, fields), lines: { create: lines.map((l, i) => ({ lineNumber: i + 1, categoryId: cat(l.category), manufacturer: l.manufacturer, model: l.model, partNumber: '', description: l.description, specs: l.specs ?? {}, cosmeticGrade: l.cosmeticGrade, functionalGrade: l.functionalGrade, quantity: l.quantity, unit: 'each', serials: [], notes: '', extra: {} })) } }, include: { lines: { orderBy: { lineNumber: 'asc' } } } })
  }

  // Lot 1: sealed, lot total, built from the Meridian job's audited inventory (S7).
  const forLot = assets1.filter((a) => ['Latitude 5420', 'EliteDesk 800 G6 SFF'].includes(a.plan.model)).map((a) => a.id)
  const lot1Draft = await createLotFromAssets(owner, { assetIds: forLot, title: 'Dell Latitude 5420 and HP EliteDesk 800 G6, 36 units, wiped', saleEventId: event.id, facilityId: facility?.id ?? null, format: 'sealed_bid', bidBasis: 'lot_total' })
  await prisma.lot.update({ where: { id: lot1Draft.id }, data: { slug: slugify(lot1Draft.title), closesAt: closeAt(4), reserveMinor: 900_000, palletCount: 2, dimensions: '2 pallets, 48x40x52 in', conditionSummary: 'Mostly grade B, fully working. Batteries 80%+ on the Latitudes. Crypto-erased (NIST 800-88 purge), no OS installed.', description: doc('Off-lease fleet from a healthcare client, audited serial by serial. Chargers included for the laptops; no power cords for the desktops. Asset tags removed.'), warrantyDays: 30 } })

  // Lot 2: sealed, per line.
  const lot2 = await manualLot('Data-centre refresh: Dell R740, Cisco 9300 and HPE DL360', { format: 'sealed_bid', bidBasis: 'per_line', closesAt: closeAt(4, 20), reserveMinor: null, palletCount: 6, conditionSummary: 'Servers have no drives (shredded on site). Switches factory reset.', description: doc('Decommissioned from a regional bank data centre. Rails and bezels included where noted on the manifest. Bid per line: each line can be awarded to a different buyer.') }, [
    { category: 'Servers', manufacturer: 'Dell', model: 'PowerEdge R740', description: 'Dell PowerEdge R740, 2x Xeon Gold 6130, 256 GB, no drives, rails', quantity: 18, cosmeticGrade: 'Grade A', functionalGrade: 'Fully working', specs: { cpu: '2x Xeon Gold 6130', ramGb: 256 } },
    { category: 'Networking', manufacturer: 'Cisco', model: 'Catalyst 9300-48P', description: 'Cisco Catalyst 9300-48P-A, PoE+, dual PSU, no network module', quantity: 24, cosmeticGrade: 'Grade B', functionalGrade: 'Fully working' },
    { category: 'Servers', manufacturer: 'HPE', model: 'ProLiant DL360 Gen10', description: 'HPE ProLiant DL360 Gen10, 2x Xeon Silver 4110, 64 GB, no drives', quantity: 40, cosmeticGrade: 'Grade B', functionalGrade: 'Powers on, untested', specs: { cpu: '2x Xeon Silver 4110', ramGb: 64 } },
  ])

  // Lot 3: open auction.
  const lot3 = await manualLot('Apple MacBook Pro 13" M1 (2020), 60 units, unlocked', { format: 'open_auction', bidBasis: 'lot_total', openingBidMinor: 1_500_000, bidIncrementMinor: 25_000, reserveMinor: 1_700_000, closesAt: closeAt(3, 21), palletCount: 1, conditionSummary: 'Activation lock and MDM removed. Erased with Apple Configurator.', description: doc('Returned from a corporate lease. Every unit checked for activation lock and MDM enrolment before listing. Chargers not included.') }, [
    { category: 'Laptops', manufacturer: 'Apple', model: 'MacBook Pro 13" M1 2020', description: 'MacBook Pro 13" M1, 8 GB, 256 GB, Space Grey', quantity: 36, cosmeticGrade: 'Grade B', functionalGrade: 'Fully working', specs: { cpu: 'Apple M1', ramGb: 8, storage: '256 GB' } },
    { category: 'Laptops', manufacturer: 'Apple', model: 'MacBook Pro 13" M1 2020', description: 'MacBook Pro 13" M1, 8 GB, 256 GB, heavy wear on lids', quantity: 24, cosmeticGrade: 'Grade C', functionalGrade: 'Fully working', specs: { cpu: 'Apple M1', ramGb: 8, storage: '256 GB' } },
  ])

  // Lot 4: fixed price.
  const lot4 = await manualLot('Dell P2422H 24" monitors, 80 units, with stands', { format: 'fixed_price', bidBasis: 'lot_total', fixedPriceMinor: 360_000, closesAt: closeAt(5), palletCount: 2, conditionSummary: 'Grade A/B, tested at 1080p. Stands included; no cables.', description: doc('Bought together as a whole lot at the listed price. First buyer to confirm gets it.') }, [
    { category: 'Monitors', manufacturer: 'Dell', model: 'P2422H', description: 'Dell P2422H 23.8" IPS, height-adjustable stand', quantity: 80, cosmeticGrade: 'Grade B', functionalGrade: 'Fully working' },
  ])

  // Lot 5: sealed, will close with bids waiting for an award.
  const lot5 = await manualLot('Lenovo ThinkCentre M720q Tiny, 120 units, wiped', { format: 'sealed_bid', bidBasis: 'lot_total', reserveMinor: 1_000_000, closesAt: closeAt(2), palletCount: 2, conditionSummary: 'i5-8500T, 8 GB, 256 GB SSD. Crypto-erased. VESA mounts on about half.', description: doc('Branch office desktops from a credit union refresh.') }, [
    { category: 'Desktops', manufacturer: 'Lenovo', model: 'ThinkCentre M720q', description: 'Lenovo ThinkCentre M720q Tiny, i5-8500T, 8 GB, 256 GB SSD', quantity: 96, cosmeticGrade: 'Grade B', functionalGrade: 'Fully working' },
    { category: 'Desktops', manufacturer: 'Lenovo', model: 'ThinkCentre M720q', description: 'Lenovo ThinkCentre M720q Tiny, i5-8500T, 8 GB, no SSD', quantity: 24, cosmeticGrade: 'Grade C', functionalGrade: 'Working with faults' },
  ])

  // Lot 6: sealed, will be awarded and paid.
  const lot6 = await manualLot('Enterprise SSDs 960 GB-1.92 TB, 400 units, NIST purged', { format: 'sealed_bid', bidBasis: 'lot_total', reserveMinor: 1_200_000, closesAt: closeAt(2, 18), palletCount: 1, conditionSummary: 'Each drive crypto-erased and verified; erasure report by serial on the manifest.', description: doc('Samsung PM883 and Intel S4510 SATA SSDs pulled from storage arrays. Health 90%+ by SMART.') }, [
    { category: 'Solid state drives', manufacturer: 'Samsung', model: 'PM883 1.92TB', description: 'Samsung PM883 1.92 TB SATA SSD, health 90%+', quantity: 220, cosmeticGrade: 'Grade A', functionalGrade: 'Fully working' },
    { category: 'Solid state drives', manufacturer: 'Intel', model: 'D3-S4510 960GB', description: 'Intel D3-S4510 960 GB SATA SSD, health 90%+', quantity: 180, cosmeticGrade: 'Grade A', functionalGrade: 'Fully working' },
  ])

  const published = await publishSaleEvent(owner, { saleEventId: event.id, announce: true })
  if (published.problems?.length) fail(`Some starter lots could not be published: ${published.problems.join('; ')}`)

  const lotNumber = async (id: string) => (await prisma.lot.findUnique({ where: { id }, select: { lotNumber: true } })).lotNumber as string
  const asNorthgate = await sessionFor(buyerUsers.northgate.userId)
  const asBluewater = await sessionFor(buyerUsers.bluewater.userId)
  const key = () => `starter-${randomBytes(8).toString('hex')}`
  const bid = (who: Ctx, lot: string, args: Record<string, any>) => placeBid(who, { lotNumber: lot, idempotencyKey: key(), ...args } as any)

  const [n1, n2, n3, n5, n6] = await Promise.all([lot1Draft.id, lot2.id, lot3.id, lot5.id, lot6.id].map(lotNumber))
  await bid(asNorthgate, n1, { amountMinor: 1_104_000 })
  await bid(asBluewater, n1, { amountMinor: 1_065_000 })
  const [r740, c9300, dl360] = lot2.lines
  await bid(asNorthgate, n2, { lines: [{ lotLineId: r740.id, unitPriceMinor: 115_000 }, { lotLineId: c9300.id, unitPriceMinor: 64_000 }] })
  await bid(asBluewater, n2, { lines: [{ lotLineId: r740.id, unitPriceMinor: 121_000 }, { lotLineId: c9300.id, unitPriceMinor: 61_000 }, { lotLineId: dl360.id, unitPriceMinor: 48_000 }] })
  await bid(asNorthgate, n3, { amountMinor: 1_500_000 })
  await bid(asBluewater, n3, { amountMinor: 1_550_000 })
  await bid(asNorthgate, n3, { amountMinor: 1_625_000 })
  await bid(asNorthgate, n5, { amountMinor: 960_000 })
  await bid(asBluewater, n5, { amountMinor: 1_020_000 })
  const win6 = await bid(asBluewater, n6, { amountMinor: 1_480_000 })
  await bid(asNorthgate, n6, { amountMinor: 1_390_000 })

  // Close lots 5 and 6 as the clock would at their close time.
  const past = new Date(Date.now() - 60_000)
  for (const id of [lot5.id, lot6.id]) {
    await prisma.lot.update({ where: { id }, data: { closesAt: past } })
    await advanceLotClock({ prisma }, id)
  }
  const [award6] = await awardLot(owner, { lotId: lot6.id, bidId: (win6 as any).bidId })
  const invoice6 = await prisma.invoice.findUnique({ where: { invoiceNumber: award6.invoiceNumber } })
  await recordOfflinePayment(owner, { invoiceId: invoice6.id, method: 'wire', amountMinor: invoice6.totalMinor, reference: `FW ${randomBytes(4).toString('hex').toUpperCase()} BLUEWATER IT ASSET`, paidOn: new Date().toISOString().slice(0, 10) })

  const lotRows = await prisma.lot.findMany({ where: { saleEventId: event.id }, select: { lotNumber: true, title: true, status: true, format: true, bidBasis: true, bidCount: true }, orderBy: { lotNumber: 'asc' } })
  records.saleEvent = { title: event.title, lots: lotRows }
  records.paidOrder = { orderNumber: award6.orderNumber, invoiceNumber: award6.invoiceNumber, buyer: 'Bluewater IT Asset Trading Inc.' }

  return { password, logins, records }
}
