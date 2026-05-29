import { ingestCourtyardTrades } from "@/lib/adapters/courtyard";
import { prisma } from "@/lib/prisma";
import { createPublicClient, http } from "viem";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const rpcUrl = parseArg("rpc") || process.env.POLYGON_RPC_URL || "https://polygon.drpc.org";
  const lookback = BigInt(parseArg("lookback") || "100");
  const client = createPublicClient({ transport: http(rpcUrl) });
  const latest = await client.getBlockNumber();
  const from = latest > lookback ? latest - lookback : 0n;

  const output = await ingestCourtyardTrades({ rpcUrl, fromBlock: from, toBlock: latest });

  let persisted = 0;
  for (const item of output.upserts) {
    await prisma.collectibleListing.upsert({
      where: {
        sourcePlatform_sourceListingId: {
          sourcePlatform: item.sourcePlatform,
          sourceListingId: item.sourceListingId,
        },
      },
      create: {
        sourcePlatform: item.sourcePlatform,
        sourceListingId: item.sourceListingId,
        sourceItemId: item.sourceItemId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        images: (item.images as unknown as object) ?? undefined,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        franchise: item.franchise,
        setName: item.setName,
        cardNumber: item.cardNumber,
        year: item.year,
        conditionType: item.conditionType,
        grader: item.grader,
        gradeValue: item.gradeValue,
        gradeNormalized: item.gradeNormalized,
        gradeLabelRaw: item.gradeLabelRaw,
        listingType: item.listingType,
        priceAmount: item.priceAmount,
        priceCurrency: item.priceCurrency,
        priceUsd: item.priceUsd,
        lastPriceUpdateAt: new Date(item.lastPriceUpdateAt),
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        tokenId: item.tokenId,
        tokenStandard: item.tokenStandard,
        vaulted: item.vaulted,
        redeemable: item.redeemable,
        authProvider: item.authProvider,
        listingStatus: item.listingStatus,
        listedAt: item.listedAt ? new Date(item.listedAt) : undefined,
        soldAt: item.soldAt ? new Date(item.soldAt) : undefined,
        sellerAddress: item.sellerAddress,
        sellerHandle: item.sellerHandle,
        sellerVerified: item.sellerVerified,
        syncConfidence: item.syncConfidence,
        dataQualityFlags: (item.dataQualityFlags as object) ?? undefined,
        rawSourcePayload: item.rawSourcePayload as object,
        syncedAt: new Date(item.syncedAt),
      },
      update: {
        sourceItemId: item.sourceItemId,
        sourceUrl: item.sourceUrl,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        images: (item.images as unknown as object) ?? undefined,
        categoryL1: item.categoryL1,
        categoryL2: item.categoryL2,
        franchise: item.franchise,
        setName: item.setName,
        cardNumber: item.cardNumber,
        year: item.year,
        conditionType: item.conditionType,
        grader: item.grader,
        gradeValue: item.gradeValue,
        gradeNormalized: item.gradeNormalized,
        gradeLabelRaw: item.gradeLabelRaw,
        listingType: item.listingType,
        priceAmount: item.priceAmount,
        priceCurrency: item.priceCurrency,
        priceUsd: item.priceUsd,
        lastPriceUpdateAt: new Date(item.lastPriceUpdateAt),
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        tokenId: item.tokenId,
        tokenStandard: item.tokenStandard,
        vaulted: item.vaulted,
        redeemable: item.redeemable,
        authProvider: item.authProvider,
        listingStatus: item.listingStatus,
        listedAt: item.listedAt ? new Date(item.listedAt) : undefined,
        soldAt: item.soldAt ? new Date(item.soldAt) : undefined,
        sellerAddress: item.sellerAddress,
        sellerHandle: item.sellerHandle,
        sellerVerified: item.sellerVerified,
        syncConfidence: item.syncConfidence,
        dataQualityFlags: (item.dataQualityFlags as object) ?? undefined,
        rawSourcePayload: item.rawSourcePayload as object,
        syncedAt: new Date(item.syncedAt),
      },
    });
    persisted += 1;
  }

  console.log(
    JSON.stringify(
      {
        lookback: lookback.toString(),
        upsertsFetched: output.upserts.length,
        persisted,
        parseErrors: output.errors.length,
        checkpoint: {
          chainId: output.checkpoint.chainId,
          lastProcessedBlock: output.checkpoint.lastProcessedBlock.toString(),
        },
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
