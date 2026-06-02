"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import ConnectButton from "@/components/ConnectButton";
import WishlistButton from "@/components/WishlistButton";

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

const PLATFORM_LABELS: Record<string, string> = {
  courtyard: "Courtyard",
  beezie: "Beezie",
  collector_crypt: "Collector Crypt",
  phygitals: "Phygitals",
};

const PAGE_SIZE = 36;

export default function CollectiblesPage() {
  const { authenticated, user } = usePrivy();

  const [items, setItems] = useState<ListingItem[]>([]);
  const [categories, setCategories] = useState<Facet[]>([]);
  const [grades, setGrades] = useState<Facet[]>([]);
  const [platforms, setPlatforms] = useState<Facet[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("buy");
  const [sort, setSort] = useState<string>("updated_desc");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Price filter state
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // Grade filter state
  const [activeGrade, setActiveGrade] = useState<string>("all");

  // Platform filter state
  const [activePlatform, setActivePlatform] = useState<string>("all");

  // Mobile filter panel state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Wishlist state — Set of wishlisted listing IDs
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());

  // Load wishlist when user is authenticated
  useEffect(() => {
    if (!authenticated || !user?.id) {
      setWishlistedIds(new Set());
      return;
    }
    fetch(`/api/user/wishlist?privy_user_id=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data: { items?: { listingId: string }[] }) => {
        setWishlistedIds(new Set((data.items ?? []).map((i) => i.listingId)));
      })
      .catch(() => undefined);
  }, [authenticated, user?.id]);

  const handleWishlistToggle = (listingId: string, nowWishlisted: boolean) => {
    setWishlistedIds((prev) => {
      const next = new Set(prev);
      if (nowWishlisted) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  };

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const applyPriceFilter = (e?: React.FormEvent) => {
    e?.preventDefault();
    setMinPrice(minPriceInput.trim());
    setMaxPrice(maxPriceInput.trim());
  };

  const clearPriceFilter = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setMinPrice("");
    setMaxPrice("");
  };

  const clearGradeFilter = () => setActiveGrade("all");
  const clearPlatformFilter = () => setActivePlatform("all");

  const buildParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        listing_status: "active",
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (searchQuery) params.set("q", searchQuery);
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (activeGrade !== "all") params.set("grade", activeGrade);
      if (activePlatform !== "all") params.set("source_platform", activePlatform);
      if (activeTab === "new" || sort === "updated_desc") params.set("sort", "updated_desc");
      else if (activeTab === "ending" || sort === "price_asc") params.set("sort", "price_asc");
      else if (sort === "price_desc") params.set("sort", "price_desc");
      if (minPrice) params.set("min_price_usd", minPrice);
      if (maxPrice) params.set("max_price_usd", maxPrice);
      return params;
    },
    [searchQuery, activeCategory, activeGrade, activePlatform, activeTab, sort, minPrice, maxPrice],
  );

  // Initial / filter-changed load (resets to page 1)
  useEffect(() => {
    async function load() {
      setLoading(true);
      setCurrentPage(1);

      const [listingsRes, facetsRes] = await Promise.all([
        fetch(`/api/collectibles/listings?${buildParams(1).toString()}`, { cache: "no-store" }),
        fetch("/api/collectibles/facets", { cache: "no-store" }),
      ]);
      const listingsJson = await listingsRes.json();
      const facetsJson = await facetsRes.json();

      setItems(listingsJson.items ?? []);
      setTotalItems(listingsJson.pagination?.total ?? 0);
      setHasMore(
        (listingsJson.pagination?.page ?? 1) < (listingsJson.pagination?.total_pages ?? 1),
      );
      setCategories(facetsJson.categories ?? []);
      setGrades(facetsJson.grades ?? []);
      setPlatforms(facetsJson.platforms ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [activeCategory, activeTab, sort, searchQuery, minPrice, maxPrice, buildParams]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    try {
      const res = await fetch(
        `/api/collectibles/listings?${buildParams(nextPage).toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      setItems((prev) => [...prev, ...(json.items ?? [])]);
      setCurrentPage(nextPage);
      setHasMore(nextPage < (json.pagination?.total_pages ?? 1));
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

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

  const hasPriceFilter = minPrice || maxPrice;

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/" className="shrink-0 font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>

          {/* Search bar */}
          <form onSubmit={submitSearch} className="hidden flex-1 md:block">
            <div className="mx-auto flex max-w-lg items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search cards, sets, players…"
                  className="w-full bg-black/15 px-4 py-2 text-sm font-semibold text-black placeholder-black/50 focus:bg-black/20 focus:outline-none"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-black/50 hover:text-black"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="border-2 border-black bg-black px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex items-center gap-2">
            <div className="hidden font-mono text-[10px] font-bold tracking-[0.2em] text-black md:block">COLLECTORS MODE</div>
            <ConnectButton />
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={submitSearch} className="mt-2 flex gap-2 md:hidden">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search cards, sets, players…"
            className="flex-1 bg-black/15 px-3 py-2 text-sm font-semibold text-black placeholder-black/50 focus:outline-none"
          />
          <button
            type="submit"
            className="border-2 border-black bg-black px-3 py-2 font-mono text-[10px] font-bold text-[#FEDB02]"
          >
            Go
          </button>
        </form>
      </header>

      {/* Active search banner */}
      {searchQuery && (
        <div className="border-b border-white/10 bg-[#1A1A1A] px-4 py-2 md:px-8">
          <div className="mx-auto flex max-w-[1480px] items-center justify-between">
            <p className="font-mono text-[11px] text-white/70">
              Search results for <span className="font-bold text-white">&ldquo;{searchQuery}&rdquo;</span>
              {!loading && <span className="ml-2 text-white/45">— {totalItems} found</span>}
            </p>
            <button onClick={clearSearch} className="font-mono text-[10px] text-[#FEDB02] hover:underline">
              Clear search
            </button>
          </div>
        </div>
      )}

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
            <span className="font-mono text-[10px] font-bold tracking-widest text-[#FEDB02]">{totalItems.toLocaleString()} LIVE</span>
          </div>
        </div>
      </div>

      {/* Mobile filter toggle row */}
      <div className="border-b border-white/10 bg-[#111] px-4 py-2 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileFiltersOpen((o) => !o)}
            className="flex items-center gap-2 border border-white/25 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white"
          >
            <span>Filters</span>
            <span className="text-[#FEDB02]">{mobileFiltersOpen ? "▲" : "▼"}</span>
            {(activeGrade !== "all" || activePlatform !== "all" || hasPriceFilter) && (
              <span className="h-2 w-2 rounded-full bg-[#FEDB02]" />
            )}
          </button>
          {(activeGrade !== "all" || activePlatform !== "all" || hasPriceFilter) && (
            <button
              onClick={() => { clearGradeFilter(); clearPlatformFilter(); clearPriceFilter(); }}
              className="font-mono text-[9px] text-[#FEDB02]/70 hover:text-[#FEDB02]"
            >
              CLEAR ALL
            </button>
          )}
        </div>

        {mobileFiltersOpen && (
          <div className="mt-3 space-y-4 pb-2">
            {/* Mobile price filter */}
            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Price (USD)</p>
              <form onSubmit={applyPriceFilter} className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  className="w-20 border border-white/20 bg-black/40 px-2 py-1 font-mono text-[11px] text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
                />
                <span className="font-mono text-[10px] text-white/40">—</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  className="w-20 border border-white/20 bg-black/40 px-2 py-1 font-mono text-[11px] text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
                />
                <button
                  type="submit"
                  className="border border-[#FEDB02] px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#FEDB02]"
                >
                  Apply
                </button>
                {hasPriceFilter && (
                  <button type="button" onClick={clearPriceFilter} className="font-mono text-[9px] text-white/50">✕</button>
                )}
              </form>
            </div>

            {/* Mobile grade filter */}
            {grades.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Grade</p>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={clearGradeFilter}
                    className={`border px-2 py-1 font-mono text-[9px] font-bold ${activeGrade === "all" ? "border-[#FEDB02] text-[#FEDB02]" : "border-white/20 text-white/50"}`}
                  >
                    All
                  </button>
                  {grades.slice(0, 8).map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setActiveGrade(g.value ?? "all")}
                      className={`border px-2 py-1 font-mono text-[9px] font-bold ${activeGrade === g.value ? "border-[#FEDB02] text-[#FEDB02]" : "border-white/20 text-white/50"}`}
                    >
                      {g.value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile source filter */}
            {platforms.length > 1 && (
              <div>
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Source</p>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={clearPlatformFilter}
                    className={`border px-2 py-1 font-mono text-[9px] font-bold ${activePlatform === "all" ? "border-[#FEDB02] text-[#FEDB02]" : "border-white/20 text-white/50"}`}
                  >
                    All
                  </button>
                  {platforms.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setActivePlatform(p.value)}
                      className={`border px-2 py-1 font-mono text-[9px] font-bold ${activePlatform === p.value ? "border-[#FEDB02] text-[#FEDB02]" : "border-white/20 text-white/50"}`}
                    >
                      {PLATFORM_LABELS[p.value] ?? p.value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <section className="mx-auto flex w-full max-w-[1480px]">
        <aside className="hidden w-[220px] shrink-0 border-r-2 border-white/10 bg-[#0A0A0A] p-5 lg:block">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black">FILTERS</h2>
            <button
              onClick={() => { setActiveCategory("all"); clearSearch(); clearPriceFilter(); clearGradeFilter(); clearPlatformFilter(); }}
              className="font-mono text-[10px] font-bold tracking-widest text-[#FEDB02]"
            >
              CLEAR
            </button>
          </div>

          {/* Price range filter */}
          <p className="mb-2 mt-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Price (USD)</p>
          <form onSubmit={applyPriceFilter} className="space-y-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="w-full border border-white/20 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
              />
              <span className="shrink-0 font-mono text-[10px] text-white/40">—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="w-full border border-white/20 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white placeholder-white/30 focus:border-[#FEDB02] focus:outline-none"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="submit"
                className="flex-1 border border-[#FEDB02] bg-transparent py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#FEDB02]"
              >
                Apply
              </button>
              {hasPriceFilter && (
                <button
                  type="button"
                  onClick={clearPriceFilter}
                  className="border border-white/20 px-2 py-1 font-mono text-[10px] text-white/50 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
            {hasPriceFilter && (
              <p className="font-mono text-[9px] text-[#FEDB02]">
                {minPrice ? `$${Number(minPrice).toLocaleString()}` : "$0"} — {maxPrice ? `$${Number(maxPrice).toLocaleString()}` : "∞"}
              </p>
            )}
          </form>

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

          {/* Platform filter */}
          {platforms.length > 1 && (
            <>
              <p className="mb-2 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Source</p>
              <div className="space-y-2">
                <button
                  onClick={clearPlatformFilter}
                  className="flex w-full items-center justify-between border-b border-white/5 py-1 text-left"
                >
                  <span className={`text-sm ${activePlatform === "all" ? "font-bold text-white" : "text-white/65"}`}>All sources</span>
                </button>
                {platforms.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setActivePlatform(p.value)}
                    className="flex w-full items-center justify-between border-b border-white/5 py-1 text-left"
                  >
                    <span className={`text-sm ${activePlatform === p.value ? "font-bold text-white" : "text-white/65"}`}>
                      {PLATFORM_LABELS[p.value] ?? p.value}
                    </span>
                    <span className="font-mono text-[10px] text-white/35">{p.count}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="mb-2 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Grade</p>
          <div className="space-y-2">
            <button
              onClick={clearGradeFilter}
              className="flex w-full items-center justify-between border-b border-white/5 py-1 text-left"
            >
              <span className={`text-sm ${activeGrade === "all" ? "font-bold text-white" : "text-white/65"}`}>All grades</span>
            </button>
            {grades.slice(0, 10).map((grade) => (
              <button
                key={grade.value}
                onClick={() => setActiveGrade(grade.value)}
                className="flex w-full items-center justify-between border-b border-white/5 py-1 text-left"
              >
                <span className={`text-sm ${activeGrade === grade.value ? "font-bold text-white" : "text-white/65"}`}>{grade.value}</span>
                <span className="font-mono text-[10px] text-white/35">{grade.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 px-4 pb-10 pt-6 md:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                {searchQuery ? `"${searchQuery}"` : "TRADING CARDS"}
              </h1>
              <p className="mt-1 font-mono text-[11px] text-white/45">
                {loading ? "Loading..." : `${items.length} of ${totalItems.toLocaleString()} listings shown`}
              </p>
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

          {/* Active filter chips */}
          {(activeGrade !== "all" || activePlatform !== "all" || hasPriceFilter) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {activeGrade !== "all" && (
                <button
                  onClick={clearGradeFilter}
                  className="flex items-center gap-1 border border-[#FEDB02] px-2 py-1 font-mono text-[10px] font-bold text-[#FEDB02]"
                >
                  Grade: {activeGrade} <span className="ml-1 opacity-60">✕</span>
                </button>
              )}
              {activePlatform !== "all" && (
                <button
                  onClick={clearPlatformFilter}
                  className="flex items-center gap-1 border border-[#FEDB02] px-2 py-1 font-mono text-[10px] font-bold text-[#FEDB02]"
                >
                  Source: {PLATFORM_LABELS[activePlatform] ?? activePlatform} <span className="ml-1 opacity-60">✕</span>
                </button>
              )}
              {hasPriceFilter && (
                <button
                  onClick={clearPriceFilter}
                  className="flex items-center gap-1 border border-[#FEDB02] px-2 py-1 font-mono text-[10px] font-bold text-[#FEDB02]"
                >
                  Price: {minPrice ? `$${Number(minPrice).toLocaleString()}` : "$0"}–{maxPrice ? `$${Number(maxPrice).toLocaleString()}` : "∞"}
                  <span className="ml-1 opacity-60">✕</span>
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="overflow-hidden border-2 border-white/10 bg-black/30">
                    <div className="aspect-[3/4] animate-pulse bg-gradient-to-br from-neutral-800 to-neutral-700" />
                    <div className="space-y-2 p-2">
                      <div className="h-3 w-3/4 animate-pulse bg-neutral-700" />
                      <div className="h-3 w-1/2 animate-pulse bg-neutral-800" />
                    </div>
                  </div>
                ))
              : items.map((item) => (
                  <article key={item.id} className="overflow-hidden border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FEDB02]">
                    <Link href={`/collectibles/lot/${item.id}`}>
                      <div className="relative aspect-[3/4] border-b-2 border-[#0A0A0A] bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                        {/* Wishlist heart — top right */}
                        <div className="absolute right-1 top-1 bg-[#0A0A0A]/70">
                          <WishlistButton
                            listingId={item.id}
                            isWishlisted={wishlistedIds.has(item.id)}
                            onToggle={handleWishlistToggle}
                          />
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
            {!loading && items.length === 0 && (
              <div className="col-span-full border border-white/20 bg-black/30 p-6 text-sm text-white/70">
                {searchQuery
                  ? `No listings found for "${searchQuery}". Try a different search term.`
                  : "No listings found for this filter. Try a different category/sort."}
              </div>
            )}
          </div>

          {/* Load more / pagination */}
          {!loading && items.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-3">
              {hasMore ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="border-2 border-[#FEDB02] px-8 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#FEDB02] transition hover:bg-[#FEDB02] hover:text-black disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : `Load More  ·  ${items.length} / ${totalItems.toLocaleString()}`}
                </button>
              ) : (
                <p className="font-mono text-[11px] text-white/30">
                  All {totalItems.toLocaleString()} listings shown
                </p>
              )}
              {loadingMore && (
                <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden border-2 border-white/10 bg-black/30">
                      <div className="aspect-[3/4] animate-pulse bg-gradient-to-br from-neutral-800 to-neutral-700" />
                      <div className="space-y-2 p-2">
                        <div className="h-3 w-3/4 animate-pulse bg-neutral-700" />
                        <div className="h-3 w-1/2 animate-pulse bg-neutral-800" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <p className="font-mono text-[11px] text-white/45">LIVE INGEST · COURTYARD / BEEZIE / PHYGITALS / COLLECTOR CRYPT</p>
            <p className="font-mono text-[11px] text-[#FEDB02]">DIRECTION 4 · BOLD SPORT</p>
          </div>
        </div>
      </section>
    </main>
  );
}
