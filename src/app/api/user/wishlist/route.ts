import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/user/wishlist?privy_user_id=...
export async function GET(req: NextRequest) {
  const privyUserId = req.nextUrl.searchParams.get("privy_user_id")?.trim();
  if (!privyUserId) {
    return NextResponse.json({ error: "privy_user_id is required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    select: { id: true },
  });

  if (!profile) return NextResponse.json({ items: [] });

  const items = await prisma.wishlistItem.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      listingId: true,
      createdAt: true,
      listing: {
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
        },
      },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      listing: {
        ...item.listing,
        priceAmount: item.listing.priceAmount.toString(),
        priceUsd: item.listing.priceUsd?.toString() ?? null,
      },
    })),
  });
}

type WishlistBody = { privyUserId?: string; listingId?: string };

// POST /api/user/wishlist — add to wishlist
export async function POST(req: NextRequest) {
  const body = (await req.json()) as WishlistBody;
  const privyUserId = body.privyUserId?.trim();
  const listingId = body.listingId?.trim();

  if (!privyUserId || !listingId) {
    return NextResponse.json({ error: "privyUserId and listingId are required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await prisma.wishlistItem.upsert({
    where: { userId_listingId: { userId: profile.id, listingId } },
    create: { userId: profile.id, listingId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/user/wishlist — remove from wishlist
export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as WishlistBody;
  const privyUserId = body.privyUserId?.trim();
  const listingId = body.listingId?.trim();

  if (!privyUserId || !listingId) {
    return NextResponse.json({ error: "privyUserId and listingId are required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await prisma.wishlistItem.deleteMany({
    where: { userId: profile.id, listingId },
  });

  return NextResponse.json({ ok: true });
}
