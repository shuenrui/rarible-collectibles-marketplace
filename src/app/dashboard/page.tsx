"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import ConnectButton from "@/components/ConnectButton";

type LinkedWallet = {
  address: string;
  chainType?: string;
  walletClientType?: string;
  connectorType?: string;
  type?: string;
};

type CollectionItem = {
  id: string;
  title: string;
  imageUrl: string;
  gradeValue: string | null;
  gradeNormalized: string | null;
  priceAmount: string;
  priceCurrency: string;
  priceUsd: string | null;
  sourcePlatform: string;
  sourceUrl: string;
  listingStatus: string;
};

function truncateAddress(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function walletChainLabel(chainType?: string) {
  if (chainType === "solana") return "Solana";
  if (chainType === "ethereum") return "EVM";
  return "Wallet";
}

export default function DashboardPage() {
  const { ready, authenticated, user, linkWallet } = usePrivy();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const wallets = useMemo(() => {
    const linkedAccounts = (user?.linkedAccounts ?? []) as LinkedWallet[];

    return linkedAccounts.filter(
      (account) =>
        (account.type === "wallet" || account.type === "smart_wallet") &&
        Boolean(account.address),
    );
  }, [user?.linkedAccounts]);

  const embeddedWallets = useMemo(() => {
    const embedded = wallets.filter(
      (wallet) =>
        wallet.walletClientType === "privy" ||
        wallet.walletClientType === "privy-v2" ||
        wallet.connectorType === "embedded",
    );

    if (embedded.length > 0) return embedded;

    const firstByChain = new Map<string, LinkedWallet>();
    for (const wallet of wallets) {
      if (!wallet.chainType || firstByChain.has(wallet.chainType)) continue;
      firstByChain.set(wallet.chainType, wallet);
    }

    return Array.from(firstByChain.values());
  }, [wallets]);

  useEffect(() => {
    if (!authenticated || wallets.length === 0) {
      setItems([]);
      return;
    }

    let active = true;

    const loadCollection = async () => {
      setLoadingCollection(true);

      try {
        const params = new URLSearchParams({
          wallets: wallets.map((wallet) => wallet.address).join(","),
        });
        const response = await fetch(`/api/user/collection?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { items: CollectionItem[] };
        if (active) setItems(data.items ?? []);
      } finally {
        if (active) setLoadingCollection(false);
      }
    };

    loadCollection();

    return () => {
      active = false;
    };
  }, [authenticated, wallets]);

  const googleEmail = user?.google?.email || user?.email?.address || "Google account";

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    window.setTimeout(() => setCopiedAddress(null), 1500);
  };

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/collectibles"
              className="hidden border-2 border-black px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-black md:inline-flex"
            >
              Marketplace
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <section className="border-b-[3px] border-[#FEDB02] px-4 py-12 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FEDB02]">Dashboard</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Your wallet, one account.</h1>
            <p className="mt-4 max-w-2xl text-sm text-white/70 md:text-base">
              Google is the primary login. Privy creates the embedded wallets, and you can link your own EVM and
              Solana wallets underneath the same account.
            </p>
          </div>
          {ready && authenticated ? (
            <div className="border-2 border-[#FEDB02] bg-[#131313] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FEDB02]">Signed in as</p>
              <p className="mt-1 text-sm font-bold">{googleEmail}</p>
            </div>
          ) : null}
        </div>
      </section>

      {!ready ? (
        <section className="px-4 py-12 md:px-8">
          <div className="mx-auto max-w-[1280px] border-2 border-white/10 bg-[#121212] p-8 text-sm text-white/65">
            Loading Privy account state...
          </div>
        </section>
      ) : !authenticated ? (
        <section className="px-4 py-12 md:px-8">
          <div className="mx-auto max-w-[1280px] border-2 border-white/10 bg-[#121212] p-8">
            <h2 className="text-2xl font-black">Connect with Google to unlock your dashboard.</h2>
            <p className="mt-3 max-w-xl text-sm text-white/70">
              V1 uses Google for identity, generates embedded EVM and Solana wallets through Privy, and lets you link
              external wallets later.
            </p>
            <button
              onClick={() => initOAuth({ provider: "google" })}
              disabled={oauthLoading}
              className="mt-6 border-2 border-[#FEDB02] bg-[#FEDB02] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-black"
            >
              {oauthLoading ? "Connecting..." : "Continue with Google"}
            </button>
          </div>
        </section>
      ) : (
        <section className="px-4 py-12 md:px-8">
          <div className="mx-auto grid w-full max-w-[1280px] gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-2 border-white/10 bg-[#121212] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FEDB02]">Linked wallets</p>
                  <h2 className="mt-2 text-2xl font-black">Identity and wallet linking</h2>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black">{wallets.length}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">wallets linked</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {wallets.length ? (
                  wallets.map((wallet) => (
                    <div key={`${wallet.chainType}-${wallet.address}`} className="border border-white/10 bg-black/30 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FEDB02]">
                            {walletChainLabel(wallet.chainType)}
                          </p>
                          <p className="mt-1 text-sm font-bold">{truncateAddress(wallet.address)}</p>
                          <p className="mt-1 text-xs text-white/45">
                            {wallet.walletClientType || wallet.connectorType || "linked wallet"}
                          </p>
                        </div>
                        <button
                          onClick={() => copyAddress(wallet.address)}
                          className="border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75"
                        >
                          {copiedAddress === wallet.address ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">No wallets linked yet.</p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => linkWallet({ walletChainType: "ethereum-only" })}
                  className="border-2 border-[#FEDB02] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#FEDB02]"
                >
                  Link EVM wallet
                </button>
                <button
                  onClick={() => linkWallet({ walletChainType: "solana-only" })}
                  className="border-2 border-white/20 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white"
                >
                  Link Solana wallet
                </button>
              </div>
            </div>

            <div className="border-2 border-white/10 bg-[#121212] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FEDB02]">Deposit USDC</p>
              <h2 className="mt-2 text-2xl font-black">Use your Privy wallet addresses.</h2>
              <p className="mt-3 text-sm text-white/70">
                V1 uses the recommended model: users deposit into their own Privy-generated addresses. No app-managed
                treasury in this phase.
              </p>

              <div className="mt-6 grid gap-3">
                {embeddedWallets.length ? (
                  embeddedWallets.map((wallet) => (
                    <div key={`deposit-${wallet.chainType}-${wallet.address}`} className="border border-white/10 bg-black/30 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FEDB02]">
                        {walletChainLabel(wallet.chainType)} deposit address
                      </p>
                      <p className="mt-2 break-all text-sm font-semibold">{wallet.address}</p>
                      <button
                        onClick={() => copyAddress(wallet.address)}
                        className="mt-3 border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/75"
                      >
                        {copiedAddress === wallet.address ? "Copied" : "Copy address"}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/60">
                    Your embedded deposit addresses will appear here once Privy finishes wallet creation.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-[1280px] border-2 border-white/10 bg-[#121212] p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FEDB02]">My Collection</p>
                <h2 className="mt-2 text-2xl font-black">Cards tied to your linked seller wallets.</h2>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                {loadingCollection ? "Loading collection" : `${items.length} cards`}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {loadingCollection
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div key={`skeleton-${index}`} className="overflow-hidden border-2 border-white/10 bg-black/30">
                      <div className="aspect-[3/4] animate-pulse bg-gradient-to-br from-neutral-800 to-neutral-700" />
                      <div className="space-y-2 p-3">
                        <div className="h-3 w-3/4 animate-pulse bg-neutral-700" />
                        <div className="h-3 w-1/2 animate-pulse bg-neutral-800" />
                      </div>
                    </div>
                  ))
                : items.map((item) => (
                    <Link
                      key={item.id}
                      href={`/collectibles/lot/${item.id}`}
                      className="overflow-hidden border-2 border-white/10 bg-black/30 transition hover:-translate-y-0.5 hover:border-[#FEDB02]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.title} className="aspect-[3/4] w-full object-cover" />
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-bold">{item.title}</p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FEDB02]">
                            {item.gradeValue || item.gradeNormalized || "unknown"}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                            {item.sourcePlatform}
                          </span>
                        </div>
                        <p className="mt-3 text-lg font-black">
                          {item.priceUsd
                            ? `$${Number(item.priceUsd).toLocaleString()}`
                            : `${item.priceAmount} ${item.priceCurrency}`}
                        </p>
                      </div>
                    </Link>
                  ))}
            </div>

            {!loadingCollection && items.length === 0 ? (
              <p className="mt-6 text-sm text-white/60">
                No marketplace cards are tied to your linked wallets yet. Once a linked wallet appears as a seller on
                one of the connected marketplaces, it will show up here.
              </p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
