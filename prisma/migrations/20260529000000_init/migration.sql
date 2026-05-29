-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SourcePlatform" AS ENUM ('phygitals', 'courtyard', 'beezie', 'collector_crypt', 'other');

-- CreateEnum
CREATE TYPE "CategoryL1" AS ENUM ('pokemon', 'sports_cards', 'one_piece', 'yugioh', 'comics', 'sealed_products', 'other');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('graded', 'raw', 'sealed', 'unknown');

-- CreateEnum
CREATE TYPE "Grader" AS ENUM ('psa', 'bgs', 'cgc', 'sgc', 'fanatics', 'alt', 'other', 'none');

-- CreateEnum
CREATE TYPE "GradeNormalized" AS ENUM ('psa10', 'psa9', 'psa8', 'bgs10', 'bgs95', 'cgc10', 'raw', 'sealed', 'other');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('fixed_price', 'auction', 'offer');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'sold', 'cancelled', 'expired', 'unknown');

-- CreateEnum
CREATE TYPE "TokenStandard" AS ENUM ('erc721', 'erc1155', 'spl', 'other');

-- CreateTable
CREATE TABLE "CollectibleListing" (
    "id" TEXT NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "sourceListingId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "images" JSONB,
    "categoryL1" "CategoryL1" NOT NULL,
    "categoryL2" TEXT,
    "franchise" TEXT,
    "setName" TEXT,
    "cardNumber" TEXT,
    "year" INTEGER,
    "conditionType" "ConditionType" NOT NULL DEFAULT 'unknown',
    "grader" "Grader" NOT NULL DEFAULT 'none',
    "gradeValue" TEXT,
    "gradeNormalized" "GradeNormalized",
    "gradeLabelRaw" TEXT,
    "listingType" "ListingType" NOT NULL DEFAULT 'fixed_price',
    "priceAmount" DECIMAL(24,8) NOT NULL,
    "priceCurrency" TEXT NOT NULL,
    "priceUsd" DECIMAL(24,8),
    "lastPriceUpdateAt" TIMESTAMP(3) NOT NULL,
    "chainId" INTEGER,
    "contractAddress" TEXT,
    "tokenId" TEXT,
    "tokenStandard" "TokenStandard",
    "vaulted" BOOLEAN NOT NULL DEFAULT false,
    "redeemable" BOOLEAN NOT NULL DEFAULT false,
    "authProvider" TEXT,
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'active',
    "listedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "sellerAddress" TEXT,
    "sellerHandle" TEXT,
    "sellerVerified" BOOLEAN NOT NULL DEFAULT false,
    "syncConfidence" INTEGER NOT NULL DEFAULT 50,
    "dataQualityFlags" JSONB,
    "rawSourcePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectibleListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectibleListing_categoryL1_gradeNormalized_priceUsd_list_idx" ON "CollectibleListing"("categoryL1", "gradeNormalized", "priceUsd", "listingStatus");

-- CreateIndex
CREATE INDEX "CollectibleListing_chainId_contractAddress_tokenId_idx" ON "CollectibleListing"("chainId", "contractAddress", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectibleListing_sourcePlatform_sourceListingId_key" ON "CollectibleListing"("sourcePlatform", "sourceListingId");
