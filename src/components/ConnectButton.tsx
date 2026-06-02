"use client";

import Link from "next/link";
import { useLogout, usePrivy } from "@privy-io/react-auth";

function truncateAddress(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function ConnectButton() {
  const { ready, authenticated, user, login } = usePrivy();
  const { logout } = useLogout();

  const accountLabel =
    user?.google?.email || user?.email?.address || user?.wallet?.address || "Dashboard";

  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <span className="border-2 border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#FEDB02]">
        Privy setup pending
      </span>
    );
  }

  if (!ready) {
    return (
      <span className="border-2 border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#FEDB02]">
        Loading account
      </span>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login({ loginMethods: ["google"] })}
        className="border-2 border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#FEDB02]"
      >
        Connect account
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard"
        className="border-2 border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#FEDB02]"
      >
        {accountLabel.includes("@") ? accountLabel : truncateAddress(accountLabel)}
      </Link>
      <button
        onClick={() => logout()}
        className="border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-black"
      >
        Sign out
      </button>
    </div>
  );
}
