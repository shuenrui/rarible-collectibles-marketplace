import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const [total, active, byPlatform] = await Promise.all([
      prisma.collectibleListing.count(),
      prisma.collectibleListing.count({ where: { listingStatus: "active" } }),
      prisma.collectibleListing.groupBy({
        by: ["sourcePlatform"],
        _count: { _all: true },
        where: { listingStatus: "active" },
      }),
    ]);
    console.log("Total listings:", total);
    console.log("Active listings:", active);
    console.log("By platform:");
    byPlatform.forEach((p) => console.log(`  ${p.sourcePlatform}: ${p._count._all}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
