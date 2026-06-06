import { prisma } from "@/lib/prisma";
import type { NormalizedListingUpsert } from "@/lib/adapters/types";

// Max rows per batch INSERT. At 42 params/row, 500 rows = 21k params (well under the 65535 limit).
const BATCH_SIZE = 500;

export async function upsertNormalizedListings(items: NormalizedListingUpsert[]): Promise<number> {
  if (!items.length) return 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await batchUpsert(items.slice(i, i + BATCH_SIZE));
  }

  return items.length;
}

async function batchUpsert(items: NormalizedListingUpsert[]): Promise<void> {
  const params: unknown[] = [];
  const rows: string[] = [];

  for (const item of items) {
    const p = params.length; // 0-indexed base; SQL params are 1-indexed so use p+offset+1

    params.push(
      item.sourcePlatform,
      item.sourceListingId,
      item.sourceItemId ?? null,
      item.sourceUrl,
      item.title,
      item.description ?? null,
      item.imageUrl,
      item.thumbnailUrl ?? null,
      item.images != null ? JSON.stringify(item.images) : null,
      item.categoryL1,
      item.categoryL2 ?? null,
      item.franchise ?? null,
      item.setName ?? null,
      item.cardNumber ?? null,
      item.year ?? null,
      item.conditionType ?? "unknown",
      item.grader ?? "none",
      item.gradeValue ?? null,
      item.gradeNormalized ?? null,
      item.gradeLabelRaw ?? null,
      item.listingType ?? "fixed_price",
      String(item.priceAmount),
      item.priceCurrency,
      item.priceUsd != null ? String(item.priceUsd) : null,
      new Date(item.lastPriceUpdateAt).toISOString(),
      item.chainId ?? null,
      item.contractAddress ?? null,
      item.tokenId ?? null,
      item.tokenStandard ?? null,
      item.vaulted ?? false,
      item.redeemable ?? false,
      item.authProvider ?? null,
      item.listingStatus ?? "active",
      item.listedAt ? new Date(item.listedAt).toISOString() : null,
      item.soldAt ? new Date(item.soldAt).toISOString() : null,
      item.sellerAddress ?? null,
      item.sellerHandle ?? null,
      item.sellerVerified ?? false,
      item.syncConfidence ?? 50,
      item.dataQualityFlags != null ? JSON.stringify(item.dataQualityFlags) : null,
      item.rawSourcePayload != null ? JSON.stringify(item.rawSourcePayload) : null,
      new Date(item.syncedAt).toISOString(),
    );

    const n = (offset: number) => `$${p + offset + 1}`;

    rows.push(
      `(gen_random_uuid(),${n(0)}::"SourcePlatform",${n(1)},${n(2)},${n(3)},${n(4)},${n(5)},${n(6)},${n(7)},${n(8)}::jsonb,${n(9)}::"CategoryL1",${n(10)},${n(11)},${n(12)},${n(13)},${n(14)},${n(15)}::"ConditionType",${n(16)}::"Grader",${n(17)},${n(18)}::"GradeNormalized",${n(19)},${n(20)}::"ListingType",${n(21)}::numeric,${n(22)},${n(23)}::numeric,${n(24)}::timestamptz,${n(25)},${n(26)},${n(27)},${n(28)}::"TokenStandard",${n(29)},${n(30)},${n(31)},${n(32)}::"ListingStatus",${n(33)}::timestamptz,${n(34)}::timestamptz,${n(35)},${n(36)},${n(37)},${n(38)},${n(39)}::jsonb,${n(40)}::jsonb,now(),now(),${n(41)}::timestamptz)`,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "CollectibleListing" (
      "id","sourcePlatform","sourceListingId","sourceItemId","sourceUrl",
      "title","description","imageUrl","thumbnailUrl","images",
      "categoryL1","categoryL2","franchise","setName","cardNumber","year",
      "conditionType","grader","gradeValue","gradeNormalized","gradeLabelRaw",
      "listingType","priceAmount","priceCurrency","priceUsd","lastPriceUpdateAt",
      "chainId","contractAddress","tokenId","tokenStandard",
      "vaulted","redeemable","authProvider",
      "listingStatus","listedAt","soldAt",
      "sellerAddress","sellerHandle","sellerVerified",
      "syncConfidence","dataQualityFlags","rawSourcePayload",
      "createdAt","updatedAt","syncedAt"
    ) VALUES ${rows.join(",")}
    ON CONFLICT ("sourcePlatform","sourceListingId") DO UPDATE SET
      "sourceItemId"=EXCLUDED."sourceItemId",
      "sourceUrl"=EXCLUDED."sourceUrl",
      "title"=EXCLUDED."title",
      "description"=EXCLUDED."description",
      "imageUrl"=EXCLUDED."imageUrl",
      "thumbnailUrl"=EXCLUDED."thumbnailUrl",
      "images"=EXCLUDED."images",
      "categoryL1"=EXCLUDED."categoryL1",
      "categoryL2"=EXCLUDED."categoryL2",
      "franchise"=EXCLUDED."franchise",
      "setName"=EXCLUDED."setName",
      "cardNumber"=EXCLUDED."cardNumber",
      "year"=EXCLUDED."year",
      "conditionType"=EXCLUDED."conditionType",
      "grader"=EXCLUDED."grader",
      "gradeValue"=EXCLUDED."gradeValue",
      "gradeNormalized"=EXCLUDED."gradeNormalized",
      "gradeLabelRaw"=EXCLUDED."gradeLabelRaw",
      "listingType"=EXCLUDED."listingType",
      "priceAmount"=EXCLUDED."priceAmount",
      "priceCurrency"=EXCLUDED."priceCurrency",
      "priceUsd"=EXCLUDED."priceUsd",
      "lastPriceUpdateAt"=EXCLUDED."lastPriceUpdateAt",
      "chainId"=EXCLUDED."chainId",
      "contractAddress"=EXCLUDED."contractAddress",
      "tokenId"=EXCLUDED."tokenId",
      "tokenStandard"=EXCLUDED."tokenStandard",
      "vaulted"=EXCLUDED."vaulted",
      "redeemable"=EXCLUDED."redeemable",
      "authProvider"=EXCLUDED."authProvider",
      "listingStatus"=EXCLUDED."listingStatus",
      "listedAt"=EXCLUDED."listedAt",
      "soldAt"=EXCLUDED."soldAt",
      "sellerAddress"=EXCLUDED."sellerAddress",
      "sellerHandle"=EXCLUDED."sellerHandle",
      "sellerVerified"=EXCLUDED."sellerVerified",
      "syncConfidence"=EXCLUDED."syncConfidence",
      "dataQualityFlags"=EXCLUDED."dataQualityFlags",
      "rawSourcePayload"=EXCLUDED."rawSourcePayload",
      "updatedAt"=now(),
      "syncedAt"=EXCLUDED."syncedAt"`,
    ...params,
  );
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
