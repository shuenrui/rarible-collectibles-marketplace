"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import ConnectButton from "@/components/ConnectButton";
import WishlistButton from "@/components/WishlistButton";
import { formatListingPrice } from "@/lib/pricing";

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
  listingType: "fixed_price" | "auction" | "offer";
  sourceUrl: string;
  categoryL1: string;
  syncConfidence: number;
  syncedAt: string;
  listedAt: string | null;
  matchReason?: "Card name" | "Card number" | "Set" | "Description" | null;
};

function timeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type Facet = { value: string; count: number };
type TabId = "buy" | "drops" | "packs" | "auctions" | "ending" | "new";

const PLATFORM_LABELS: Record<string, string> = {
  courtyard: "Courtyard",
  beezie: "Beezie",
  collector_crypt: "Collector Crypt",
  phygitals: "Phygitals",
};

const LISTING_TYPE_LABELS: Record<ListingItem["listingType"], string> = {
  fixed_price: "Buy now",
  auction: "Auction",
  offer: "Offer",
};

function getPrimaryCtaLabel(listingType: ListingItem["listingType"]): string {
  if (listingType === "auction") return "Place Bid";
  if (listingType === "offer") return "View Offer";
  return "Buy Now";
}

const PAGE_SIZE = 36;

function normalizeTab(value: string | null): TabId {
  if (value === "drops" || value === "packs" || value === "auctions" || value === "ending" || value === "new") {
    return value;
  }
  return "buy";
}

function normalizeSort(value: string | null, tab: TabId): string {
  if (value === "price_asc" || value === "price_desc" || value === "updated_desc") {
    return value;
  }
  if (tab === "packs") return "price_asc";
  return "updated_desc";
}

// IP category definitions with banner images, labels, and gradient fallbacks
const IP_CATEGORIES: Record<string, { label: string; banner?: string; gradient: string }> = {
  all: {
    label: "All",
    gradient: "from-yellow-400 via-orange-500 to-red-600",
  },
  pokemon: {
    label: "Pokémon",
    banner: "/banners/pokemon.jpg",
    gradient: "from-yellow-300 via-yellow-500 to-orange-500",
  },
  sports_cards: {
    label: "Sports Cards",
    banner: "/banners/baseball.jpg",
    gradient: "from-blue-500 via-blue-700 to-slate-800",
  },
  one_piece: {
    label: "One Piece",
    banner: "/banners/onepiece.jpg",
    gradient: "from-red-500 via-orange-600 to-yellow-500",
  },
  yugioh: {
    label: "Yu-Gi-Oh!",
    banner: "/banners/yugioh.jpg",
    gradient: "from-purple-600 via-purple-800 to-black",
  },
  comics: {
    label: "Comics",
    banner: "/banners/marvel.jpg",
    gradient: "from-red-700 via-red-900 to-black",
  },
  sealed_products: {
    label: "Sealed",
    gradient: "from-green-500 via-emerald-700 to-black",
  },
  other: {
    label: "Other",
    gradient: "from-neutral-600 via-neutral-800 to-black",
  },
};

