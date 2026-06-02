"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConnectButton from "@/components/ConnectButton";

type ListingItem = {
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
  categoryL1: string;
  syncConfidence: number;
};

type Facet = { value: string; count: number };
type TabId = "buy" | "auctions" | "ending" | "new";

export default function CollectiblesPage() {
  const [items, setItems] = useState<ListingItem[]>([]);
  const [categories, setCategories] = useState<Facet[]>([]);
  const [grades, setGrades] = useState<Facet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("buy");
  const [sort, setSort] = useState<string>("updated_desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        listing_status: "active",
        page: "1",
        page_size: "36",
      });
      if (activeCategory !== "all") {
        params.set("category", activeCategory);
      }
      if (activeTab === "new") {
        params.set("sort", "updated_desc");
      }
      if (activeTab === "ending") {
        params.set("sort", "price_asc");
      }
      if (sort === "price_asc" || sort === "price_desc" || sort === "updated_desc") {
        params.set("sort", sort);
      }

      const [listingsRes, facetsRes] = await Promise.all([
        fetch(`/api/collectibles/listings?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/collectibles/facets", { cache: "no-store" }),
      ]);
      const listingsJson = await listingsRes.json();
      const facetsJson = await facetsRes.json();
      setItems(listingsJson.items ?? []);
      setCategories(facetsJson.categories ?? []);
      setGrades(facetsJson.grades ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [activeCategory, activeTab, sort]);

  const topCategories = [
    { id: "all", label: "All" },
    { id: "pokemon", label: "Pokemon" },
    { id: "sports_cards", label: "Sports Cards" },
    { id: "one_piece", label: "One Piece" },
    { id: "yugioh", label: "Yu-Gi-Oh" },
    { id: "comics", label: "Comics" },
  ];

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "buy", label: "Buy Now" },
    { id: "auctions", label: "Auctions" },
    { id: "ending", label: "Ending Soon" },
    { id: "new", label: "New Listings" },
  ];

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">RARIBLE COLLECTIBLES</Link>
          <div className="hidden flex-1 md:block">
            <Link href="/search" className="mx-auto block max-w-md bg-black/15 px-4 py-2 text-sm font-semibold text-black/60">
              Search cards, sets, players...
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-black">COLLECTORS MODE</div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="border-b-2 border-white/10 bg-[#111] px-4 md:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center gap-1 overflow-x-auto">
          {topCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest ${
                activeCategory === cat.id ? "border-[#FEDB02] text-[#FEDB02]" : "border-transparent text-white/45"
              }`}
            >
              {cat.label}
            </button>
          ))}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="h-2 w-2 rounded-full bg-[#FEDB02]" />
            <span className="font-mono text-[10px] font-bold tracking-widest text-[#FEDB02]">{items.length} LIVE</span>
          </div>
        </div>
      </div>

      <section className="mx-auto flex w-full max-w-[1480px]">
        <aside className="hidden w-[220px] shrink-0 border-r-2 border-white/10 bg-[#0A0A0A] p-5 lg:block">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black">FILTERS</h2>
            <button
              onClick={() => setActiveCategory("all")}
              className="font-mono text-[10px] font-bold tracking-widest text-[#FEDB02]"
            >
              CLEAR
            </button>
          </div>

          <p className="mb-2 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Category</p>
          <div className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className="flex w-full items-center justify-between border-b border-white/5 py-1 text-left"
              >
                <span className={`text-sm ${activeCategory === cat.value ? "font-bold text-white" : "text-white/65"}`}>{cat.value}</span>
                <span className="font-mono text-[10px] text-white/35">{cat.count}</span>
              </button>
            ))}
          </div>

          <p className="mb-2 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Grade</p>
          <div className="space-y-2">
            {grades.slice(0, 8).map((grade) => (
              <div key={grade.value} className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-sm text-white/75">{grade.value}</span>
                <span className="font-mono text-[10px] text-white/35">{grade.count}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 px-4 pb-10 pt-6 md:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">TRADING CARDS</h1>
              <p className="mt-1 font-mono text-[11px] text-white/45">{loading ? "Loading..." : `${items.length} listings shown`}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="border border-white/20 bg-[#111] px-3 py-2 font-mono text-[11px] font-bold tracking-widest text-white"
              >
                <option value="updated_desc">NEWEST</option>
                <option value="price_asc">LOWEST PRICE</option>
                <option value="price_desc">HIGHEST PRICE</option>
              </select>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap border-b-2 border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-[2px] border-b-[3px] px-4 py-3 text-sm font-bold ${
                  activeTab === tab.id ? "border-[#FEDB02] text-white" : "border-transparent text-white/45"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FEDB02]">
                <Link href={`/collectibles/lot/${item.id}`}>
                  <div className="relative aspect-[3/4] border-b-2 border-[#0A0A0A] bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "https://placehold.co/600x800/png?text=No+Image";
                      }}
                    />
                    <div className="absolute left-1 top-1 bg-[#0A0A0A] px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#FEDB02]">
                      {item.gradeValue || item.gradeNormalized || "UNKNOWN"}
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="line-clamp-2 min-h-[30px] text-xs font-bold leading-tight">{item.title}</h3>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="text-base font-black">
                        {item.priceUsd ? `$${Number(item.priceUsd).toLocaleString()}` : `${item.priceAmount} ${item.priceCurrency}`}
                      </p>
                      <span className="font-mono text-[9px] text-[#6B6B6B]">{item.sourcePlatform}</span>
                    </div>
                  </div>
                </Link>
                <div className="px-2 pb-2">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full bg-[#0A0A0A] py-2 text-center font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]"
                  >
                    BUY NOW
                  </a>
                </div>
              </article>
            ))}
            {!loading && items.length === 0 ? (
              <div className="col-span-full border border-white/20 bg-black/30 p-6 text-sm text-white/70">
                No listings found for this filter. Try a different category/sort.
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <p className="font-mono text-[11px] text-white/45">LIVE INGEST · COURTYARD / BEEZIE / PHYGITALS</p>
            <p className="font-mono text-[11px] text-[#FEDB02]">DIRECTION 4 · BOLD SPORT</p>
          </div>
        </div>
      </section>
    </main>
  );
}
