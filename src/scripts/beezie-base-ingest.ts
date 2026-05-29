import { createPublicClient, http } from "viem";
import { ingestBeezieBase } from "@/lib/adapters/beezie/base";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const rpcUrl = parseArg("rpc") || "https://mainnet.base.org";
  const lookback = BigInt(parseArg("lookback") || "1000");

  const client = createPublicClient({ transport: http(rpcUrl) });
  const latest = await client.getBlockNumber();
  const from = latest > lookback ? latest - lookback : 0n;

  const t0 = Date.now();
  const output = await ingestBeezieBase({ rpcUrl, fromBlock: from, toBlock: latest });
  const elapsed = Date.now() - t0;

  const metadataSuccess = output.upserts.filter((u) => !(u.dataQualityFlags as { missingMetadata?: boolean } | undefined)?.missingMetadata).length;
  const metadataMissing = output.upserts.length - metadataSuccess;

  console.log(
    JSON.stringify(
      {
        rpcUrl,
        fromBlock: from.toString(),
        toBlock: latest.toString(),
        blocksScanned: Number(latest - from),
        elapsedMs: elapsed,
        upserts: output.upserts.length,
        metadataSuccess,
        metadataMissing,
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

  if (output.errors.length) {
    console.log("\nSample errors:");
    for (const err of output.errors.slice(0, 5)) console.log(`- ${err.message}`);
  }
}

main().catch((err) => {
  console.error("beezie-base:ingest failed:", err);
  process.exit(1);
});
