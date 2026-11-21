-- CreateEnum
CREATE TYPE "UserKindType" AS ENUM ('staff', 'buyer', 'client');

-- CreateEnum
CREATE TYPE "UserBuyerRoleType" AS ENUM ('admin', 'bidder');

-- CreateEnum
CREATE TYPE "UserClientRoleType" AS ENUM ('admin', 'viewer');

-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "StoreSettingsWeightUnitType" AS ENUM ('lb', 'kg');

-- CreateEnum
CREATE TYPE "StoreSettingsPublicLotVisibilityType" AS ENUM ('teaser', 'full', 'hidden');

-- CreateEnum
CREATE TYPE "StoreSettingsDefaultBidFormatType" AS ENUM ('sealed_bid', 'open_auction', 'fixed_price');

-- CreateEnum
CREATE TYPE "StoreSettingsDefaultBidBasisType" AS ENUM ('lot_total', 'per_line');

-- CreateEnum
CREATE TYPE "StoreSettingsDefaultAwardModeType" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "MaterialCategoryKindType" AS ENUM ('equipment', 'component', 'commodity');

-- CreateEnum
CREATE TYPE "GradeDefinitionKindType" AS ENUM ('cosmetic', 'functional');

-- CreateEnum
CREATE TYPE "AcceptedItemFeeTypeType" AS ENUM ('free', 'per_item', 'per_weight');

