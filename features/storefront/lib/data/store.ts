import { cache } from 'react'
import { op } from './client'

export type StoreSettings = {
  businessName: string
  legalName: string
  tagline: string
  logoUrl: string | null
  supportEmail: string
  supportPhone: string
  timezone: string
  currencyCode: string
  weightUnit: string
  publicLotVisibility: string
  rules: Record<string, number | string | null>
  wholesaleTerms: any[]
  wholesaleTermsVersion: string
  serviceTerms: any[]
  serviceTermsVersion: string
  exportClause: string
}

export const getStore = cache(async () => op<StoreSettings>('storefrontSettings'))

export type LotCard = {
  id: string
  lotNumber: string
  title: string
  status: string
  format: string
  bidBasis: string
  category: string
  categorySlug: string
  saleEvent: { id: string; title: string; slug: string } | null
  imageUrl: string | null
  unitCount: number
  lineCount: number
  palletCount: number | null
  weight: number | null
  opensAt: string | null
  closesAt: string | null
  conditionSummary: string
  currentAmountMinor?: number | null
  bidCount?: number | null
  openingBidMinor?: number | null
  fixedPriceMinor?: number | null
  myBidStatus?: string | null
  myBidMinor?: number | null
}

export type SaleEvent = { id: string; title: string; slug: string; description: string; opensAt: string; closesAt: string }
export type Facility = { id: string; name: string; code: string; addressLine1: string; addressLine2: string; city: string; region: string; postalCode: string; countryCode: string; phone: string; hours: Record<string, string | null>; acceptsDropOff: boolean }
export type AcceptedItem = { id: string; name: string; category: string; accepted: boolean; feeType: string; feeMinor: number; notes: string }
export type Certification = { id: string; name: string; certificateNumber: string; certifyingBody: string; facility: string; expiresOn: string | null; documentUrl: string | null }
export type Grade = { id: string; kind: string; code: string; label: string; description: string }
export type Category = { id: string; name: string; slug: string; kind: string }

export const publicLots = (filter: Record<string, unknown> = {}) => op<LotCard[]>('publicLots', filter)
export const buyerLots = (filter: Record<string, unknown> = {}) => op<LotCard[]>('buyerLots', filter)
export const publicLot = (lotNumber: string) => op<any>('publicLot', { lotNumber })
export const buyerLot = (lotNumber: string) => op<any>('buyerLot', { lotNumber })
export const publicSaleEvents = () => op<SaleEvent[]>('publicSaleEvents')
export const publicFacilities = cache(() => op<Facility[]>('publicFacilities'))
export const publicAcceptedItems = () => op<AcceptedItem[]>('publicAcceptedItems')
export const publicCertifications = () => op<Certification[]>('publicCertifications')
export const publicGradeGuide = () => op<Grade[]>('publicGradeGuide')
export const publicCategories = cache(() => op<Category[]>('publicCategories'))
export const verifyCertificate = (code: string) => op<any>('verifyCertificate', { code })

export const myBuyerCompany = () => op<any>('myBuyerCompany')
export const myBids = (status?: string) => op<any[]>('myBids', status ? { status } : {})
export const myInvoices = () => op<any[]>('myInvoices')
export const myInvoice = (invoiceNumber: string) => op<any>('myInvoice', { invoiceNumber })
export const myOrders = () => op<any[]>('myOrders')
export const myOrder = (orderNumber: string) => op<any>('myOrder', { orderNumber })
export const myJobs = () => op<any>('myJobs')
export const myJob = (jobNumber: string) => op<any>('myJob', { jobNumber })
