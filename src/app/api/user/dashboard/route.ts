import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const privyUserId = req.nextUrl.searchParams.get("privy_user_id")?.trim();

  if (!privyUserId) {
    return NextResponse.json({ error: "privy_user_id is required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    include: {
      wallets: {
        where: { isLinked: true },
        orderBy: [{ isEmbedded: "desc" }, { createdAt: "asc" }],
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
  });

  if (!profile) {
    return NextResponse.json({
      profile: null,
      wallets: [],
      embeddedWallets: [],
      activities: [],
      collection: [],
    });
  }

  const addresses = profile.wallets.map((wallet) => wallet.address);

  const collection = addresses.length
    ? await prisma.collectibleListing.findMany({
        where: {
          sellerAddress: {
            in: addresses,
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
        },
      })
    : [];

  const embeddedWallets = profile.wallets.filter((wallet) => wallet.isEmbedded);

  return NextResponse.json({
    profile: {
      id: profile.id,
      privyUserId: profile.privyUserId,
      googleEmail: profile.googleEmail,
      email: profile.email,
    },
    wallets: profile.wallets,
    embeddedWallets,
    activities: profile.activities,
    collection: collection.map((item) => ({
      ...item,
      priceAmount: item.priceAmount.toString(),
      priceUsd: item.priceUsd?.toString() ?? null,
    })),
  });
}