function CollectiblesPageInner() {
  const { authenticated, user } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();

  const initialTab = normalizeTab(urlSearchParams.get("tab"));
  const initialSort = normalizeSort(urlSearchParams.get("sort"), initialTab);
  const initialCategory = urlSearchParams.get("category") || "all";
  const initialQuery = urlSearchParams.get("q") || "";
  const initialMinPrice = urlSearchParams.get("min_price_usd") || "";
  const initialMaxPrice = urlSearchParams.get("max_price_usd") || "";
  const initialGrade = urlSearchParams.get("grade") || "all";
  const initialPlatform = urlSearchParams.get("source_platform") || "all";

  const [items, setItems] = useState<ListingItem[]>([]);
  const [categories, setCategories] = useState<Facet[]>([]);
  const [grades, setGrades] = useState<Facet[]>([]);
  const [platforms, setPlatforms] = useState<Facet[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [sort, setSort] = useState<string>(initialSort);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stateReady, setStateReady] = useState(false);

  // Search state
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const searchRef = useRef<HTMLInputElement>(null);

  // Price filter state
  const [minPriceInput, setMinPriceInput] = useState(initialMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(initialMaxPrice);
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);

  // Grade filter state
  const [activeGrade, setActiveGrade] = useState<string>(initialGrade);

  // Platform filter state
  const [activePlatform, setActivePlatform] = useState<string>(initialPlatform);

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

  useEffect(() => {
    const nextTab = normalizeTab(urlSearchParams.get("tab"));
    const nextSort = normalizeSort(urlSearchParams.get("sort"), nextTab);
    const nextCategory = urlSearchParams.get("category") || "all";
    const nextQuery = urlSearchParams.get("q") || "";
    const nextMinPrice = urlSearchParams.get("min_price_usd") || "";
    const nextMaxPrice = urlSearchParams.get("max_price_usd") || "";
    const nextGrade = urlSearchParams.get("grade") || "all";
    const nextPlatform = urlSearchParams.get("source_platform") || "all";

    setActiveTab(nextTab);
    setSort(nextSort);
    setActiveCategory(nextCategory);
    setSearchInput(nextQuery);
    setSearchQuery(nextQuery);
    setMinPriceInput(nextMinPrice);
    setMaxPriceInput(nextMaxPrice);
    setMinPrice(nextMinPrice);
    setMaxPrice(nextMaxPrice);
    setActiveGrade(nextGrade);
    setActivePlatform(nextPlatform);
    setStateReady(true);
  }, [urlSearchParams]);

  const buildParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        listing_status: "active",
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (searchQuery) params.set("q", searchQuery);
      // Drops tab: sealed products newest first (category can be further narrowed by IP card)
      if (activeTab === "drops") {
        params.set("category", activeCategory !== "all" ? activeCategory : "sealed_products");
        params.set("sort", "updated_desc");
      } else if (activeTab === "packs") {
        // Packs: sealed product catalog, price-asc by default, IP filter still respected
        params.set("category", activeCategory !== "all" ? activeCategory : "sealed_products");
        params.set("sort", sort === "price_desc" ? "price_desc" : sort === "updated_desc" ? "updated_desc" : "price_asc");
      } else {
        if (activeCategory !== "all") params.set("category", activeCategory);
        if (activeTab === "new" || sort === "updated_desc") params.set("sort", "updated_desc");
        else if (activeTab === "ending" || sort === "price_asc") params.set("sort", "price_asc");
        else if (sort === "price_desc") params.set("sort", "price_desc");
      }
      if (activeGrade !== "all") params.set("grade", activeGrade);
      if (activePlatform !== "all") params.set("source_platform", activePlatform);
      if (minPrice) params.set("min_price_usd", minPrice);
      if (maxPrice) params.set("max_price_usd", maxPrice);
      return params;
    },
    [searchQuery, activeCategory, activeGrade, activePlatform, activeTab, sort, minPrice, maxPrice],
  );

  useEffect(() => {
    if (!stateReady) return;

    const nextParams = new URLSearchParams();
    if (searchQuery) nextParams.set("q", searchQuery);
    if (activeCategory !== "all") nextParams.set("category", activeCategory);
    if (activeGrade !== "all") nextParams.set("grade", activeGrade);
    if (activePlatform !== "all") nextParams.set("source_platform", activePlatform);
    if (minPrice) nextParams.set("min_price_usd", minPrice);
    if (maxPrice) nextParams.set("max_price_usd", maxPrice);
    if (activeTab !== "buy") nextParams.set("tab", activeTab);
    if (sort !== normalizeSort(null, activeTab)) nextParams.set("sort", sort);

    const current = urlSearchParams.toString();
    const next = nextParams.toString();
    if (current !== next) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [
    activeCategory,
    activeGrade,
    activePlatform,
    activeTab,
    maxPrice,
    minPrice,
    pathname,
    router,
    searchQuery,
    sort,
    stateReady,
    urlSearchParams,
  ]);

  // Initial / filter-changed load (resets to page 1)
  useEffect(() => {
    if (!stateReady) return;

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
  }, [activeCategory, activeGrade, activePlatform, activeTab, sort, searchQuery, minPrice, maxPrice, buildParams, stateReady]);

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

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "buy", label: "Buy Now" },
    { id: "drops", label: "🔥 Drops" },
    { id: "packs", label: "📦 Packs" },
    { id: "new", label: "New Listings" },
    { id: "ending", label: "Ending Soon" },
    { id: "auctions", label: "Auctions" },
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
                className="border-2 border-black bg-black px-4 py-2 text-[11px] font-semibold text-white/50"
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

      {/* Visual IP category cards row */}
      <div className="border-b-2 border-white/10 bg-[#0D0D0D] px-4 py-3 md:px-8">
        <div className="mx-auto max-w-[1480px]">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {Object.entries(IP_CATEGORIES).map(([id, meta]) => {
              const catFacet = categories.find((c) => c.value === id);
              const count = id === "all" ? totalItems : catFacet?.count ?? 0;
              const isActive = activeCategory === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveCategory(id)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-sm ${
                    isActive ? "ring-2 ring-[#FEDB02]" : "ring-1 ring-white/10"
                  }`}
                  style={{ width: 130, height: 72 }}
                >
                  {/* Background */}
                  {meta.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meta.banner}
                      alt={meta.label}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                  <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} ${meta.banner ? "opacity-60" : "opacity-100"}`} />
                  {/* Overlay text */}
                  <div className="absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className={`font-black text-[11px] leading-tight ${isActive ? "text-[#FEDB02]" : "text-white"}`}>
                      {meta.label}
                    </p>
                    {count > 0 && (
                      <p className="font-mono text-[9px] text-white/60">{count.toLocaleString()}</p>
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FEDB02]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* IP Banner Hero — shown when a specific category is selected */}
      {activeCategory !== "all" && IP_CATEGORIES[activeCategory]?.banner && (
        <div className="relative h-40 w-full overflow-hidden md:h-52">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IP_CATEGORIES[activeCategory].banner}
            alt={IP_CATEGORIES[activeCategory].label}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end px-4 pb-6 md:px-8">
            <div className="mx-auto w-full max-w-[1480px]">
              <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]">CATEGORY</p>
              <h2 className="text-4xl font-black leading-tight text-white md:text-5xl">
                {IP_CATEGORIES[activeCategory].label}
              </h2>
              {!loading && (
                <p className="mt-1 font-mono text-[12px] text-white/60">
                  {totalItems.toLocaleString()} listings · use filters to narrow down
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
              <p className="mb-2 text-[11px] font-semibold text-white/50">Price (USD)</p>
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
                <p className="mb-2 text-[11px] font-semibold text-white/50">Grade</p>
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
                <p className="mb-2 text-[11px] font-semibold text-white/50">Source</p>
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
            <h2 className="text-sm font-bold text-white/80">Filters</h2>
            <button
              onClick={() => { setActiveCategory("all"); clearSearch(); clearPriceFilter(); clearGradeFilter(); clearPlatformFilter(); }}
              className="text-[11px] font-semibold text-[#FEDB02]"
            >
              Clear all
            </button>
          </div>

          {/* Price range filter */}
          <p className="mb-2 mt-0 text-[11px] font-semibold text-white/50">Price (USD)</p>
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

          <p className="mb-2 mt-6 text-[11px] font-semibold text-white/50">Category</p>
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
              <p className="mb-2 mt-6 text-[11px] font-semibold text-white/50">Source</p>
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

          <p className="mb-2 mt-6 text-[11px] font-semibold text-white/50">Grade</p>
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
                {searchQuery
                  ? `"${searchQuery}"`
                  : activeCategory !== "all"
                  ? (IP_CATEGORIES[activeCategory]?.label ?? "Collectibles")
                  : "Graded Collectibles"}
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

          {/* Drops hero banner */}
          {activeTab === "drops" && (
            <div className="mb-5 border-2 border-[#FEDB02]/30 bg-gradient-to-r from-[#1A1200] to-[#0A0A0A] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#FEDB02]">🔥 DROPS</p>
                  <h2 className="mt-1 text-xl font-black leading-tight text-white">Latest Sealed Products</h2>
                  <p className="mt-1 font-mono text-[11px] text-white/50">
                    Booster boxes, packs &amp; sealed sets · newest first · badges show age
                  </p>
                </div>
                {!loading && (
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-2xl font-black text-[#FEDB02]">{totalItems.toLocaleString()}</p>
                    <p className="font-mono text-[9px] text-white/40">SEALED LISTINGS</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Packs hero banner */}
          {activeTab === "packs" && (
            <div className="mb-5 border-2 border-emerald-500/30 bg-gradient-to-r from-[#001A0A] to-[#0A0A0A] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-emerald-400">📦 PACKS</p>
                  <h2 className="mt-1 text-xl font-black leading-tight text-white">Sealed Product Marketplace</h2>
                  <p className="mt-1 font-mono text-[11px] text-white/50">
                    Booster boxes, packs &amp; sealed sets · sorted by price · find the best deal
                  </p>
                </div>
                {!loading && (
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-2xl font-black text-emerald-400">{totalItems.toLocaleString()}</p>
                    <p className="font-mono text-[9px] text-white/40">SEALED LISTINGS</p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["price_asc", "price_desc", "updated_desc"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`border px-3 py-1 font-mono text-[9px] font-bold tracking-widest ${
                      sort === s || (activeTab === "packs" && s === "price_asc" && !["price_desc","updated_desc"].includes(sort))
                        ? "border-emerald-400 text-emerald-400"
                        : "border-white/20 text-white/40"
                    }`}
                  >
                    {s === "price_asc" ? "LOWEST PRICE" : s === "price_desc" ? "HIGHEST PRICE" : "NEWEST"}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="overflow-hidden bg-white">
                    <div className="aspect-[3/4] animate-pulse bg-neutral-200" />
                    <div className="space-y-2 p-3">
                      <div className="h-5 w-1/2 animate-pulse bg-neutral-200" />
                      <div className="h-3 w-3/4 animate-pulse bg-neutral-100" />
                      <div className="h-3 w-1/3 animate-pulse bg-neutral-100" />
                    </div>
                  </div>
                ))
              : items.map((item) => {
                  const itemTimestamp = item.listedAt ?? item.syncedAt;
                  const isNew = Date.now() - new Date(itemTimestamp).getTime() < 48 * 60 * 60 * 1000;
                  const grade = activeTab === "packs" ? "Sealed" : (item.gradeValue || item.gradeNormalized || "—");
                  const price = formatListingPrice(
                    item.priceUsd,
                    item.priceAmount,
                    item.priceCurrency,
                    item.listingType,
                  );
                  const source = PLATFORM_LABELS[item.sourcePlatform] ?? item.sourcePlatform;
                  const listingTypeLabel = LISTING_TYPE_LABELS[item.listingType] ?? "Listing";
                  return (
                  <article key={item.id} className="group overflow-hidden bg-white text-[#0A0A0A] transition hover:shadow-[0_6px_0_#FEDB02]">
                    <Link href={`/collectibles/lot/${item.id}`} className="block">
                      {/* 1 — Image */}
                      <div className="relative aspect-[3/4] bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "https://placehold.co/600x800/png?text=No+Image";
                          }}
                        />
                        {/* 2 — Grade badge */}
                        <div className="absolute left-2 top-2 bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {grade}
                        </div>
                        <div className="absolute right-2 bottom-2 bg-white/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-black">
                          {listingTypeLabel}
                        </div>
                        {isNew && (
                          <div className="absolute bottom-2 left-2 bg-[#FEDB02] px-1.5 py-0.5 text-[9px] font-black text-black">
                            New
                          </div>
                        )}
                        <div className="absolute right-1 top-1">
                          <WishlistButton
                            listingId={item.id}
                            isWishlisted={wishlistedIds.has(item.id)}
                            onToggle={handleWishlistToggle}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        {/* 3 — Price (loud) */}
                        <p className="text-xl font-black leading-none">{price}</p>
                        {/* Title (secondary) */}
                        <h3 className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-neutral-500">
                          {item.title}
                        </h3>
                        {searchQuery && item.matchReason && (
                          <div className="mt-2">
                            <span className="inline-flex border border-[#FEDB02]/50 bg-[#FEDB02]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#A68C00]">
                              {item.matchReason}
                            </span>
                          </div>
                        )}
                        {/* 4 — Source (quiet trust-mark) */}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-neutral-400">
                            {source}
                          </span>
                          <span className="font-mono text-[9px] text-neutral-300">{timeAgo(item.listedAt ?? item.syncedAt)}</span>
                        </div>
                      </div>
                    </Link>
                    {/* 5 — CTA (secondary, fills on hover) */}
                    <div className="px-3 pb-3">
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full border border-[#0A0A0A] py-2 text-center text-[10px] font-bold tracking-wide text-[#0A0A0A] transition-colors group-hover:bg-[#0A0A0A] group-hover:text-[#FEDB02]"
                      >
                        {getPrimaryCtaLabel(item.listingType)}
                      </a>
                    </div>
                  </article>
                ); })}
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

export default function CollectiblesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0A0A0A] text-white" />}>
      <CollectiblesPageInner />
    </Suspense>
  );
}
