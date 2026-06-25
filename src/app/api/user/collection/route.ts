import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseWallets(value: string | null) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(",")
        .map((wallet) => wallet.trim())
        .filter(Boolean),
    ),
  );
}

export async function GET(req: NextRequest) {
  const wallets = parseWallets(req.nextUrl.searchParams.get("wallets"));

  if (!wallets.length) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.collectibleListing.findMany({
    where: {
      sellerAddress: {
        in: wallets,
      },
    },
    orderBy: [{ listingStatus: "asc" }, { syncedAt: "desc" }],
    take: 48,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      gradeValue: true,
      gradeNormalized: true,
      priceAmount: true,
      priceCurrency: true,
      priceUsd: true,
      listingType: true,
      sourcePlatform: true,
      sourceUrl: true,
      listingStatus: true,
      sellerAddress: true,
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
