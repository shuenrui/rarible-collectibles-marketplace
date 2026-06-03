import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function asCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function softDiversifyBySource<T extends { sourcePlatform: string }>(
  items: T[],
  pageSize: number,
  page: number,
) {
  const target = page * pageSize;
  const blocks: T[] = [];
  const maxPerSource = Math.ceil(pageSize / 2);
  const queue = [...items];
  const deferred: T[] = [];

  while (blocks.length < target && (queue.length || deferred.length)) {
    const perPageCounts = new Map<string, number>();
    const pageItems: T[] = [];
    const spillover: T[] = [];

    while (pageItems.length < pageSize && queue.length) {
      const candidate = queue.shift() as T;
      const currentCount = perPageCounts.get(candidate.sourcePlatform) ?? 0;

      if (currentCount < maxPerSource) {
        pageItems.push(candidate);
        perPageCounts.set(candidate.sourcePlatform, currentCount + 1);
      } else {
        spillover.push(candidate);
      }
    }

    while (pageItems.length < pageSize && deferred.length) {
      pageItems.push(deferred.shift() as T);
    }

    while (pageItems.length < pageSize && spillover.length) {
      pageItems.push(spillover.shift() as T);
    }

    deferred.push(...spillover);
    blocks.push(...pageItems);
  }

  const start = (page - 1) * pageSize;
  return blocks.slice(start, start + pageSize);
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
        const candidateTake = Math.max(page * pageSize * 6, 96);
        const candidates = await prisma.collectibleListing.findMany({
          where,
          orderBy,
          take: candidateTake,
          select,
        });

        return softDiversifyBySource(candidates, pageSize, page);
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
