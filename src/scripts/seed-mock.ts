import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const now = new Date();

const mocks: Prisma.CollectibleListingUncheckedCreateInput[] = [
  {
    sourcePlatform: "other",
    sourceListingId: "mock-pokemon-psa10-001",
    sourceUrl: "https://example.com/mock/pokemon-001",
    title: "Charizard Base Set Holo #4 PSA 10",
    imageUrl: "https://images.unsplash.com/photo-1633477189729-9290b3261d0a?auto=format&fit=crop&w=800&q=80",
    categoryL1: "pokemon",
    conditionType: "graded",
    grader: "psa",
    gradeValue: "10",
    gradeNormalized: "psa10",
    listingType: "fixed_price",
    priceAmount: "7250",
    priceCurrency: "USD",
    priceUsd: "7250",
    lastPriceUpdateAt: now,
    listingStatus: "active",
    sellerVerified: true,
    syncConfidence: 95,
    vaulted: true,
    redeemable: false,
    rawSourcePayload: { source: "mock-seed" },
    syncedAt: now,
  },
  {
    sourcePlatform: "other",
    sourceListingId: "mock-basketball-psa9-002",
    sourceUrl: "https://example.com/mock/sports-002",
    title: "Michael Jordan 1989 Hoops #200 PSA 9",
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
    categoryL1: "sports_cards",
    categoryL2: "basketball",
    conditionType: "graded",
    grader: "psa",
    gradeValue: "9",
    gradeNormalized: "psa9",
    listingType: "fixed_price",
    priceAmount: "1290",
    priceCurrency: "USD",
    priceUsd: "1290",
    lastPriceUpdateAt: now,
    listingStatus: "active",
    sellerVerified: true,
    syncConfidence: 94,
    vaulted: true,
    redeemable: true,
    rawSourcePayload: { source: "mock-seed" },
    syncedAt: now,
  },
  {
    sourcePlatform: "other",
    sourceListingId: "mock-onepiece-raw-003",
    sourceUrl: "https://example.com/mock/onepiece-003",
    title: "Monkey D. Luffy OP01-003 Raw",
    imageUrl: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=80",
    categoryL1: "one_piece",
    conditionType: "raw",
    grader: "none",
    gradeValue: "RAW",
    gradeNormalized: "raw",
    listingType: "fixed_price",
    priceAmount: "220",
    priceCurrency: "USD",
    priceUsd: "220",
    lastPriceUpdateAt: now,
    listingStatus: "active",
    sellerVerified: false,
    syncConfidence: 90,
    vaulted: false,
    redeemable: true,
    rawSourcePayload: { source: "mock-seed" },
    syncedAt: now,
  },
  {
    sourcePlatform: "other",
    sourceListingId: "mock-yugioh-bgs95-004",
    sourceUrl: "https://example.com/mock/yugioh-004",
    title: "Blue-Eyes White Dragon SDK-001 BGS 9.5",
    imageUrl: "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&w=800&q=80",
    categoryL1: "yugioh",
    conditionType: "graded",
    grader: "bgs",
    gradeValue: "9.5",
    gradeNormalized: "bgs95",
    listingType: "auction",
    priceAmount: "860",
    priceCurrency: "USD",
    priceUsd: "860",
    lastPriceUpdateAt: now,
    listingStatus: "active",
    sellerVerified: true,
    syncConfidence: 93,
    vaulted: true,
    redeemable: false,
    rawSourcePayload: { source: "mock-seed" },
    syncedAt: now,
  },
  {
    sourcePlatform: "other",
    sourceListingId: "mock-comic-cgc10-005",
    sourceUrl: "https://example.com/mock/comic-005",
    title: "Amazing Spider-Man #300 CGC 10",
    imageUrl: "https://images.unsplash.com/photo-1611605698335-8b1569810432?auto=format&fit=crop&w=800&q=80",
    categoryL1: "comics",
    conditionType: "graded",
    grader: "cgc",
    gradeValue: "10",
    gradeNormalized: "cgc10",
    listingType: "fixed_price",
    priceAmount: "3150",
    priceCurrency: "USD",
    priceUsd: "3150",
    lastPriceUpdateAt: now,
    listingStatus: "active",
    sellerVerified: true,
    syncConfidence: 96,
    vaulted: true,
    redeemable: false,
    rawSourcePayload: { source: "mock-seed" },
    syncedAt: now,
  },
];

async function main() {
  let upserted = 0;
  for (const m of mocks) {
    await prisma.collectibleListing.upsert({
      where: {
        sourcePlatform_sourceListingId: {
          sourcePlatform: m.sourcePlatform,
          sourceListingId: m.sourceListingId,
        },
      },
      create: m,
      update: m,
    });
    upserted += 1;
  }

  console.log(JSON.stringify({ upserted }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
