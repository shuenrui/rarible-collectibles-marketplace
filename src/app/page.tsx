"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PackRipModal from "@/components/PackRipModal";
import SellFlowModal from "@/components/SellFlowModal";

type FeaturedItem = {
  id: string;
  title: string;
  imageUrl: string;
  priceAmount: string;
  priceCurrency: string;
  priceUsd: string | null;
  sourcePlatform: string;
  gradeValue: string | null;
  gradeNormalized: string | null;
};

const fandoms = [
  {
    name: "Pokemon",
    slug: "pokemon",
    count: "3,201",
    tag: "Mythic Electric",
    banner: "from-[#FFE55D] via-[#FEC700] to-[#FF7E1D]",
    accent: "text-black",
  },
  {
    name: "Marvel",
    slug: "comics",
    count: "612",
    tag: "Multiverse Arc",
    banner: "from-[#111] via-[#5A0F23] to-[#C62828]",
    accent: "text-white",
  },
  {
    name: "Baseball",
    slug: "sports_cards",
    count: "2,104",
    tag: "Hall of Flame",
    banner: "from-[#09132A] via-[#1452FF] to-[#4FC2FF]",
    accent: "text-white",
  },
  {
    name: "Yu-Gi-Oh",
    slug: "yugioh",
    count: "612",
    tag: "Shadow Duel",
    banner: "from-[#1A072E] via-[#4B1F91] to-[#FF3B70]",
    accent: "text-white",
  },
  {
    name: "NBA",
    slug: "sports_cards",
    count: "847",
    tag: "GOAT Vault",
    banner: "from-[#0A0A0A] via-[#3A3A3A] to-[#A9A9A9]",
    accent: "text-white",
  },
  {
    name: "One Piece",
    slug: "one_piece",
    count: "389",
    tag: "Grand Line",
    banner: "from-[#022C22] via-[#00B574] to-[#85FFD7]",
    accent: "text-white",
  },
];

const hotLots = [
  { title: "Charizard 1st Ed Holo", grade: "PSA 10", price: "$8,420" },
  { title: "Pikachu Illustrator '98", grade: "PSA 8", price: "$45,200" },
  { title: "Mantle '52 Topps #311", grade: "PSA 9", price: "$12,200" },
  { title: "Jordan Fleer Rookie #57", grade: "PSA 10", price: "$22,000" },
];

