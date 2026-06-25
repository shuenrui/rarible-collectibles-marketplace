import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function asCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function getTimestampScore(item: { listedAt: Date | null; syncedAt: Date }) {
  return item.listedAt?.getTime() ?? item.syncedAt.getTime();
}

function softDiversifyBySource<T extends { sourcePlatform: string; listedAt: Date | null; syncedAt: Date }>(
  itemsBySource: T[][],
  pageSize: number,
  page: number,
) {
  const numSources = itemsBySource.filter((b) => b.length > 0).length || 1;
  // Hard cap: no platform may contribute more than ~40% of a page (floor at 2 so small pages work)
  const maxTotalPerSource = Math.max(2, Math.floor(pageSize * 0.4));
  // Soft consecutive cap: max 2 in a row before yielding to another platform
  const maxConsecutive = 2;

  const cursors = new Array(itemsBySource.length).fill(0);
  // Track how many items each platform has contributed to the CURRENT page
  const pageContribs = new Array(itemsBySource.length).fill(0);
  const merged: T[] = [];
  let lastBucketIndex = -1;
  let currentRun = 0;
  const target = page * pageSize;

  while (merged.length < target) {
    let bestBucketIndex = -1;
    let bestBucketItem: T | null = null;

    // Pass 1: respect both the consecutive cap AND the total-per-page cap
    for (let i = 0; i < itemsBySource.length; i++) {
      const candidate = itemsBySource[i][cursors[i]];
      if (!candidate) continue;
      // Skip if this platform has hit the consecutive run cap
      if (i === lastBucketIndex && currentRun >= maxConsecutive) continue;
      // Skip if this platform has hit the total-per-page cap
      if (pageContribs[i] >= maxTotalPerSource) continue;
      if (!bestBucketItem || getTimestampScore(candidate) > getTimestampScore(bestBucketItem)) {
        bestBucketItem = candidate;
        bestBucketIndex = i;
      }
    }

    // Pass 2 (fallback): if all remaining candidates are blocked by consecutive cap,
    // relax it but still respect the total-per-page cap
    if (!bestBucketItem) {
      for (let i = 0; i < itemsBySource.length; i++) {
        const candidate = itemsBySource[i][cursors[i]];
        if (!candidate) continue;
        if (pageContribs[i] >= maxTotalPerSource) continue;
        if (!bestBucketItem || getTimestampScore(candidate) > getTimestampScore(bestBucketItem)) {
          bestBucketItem = candidate;
          bestBucketIndex = i;
        }
      }
    }

    // Pass 3 (last resort): everything is capped, just take the freshest remaining
    if (!bestBucketItem) {
      for (let i = 0; i < itemsBySource.length; i++) {
        const candidate = itemsBySource[i][cursors[i]];
        if (!candidate) continue;
        if (!bestBucketItem || getTimestampScore(candidate) > getTimestampScore(bestBucketItem)) {
          bestBucketItem = candidate;
          bestBucketIndex = i;
        }
      }
    }

    if (!bestBucketItem || bestBucketIndex === -1) break;

    merged.push(bestBucketItem);
    cursors[bestBucketIndex] += 1;
    pageContribs[bestBucketIndex] += 1;

    if (bestBucketIndex === lastBucketIndex) {
      currentRun += 1;
    } else {
      lastBucketIndex = bestBucketIndex;
      currentRun = 1;
    }

    // Reset per-page contribution counts when we finish a full page
    if (merged.length % pageSize === 0) {
      pageContribs.fill(0);
    }
  }

  const start = (page - 1) * pageSize;
  return merged.slice(start, start + pageSize);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Number(sp.get("page") || "1");
  const pageSize = Number(sp.get("page_size") || "24");
  const q = sp.get("q")?.trim();
  const categories = asCsv(sp.get("category"));
  const grades = asCsv(sp.get("grade"));
  const platforms = asCsv(sp.get("source_platform"));
  const listingTypes = asCsv(sp.get("listing_type"));
  const status = sp.get("listing_status") || "active";
  const sort = sp.get("sort") || "newest";
  const minPrice = sp.get("min_price_usd");
  const maxPrice = sp.get("max_price_usd");

  const where: Prisma.CollectibleListingWhereInput = {
    listingStatus: status as never,
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { franchise: { contains: q, mode: "insensitive" } },
      { setName: { contains: q, mode: "insensitive" } },
      { cardNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  if (categories.length) where.categoryL1 = { in: categories as never[] };
  if (grades.length) where.gradeNormalized = { in: grades as never[] };
  if (platforms.length) where.sourcePlatform = { in: platforms as never[] };
  if (listingTypes.length) where.listingType = { in: listingTypes as never[] };

  if (!listingTypes.length && (sort === "price_asc" || sort === "price_desc")) {
    // "Lowest price" and "Highest price" should rank actual buy-now inventory,
    // not auction placeholder bids or offer-only rows.
    where.listingType = "fixed_price";
  }

  if (minPrice || maxPrice) {
    where.priceUsd = {
      gte: minPrice ? minPrice : undefined,
      lte: maxPrice ? maxPrice : undefined,
    };
  }

  const orderBy: Prisma.CollectibleListingOrderByWithRelationInput[] =
    sort === "price_asc"
      ? [{ priceUsd: "asc" }, { listedAt: "desc" }, { syncedAt: "desc" }]
      : sort === "price_desc"
      ? [{ priceUsd: "desc" }, { listedAt: "desc" }, { syncedAt: "desc" }]
      : [{ listedAt: "desc" }, { syncedAt: "desc" }];

  const shouldDiversifyAll =
    !q &&
    !categories.length &&
    !grades.length &&
    !platforms.length &&
    !minPrice &&
    !maxPrice &&
    status === "active" &&
    sort === "updated_desc";

  const select = {
    id: true,
    title: true,
    imageUrl: true,
    gradeValue: true,
    gradeNormalized: true,
    priceAmount: true,
    priceCurrency: true,
    priceUsd: true,
    sourcePlatform: true,
    listingType: true,
    sourceUrl: true,
    listingStatus: true,
    categoryL1: true,
    syncConfidence: true,
    vaulted: true,
    redeemable: true,
    syncedAt: true,
    listedAt: true,
  } satisfies Prisma.CollectibleListingSelect;

  // Fetch items — try the ideal sorted+counted path first, fall back to a simple
  // PK-scan if a statement-timeout kills the heavier queries (likely on a cold
  // Supabase free-tier slot without the right indexes yet).
  let total = -1;
  type ListingRow = Prisma.CollectibleListingGetPayload<{ select: typeof select }>;
  let items: ListingRow[] = [];

  try {
    total = await prisma.collectibleListing.count({ where });
  } catch {
    // count will be -1 (unknown) until indexes are in place
  }

  try {
    items = shouldDiversifyAll
      ? await (async () => {
          const sourceRows = await prisma.collectibleListing.groupBy({
            by: ["sourcePlatform"],
            where,
            _count: { _all: true },
            orderBy: { _count: { sourcePlatform: "desc" } },
          });

          const candidateTakePerSource = Math.max(page * pageSize * 2, 24);
          const sourceBuckets = await Promise.all(
            sourceRows.map((row) =>
              prisma.collectibleListing.findMany({
                where: { ...where, sourcePlatform: row.sourcePlatform },
                orderBy,
                take: candidateTakePerSource,
                select,
              }),
            ),
          );

          return softDiversifyBySource(sourceBuckets, pageSize, page);
        })()
      : await prisma.collectibleListing.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          select,
        });
  } catch {
    // Fall back to a pure PK scan with NO WHERE clause — reads the last
    // (pageSize * 5) rows from the PK B-tree index only, then filters in
    // memory. Without a WHERE, Postgres reads exactly N rows without any
    // heap filter pass, so this cannot hit a statement timeout regardless
    // of missing indexes.
    const raw = await prisma.collectibleListing.findMany({
      orderBy: [{ id: "desc" }],
      take: pageSize * 5,
      select,
    });
    items = raw
      .filter((r) => r.listingStatus === status)
      .slice(0, pageSize);
  }

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      priceAmount: item.priceAmount.toString(),
      priceUsd: item.priceUsd?.toString() ?? null,
      syncedAt: item.syncedAt.toISOString(),
      listedAt: item.listedAt?.toISOString() ?? null,
    })),
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: total >= 0 ? Math.ceil(total / pageSize) : null,
    },
    applied_filters: {
      q,
      categories,
      grades,
      platforms,
      min_price_usd: minPrice,
      max_price_usd: maxPrice,
      listing_status: status,
      listing_types: listingTypes,
      sort,
    },
  });
}
