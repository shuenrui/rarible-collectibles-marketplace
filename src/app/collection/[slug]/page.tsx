import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CollectionPageProps = {
  params: { slug: string };
  searchParams?: {
    page?: string;
    grade?: string;
    source_platform?: string;
    min_price_usd?: string;
    max_price_usd?: string;
    sort?: string;
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  pokemon: "Pokemon",
  sports_cards: "Sports Cards",
  one_piece: "One Piece",
  yugioh: "Yu-Gi-Oh",
  comics: "Comics",
  sealed_products: "Sealed Products",
  other: "Collectibles",
};

const CATEGORY_BANNERS: Record<string, string> = {
  pokemon: "/banners/pokemon.jpg",
  sports_cards: "/banners/baseball.jpg",
  one_piece: "/banners/onepiece.jpg",
  yugioh: "/banners/yugioh.jpg",
  comics: "/banners/marvel.jpg",
};

function labelFor(slug: string): string {
  return CATEGORY_LABELS[slug] || slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function timeAgo(value: string | Date | null) {
  if (!value) return "recently";

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const slug = params.slug;
  const label = labelFor(slug);
  const page = Math.max(1, Number(searchParams?.page || "1"));
  const pageSize = 36;
  const selectedGrade = searchParams?.grade?.trim() || "";
  const selectedSource = searchParams?.source_platform?.trim() || "";
  const minPrice = searchParams?.min_price_usd?.trim() || "";
  const maxPrice = searchParams?.max_price_usd?.trim() || "";
  const sort = searchParams?.sort?.trim() || "updated_desc";

  const where: Prisma.CollectibleListingWhereInput = {
    listingStatus: "active",
    categoryL1: slug as never,
  };

  if (selectedGrade) where.gradeNormalized = selectedGrade as never;
  if (selectedSource) where.sourcePlatform = selectedSource as never;
  if (minPrice || maxPrice) {
    where.priceUsd = {
      gte: minPrice || undefined,
      lte: maxPrice || undefined,
    };
  }

  const orderBy: Prisma.CollectibleListingOrderByWithRelationInput[] =
    sort === "price_asc"
      ? [{ priceUsd: "asc" }, { listedAt: "desc" }, { syncedAt: "desc" }]
      : sort === "price_desc"
        ? [{ priceUsd: "desc" }, { listedAt: "desc" }, { syncedAt: "desc" }]
        : [{ listedAt: "desc" }, { syncedAt: "desc" }];

  const [items, total, grades, platforms] = await Promise.all([
    prisma.collectibleListing.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
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
        syncedAt: true,
        listedAt: true,
      },
    }),
    prisma.collectibleListing.count({ where }),
    prisma.collectibleListing.groupBy({
      by: ["gradeNormalized"],
      where: {
        listingStatus: "active",
        categoryL1: slug as never,
      },
      _count: { _all: true },
      orderBy: { _count: { gradeNormalized: "desc" } },
      take: 8,
    }),
    prisma.collectibleListing.groupBy({
      by: ["sourcePlatform"],
      where: {
        listingStatus: "active",
        categoryL1: slug as never,
      },
      _count: { _all: true },
      orderBy: { _count: { sourcePlatform: "desc" } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const bannerImage = CATEGORY_BANNERS[slug];

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <div className="hidden flex-1 md:block">
            <Link href="/search" className="mx-auto block max-w-md bg-black/15 px-4 py-2 text-sm font-semibold text-black/60">
              Search cards, sets, players...
            </Link>
          </div>
          <Link href="/collectibles" className="font-mono text-[10px] font-bold tracking-[0.2em] text-black">
            BROWSE ALL
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b-[3px] border-[#FEDB02] px-4 py-12 md:px-8">
        {bannerImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerImage}
              alt={label}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/30" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-black via-neutral-900 to-black" />
        )}
        <div className="relative mx-auto w-full max-w-[1480px]">
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]">FANDOM COLLECTION</p>
          <h1 className="mt-2 text-5xl font-black leading-[0.92] tracking-tight md:text-7xl">
            {label.toUpperCase()}
            <br />
            <span className="text-[#FEDB02]">MARKET</span>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <p className="font-mono text-xs tracking-[0.14em] text-white/75">{total.toLocaleString()} ACTIVE LISTINGS</p>
            <p className="font-mono text-xs tracking-[0.14em] text-white/55">PSA 10 / price / source / freshness filters enabled</p>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[1480px]">
        <aside className="hidden w-[240px] shrink-0 border-r-2 border-white/10 bg-[#0A0A0A] p-5 lg:block">
          <form method="GET" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">FILTERS</h2>
              <Link
                href={`/collection/${slug}`}
                className="font-mono text-[10px] font-bold tracking-widest text-[#FEDB02]"
              >
                CLEAR
              </Link>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Grade</p>
              <div className="space-y-2">
                {grades.map((grade) => {
                  if (!grade.gradeNormalized) return null;
                  return (
                    <label key={grade.gradeNormalized} className="flex items-center justify-between border-b border-white/5 py-1 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="grade"
                          value={grade.gradeNormalized}
                          defaultChecked={selectedGrade === grade.gradeNormalized}
                        />
                        <span>{grade.gradeNormalized}</span>
                      </div>
                      <span className="font-mono text-[10px] text-white/35">{grade._count._all}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Source</p>
              <div className="space-y-2">
                {platforms.map((platform) => (
                  <label key={platform.sourcePlatform} className="flex items-center justify-between border-b border-white/5 py-1 text-sm">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="source_platform"
                        value={platform.sourcePlatform}
                        defaultChecked={selectedSource === platform.sourcePlatform}
                      />
                      <span>{platform.sourcePlatform}</span>
                    </div>
                    <span className="font-mono text-[10px] text-white/35">{platform._count._all}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Price USD</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="min_price_usd"
                  defaultValue={minPrice}
                  placeholder="Min"
                  className="border border-white/20 bg-[#111] px-3 py-2 text-sm text-white"
                />
                <input
                  name="max_price_usd"
                  defaultValue={maxPrice}
                  placeholder="Max"
                  className="border border-white/20 bg-[#111] px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FEDB02]">Sort</p>
              <select
                name="sort"
                defaultValue={sort}
                className="w-full border border-white/20 bg-[#111] px-3 py-2 font-mono text-[11px] font-bold tracking-widest text-white"
              >
                <option value="updated_desc">NEWEST</option>
                <option value="price_asc">LOWEST PRICE</option>
                <option value="price_desc">HIGHEST PRICE</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#FEDB02] py-3 text-sm font-black uppercase tracking-[0.14em] text-black"
            >
              Apply filters
            </button>
          </form>
        </aside>

        <section className="flex-1 px-4 pb-10 pt-6 md:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] text-white/55">
                SHOWING {items.length} OF {total.toLocaleString()} LISTINGS
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/55">
                {selectedGrade ? <span className="border border-white/15 px-2 py-1">grade: {selectedGrade}</span> : null}
                {selectedSource ? <span className="border border-white/15 px-2 py-1">source: {selectedSource}</span> : null}
                {minPrice || maxPrice ? (
                  <span className="border border-white/15 px-2 py-1">
                    price: {minPrice || "0"} - {maxPrice || "max"}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/collectibles" className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#FEDB02]">
                BACK TO MARKETPLACE
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FEDB02]">
                <Link href={`/collectibles/lot/${item.id}`}>
                  <div className="relative aspect-[3/4] border-b-2 border-[#0A0A0A] bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                    <div className="absolute left-1 top-1 bg-[#0A0A0A] px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#FEDB02]">
                      {item.gradeValue || item.gradeNormalized || "UNKNOWN"}
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="line-clamp-2 min-h-[30px] text-xs font-bold leading-tight">{item.title}</h3>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <p className="text-base font-black">
                        {item.priceUsd ? `$${Number(item.priceUsd).toLocaleString()}` : `${item.priceAmount.toString()} ${item.priceCurrency}`}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] text-[#6B6B6B]">{item.sourcePlatform}</span>
                      <span className="font-mono text-[8px] text-[#6B6B6B]">{timeAgo(item.listedAt ?? item.syncedAt)}</span>
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
            {items.length === 0 ? (
              <div className="col-span-full border border-white/20 bg-black/30 p-6 text-sm text-white/70">
                No active listings currently available for this category with the current filters.
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="font-mono text-[11px] text-white/50">
              PAGE {page} OF {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={{
                    pathname: `/collection/${slug}`,
                    query: { ...searchParams, page: String(page - 1) },
                  }}
                  className="border border-white/20 px-4 py-2 font-mono text-[11px] font-bold tracking-[0.18em] text-white"
                >
                  PREV
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={{
                    pathname: `/collection/${slug}`,
                    query: { ...searchParams, page: String(page + 1) },
                  }}
                  className="border border-[#FEDB02] bg-[#FEDB02] px-4 py-2 font-mono text-[11px] font-bold tracking-[0.18em] text-black"
                >
                  NEXT
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
