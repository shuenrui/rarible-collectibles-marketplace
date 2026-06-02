import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.collectibleListing.findMany({
    where: {
      listingStatus: "active",
    },
    orderBy: [{ priceUsd: "desc" }, { priceAmount: "desc" }, { syncedAt: "desc" }],
    take: 4,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      priceAmount: true,
      priceCurrency: true,
      priceUsd: true,
      sourcePlatform: true,
      gradeValue: true,
      gradeNormalized: true,
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      priceAmount: item.priceAmount.toString(),
      priceUsd: item.priceUsd?.toString() ?? null,
    })),
  });
}
