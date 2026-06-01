import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [categories, grades, platforms, priceAgg] = await Promise.all([
    prisma.collectibleListing.groupBy({
      by: ["categoryL1"],
      _count: { _all: true },
      where: { listingStatus: "active" },
    }),
    prisma.collectibleListing.groupBy({
      by: ["gradeNormalized"],
      _count: { _all: true },
      where: { listingStatus: "active" },
    }),
    prisma.collectibleListing.groupBy({
      by: ["sourcePlatform"],
      _count: { _all: true },
      where: { listingStatus: "active" },
    }),
    prisma.collectibleListing.aggregate({
      _min: { priceUsd: true },
      _max: { priceUsd: true },
      where: { listingStatus: "active" },
    }),
  ]);

  return NextResponse.json({
    categories: categories.map((x) => ({ value: x.categoryL1, count: x._count._all })),
    grades: grades
      .filter((x) => x.gradeNormalized)
      .map((x) => ({ value: x.gradeNormalized, count: x._count._all })),
    platforms: platforms.map((x) => ({ value: x.sourcePlatform, count: x._count._all })),
    price_range: {
      min: priceAgg._min.priceUsd?.toString() ?? null,
      max: priceAgg._max.priceUsd?.toString() ?? null,
    },
  });
}
