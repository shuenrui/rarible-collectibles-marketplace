import Link from "next/link";
import { prisma } from "@/lib/prisma";

type SearchPageProps = {
  searchParams: { q?: string };
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
          <Link href="/collectibles" className="font-mono text-[10px] font-bold tracking-[0.2em] text-black">
            BACK TO BROWSE
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1480px] px-4 pb-10 pt-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight">SEARCH MARKETPLACE</h1>
          <p className="mt-1 font-mono text-[11px] text-white/45">DIRECTION 4 · BOLD SPORT</p>
        </div>

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
            className="border-2 border-[#FEDB02] bg-[#FEDB02] px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-black"
          >
            Search
          </button>
        </form>

        <div className="mb-4 font-mono text-[11px] text-white/55">
          {q ? `Results for "${q}" · ${items.length} shown` : `${items.length} latest listings`}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_#FEDB02]">
              <Link href={`/collectibles/lot/${item.id}`}>
                <div className="relative aspect-[3/4] border-b-2 border-[#0A0A0A] bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-500">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-1 top-1 bg-[#0A0A0A] px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#FEDB02]">
                    {item.gradeValue || item.gradeNormalized || "UNKNOWN"}
                  </div>
                </div>
                <div className="p-2">
                  <h3 className="line-clamp-2 min-h-[30px] text-xs font-bold leading-tight">{item.title}</h3>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-base font-black">
                      {item.priceUsd ? `$${Number(item.priceUsd).toLocaleString()}` : `${item.priceAmount.toString()} ${item.priceCurrency}`}
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
