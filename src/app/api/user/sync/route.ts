import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SyncWalletPayload = {
  address: string;
  chainType?: string;
  walletClientType?: string;
  connectorType?: string;
  type?: string;
};

type SyncBody = {
  privyUserId?: string;
  googleEmail?: string | null;
  email?: string | null;
  wallets?: SyncWalletPayload[];
};

function normalizeWallets(wallets: SyncWalletPayload[] = []) {
  const byAddress = new Map<string, SyncWalletPayload>();

  for (const wallet of wallets) {
    const address = wallet.address?.trim();
    if (!address) continue;
    byAddress.set(address.toLowerCase(), {
      ...wallet,
      address,
      chainType: wallet.chainType ?? "unknown",
      type: wallet.type ?? "wallet",
    });
  }

  return Array.from(byAddress.values());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SyncBody;
  const privyUserId = body.privyUserId?.trim();

  if (!privyUserId) {
    return NextResponse.json({ error: "privyUserId is required" }, { status: 400 });
  }

  const normalizedWallets = normalizeWallets(body.wallets);
  const now = new Date();

  const profile = await prisma.userProfile.upsert({
    where: { privyUserId },
    create: {
      privyUserId,
      googleEmail: body.googleEmail ?? null,
      email: body.email ?? null,
    },
    update: {
      googleEmail: body.googleEmail ?? null,
      email: body.email ?? null,
    },
    select: {
      id: true,
    },
  });

  const existingWallets = await prisma.userWallet.findMany({
    where: { userId: profile.id },
    select: {
      id: true,
      address: true,
      isLinked: true,
    },
  });

  const existingByAddress = new Map(
    existingWallets.map((wallet) => [wallet.address.toLowerCase(), wallet]),
  );

  for (const wallet of normalizedWallets) {
    const existing = existingByAddress.get(wallet.address.toLowerCase());
    const isEmbedded =
      wallet.walletClientType === "privy" ||
      wallet.walletClientType === "privy-v2" ||
      wallet.connectorType === "embedded";

    const upserted = await prisma.userWallet.upsert({
      where: {
        userId_address: {
          userId: profile.id,
          address: wallet.address,
        },
      },
      create: {
        userId: profile.id,
        address: wallet.address,
        chainType: wallet.chainType ?? "unknown",
        walletClientType: wallet.walletClientType ?? null,
        connectorType: wallet.connectorType ?? null,
        walletType: wallet.type ?? "wallet",
        isEmbedded,
        isLinked: true,
        lastSyncedAt: now,
      },
      update: {
        chainType: wallet.chainType ?? "unknown",
        walletClientType: wallet.walletClientType ?? null,
        connectorType: wallet.connectorType ?? null,
        walletType: wallet.type ?? "wallet",
        isEmbedded,
        isLinked: true,
        lastSyncedAt: now,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      await prisma.userActivity.create({
        data: {
          userId: profile.id,
          walletId: upserted.id,
          type: "wallet_linked",
          title: "Wallet linked",
          details: {
            address: wallet.address,
            chainType: wallet.chainType ?? "unknown",
            walletClientType: wallet.walletClientType ?? null,
          },
        },
      });
    }
  }

  const incomingAddresses = new Set(
    normalizedWallets.map((wallet) => wallet.address.toLowerCase()),
  );

  const unlinkedWallets = existingWallets.filter(
    (wallet) => wallet.isLinked && !incomingAddresses.has(wallet.address.toLowerCase()),
  );

  if (unlinkedWallets.length) {
    await prisma.userWallet.updateMany({
      where: {
        id: {
          in: unlinkedWallets.map((wallet) => wallet.id),
        },
      },
      data: {
        isLinked: false,
        lastSyncedAt: now,
      },
    });
  }

  const recentSignIn = await prisma.userActivity.findFirst({
    where: {
      userId: profile.id,
      type: "sign_in",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  const shouldRecordSignIn =
    !recentSignIn || now.getTime() - recentSignIn.createdAt.getTime() > 1000 * 60 * 30;

  if (shouldRecordSignIn) {
    await prisma.userActivity.create({
      data: {
        userId: profile.id,
        type: "sign_in",
        title: "Signed in with Privy",
        details: {
          googleEmail: body.googleEmail ?? null,
          walletCount: normalizedWallets.length,
        },
      },
    });
  }

  return NextResponse.json({
    ok: true,
    profileId: profile.id,
    walletCount: normalizedWallets.length,
  });
}
