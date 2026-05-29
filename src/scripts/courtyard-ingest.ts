import { createPublicClient, http } from "viem";
import {
  decodeKnownCourtyardTradeCount,
  discoverCourtyardEventSignatures,
  ingestCourtyardTrades,
} from "@/lib/adapters/courtyard";

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

  const t0 = Date.now();
  const output = await ingestCourtyardTrades({ rpcUrl, fromBlock: from, toBlock: latest });
  const elapsed = Date.now() - t0;

  const sigs = await discoverCourtyardEventSignatures({ rpcUrl, fromBlock: from, toBlock: latest });
  const tradeCountDecoded = await decodeKnownCourtyardTradeCount({ rpcUrl, fromBlock: from, toBlock: latest });

  const blockSpan = Number(latest - from);
  const msPerBlock = blockSpan > 0 ? Number((elapsed / blockSpan).toFixed(2)) : elapsed;
  const metadataSuccess = output.upserts.filter((u) => !(u.dataQualityFlags as { missingMetadata?: boolean } | undefined)?.missingMetadata).length;
  const metadataMissing = output.upserts.length - metadataSuccess;
  const highConfidence = output.upserts.filter((u) => u.syncConfidence >= 80).length;
  const lowConfidence = output.upserts.filter((u) => u.syncConfidence < 80).length;

  console.log(
    JSON.stringify(
      {
        rpcUrl,
        fromBlock: from.toString(),
        toBlock: latest.toString(),
        blocksScanned: blockSpan,
        elapsedMs: elapsed,
        msPerBlock,
        upserts: output.upserts.length,
        metadataSuccess,
        metadataMissing,
        highConfidence,
        lowConfidence,
        tombstones: output.tombstones.length,
        parseErrors: output.errors.length,
        tradeCountDecoded,
        topEventSignatures: Object.entries(sigs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        checkpoint: {
          chainId: output.checkpoint.chainId,
          lastProcessedBlock: output.checkpoint.lastProcessedBlock.toString(),
          updatedAt: output.checkpoint.updatedAt,
        },
      },
      null,
      2,
    ),
  );

  if (output.errors.length) {
    console.log("\nSample errors:");
    for (const err of output.errors.slice(0, 5)) {
      console.log(`- ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error("courtyard:ingest failed:", err);
  process.exit(1);
});
