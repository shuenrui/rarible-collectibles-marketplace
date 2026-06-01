import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function asCsv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
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

  const orderBy: Prisma.CollectibleListingOrderByWithRelationInput =
    sort === "price_asc"
      ? { priceUsd: "asc" }
      : sort === "price_desc"
      ? { priceUsd: "desc" }
      : { syncedAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.collectibleListing.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
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
      },
    }),
    prisma.collectibleListing.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      priceAmount: item.priceAmount.toString(),
      priceUsd: item.priceUsd?.toString() ?? null,
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