-- CreateEnum
CREATE TYPE "StoredFileVisibilityType" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "ClientOrganizationStatusType" AS ENUM ('prospect', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "ClientOrganizationDefaultPricingModelType" AS ENUM ('fee_for_service', 'revenue_share', 'buyout');

-- CreateEnum
CREATE TYPE "JobTypeType" AS ENUM ('pickup', 'drop_off');

-- CreateEnum
CREATE TYPE "JobStatusType" AS ENUM ('requested', 'quoted', 'accepted', 'declined', 'scheduled', 'en_route', 'collected', 'received', 'processing', 'completed', 'settled', 'closed', 'cancelled', 'on_hold');

-- CreateEnum
CREATE TYPE "JobPricingModelType" AS ENUM ('fee_for_service', 'revenue_share', 'buyout');

-- CreateEnum
CREATE TYPE "JobEstimateLineUnitType" AS ENUM ('units', 'pallets', 'lb', 'kg');

-- CreateEnum
CREATE TYPE "JobServiceLineKindType" AS ENUM ('pickup', 'audit', 'wipe', 'shred', 'recycling_fee', 'other');

-- CreateEnum
CREATE TYPE "JobPhotoStageType" AS ENUM ('request', 'collection', 'receiving');

-- CreateEnum
CREATE TYPE "ContainerTypeType" AS ENUM ('pallet', 'gaylord', 'box', 'cage', 'tote');

-- CreateEnum
CREATE TYPE "ContainerStatusType" AS ENUM ('collected', 'received', 'processed', 'missing', 'unexpected');

-- CreateEnum
CREATE TYPE "CustodyEventTypeType" AS ENUM ('collected', 'handed_to_carrier', 'received', 'seal_verified', 'seal_exception', 'moved', 'audited', 'sanitized', 'verified', 'allocated', 'released_to_buyer', 'shipped_downstream', 'returned_to_client', 'hold_placed', 'hold_released');

-- CreateEnum
CREATE TYPE "AssetStatusType" AS ENUM ('received', 'audited', 'ready_for_sale', 'allocated', 'sold', 'released', 'recycling', 'downstream', 'returned', 'on_hold');

-- CreateEnum
CREATE TYPE "AssetSanitizationStatusType" AS ENUM ('not_required', 'pending', 'passed', 'failed', 'destroyed');

-- CreateEnum
CREATE TYPE "AssetDispositionType" AS ENUM ('undecided', 'resale', 'parts', 'recycle', 'return', 'hold');

-- CreateEnum
CREATE TYPE "SanitizationRecordMethodType" AS ENUM ('clear', 'purge', 'destroy');

-- CreateEnum
CREATE TYPE "SanitizationRecordTechniqueType" AS ENUM ('overwrite', 'block_erase', 'crypto_erase', 'secure_erase', 'degauss', 'shred', 'crush', 'disintegrate');

-- CreateEnum
CREATE TYPE "SanitizationRecordResultType" AS ENUM ('passed', 'failed');

-- CreateEnum
CREATE TYPE "ErasureImportStatusType" AS ENUM ('uploaded', 'validated', 'committed', 'discarded');

-- CreateEnum
CREATE TYPE "CertificateTypeType" AS ENUM ('data_destruction', 'recycling');

-- CreateEnum
CREATE TYPE "CertificateStatusType" AS ENUM ('issued', 'revoked');

-- CreateEnum
CREATE TYPE "SettlementStatusType" AS ENUM ('draft', 'in_review', 'published', 'disputed', 'paid', 'closed');

-- CreateEnum
CREATE TYPE "SettlementPayoutMethodType" AS ENUM ('cheque', 'ach', 'wire', 'credit');

-- CreateEnum
CREATE TYPE "SettlementLineKindType" AS ENUM ('service_fee', 'asset_value', 'commodity_value', 'adjustment');

-- CreateEnum
CREATE TYPE "DownstreamVendorStatusType" AS ENUM ('pending', 'approved', 'suspended');

-- CreateEnum
CREATE TYPE "OutboundShipmentStatusType" AS ENUM ('draft', 'shipped', 'receipt_confirmed', 'closed');

-- CreateEnum
CREATE TYPE "BuyerCompanyBusinessTypeType" AS ENUM ('refurbisher', 'reseller', 'exporter', 'recycler', 'broker', 'other');

-- CreateEnum
CREATE TYPE "BuyerCompanyMonthlySpendBandType" AS ENUM ('under_5k', 'from_5k_to_25k', 'from_25k_to_100k', 'over_100k');

-- CreateEnum
CREATE TYPE "BuyerCompanyStatusType" AS ENUM ('draft', 'submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "BuyerCompanyTaxStatusType" AS ENUM ('taxable', 'exempt_resale', 'export');

-- CreateEnum
CREATE TYPE "BuyerDocumentTypeType" AS ENUM ('resale_certificate', 'export_license', 'business_registration', 'w9', 'r2_certificate', 'other');

-- CreateEnum
CREATE TYPE "BuyerDocumentStatusType" AS ENUM ('submitted', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "SaleEventStatusType" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "LotStatusType" AS ENUM ('draft', 'scheduled', 'open', 'closed', 'awarded', 'completed', 'unsold', 'cancelled');

-- CreateEnum
CREATE TYPE "LotFormatType" AS ENUM ('sealed_bid', 'open_auction', 'fixed_price');

-- CreateEnum
CREATE TYPE "LotBidBasisType" AS ENUM ('lot_total', 'per_line');

-- CreateEnum
CREATE TYPE "LotAwardModeType" AS ENUM ('manual', 'auto');

-- CreateEnum
CREATE TYPE "LotShippingTermType" AS ENUM ('buyer_arranged', 'seller_quoted', 'pickup_only');

-- CreateEnum
CREATE TYPE "LotLineUnitType" AS ENUM ('each', 'lb', 'kg');

-- CreateEnum
CREATE TYPE "ManifestImportStatusType" AS ENUM ('uploaded', 'mapped', 'validated', 'committed', 'discarded');

-- CreateEnum
CREATE TYPE "ManifestImportPurposeType" AS ENUM ('lot_manifest', 'asset_import');

-- CreateEnum
CREATE TYPE "BidStatusType" AS ENUM ('active', 'superseded', 'withdrawn', 'won', 'partially_won', 'lost', 'void', 'defaulted', 'expired');

-- CreateEnum
CREATE TYPE "BidSourceType" AS ENUM ('web', 'bid_sheet', 'staff_entry');

-- CreateEnum
CREATE TYPE "BidLineStatusType" AS ENUM ('active', 'won', 'lost');

-- CreateEnum
CREATE TYPE "AwardStatusType" AS ENUM ('active', 'defaulted', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderStatusType" AS ENUM ('awaiting_payment', 'paid', 'ready_for_release', 'released', 'completed', 'defaulted', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderReleaseMethodType" AS ENUM ('pickup', 'freight');

-- CreateEnum
CREATE TYPE "DockAppointmentStatusType" AS ENUM ('booked', 'arrived', 'done', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "ClaimReasonType" AS ENUM ('shortage', 'wrong_item', 'misgraded', 'dead_on_arrival', 'damage', 'other');

-- CreateEnum
CREATE TYPE "ClaimStatusType" AS ENUM ('submitted', 'under_review', 'approved', 'denied', 'resolved');

-- CreateEnum
CREATE TYPE "ClaimResolutionType" AS ENUM ('refund', 'partial_refund', 'return_and_refund', 'denied');

-- CreateEnum
CREATE TYPE "InvoiceKindType" AS ENUM ('lot_sale', 'service', 'settlement', 'restocking', 'storage');

-- CreateEnum
CREATE TYPE "InvoiceStatusType" AS ENUM ('open', 'partially_paid', 'paid', 'partially_refunded', 'refunded', 'void');

-- CreateEnum
CREATE TYPE "InvoiceLineKindType" AS ENUM ('item', 'premium', 'tax', 'freight', 'card_fee', 'storage', 'service', 'adjustment');

-- CreateEnum
CREATE TYPE "PaymentSessionMethodType" AS ENUM ('card', 'bank_transfer');

-- CreateEnum
CREATE TYPE "PaymentSessionStatusType" AS ENUM ('pending', 'requires_action', 'captured', 'failed', 'canceled', 'unknown');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('card', 'ach', 'wire', 'cheque', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatusType" AS ENUM ('reported', 'confirmed', 'rejected', 'captured', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "RefundStatusType" AS ENUM ('pending', 'succeeded', 'failed', 'unknown');

-- CreateEnum
CREATE TYPE "RefundMethodType" AS ENUM ('card', 'wire', 'ach', 'cheque', 'cash');

-- CreateEnum
CREATE TYPE "NotificationEmailStatusType" AS ENUM ('not_sent', 'queued', 'sent', 'failed', 'skipped');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canEditOtherPeople",
DROP COLUMN "canManageAllTodos",
DROP COLUMN "canManagePeople",
DROP COLUMN "canManageRoles",
DROP COLUMN "canSeeOtherPeople",
ADD COLUMN     "canAuditAssets" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canAwardLots" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCollect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canDispatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canIssueCertificates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageBuyers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageClients" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageDownstream" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageJobs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageLots" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSettlements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReceive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canRefund" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSanitize" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSeeSealedBidAmountsBeforeClose" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canVerifySanitization" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN     "acceptedTermsVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "buyerCompany" TEXT,
ADD COLUMN     "buyerRole" "UserBuyerRoleType",
ADD COLUMN     "clientOrganization" TEXT,
ADD COLUMN     "clientRole" "UserClientRoleType",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "UserKindType" NOT NULL DEFAULT 'staff',
ADD COLUMN     "notificationPrefs" JSONB DEFAULT '{}',
ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" DEFAULT 'not_started',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT 'Electronics Recycling',
    "legalName" TEXT NOT NULL DEFAULT '',
    "logo" TEXT,
    "tagline" TEXT NOT NULL DEFAULT '',
    "supportEmail" TEXT NOT NULL DEFAULT '',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "weightUnit" "StoreSettingsWeightUnitType" NOT NULL DEFAULT 'lb',
    "publicLotVisibility" "StoreSettingsPublicLotVisibilityType" NOT NULL DEFAULT 'teaser',
    "defaultBidFormat" "StoreSettingsDefaultBidFormatType" NOT NULL DEFAULT 'sealed_bid',
    "defaultBidBasis" "StoreSettingsDefaultBidBasisType" NOT NULL DEFAULT 'lot_total',
    "defaultAwardMode" "StoreSettingsDefaultAwardModeType" NOT NULL DEFAULT 'manual',
    "softCloseWindowMinutes" INTEGER NOT NULL DEFAULT 3,
    "softCloseExtensionMinutes" INTEGER NOT NULL DEFAULT 3,
    "softCloseMaxExtensions" INTEGER NOT NULL DEFAULT 20,
    "bidValidityBusinessDays" INTEGER NOT NULL DEFAULT 3,
    "buyerPremiumBps" INTEGER NOT NULL DEFAULT 0,
    "salesTaxBps" INTEGER NOT NULL DEFAULT 0,
    "cardFeeBps" INTEGER NOT NULL DEFAULT 300,
    "cardMaxAmountMinor" INTEGER,
    "paymentDueBusinessDays" INTEGER NOT NULL DEFAULT 2,
    "paymentGraceBusinessDays" INTEGER NOT NULL DEFAULT 2,
    "restockingFeeBps" INTEGER NOT NULL DEFAULT 1500,
    "strikesBeforeSuspension" INTEGER NOT NULL DEFAULT 3,
    "removalBusinessDays" INTEGER NOT NULL DEFAULT 5,
    "storageFeePerPalletPerDayMinor" INTEGER NOT NULL DEFAULT 2000,
    "claimWindowBusinessDays" INTEGER NOT NULL DEFAULT 5,
    "claimVarianceBps" INTEGER NOT NULL DEFAULT 500,
    "defaultClientRevenueShareBps" INTEGER NOT NULL DEFAULT 7000,
    "sanitizationVerificationSampleBps" INTEGER NOT NULL DEFAULT 500,
    "wireInstructions" TEXT NOT NULL DEFAULT '',
    "wholesaleTerms" JSONB NOT NULL DEFAULT '[{"type":"paragraph","children":[{"text":""}]}]',
    "wholesaleTermsVersion" TEXT NOT NULL DEFAULT '1',
    "serviceTerms" JSONB NOT NULL DEFAULT '[{"type":"paragraph","children":[{"text":""}]}]',
    "serviceTermsVersion" TEXT NOT NULL DEFAULT '1',
    "exportClause" TEXT NOT NULL DEFAULT '',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPassword" TEXT NOT NULL DEFAULT '',
    "smtpFrom" TEXT NOT NULL DEFAULT '',
    "storefrontUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT NOT NULL DEFAULT '',
    "hours" JSONB DEFAULT '{}',
    "acceptsDropOff" BOOLEAN NOT NULL DEFAULT true,
    "dockSlotMinutes" INTEGER NOT NULL DEFAULT 30,
    "dockSlotsPerWindow" INTEGER NOT NULL DEFAULT 2,
    "pickupInstructions" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'R2v3',
    "otherName" TEXT NOT NULL DEFAULT '',
    "certificateNumber" TEXT NOT NULL DEFAULT '',
    "certifyingBody" TEXT NOT NULL DEFAULT '',
    "facility" TEXT,
    "issuedOn" DATE,
    "expiresOn" DATE,
    "document" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "kind" "MaterialCategoryKindType" NOT NULL DEFAULT 'equipment',
    "parent" TEXT,
    "r2Category" TEXT NOT NULL DEFAULT '',
    "isFocusMaterial" BOOLEAN NOT NULL DEFAULT false,
    "dataBearingDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeDefinition" (
    "id" TEXT NOT NULL,
    "kind" "GradeDefinitionKindType" NOT NULL DEFAULT 'cosmetic',
    "code" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptedItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "feeType" "AcceptedItemFeeTypeType" NOT NULL DEFAULT 'free',
    "feeMinor" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT '',
    "visibility" "StoredFileVisibilityType" NOT NULL DEFAULT 'private',
    "ownerBuyerCompanyId" TEXT NOT NULL DEFAULT '',
    "ownerClientOrganizationId" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT,
    "data" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "billingEmail" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "taxId" TEXT NOT NULL DEFAULT '',
    "status" "ClientOrganizationStatusType" NOT NULL DEFAULT 'prospect',
    "defaultPricingModel" "ClientOrganizationDefaultPricingModelType" NOT NULL DEFAULT 'fee_for_service',
    "defaultRevenueShareBps" INTEGER,
    "accountManager" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSite" (
    "id" TEXT NOT NULL,
    "organization" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "hasDock" BOOLEAN NOT NULL DEFAULT false,
    "needsLiftgate" BOOLEAN NOT NULL DEFAULT false,
    "accessNotes" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT,
    "type" "JobTypeType" NOT NULL DEFAULT 'pickup',
    "status" "JobStatusType" NOT NULL DEFAULT 'requested',
    "holdFromStatus" TEXT NOT NULL DEFAULT '',
    "organization" TEXT,
    "site" TEXT,
    "facility" TEXT,
    "requestedBy" TEXT,
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "siteAddress" JSONB,
    "accessDetails" JSONB DEFAULT '{}',
    "requestedDates" JSONB DEFAULT '[]',
    "hasDataBearing" BOOLEAN NOT NULL DEFAULT false,
    "servicesRequested" JSONB DEFAULT '[]',
    "pricingModel" "JobPricingModelType",
    "revenueShareBps" INTEGER,
    "buyoutAmountMinor" INTEGER,
    "quoteSentAt" TIMESTAMP(3),
    "quoteAcceptedAt" TIMESTAMP(3),
    "quoteAcceptedBy" TEXT,
    "quoteSignatureName" TEXT NOT NULL DEFAULT '',
    "quoteTermsVersion" TEXT NOT NULL DEFAULT '',
    "declineReason" TEXT NOT NULL DEFAULT '',
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "scheduledDate" DATE,
    "windowStart" TEXT NOT NULL DEFAULT '',
    "windowEnd" TEXT NOT NULL DEFAULT '',
    "driver" TEXT,
    "vehicle" TEXT NOT NULL DEFAULT '',
    "collectedAt" TIMESTAMP(3),
    "clientSignerName" TEXT NOT NULL DEFAULT '',
    "clientSignature" TEXT,
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "settlement" TEXT,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEstimateLine" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "category" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "unit" "JobEstimateLineUnitType" NOT NULL DEFAULT 'units',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobServiceLine" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER DEFAULT 0,
    "kind" "JobServiceLineKindType" NOT NULL DEFAULT 'other',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobServiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPhoto" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "image" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "stage" "JobPhotoStageType" NOT NULL DEFAULT 'request',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "label" TEXT NOT NULL DEFAULT '',
    "type" "ContainerTypeType" NOT NULL DEFAULT 'pallet',
    "sealNumber" TEXT NOT NULL DEFAULT '',
    "receivedSealNumber" TEXT NOT NULL DEFAULT '',
    "sealVerified" BOOLEAN NOT NULL DEFAULT false,
    "sealException" TEXT NOT NULL DEFAULT '',
    "sealExceptionResolution" TEXT NOT NULL DEFAULT '',
    "itemCountDeclared" INTEGER,
    "grossWeight" DECIMAL(12,2),
    "tareWeight" DECIMAL(12,2),
    "status" "ContainerStatusType" NOT NULL DEFAULT 'collected',
    "locationCode" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyEvent" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "container" TEXT,
    "asset" TEXT,
    "type" "CustodyEventTypeType" NOT NULL DEFAULT 'moved',
    "actor" TEXT,
    "actorName" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facility" TEXT,
    "locationText" TEXT NOT NULL DEFAULT '',
    "signerName" TEXT NOT NULL DEFAULT '',
    "signature" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetNumber" TEXT,
    "job" TEXT,
    "container" TEXT,
    "organization" TEXT,
    "parent" TEXT,
    "category" TEXT,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "partNumber" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "clientAssetTag" TEXT NOT NULL DEFAULT '',
    "specs" JSONB DEFAULT '{}',
    "isDataBearing" BOOLEAN NOT NULL DEFAULT false,
    "cosmeticGrade" TEXT,
    "functionalGrade" TEXT,
    "testNotes" TEXT NOT NULL DEFAULT '',
    "weight" DECIMAL(12,2),
    "status" "AssetStatusType" NOT NULL DEFAULT 'received',
    "holdFromStatus" TEXT NOT NULL DEFAULT '',
    "sanitizationStatus" "AssetSanitizationStatusType" NOT NULL DEFAULT 'not_required',
    "disposition" "AssetDispositionType" NOT NULL DEFAULT 'undecided',
    "holdReason" TEXT NOT NULL DEFAULT '',
    "storageRemoved" BOOLEAN NOT NULL DEFAULT false,
    "fairMarketValueMinor" INTEGER,
    "lotLine" TEXT,
    "soldPriceMinor" INTEGER,
    "outboundLine" TEXT,
    "locationCode" TEXT NOT NULL DEFAULT '',
    "auditedBy" TEXT,
    "auditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPhoto" (
    "id" TEXT NOT NULL,
    "asset" TEXT,
    "image" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanitizationRecord" (
    "id" TEXT NOT NULL,
    "asset" TEXT,
    "method" "SanitizationRecordMethodType" NOT NULL DEFAULT 'purge',
    "technique" "SanitizationRecordTechniqueType" NOT NULL DEFAULT 'overwrite',
    "standard" TEXT NOT NULL DEFAULT 'NIST SP 800-88',
    "tool" TEXT NOT NULL DEFAULT '',
    "toolVersion" TEXT NOT NULL DEFAULT '',
    "reportReference" TEXT NOT NULL DEFAULT '',
    "reportFile" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" "SanitizationRecordResultType" NOT NULL DEFAULT 'passed',
    "failureReason" TEXT NOT NULL DEFAULT '',
    "operator" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "witnessName" TEXT NOT NULL DEFAULT '',
    "importBatch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanitizationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErasureImport" (
    "id" TEXT NOT NULL,
    "file" TEXT,
    "originalFilename" TEXT NOT NULL DEFAULT '',
    "tool" TEXT NOT NULL DEFAULT '',
    "status" "ErasureImportStatusType" NOT NULL DEFAULT 'uploaded',
    "rowCount" INTEGER DEFAULT 0,
    "matchedCount" INTEGER DEFAULT 0,
    "unmatched" JSONB DEFAULT '[]',
    "rows" JSONB DEFAULT '[]',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErasureImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityLine" (
    "id" TEXT NOT NULL,
    "job" TEXT,
    "category" TEXT,
    "weight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "outboundLine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommodityLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "type" "CertificateTypeType" NOT NULL DEFAULT 'data_destruction',
    "job" TEXT,
    "organization" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "verificationCode" TEXT,
    "snapshot" JSONB,
    "pdf" TEXT,
    "status" "CertificateStatusType" NOT NULL DEFAULT 'issued',
    "revokedReason" TEXT NOT NULL DEFAULT '',
    "revokedAt" TIMESTAMP(3),
    "replaces" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT,
    "organization" TEXT,
    "status" "SettlementStatusType" NOT NULL DEFAULT 'draft',
    "feesTotalMinor" INTEGER DEFAULT 0,
    "clientShareTotalMinor" INTEGER DEFAULT 0,
    "netMinor" INTEGER DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "disputeNote" TEXT NOT NULL DEFAULT '',
    "disputeRecordedBy" TEXT,
    "payoutMethod" "SettlementPayoutMethodType",
    "payoutReference" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3),
    "pdf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLine" (
    "id" TEXT NOT NULL,
    "settlement" TEXT,
    "kind" "SettlementLineKindType" NOT NULL DEFAULT 'service_fee',
    "description" TEXT NOT NULL DEFAULT '',
    "asset" TEXT,
    "quantity" DECIMAL(12,3) DEFAULT 1,
    "grossMinor" INTEGER DEFAULT 0,
    "clientShareBps" INTEGER DEFAULT 0,
    "clientAmountMinor" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownstreamVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "certifications" JSONB DEFAULT '[]',
    "status" "DownstreamVendorStatusType" NOT NULL DEFAULT 'pending',
    "approvedOn" DATE,
    "reviewDueOn" DATE,
    "dueDiligenceFile" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownstreamVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundShipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT,
    "vendor" TEXT,
    "facility" TEXT,
    "status" "OutboundShipmentStatusType" NOT NULL DEFAULT 'draft',
    "shippedAt" TIMESTAMP(3),
    "carrier" TEXT NOT NULL DEFAULT '',
    "billOfLading" TEXT NOT NULL DEFAULT '',
    "receivedWeight" DECIMAL(12,2),
    "receiptConfirmedAt" TIMESTAMP(3),
    "receiptDocument" TEXT,
    "destinationCountry" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundShipmentLine" (
    "id" TEXT NOT NULL,
    "shipment" TEXT,
    "category" TEXT,
    "weight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "containerCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundShipmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerCompany" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL DEFAULT '',
    "tradingName" TEXT NOT NULL DEFAULT '',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "businessType" "BuyerCompanyBusinessTypeType",
    "monthlySpendBand" "BuyerCompanyMonthlySpendBandType",
    "destinationCountries" JSONB DEFAULT '[]',
    "status" "BuyerCompanyStatusType" NOT NULL DEFAULT 'draft',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "taxStatus" "BuyerCompanyTaxStatusType" NOT NULL DEFAULT 'taxable',
    "spendLimitMinor" INTEGER,
    "strikes" INTEGER DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "termsVersionAccepted" TEXT NOT NULL DEFAULT '',
    "termsAcceptedAt" TIMESTAMP(3),
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerDocument" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "type" "BuyerDocumentTypeType" NOT NULL DEFAULT 'resale_certificate',
    "file" TEXT,
    "state" TEXT NOT NULL DEFAULT '',
    "expiresOn" DATE,
    "status" "BuyerDocumentStatusType" NOT NULL DEFAULT 'submitted',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT,
    "expiryHandledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerMessage" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "author" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "fromStaff" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "SaleEventStatusType" NOT NULL DEFAULT 'draft',
    "announcementSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "saleEvent" TEXT,
    "category" TEXT,
    "description" JSONB NOT NULL DEFAULT '[{"type":"paragraph","children":[{"text":""}]}]',
    "conditionSummary" TEXT NOT NULL DEFAULT '',
    "facility" TEXT,
    "status" "LotStatusType" NOT NULL DEFAULT 'draft',
    "format" "LotFormatType" NOT NULL DEFAULT 'sealed_bid',
    "bidBasis" "LotBidBasisType" NOT NULL DEFAULT 'lot_total',
    "awardMode" "LotAwardModeType" NOT NULL DEFAULT 'manual',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "originalClosesAt" TIMESTAMP(3),
    "extensionCount" INTEGER DEFAULT 0,
    "openingBidMinor" INTEGER,
    "reserveMinor" INTEGER,
    "bidIncrementMinor" INTEGER,
    "fixedPriceMinor" INTEGER,
    "currentAmountMinor" INTEGER,
    "bidCount" INTEGER DEFAULT 0,
    "palletCount" INTEGER,
    "weight" DECIMAL(12,2),
    "dimensions" TEXT NOT NULL DEFAULT '',
    "shippingTerms" "LotShippingTermType" NOT NULL DEFAULT 'buyer_arranged',
    "exportAllowed" BOOLEAN NOT NULL DEFAULT true,
    "warrantyDays" INTEGER DEFAULT 0,
    "relistedFrom" TEXT,
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "sourceImport" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reminder24SentAt" TIMESTAMP(3),
    "reminder2SentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotLine" (
    "id" TEXT NOT NULL,
    "lot" TEXT,
    "lineNumber" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "partNumber" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "specs" JSONB DEFAULT '{}',
    "cosmeticGrade" TEXT NOT NULL DEFAULT '',
    "functionalGrade" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" "LotLineUnitType" NOT NULL DEFAULT 'each',
    "serials" JSONB DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "extra" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotImage" (
    "id" TEXT NOT NULL,
    "lot" TEXT,
    "image" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotAddendum" (
    "id" TEXT NOT NULL,
    "lot" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "postedBy" TEXT,
    "postedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestImport" (
    "id" TEXT NOT NULL,
    "file" TEXT,
    "originalFilename" TEXT NOT NULL DEFAULT '',
    "status" "ManifestImportStatusType" NOT NULL DEFAULT 'uploaded',
    "sheetName" TEXT NOT NULL DEFAULT '',
    "sheetNames" JSONB DEFAULT '[]',
    "headerRow" INTEGER DEFAULT 1,
    "headers" JSONB DEFAULT '[]',
    "mapping" JSONB DEFAULT '{}',
    "rowCount" INTEGER DEFAULT 0,
    "validCount" INTEGER DEFAULT 0,
    "errorCount" INTEGER DEFAULT 0,
    "rows" JSONB DEFAULT '[]',
    "purpose" "ManifestImportPurposeType" NOT NULL DEFAULT 'lot_manifest',
    "targetJob" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManifestMapping" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "mapping" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "lot" TEXT,
    "company" TEXT,
    "placedBy" TEXT,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "BidStatusType" NOT NULL DEFAULT 'active',
    "activeKey" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "BidSourceType" NOT NULL DEFAULT 'web',
    "staffNote" TEXT NOT NULL DEFAULT '',
    "sheetFile" TEXT,
    "idempotencyKey" TEXT,
    "requestHash" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "supersedes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidLine" (
    "id" TEXT NOT NULL,
    "bid" TEXT,
    "lotLine" TEXT,
    "unitPriceMinor" INTEGER DEFAULT 0,
    "quantity" INTEGER DEFAULT 0,
    "status" "BidLineStatusType" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "lot" TEXT,
    "bid" TEXT,
    "company" TEXT,
    "awardedBy" TEXT,
    "awardedAt" TIMESTAMP(3),
    "amountMinor" INTEGER DEFAULT 0,
    "isBelowReserve" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "status" "AwardStatusType" NOT NULL DEFAULT 'active',
    "activeLotKey" TEXT,
    "order" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardLine" (
    "id" TEXT NOT NULL,
    "award" TEXT,
    "lotLine" TEXT,
    "activeLotLineKey" TEXT,
    "bidLine" TEXT,
    "quantity" INTEGER DEFAULT 0,
    "unitPriceMinor" INTEGER DEFAULT 0,
    "totalMinor" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT,
    "company" TEXT,
    "lot" TEXT,
    "status" "OrderStatusType" NOT NULL DEFAULT 'awaiting_payment',
    "paymentDueAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "removalDueAt" TIMESTAMP(3),
    "releaseMethod" "OrderReleaseMethodType",
    "preferredPickupDate" DATE,
    "carrierName" TEXT NOT NULL DEFAULT '',
    "carrierReference" TEXT NOT NULL DEFAULT '',
    "freightPickupDate" DATE,
    "destinationCountry" TEXT NOT NULL DEFAULT '',
    "exportAcknowledgedAt" TIMESTAMP(3),
    "releaseDetailsSetAt" TIMESTAMP(3),
    "palletCount" INTEGER,
    "weight" DECIMAL(12,2),
    "dimensions" TEXT NOT NULL DEFAULT '',
    "billOfLading" TEXT NOT NULL DEFAULT '',
    "releasedAt" TIMESTAMP(3),
    "releasedBy" TEXT,
    "driverName" TEXT NOT NULL DEFAULT '',
    "driverSignature" TEXT,
    "claimWindowEndsAt" TIMESTAMP(3),
    "restockingInvoice" TEXT,
    "runnerUpOfferedAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "order" TEXT,
    "lineNumber" INTEGER DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "specs" JSONB DEFAULT '{}',
    "grade" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "unitPriceMinor" INTEGER DEFAULT 0,
    "totalMinor" INTEGER DEFAULT 0,
    "serials" JSONB DEFAULT '[]',
    "sourceLotLineId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DockAppointment" (
    "id" TEXT NOT NULL,
    "facility" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "order" TEXT,
    "job" TEXT,
    "driverName" TEXT NOT NULL DEFAULT '',
    "vehicle" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "DockAppointmentStatusType" NOT NULL DEFAULT 'booked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DockAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT,
    "order" TEXT,
    "company" TEXT,
    "openedBy" TEXT,
    "reason" "ClaimReasonType" NOT NULL DEFAULT 'shortage',
    "description" TEXT NOT NULL DEFAULT '',
    "lines" JSONB DEFAULT '[]',
    "requestedAmountMinor" INTEGER DEFAULT 0,
    "status" "ClaimStatusType" NOT NULL DEFAULT 'submitted',
    "resolution" "ClaimResolutionType",
    "approvedAmountMinor" INTEGER,
    "resolutionNote" TEXT NOT NULL DEFAULT '',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "refund" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimPhoto" (
    "id" TEXT NOT NULL,
    "claim" TEXT,
    "image" TEXT,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "kind" "InvoiceKindType" NOT NULL DEFAULT 'lot_sale',
    "buyerCompany" TEXT,
    "clientOrganization" TEXT,
    "order" TEXT,
    "job" TEXT,
    "settlement" TEXT,
    "status" "InvoiceStatusType" NOT NULL DEFAULT 'open',
    "subtotalMinor" INTEGER DEFAULT 0,
    "premiumMinor" INTEGER DEFAULT 0,
    "taxMinor" INTEGER DEFAULT 0,
    "freightMinor" INTEGER DEFAULT 0,
    "feeMinor" INTEGER DEFAULT 0,
    "otherMinor" INTEGER DEFAULT 0,
    "totalMinor" INTEGER DEFAULT 0,
    "paidMinor" INTEGER DEFAULT 0,
    "refundedMinor" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "remindedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidReason" TEXT NOT NULL DEFAULT '',
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "taxExemptReason" TEXT NOT NULL DEFAULT '',
    "billTo" JSONB DEFAULT '{}',
    "pdf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "kind" "InvoiceLineKindType" NOT NULL DEFAULT 'item',
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(12,3) DEFAULT 1,
    "unitPriceMinor" INTEGER DEFAULT 0,
    "totalMinor" INTEGER DEFAULT 0,
    "paymentSessionId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isInstalled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT 'manual',
    "generatePaymentLinkFunction" TEXT NOT NULL DEFAULT 'manual',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "paymentProvider" TEXT,
    "method" "PaymentSessionMethodType" NOT NULL DEFAULT 'card',
    "openKey" TEXT,
    "idempotencyKeyHash" TEXT,
    "status" "PaymentSessionStatusType" NOT NULL DEFAULT 'pending',
    "amountMinor" INTEGER DEFAULT 0,
    "feeMinor" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "clientSecret" TEXT NOT NULL DEFAULT '',
    "capturedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "replayKey" TEXT NOT NULL DEFAULT '',
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "processedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoice" TEXT,
    "session" TEXT,
    "method" "PaymentMethodType" NOT NULL DEFAULT 'wire',
    "amountMinor" INTEGER DEFAULT 0,
    "status" "PaymentStatusType" NOT NULL DEFAULT 'reported',
    "providerReference" TEXT,
    "bankReference" TEXT NOT NULL DEFAULT '',
    "paidOn" TEXT NOT NULL DEFAULT '',
    "reportedBy" TEXT,
    "reportedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectionReason" TEXT NOT NULL DEFAULT '',
    "refundedMinor" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "payment" TEXT,
    "invoice" TEXT,
    "amountMinor" INTEGER DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "RefundStatusType" NOT NULL DEFAULT 'pending',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "method" "RefundMethodType" NOT NULL DEFAULT 'card',
    "createdBy" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user" TEXT,
    "type" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "readAt" TIMESTAMP(3),
    "emailStatus" "NotificationEmailStatusType" NOT NULL DEFAULT 'not_sent',
    "emailError" TEXT NOT NULL DEFAULT '',
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actor" TEXT,
    "actorLabel" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "entityType" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT NOT NULL DEFAULT '',
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandReceipt" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "result" JSONB,
    "actorId" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DownstreamVendor_approvedCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DownstreamVendor_approvedCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BuyerCompany_categoriesOfInterest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BuyerCompany_categoriesOfInterest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "StoreSettings_logo_idx" ON "StoreSettings"("logo");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_code_key" ON "Facility"("code");

-- CreateIndex
CREATE INDEX "Certification_facility_idx" ON "Certification"("facility");

-- CreateIndex
CREATE INDEX "Certification_document_idx" ON "Certification"("document");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategory_slug_key" ON "MaterialCategory"("slug");

-- CreateIndex
CREATE INDEX "MaterialCategory_parent_idx" ON "MaterialCategory"("parent");

-- CreateIndex
CREATE INDEX "AcceptedItem_category_idx" ON "AcceptedItem"("category");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedBy_idx" ON "StoredFile"("uploadedBy");

-- CreateIndex
CREATE INDEX "ClientOrganization_accountManager_idx" ON "ClientOrganization"("accountManager");

-- CreateIndex
CREATE INDEX "ClientSite_organization_idx" ON "ClientSite"("organization");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Job_settlement_key" ON "Job"("settlement");

-- CreateIndex
CREATE INDEX "Job_organization_idx" ON "Job"("organization");

-- CreateIndex
CREATE INDEX "Job_site_idx" ON "Job"("site");

-- CreateIndex
CREATE INDEX "Job_facility_idx" ON "Job"("facility");

-- CreateIndex
CREATE INDEX "Job_requestedBy_idx" ON "Job"("requestedBy");

-- CreateIndex
CREATE INDEX "Job_quoteAcceptedBy_idx" ON "Job"("quoteAcceptedBy");

-- CreateIndex
CREATE INDEX "Job_driver_idx" ON "Job"("driver");

-- CreateIndex
CREATE INDEX "Job_clientSignature_idx" ON "Job"("clientSignature");

-- CreateIndex
CREATE INDEX "JobEstimateLine_job_idx" ON "JobEstimateLine"("job");

-- CreateIndex
CREATE INDEX "JobEstimateLine_category_idx" ON "JobEstimateLine"("category");

-- CreateIndex
CREATE INDEX "JobServiceLine_job_idx" ON "JobServiceLine"("job");

-- CreateIndex
CREATE INDEX "JobPhoto_job_idx" ON "JobPhoto"("job");

-- CreateIndex
CREATE INDEX "JobPhoto_image_idx" ON "JobPhoto"("image");

-- CreateIndex
CREATE UNIQUE INDEX "Container_label_key" ON "Container"("label");

-- CreateIndex
CREATE INDEX "Container_job_idx" ON "Container"("job");

-- CreateIndex
CREATE INDEX "CustodyEvent_job_idx" ON "CustodyEvent"("job");

-- CreateIndex
CREATE INDEX "CustodyEvent_container_idx" ON "CustodyEvent"("container");

-- CreateIndex
CREATE INDEX "CustodyEvent_asset_idx" ON "CustodyEvent"("asset");

-- CreateIndex
CREATE INDEX "CustodyEvent_actor_idx" ON "CustodyEvent"("actor");

-- CreateIndex
CREATE INDEX "CustodyEvent_facility_idx" ON "CustodyEvent"("facility");

-- CreateIndex
CREATE INDEX "CustodyEvent_signature_idx" ON "CustodyEvent"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetNumber_key" ON "Asset"("assetNumber");

-- CreateIndex
CREATE INDEX "Asset_job_idx" ON "Asset"("job");

-- CreateIndex
CREATE INDEX "Asset_container_idx" ON "Asset"("container");

-- CreateIndex
CREATE INDEX "Asset_organization_idx" ON "Asset"("organization");

-- CreateIndex
CREATE INDEX "Asset_parent_idx" ON "Asset"("parent");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "Asset_clientAssetTag_idx" ON "Asset"("clientAssetTag");

-- CreateIndex
CREATE INDEX "Asset_cosmeticGrade_idx" ON "Asset"("cosmeticGrade");

-- CreateIndex
CREATE INDEX "Asset_functionalGrade_idx" ON "Asset"("functionalGrade");

-- CreateIndex
CREATE INDEX "Asset_lotLine_idx" ON "Asset"("lotLine");

-- CreateIndex
CREATE INDEX "Asset_outboundLine_idx" ON "Asset"("outboundLine");

-- CreateIndex
CREATE INDEX "Asset_auditedBy_idx" ON "Asset"("auditedBy");

-- CreateIndex
CREATE INDEX "AssetPhoto_asset_idx" ON "AssetPhoto"("asset");

-- CreateIndex
CREATE INDEX "AssetPhoto_image_idx" ON "AssetPhoto"("image");

-- CreateIndex
CREATE INDEX "SanitizationRecord_asset_idx" ON "SanitizationRecord"("asset");

-- CreateIndex
CREATE INDEX "SanitizationRecord_reportFile_idx" ON "SanitizationRecord"("reportFile");

-- CreateIndex
CREATE INDEX "SanitizationRecord_operator_idx" ON "SanitizationRecord"("operator");

-- CreateIndex
CREATE INDEX "SanitizationRecord_verifiedBy_idx" ON "SanitizationRecord"("verifiedBy");

-- CreateIndex
CREATE INDEX "SanitizationRecord_importBatch_idx" ON "SanitizationRecord"("importBatch");

-- CreateIndex
CREATE INDEX "ErasureImport_file_idx" ON "ErasureImport"("file");

-- CreateIndex
CREATE INDEX "ErasureImport_uploadedBy_idx" ON "ErasureImport"("uploadedBy");

-- CreateIndex
CREATE INDEX "CommodityLine_job_idx" ON "CommodityLine"("job");

-- CreateIndex
CREATE INDEX "CommodityLine_category_idx" ON "CommodityLine"("category");

-- CreateIndex
CREATE INDEX "CommodityLine_outboundLine_idx" ON "CommodityLine"("outboundLine");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");

-- CreateIndex
CREATE INDEX "Certificate_job_idx" ON "Certificate"("job");

-- CreateIndex
CREATE INDEX "Certificate_organization_idx" ON "Certificate"("organization");

-- CreateIndex
CREATE INDEX "Certificate_issuedBy_idx" ON "Certificate"("issuedBy");

-- CreateIndex
CREATE INDEX "Certificate_pdf_idx" ON "Certificate"("pdf");

-- CreateIndex
CREATE INDEX "Certificate_replaces_idx" ON "Certificate"("replaces");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementNumber_key" ON "Settlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "Settlement_organization_idx" ON "Settlement"("organization");

-- CreateIndex
CREATE INDEX "Settlement_disputeRecordedBy_idx" ON "Settlement"("disputeRecordedBy");

-- CreateIndex
CREATE INDEX "Settlement_pdf_idx" ON "Settlement"("pdf");

-- CreateIndex
CREATE INDEX "SettlementLine_settlement_idx" ON "SettlementLine"("settlement");

-- CreateIndex
CREATE INDEX "SettlementLine_asset_idx" ON "SettlementLine"("asset");

-- CreateIndex
CREATE INDEX "DownstreamVendor_dueDiligenceFile_idx" ON "DownstreamVendor"("dueDiligenceFile");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundShipment_shipmentNumber_key" ON "OutboundShipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "OutboundShipment_vendor_idx" ON "OutboundShipment"("vendor");

-- CreateIndex
CREATE INDEX "OutboundShipment_facility_idx" ON "OutboundShipment"("facility");

-- CreateIndex
CREATE INDEX "OutboundShipment_receiptDocument_idx" ON "OutboundShipment"("receiptDocument");

-- CreateIndex
CREATE INDEX "OutboundShipmentLine_shipment_idx" ON "OutboundShipmentLine"("shipment");

-- CreateIndex
CREATE INDEX "OutboundShipmentLine_category_idx" ON "OutboundShipmentLine"("category");

-- CreateIndex
CREATE INDEX "BuyerCompany_approvedBy_idx" ON "BuyerCompany"("approvedBy");

-- CreateIndex
CREATE INDEX "BuyerDocument_company_idx" ON "BuyerDocument"("company");

-- CreateIndex
CREATE INDEX "BuyerDocument_file_idx" ON "BuyerDocument"("file");

-- CreateIndex
CREATE INDEX "BuyerDocument_uploadedBy_idx" ON "BuyerDocument"("uploadedBy");

-- CreateIndex
CREATE INDEX "BuyerMessage_company_idx" ON "BuyerMessage"("company");

-- CreateIndex
CREATE INDEX "BuyerMessage_author_idx" ON "BuyerMessage"("author");

-- CreateIndex
CREATE UNIQUE INDEX "SaleEvent_slug_key" ON "SaleEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_lotNumber_key" ON "Lot"("lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_sourceImport_key" ON "Lot"("sourceImport");

-- CreateIndex
CREATE INDEX "Lot_slug_idx" ON "Lot"("slug");

-- CreateIndex
CREATE INDEX "Lot_saleEvent_idx" ON "Lot"("saleEvent");

-- CreateIndex
CREATE INDEX "Lot_category_idx" ON "Lot"("category");

-- CreateIndex
CREATE INDEX "Lot_facility_idx" ON "Lot"("facility");

-- CreateIndex
CREATE INDEX "Lot_relistedFrom_idx" ON "Lot"("relistedFrom");

-- CreateIndex
CREATE INDEX "LotLine_lot_idx" ON "LotLine"("lot");

-- CreateIndex
CREATE INDEX "LotLine_category_idx" ON "LotLine"("category");

-- CreateIndex
CREATE INDEX "LotImage_lot_idx" ON "LotImage"("lot");

-- CreateIndex
CREATE INDEX "LotImage_image_idx" ON "LotImage"("image");

-- CreateIndex
CREATE INDEX "LotAddendum_lot_idx" ON "LotAddendum"("lot");

-- CreateIndex
CREATE INDEX "LotAddendum_postedBy_idx" ON "LotAddendum"("postedBy");

-- CreateIndex
CREATE INDEX "ManifestImport_file_idx" ON "ManifestImport"("file");

-- CreateIndex
CREATE INDEX "ManifestImport_targetJob_idx" ON "ManifestImport"("targetJob");

-- CreateIndex
CREATE INDEX "ManifestImport_uploadedBy_idx" ON "ManifestImport"("uploadedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_activeKey_key" ON "Bid"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_idempotencyKey_key" ON "Bid"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Bid_lot_idx" ON "Bid"("lot");

-- CreateIndex
CREATE INDEX "Bid_company_idx" ON "Bid"("company");

-- CreateIndex
CREATE INDEX "Bid_placedBy_idx" ON "Bid"("placedBy");

-- CreateIndex
CREATE INDEX "Bid_sheetFile_idx" ON "Bid"("sheetFile");

-- CreateIndex
CREATE INDEX "Bid_supersedes_idx" ON "Bid"("supersedes");

-- CreateIndex
CREATE INDEX "BidLine_bid_idx" ON "BidLine"("bid");

-- CreateIndex
CREATE INDEX "BidLine_lotLine_idx" ON "BidLine"("lotLine");

-- CreateIndex
CREATE UNIQUE INDEX "Award_activeLotKey_key" ON "Award"("activeLotKey");

-- CreateIndex
CREATE UNIQUE INDEX "Award_order_key" ON "Award"("order");

-- CreateIndex
CREATE INDEX "Award_lot_idx" ON "Award"("lot");

-- CreateIndex
CREATE INDEX "Award_bid_idx" ON "Award"("bid");

-- CreateIndex
CREATE INDEX "Award_company_idx" ON "Award"("company");

-- CreateIndex
CREATE INDEX "Award_awardedBy_idx" ON "Award"("awardedBy");

-- CreateIndex
CREATE UNIQUE INDEX "AwardLine_activeLotLineKey_key" ON "AwardLine"("activeLotLineKey");

-- CreateIndex
CREATE INDEX "AwardLine_award_idx" ON "AwardLine"("award");

-- CreateIndex
CREATE INDEX "AwardLine_lotLine_idx" ON "AwardLine"("lotLine");

-- CreateIndex
CREATE INDEX "AwardLine_bidLine_idx" ON "AwardLine"("bidLine");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_company_idx" ON "Order"("company");

-- CreateIndex
CREATE INDEX "Order_lot_idx" ON "Order"("lot");

-- CreateIndex
CREATE INDEX "Order_releasedBy_idx" ON "Order"("releasedBy");

-- CreateIndex
CREATE INDEX "Order_driverSignature_idx" ON "Order"("driverSignature");

-- CreateIndex
CREATE INDEX "Order_restockingInvoice_idx" ON "Order"("restockingInvoice");

-- CreateIndex
CREATE INDEX "OrderLine_order_idx" ON "OrderLine"("order");

-- CreateIndex
CREATE UNIQUE INDEX "DockAppointment_order_key" ON "DockAppointment"("order");

-- CreateIndex
CREATE INDEX "DockAppointment_facility_idx" ON "DockAppointment"("facility");

-- CreateIndex
CREATE INDEX "DockAppointment_job_idx" ON "DockAppointment"("job");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_refund_key" ON "Claim"("refund");

-- CreateIndex
CREATE INDEX "Claim_order_idx" ON "Claim"("order");

-- CreateIndex
CREATE INDEX "Claim_company_idx" ON "Claim"("company");

-- CreateIndex
CREATE INDEX "Claim_openedBy_idx" ON "Claim"("openedBy");

-- CreateIndex
CREATE INDEX "Claim_resolvedBy_idx" ON "Claim"("resolvedBy");

-- CreateIndex
CREATE INDEX "ClaimPhoto_claim_idx" ON "ClaimPhoto"("claim");

-- CreateIndex
CREATE INDEX "ClaimPhoto_image_idx" ON "ClaimPhoto"("image");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_order_key" ON "Invoice"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_settlement_key" ON "Invoice"("settlement");

-- CreateIndex
CREATE INDEX "Invoice_buyerCompany_idx" ON "Invoice"("buyerCompany");

-- CreateIndex
CREATE INDEX "Invoice_clientOrganization_idx" ON "Invoice"("clientOrganization");

-- CreateIndex
CREATE INDEX "Invoice_job_idx" ON "Invoice"("job");

-- CreateIndex
CREATE INDEX "Invoice_pdf_idx" ON "Invoice"("pdf");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoice_idx" ON "InvoiceLine"("invoice");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_openKey_key" ON "PaymentSession"("openKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_idempotencyKeyHash_key" ON "PaymentSession"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "PaymentSession_invoice_idx" ON "PaymentSession"("invoice");

-- CreateIndex
CREATE INDEX "PaymentSession_paymentProvider_idx" ON "PaymentSession"("paymentProvider");

-- CreateIndex
CREATE INDEX "PaymentSession_providerPaymentId_idx" ON "PaymentSession"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentSession_createdBy_idx" ON "PaymentSession"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_replayKey_key" ON "PaymentWebhookEvent"("replayKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_session_key" ON "Payment"("session");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_invoice_idx" ON "Payment"("invoice");

-- CreateIndex
CREATE INDEX "Payment_reportedBy_idx" ON "Payment"("reportedBy");

-- CreateIndex
CREATE INDEX "Payment_confirmedBy_idx" ON "Payment"("confirmedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_payment_idx" ON "Refund"("payment");

-- CreateIndex
CREATE INDEX "Refund_invoice_idx" ON "Refund"("invoice");

-- CreateIndex
CREATE INDEX "Refund_createdBy_idx" ON "Refund"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_user_idx" ON "Notification"("user");

-- CreateIndex
CREATE INDEX "AuditEvent_actor_idx" ON "AuditEvent"("actor");

-- CreateIndex
CREATE INDEX "AuditEvent_entityId_idx" ON "AuditEvent"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandReceipt_eventKey_key" ON "CommandReceipt"("eventKey");

-- CreateIndex
CREATE INDEX "_DownstreamVendor_approvedCategories_B_index" ON "_DownstreamVendor_approvedCategories"("B");

-- CreateIndex
CREATE INDEX "_BuyerCompany_categoriesOfInterest_B_index" ON "_BuyerCompany_categoriesOfInterest"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "User_buyerCompany_idx" ON "User"("buyerCompany");

-- CreateIndex
CREATE INDEX "User_clientOrganization_idx" ON "User"("clientOrganization");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_buyerCompany_fkey" FOREIGN KEY ("buyerCompany") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientOrganization_fkey" FOREIGN KEY ("clientOrganization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_logo_fkey" FOREIGN KEY ("logo") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_facility_fkey" FOREIGN KEY ("facility") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_document_fkey" FOREIGN KEY ("document") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCategory" ADD CONSTRAINT "MaterialCategory_parent_fkey" FOREIGN KEY ("parent") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptedItem" ADD CONSTRAINT "AcceptedItem_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOrganization" ADD CONSTRAINT "ClientOrganization_accountManager_fkey" FOREIGN KEY ("accountManager") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSite" ADD CONSTRAINT "ClientSite_organization_fkey" FOREIGN KEY ("organization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organization_fkey" FOREIGN KEY ("organization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_site_fkey" FOREIGN KEY ("site") REFERENCES "ClientSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_facility_fkey" FOREIGN KEY ("facility") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_quoteAcceptedBy_fkey" FOREIGN KEY ("quoteAcceptedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_driver_fkey" FOREIGN KEY ("driver") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientSignature_fkey" FOREIGN KEY ("clientSignature") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEstimateLine" ADD CONSTRAINT "JobEstimateLine_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEstimateLine" ADD CONSTRAINT "JobEstimateLine_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobServiceLine" ADD CONSTRAINT "JobServiceLine_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPhoto" ADD CONSTRAINT "JobPhoto_image_fkey" FOREIGN KEY ("image") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_container_fkey" FOREIGN KEY ("container") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_asset_fkey" FOREIGN KEY ("asset") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_facility_fkey" FOREIGN KEY ("facility") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_signature_fkey" FOREIGN KEY ("signature") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_container_fkey" FOREIGN KEY ("container") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organization_fkey" FOREIGN KEY ("organization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_parent_fkey" FOREIGN KEY ("parent") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_cosmeticGrade_fkey" FOREIGN KEY ("cosmeticGrade") REFERENCES "GradeDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_functionalGrade_fkey" FOREIGN KEY ("functionalGrade") REFERENCES "GradeDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_lotLine_fkey" FOREIGN KEY ("lotLine") REFERENCES "LotLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_outboundLine_fkey" FOREIGN KEY ("outboundLine") REFERENCES "OutboundShipmentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_auditedBy_fkey" FOREIGN KEY ("auditedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPhoto" ADD CONSTRAINT "AssetPhoto_asset_fkey" FOREIGN KEY ("asset") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPhoto" ADD CONSTRAINT "AssetPhoto_image_fkey" FOREIGN KEY ("image") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanitizationRecord" ADD CONSTRAINT "SanitizationRecord_asset_fkey" FOREIGN KEY ("asset") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanitizationRecord" ADD CONSTRAINT "SanitizationRecord_reportFile_fkey" FOREIGN KEY ("reportFile") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanitizationRecord" ADD CONSTRAINT "SanitizationRecord_operator_fkey" FOREIGN KEY ("operator") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanitizationRecord" ADD CONSTRAINT "SanitizationRecord_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanitizationRecord" ADD CONSTRAINT "SanitizationRecord_importBatch_fkey" FOREIGN KEY ("importBatch") REFERENCES "ErasureImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErasureImport" ADD CONSTRAINT "ErasureImport_file_fkey" FOREIGN KEY ("file") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErasureImport" ADD CONSTRAINT "ErasureImport_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLine" ADD CONSTRAINT "CommodityLine_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLine" ADD CONSTRAINT "CommodityLine_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityLine" ADD CONSTRAINT "CommodityLine_outboundLine_fkey" FOREIGN KEY ("outboundLine") REFERENCES "OutboundShipmentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_organization_fkey" FOREIGN KEY ("organization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_pdf_fkey" FOREIGN KEY ("pdf") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_replaces_fkey" FOREIGN KEY ("replaces") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_organization_fkey" FOREIGN KEY ("organization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_disputeRecordedBy_fkey" FOREIGN KEY ("disputeRecordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_pdf_fkey" FOREIGN KEY ("pdf") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_asset_fkey" FOREIGN KEY ("asset") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownstreamVendor" ADD CONSTRAINT "DownstreamVendor_dueDiligenceFile_fkey" FOREIGN KEY ("dueDiligenceFile") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundShipment" ADD CONSTRAINT "OutboundShipment_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "DownstreamVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundShipment" ADD CONSTRAINT "OutboundShipment_facility_fkey" FOREIGN KEY ("facility") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundShipment" ADD CONSTRAINT "OutboundShipment_receiptDocument_fkey" FOREIGN KEY ("receiptDocument") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundShipmentLine" ADD CONSTRAINT "OutboundShipmentLine_shipment_fkey" FOREIGN KEY ("shipment") REFERENCES "OutboundShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundShipmentLine" ADD CONSTRAINT "OutboundShipmentLine_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerCompany" ADD CONSTRAINT "BuyerCompany_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerDocument" ADD CONSTRAINT "BuyerDocument_company_fkey" FOREIGN KEY ("company") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerDocument" ADD CONSTRAINT "BuyerDocument_file_fkey" FOREIGN KEY ("file") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerDocument" ADD CONSTRAINT "BuyerDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerMessage" ADD CONSTRAINT "BuyerMessage_company_fkey" FOREIGN KEY ("company") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerMessage" ADD CONSTRAINT "BuyerMessage_author_fkey" FOREIGN KEY ("author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_saleEvent_fkey" FOREIGN KEY ("saleEvent") REFERENCES "SaleEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_facility_fkey" FOREIGN KEY ("facility") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_relistedFrom_fkey" FOREIGN KEY ("relistedFrom") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_sourceImport_fkey" FOREIGN KEY ("sourceImport") REFERENCES "ManifestImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotLine" ADD CONSTRAINT "LotLine_lot_fkey" FOREIGN KEY ("lot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotLine" ADD CONSTRAINT "LotLine_category_fkey" FOREIGN KEY ("category") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotImage" ADD CONSTRAINT "LotImage_lot_fkey" FOREIGN KEY ("lot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotImage" ADD CONSTRAINT "LotImage_image_fkey" FOREIGN KEY ("image") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAddendum" ADD CONSTRAINT "LotAddendum_lot_fkey" FOREIGN KEY ("lot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotAddendum" ADD CONSTRAINT "LotAddendum_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestImport" ADD CONSTRAINT "ManifestImport_file_fkey" FOREIGN KEY ("file") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestImport" ADD CONSTRAINT "ManifestImport_targetJob_fkey" FOREIGN KEY ("targetJob") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManifestImport" ADD CONSTRAINT "ManifestImport_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_lot_fkey" FOREIGN KEY ("lot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_company_fkey" FOREIGN KEY ("company") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_placedBy_fkey" FOREIGN KEY ("placedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_sheetFile_fkey" FOREIGN KEY ("sheetFile") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidLine" ADD CONSTRAINT "BidLine_bid_fkey" FOREIGN KEY ("bid") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidLine" ADD CONSTRAINT "BidLine_lotLine_fkey" FOREIGN KEY ("lotLine") REFERENCES "LotLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_lot_fkey" FOREIGN KEY ("lot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_bid_fkey" FOREIGN KEY ("bid") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_company_fkey" FOREIGN KEY ("company") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_awardedBy_fkey" FOREIGN KEY ("awardedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_order_fkey" FOREIGN KEY ("order") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardLine" ADD CONSTRAINT "AwardLine_award_fkey" FOREIGN KEY ("award") REFERENCES "Award"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardLine" ADD CONSTRAINT "AwardLine_lotLine_fkey" FOREIGN KEY ("lotLine") REFERENCES "LotLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardLine" ADD CONSTRAINT "AwardLine_bidLine_fkey" FOREIGN KEY ("bidLine") REFERENCES "BidLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_company_fkey" FOREIGN KEY ("company") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_lot_fkey" FOREIGN KEY ("lot") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_driverSignature_fkey" FOREIGN KEY ("driverSignature") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restockingInvoice_fkey" FOREIGN KEY ("restockingInvoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_order_fkey" FOREIGN KEY ("order") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DockAppointment" ADD CONSTRAINT "DockAppointment_facility_fkey" FOREIGN KEY ("facility") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DockAppointment" ADD CONSTRAINT "DockAppointment_order_fkey" FOREIGN KEY ("order") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DockAppointment" ADD CONSTRAINT "DockAppointment_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_order_fkey" FOREIGN KEY ("order") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_company_fkey" FOREIGN KEY ("company") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_refund_fkey" FOREIGN KEY ("refund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPhoto" ADD CONSTRAINT "ClaimPhoto_claim_fkey" FOREIGN KEY ("claim") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPhoto" ADD CONSTRAINT "ClaimPhoto_image_fkey" FOREIGN KEY ("image") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_buyerCompany_fkey" FOREIGN KEY ("buyerCompany") REFERENCES "BuyerCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientOrganization_fkey" FOREIGN KEY ("clientOrganization") REFERENCES "ClientOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_order_fkey" FOREIGN KEY ("order") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_job_fkey" FOREIGN KEY ("job") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_pdf_fkey" FOREIGN KEY ("pdf") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_session_fkey" FOREIGN KEY ("session") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoice_fkey" FOREIGN KEY ("invoice") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actor_fkey" FOREIGN KEY ("actor") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DownstreamVendor_approvedCategories" ADD CONSTRAINT "_DownstreamVendor_approvedCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "DownstreamVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DownstreamVendor_approvedCategories" ADD CONSTRAINT "_DownstreamVendor_approvedCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "MaterialCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuyerCompany_categoriesOfInterest" ADD CONSTRAINT "_BuyerCompany_categoriesOfInterest_A_fkey" FOREIGN KEY ("A") REFERENCES "BuyerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BuyerCompany_categoriesOfInterest" ADD CONSTRAINT "_BuyerCompany_categoriesOfInterest_B_fkey" FOREIGN KEY ("B") REFERENCES "MaterialCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Document numbers (lib/core.ts SEQUENCES). Postgres sequences never hand out the same value twice.
CREATE SEQUENCE IF NOT EXISTS "job_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "lot_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "certificate_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "settlement_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "claim_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "shipment_number_seq" START 1001;
CREATE SEQUENCE IF NOT EXISTS "asset_number_seq" START 1001;
