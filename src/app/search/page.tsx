import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CollectibleImage from "@/components/CollectibleImage";
import { formatListingPrice } from "@/lib/pricing";

type SearchPageProps = {
  searchParams: { q?: string };
};

const PLATFORM_LABELS: Record<string, string> = {
  courtyard: "Courtyard",
  beezie: "Beezie",
  collector_crypt: "Collector Crypt",
  phygitals: "Phygitals",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = (searchParams.q || "").trim();

  const items = await prisma.collectibleListing.findMany({
    where: {
      listingStatus: "active",
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { franchise: { contains: q, mode: "insensitive" } },
              { setName: { contains: q, mode: "insensitive" } },
              { cardNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { syncedAt: "desc" },
    take: 48,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      gradeValue: true,
      gradeNormalized: true,
      priceAmount: true,
      priceCurrency: true,
      priceUsd: true,
      listingType: true,
      sourcePlatform: true,
      sourceUrl: true,
    },
  });

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-20 border-b-[3px] border-black bg-[#FEDB02] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/" className="font-black tracking-tight text-black md:text-lg">
            RARIBLE COLLECTIBLES
          </Link>
          <Link href="/collectibles" className="text-[11px] font-semibold text-black/60">
            Back to browse
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1480px] px-4 pb-10 pt-6 md:px-8">
        <h1 className="mb-4 text-3xl font-black tracking-tight">Search Marketplace</h1>

        <form action="/search" method="get" className="mb-7 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search cards, sets, players, franchises..."
            className="w-full border-2 border-white/20 bg-[#111] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/40 focus:border-[#FEDB02]"
          />
          <button
            type="submit"
            className="border-2 border-[#FEDB02] bg-[#FEDB02] px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-black"
          >
            Search
          </button>
        </form>

        <div className="mb-4 text-[11px] text-white/50">
          {q ? `Results for "${q}" · ${items.length} shown` : `${items.length} latest listings`}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => {
            const grade = item.gradeValue || item.gradeNormalized || "—";
            const price = formatListingPrice(
              item.priceUsd?.toString() ?? null,
              item.priceAmount.toString(),
              item.priceCurrency,
              item.listingType,
            );
            const sourceLabel = PLATFORM_LABELS[item.sourcePlatform] ?? item.sourcePlatform;

            return (
              <article key={item.id} className="group overflow-hidden bg-white text-[#0A0A0A] transition hover:shadow-[0_6px_0_#FEDB02]">
                <Link href={`/collectibles/lot/${item.id}`} className="block">
                  <div className="relative aspect-[3/4] bg-neutral-100">
                    <CollectibleImage
                      src={item.imageUrl}
                      alt={item.title}
                      title={item.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-2 top-2 bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {grade}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xl font-black leading-none">{price}</p>
                    <h3 className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-neutral-500">{item.title}</h3>
                    <p className="mt-2 text-[11px] font-semibold text-neutral-400">{sourceLabel}</p>
                  </div>
                </Link>
                <div className="px-3 pb-3">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full border border-[#0A0A0A] py-2 text-center text-[10px] font-bold tracking-wide text-[#0A0A0A] transition-colors group-hover:bg-[#0A0A0A] group-hover:text-[#FEDB02]"
                  >
                    Buy Now
                  </a>
                </div>
              </article>
            );
          })}
          {items.length === 0 ? (
            <div className="col-span-full border border-white/20 bg-black/30 p-6 text-sm text-white/70">
              No results found. Try a different query.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