export default function Home() {
  const [packOpen, setPackOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [featured, setFeatured] = useState<FeaturedItem | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadFeatured = async () => {
      try {
        const res = await fetch("/api/collectibles/featured", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { item: FeaturedItem | null };
        if (active) setFeatured(data.item);
      } finally {
        if (active) setFeaturedLoading(false);
      }
    };

    loadFeatured();

    return () => {
      active = false;
    };
  }, []);

  const featuredPrice = useMemo(() => {
    if (!featured) return "—";
    if (featured.priceUsd) return `$${Number(featured.priceUsd).toLocaleString()}`;
    return `${featured.priceAmount} ${featured.priceCurrency}`;
  }, [featured]);

  const featuredGrade = featured?.gradeValue || featured?.gradeNormalized || "UNKNOWN";
  const featuredSource = featured?.sourcePlatform?.toUpperCase() || "LISTING";

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <PackRipModal open={packOpen} onClose={() => setPackOpen(false)} />
      <SellFlowModal open={sellOpen} onClose={() => setSellOpen(false)} />

      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <div className="font-black tracking-tight text-black md:text-lg">RARIBLE COLLECTIBLES</div>
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/collectibles" className="px-3 py-2 text-sm font-bold text-black">
              Marketplace
            </Link>
            <span className="px-3 py-2 text-sm font-bold text-black/70">Drops</span>
            <span className="px-3 py-2 text-sm font-bold text-black/70">Packs</span>
            <button onClick={() => setSellOpen(true)} className="px-3 py-2 text-sm font-bold text-black/70">
              Sell
            </button>
            <Link href="/vault" className="px-3 py-2 text-sm font-bold text-black/70">
              Vault
            </Link>
          </nav>
          <div className="flex items-center gap-2 border-2 border-black p-0.5">
            <Link href="/" className="bg-black px-3 py-1 font-mono text-[10px] font-black tracking-[0.2em] text-[#FEDB02]">
              COLLECTORS
            </Link>
            <Link href="/traders" className="px-3 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-black/70">
              TRADERS
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b-[3px] border-[#FEDB02] px-4 py-16 md:px-8 md:py-20">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5 inline-block bg-[#FEDB02] px-4 py-2 font-mono text-xs font-bold tracking-[0.2em] text-black">
              {featuredGrade}
            </div>
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              BID ON
              <br />
              SOMETHING
              <br />
              <span className="text-[#FEDB02]">LEGENDARY.</span>
            </h1>
            <div className="mt-8 flex flex-wrap items-end gap-5">
              <p className="text-5xl font-black md:text-7xl">{featuredPrice}</p>
              <p className="font-mono text-xs tracking-widest text-white/60">
                {featuredLoading ? "LOADING FEATURED LISTING" : `${featuredSource} · TOP LISTING`}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={featured ? `/collectibles/lot/${featured.id}` : "/collectibles"}
                className="border-2 border-[#FEDB02] bg-[#FEDB02] px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-black"
              >
                View Lot
              </Link>
              <Link
                href="/collectibles"
                className="border-2 border-white/40 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white"
              >
                Browse Marketplace
              </Link>
              <button
                onClick={() => setPackOpen(true)}
                className="border-2 border-[#FEDB02] bg-transparent px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#FEDB02]"
              >
                Rip My Pack
              </button>
            </div>
          </div>

          <div className="border-2 border-[#FEDB02] bg-[#1A1A1A] p-4">
            <div className="aspect-[3/4] w-full border-2 border-black bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500">
              {featured?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.imageUrl} alt={featured.title} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <p className="mt-3 line-clamp-2 text-sm font-bold">{featured?.title || "Featured collectible"}</p>
            <p className="mt-1 font-mono text-xs text-[#FEDB02]">FEATURED LISTING · {featuredSource}</p>
          </div>
        </div>
      </section>

      <section className="border-b-[3px] border-black bg-white px-4 py-14 text-black md:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black leading-none md:text-6xl">
              WHAT&apos;S YOUR <span className="bg-[#FEDB02] px-2">GAME?</span>
            </h2>
            <Link
              href="/collectibles"
              className="bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#FEDB02]"
            >
              All Universes
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fandoms.map((fandom) => (
              <Link
                key={fandom.name}
                href={`/collection/${fandom.slug}`}
                className="group relative overflow-hidden border-2 border-black bg-black"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${fandom.banner}`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.3),transparent_40%)]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

                <div className="relative flex min-h-[180px] flex-col justify-end p-5 transition-transform duration-200 group-hover:scale-[1.02]">
                  <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${fandom.accent} opacity-85`}>
                    {fandom.tag}
                  </p>
                  <p className={`mt-1 text-3xl font-black leading-none ${fandom.accent}`}>{fandom.name}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className={`font-mono text-xs uppercase tracking-[0.2em] ${fandom.accent} opacity-80`}>
                      {fandom.count} listings
                    </p>
                    <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${fandom.accent}`}>
                      Enter
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F3F0E8] px-4 py-14 text-black md:px-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-black leading-none md:text-6xl">HOT RIGHT NOW</h2>
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-red-600">982 AUCTIONS LIVE</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hotLots.map((lot) => (
              <Link key={lot.title} href="/collectibles" className="border-2 border-black bg-white p-3">
                <div className="aspect-[3/4] border-2 border-black bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-500" />
                <p className="mt-3 text-sm font-black leading-tight">{lot.title}</p>
                <p className="mt-1 font-mono text-xs">{lot.grade}</p>
                <p className="mt-2 text-xl font-black">{lot.price}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
