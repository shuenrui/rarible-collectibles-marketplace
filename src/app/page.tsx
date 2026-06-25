"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConnectButton from "@/components/ConnectButton";
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

type HotItem = {
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
    image: "/banners/pokemon.jpg",
  },
  {
    name: "Sports Cards",
    slug: "sports_cards",
    count: "2,951",
    tag: "Baseball · NBA · More",
    image: "/banners/baseball.jpg",
  },
  {
    name: "Marvel",
    slug: "comics",
    count: "612",
    tag: "Multiverse Arc",
    image: "/banners/marvel.jpg",
  },
  {
    name: "Yu-Gi-Oh",
    slug: "yugioh",
    count: "612",
    tag: "Shadow Duel",
    image: "/banners/yugioh.jpg",
  },
  {
    name: "One Piece",
    slug: "one_piece",
    count: "389",
    tag: "Grand Line",
    image: "/banners/onepiece.jpg",
  },
  {
    name: "All Collectibles",
    slug: "",
    count: "23,000+",
    tag: "Every category",
    image: "/banners/pokemon.jpg",
  },
];

export default function Home() {
  const [packOpen, setPackOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [featured, setFeatured] = useState<FeaturedItem | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [hotItems, setHotItems] = useState<HotItem[]>([]);
  const [hotLoading, setHotLoading] = useState(true);

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

  useEffect(() => {
    let active = true;

    const loadHot = async () => {
      try {
        const res = await fetch("/api/collectibles/hot", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: HotItem[] };
        if (active) setHotItems(data.items || []);
      } finally {
        if (active) setHotLoading(false);
      }
    };

    loadHot();

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

  const hotCountLabel = hotLoading ? "LOADING TOP LISTINGS" : `${hotItems.length} TOP LISTINGS`;

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
            <button onClick={() => setSellOpen(true)} className="px-3 py-2 text-sm font-bold text-black/70">
              Sell
            </button>
            <Link href="/vault" className="px-3 py-2 text-sm font-bold text-black/70">
              Vault Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 border-2 border-black p-0.5 md:flex">
              <Link href="/" className="bg-black px-3 py-1 text-[10px] font-black text-[#FEDB02]">
                Browse &amp; collect
              </Link>
              <Link href="/traders" className="px-3 py-1 text-[10px] font-bold text-black/60">
                Trade &amp; track demo
              </Link>
            </div>
            <ConnectButton />
            {/* Hamburger — mobile only */}
            <button
              className="flex flex-col justify-center gap-[5px] p-2 md:hidden"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Open menu"
            >
              <span className={`block h-[2px] w-5 bg-black transition-all ${mobileNavOpen ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`block h-[2px] w-5 bg-black transition-all ${mobileNavOpen ? "opacity-0" : ""}`} />
              <span className={`block h-[2px] w-5 bg-black transition-all ${mobileNavOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileNavOpen && (
          <div className="border-t-2 border-black md:hidden">
            <div className="flex flex-col py-2">
              <Link href="/collectibles" onClick={() => setMobileNavOpen(false)} className="px-4 py-3 text-sm font-bold text-black">
                Marketplace
              </Link>
              <button onClick={() => { setSellOpen(true); setMobileNavOpen(false); }} className="px-4 py-3 text-left text-sm font-bold text-black/70">
                Sell
              </button>
              <Link href="/vault" onClick={() => setMobileNavOpen(false)} className="px-4 py-3 text-sm font-bold text-black/70">
                Vault Demo
              </Link>
              <div className="mx-4 mt-2 flex items-center gap-2 border-2 border-black p-0.5">
                <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex-1 bg-black py-2 text-center text-[10px] font-black text-[#FEDB02]">
                  Browse &amp; collect
                </Link>
                <Link href="/traders" onClick={() => setMobileNavOpen(false)} className="flex-1 py-2 text-center text-[10px] font-bold text-black/60">
                  Trade &amp; track demo
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="border-b border-white/10 px-4 py-8 md:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">
              Every graded card &amp; collectible,
              <br />
              <span className="text-[#FEDB02]">one price source.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/50">
              Buy from Courtyard, Collector Crypt, Beezie, and Phygitals — all in one place, with price comparisons and provenance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/collectibles"
              className="border-2 border-[#FEDB02] bg-[#FEDB02] px-5 py-2.5 text-sm font-black uppercase tracking-[0.1em] text-black"
            >
              Browse Marketplace
            </Link>
            {featured && (
              <Link
                href={`/collectibles/lot/${featured.id}`}
                className="border-2 border-white/20 px-5 py-2.5 text-sm font-bold text-white/70"
              >
                Featured lot · {featuredPrice}
              </Link>
            )}
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
                href={fandom.slug ? `/collection/${fandom.slug}` : "/collectibles"}
                className="group relative overflow-hidden border-2 border-black bg-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fandom.image}
                  alt={fandom.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

                <div className="relative flex min-h-[180px] flex-col justify-end p-5">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
                    {fandom.tag}
                  </p>
                  <p className="mt-1 text-3xl font-black leading-none text-white">{fandom.name}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">
                      {fandom.count} listings
                    </p>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">
                      Enter →
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
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-red-600">{hotCountLabel}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hotLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={`hot-skeleton-${index}`} className="border-2 border-black bg-white p-3">
                    <div className="aspect-[3/4] border-2 border-black bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-500" />
                    <div className="mt-3 h-4 w-4/5 animate-pulse bg-black/10" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse bg-black/10" />
                    <div className="mt-3 h-5 w-1/2 animate-pulse bg-black/10" />
                  </div>
                ))
              : hotItems.map((item) => {
                  const grade = item.gradeValue || item.gradeNormalized || "—";
                  const price = item.priceUsd
                    ? `$${Number(item.priceUsd).toLocaleString()}`
                    : `${item.priceAmount} ${item.priceCurrency}`;

                  return (
                    <Link key={item.id} href={`/collectibles/lot/${item.id}`} className="group overflow-hidden border-2 border-black bg-white transition hover:shadow-[0_4px_0_#FEDB02]">
                      <div className="relative aspect-[3/4] bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl || "https://placehold.co/300x400/png?text=No+Image"}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute left-2 top-2 bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {grade}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xl font-black leading-none text-black">{price}</p>
                        <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-neutral-500">{item.title}</p>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </div>
      </section>
    </main>
  );
}
