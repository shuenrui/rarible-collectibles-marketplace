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
  const target = page * pageSize;
  const maxConsecutivePerSource = Math.max(2, Math.ceil(pageSize / 5));
  const cursors = new Array(itemsBySource.length).fill(0);
  const merged: T[] = [];
  let lastSource: string | null = null;
  let currentRun = 0;

  while (merged.length < target) {
    let bestBucketIndex = -1;
    let bestBucketItem: T | null = null;

    for (let index = 0; index < itemsBySource.length; index += 1) {
      const candidate = itemsBySource[index][cursors[index]];
      if (!candidate) continue;

      const isRunBlocked =
        candidate.sourcePlatform === lastSource && currentRun >= maxConsecutivePerSource;
      if (isRunBlocked) continue;

      if (!bestBucketItem || getTimestampScore(candidate) > getTimestampScore(bestBucketItem)) {
        bestBucketItem = candidate;
        bestBucketIndex = index;
      }
    }

    if (!bestBucketItem) {
      for (let index = 0; index < itemsBySource.length; index += 1) {
        const candidate = itemsBySource[index][cursors[index]];
        if (!candidate) continue;
        if (!bestBucketItem || getTimestampScore(candidate) > getTimestampScore(bestBucketItem)) {
          bestBucketItem = candidate;
          bestBucketIndex = index;
        }
      }
    }

    if (!bestBucketItem || bestBucketIndex === -1) break;

    merged.push(bestBucketItem);
    cursors[bestBucketIndex] += 1;

    if (bestBucketItem.sourcePlatform === lastSource) {
      currentRun += 1;
    } else {
      lastSource = bestBucketItem.sourcePlatform;
      currentRun = 1;
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
    sourceUrl: true,
    listingStatus: true,
    categoryL1: true,
    syncConfidence: true,
    vaulted: true,
    redeemable: true,
    syncedAt: true,
    listedAt: true,
  } satisfies Prisma.CollectibleListingSelect;

  const total = await prisma.collectibleListing.count({ where });

  const items = shouldDiversifyAll
    ? await (async () => {
        const sourceRows = await prisma.collectibleListing.groupBy({
          by: ["sourcePlatform"],
          where,
          _count: { _all: true },
          orderBy: {
            _count: {
              sourcePlatform: "desc",
            },
          },
        });

        const candidateTakePerSource = Math.max(page * pageSize * 2, 24);
        const sourceBuckets = await Promise.all(
          sourceRows.map((row) =>
            prisma.collectibleListing.findMany({
              where: {
                ...where,
                sourcePlatform: row.sourcePlatform,
              },
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
      total_pages: Math.ceil(total / pageSize),
    },
    applied_filters: {
      q,
      categories,
      grades,
      platforms,
      min_price_usd: minPrice,
      max_price_usd: maxPrice,
      listing_status: status,
      sort,
    },
  });
}
