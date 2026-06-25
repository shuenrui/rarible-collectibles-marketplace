import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const featured = await prisma.collectibleListing.findFirst({
    where: {
      listingStatus: "active",
    },
    orderBy: [
      { priceUsd: "desc" },
      { priceAmount: "desc" },
      { syncedAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      imageUrl: true,
      priceAmount: true,
      priceCurrency: true,
      priceUsd: true,
      listingType: true,
      sourcePlatform: true,
      gradeValue: true,
      gradeNormalized: true,
    },
  });

  if (!featured) {
    return NextResponse.json({ item: null });
  }

  return NextResponse.json({
    item: {
      ...featured,
      priceAmount: featured.priceAmount.toString(),
      priceUsd: featured.priceUsd?.toString() ?? null,
    },
  });
}
