import { prisma } from "@/lib/prisma";
import type { NormalizedListingUpsert } from "@/lib/adapters/types";

export async function upsertNormalizedListings(items: NormalizedListingUpsert[]): Promise<number> {
  let persisted = 0;

  for (const item of items) {
    await prisma.collectibleListing.upsert({
      where: {
        sourcePlatform_sourceListingId: {
          sourcePlatform: item.sourcePlatform,
          sourceListingId: item.sourceListingId,
        },
      },
      create: {
        sourcePlatform: item.sourcePlatform,
        sourceListingId: item.sourceListingId,
        sourceItemId: item.sourceItemId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        images: (item.images as unknown as object) ?? undefined,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        franchise: item.franchise,
        setName: item.setName,
        cardNumber: item.cardNumber,
        year: item.year,
        conditionType: item.conditionType,
        grader: item.grader,
        gradeValue: item.gradeValue,
        gradeNormalized: item.gradeNormalized,
        gradeLabelRaw: item.gradeLabelRaw,
        listingType: item.listingType,
        priceAmount: item.priceAmount,
        priceCurrency: item.priceCurrency,
        priceUsd: item.priceUsd,
        lastPriceUpdateAt: new Date(item.lastPriceUpdateAt),
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        tokenId: item.tokenId,
        tokenStandard: item.tokenStandard,
        vaulted: item.vaulted,
        redeemable: item.redeemable,
        authProvider: item.authProvider,
        listingStatus: item.listingStatus,
        listedAt: item.listedAt ? new Date(item.listedAt) : undefined,
        soldAt: item.soldAt ? new Date(item.soldAt) : undefined,
        sellerAddress: item.sellerAddress,
        sellerHandle: item.sellerHandle,
        sellerVerified: item.sellerVerified,
        syncConfidence: item.syncConfidence,
        dataQualityFlags: (item.dataQualityFlags as object) ?? undefined,
        rawSourcePayload: item.rawSourcePayload as object,
        syncedAt: new Date(item.syncedAt),
      },
      update: {
        sourceItemId: item.sourceItemId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        images: (item.images as unknown as object) ?? undefined,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        franchise: item.franchise,
        setName: item.setName,
        cardNumber: item.cardNumber,
        year: item.year,
        conditionType: item.conditionType,
        grader: item.grader,
        gradeValue: item.gradeValue,
        gradeNormalized: item.gradeNormalized,
        gradeLabelRaw: item.gradeLabelRaw,
        listingType: item.listingType,
        priceAmount: item.priceAmount,
        priceCurrency: item.priceCurrency,
        priceUsd: item.priceUsd,
        lastPriceUpdateAt: new Date(item.lastPriceUpdateAt),
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        tokenId: item.tokenId,
        tokenStandard: item.tokenStandard,
        vaulted: item.vaulted,
        redeemable: item.redeemable,
        authProvider: item.authProvider,
        listingStatus: item.listingStatus,
        listedAt: item.listedAt ? new Date(item.listedAt) : undefined,
        soldAt: item.soldAt ? new Date(item.soldAt) : undefined,
        sellerAddress: item.sellerAddress,
        sellerHandle: item.sellerHandle,
        sellerVerified: item.sellerVerified,
        syncConfidence: item.syncConfidence,
        dataQualityFlags: (item.dataQualityFlags as object) ?? undefined,
        rawSourcePayload: item.rawSourcePayload as object,
        syncedAt: new Date(item.syncedAt),
      },
    });
    persisted += 1;
  }

  return persisted;
}

export async function expireUnseenActiveListings(
  sourcePlatform: NormalizedListingUpsert["sourcePlatform"],
  seenSourceListingIds: string[],
): Promise<number> {
  if (!seenSourceListingIds.length) return 0;

  const result = await prisma.collectibleListing.updateMany({
    where: {
      sourcePlatform,
      listingStatus: "active",
      sourceListingId: {
        notIn: seenSourceListingIds,
      },
    },
    data: {
      listingStatus: "expired",
    },
  });

  return result.count;
}
