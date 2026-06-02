import { prisma } from "@/lib/prisma";
import { fetchEVMBalances, fetchSolanaBalances } from "@/lib/balance";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { privyUserId?: string };
  const privyUserId = body.privyUserId?.trim();

  if (!privyUserId) {
    return NextResponse.json({ error: "privyUserId is required" }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { privyUserId },
    select: {
      id: true,
      wallets: {
        where: { isLinked: true },
        select: { id: true, address: true, chainType: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  let updated = 0;

  await Promise.allSettled(
    profile.wallets.map(async (wallet) => {
      const isEVM =
        wallet.chainType === "ethereum" || wallet.chainType === "evm";
      const isSolana = wallet.chainType === "solana";

      const balances =
        isEVM
          ? await fetchEVMBalances(wallet.address)
          : isSolana
            ? await fetchSolanaBalances(wallet.address)
            : { nativeBalance: null, usdcBalance: null };

      if (balances.nativeBalance !== null || balances.usdcBalance !== null) {
        await prisma.userWallet.update({
          where: { id: wallet.id },
          data: {
            nativeBalance: balances.nativeBalance,
            usdcBalance: balances.usdcBalance,
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      }
    }),
  );

  return NextResponse.json({ ok: true, updated });
}
