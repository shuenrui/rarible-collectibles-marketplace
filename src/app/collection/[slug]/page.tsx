import Link from "next/link";
import { prisma } from "@/lib/prisma";

type CollectionPageProps = {
  params: { slug: string };
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

function labelFor(slug: string): string {
  return CATEGORY_LABELS[slug] || slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const slug = params.slug;

  const [items, total] = await Promise.all([
    prisma.collectibleListing.findMany({
      where: {
        listingStatus: "active",
        categoryL1: slug as never,
      },
      orderBy: { syncedAt: "desc" },
      take: 72,
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
    }),
    prisma.collectibleListing.count({
      where: {
        listingStatus: "active",
        categoryL1: slug as never,
      },
    }),
  ]);

  const label = labelFor(slug);

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

      <section className="border-b-[3px] border-[#FEDB02] bg-[#0A0A0A] px-4 py-12 md:px-8">
        <div className="mx-auto w-full max-w-[1480px]">
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#FEDB02]">FANDOM COLLECTION</p>
          <h1 className="mt-2 text-5xl font-black leading-[0.92] tracking-tight md:text-7xl">
            {label.toUpperCase()}
            <br />
            <span className="text-[#FEDB02]">MARKET</span>
          </h1>
          <p className="mt-4 font-mono text-xs tracking-[0.14em] text-white/60">{total.toLocaleString()} ACTIVE LISTINGS</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1480px] px-4 pb-10 pt-6 md:px-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-[11px] text-white/55">SHOWING {items.length} LISTINGS</p>
          <Link href="/collectibles" className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#FEDB02]">
            BACK TO MARKETPLACE
          </Link>
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
              No active listings currently available for this category.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
