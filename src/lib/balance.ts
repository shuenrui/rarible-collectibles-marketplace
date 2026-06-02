const ETH_RPC = "https://eth.llamarpc.com";
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const SOL_RPC = "https://api.mainnet-beta.solana.com";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function rpcPost(url: string, body: object): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json()) as { result?: unknown };
  return json.result;
}

export async function fetchEVMBalances(
  address: string,
): Promise<{ nativeBalance: string | null; usdcBalance: string | null }> {
  try {
    const ethResult = (await rpcPost(ETH_RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    })) as string | null;

    const nativeWei = BigInt(ethResult ?? "0x0");
    const nativeBalance = (Number(nativeWei) / 1e18).toFixed(4) + " ETH";

    const padded = address.slice(2).toLowerCase().padStart(64, "0");
    const usdcResult = (await rpcPost(ETH_RPC, {
      jsonrpc: "2.0",
      id: 2,
      method: "eth_call",
      params: [{ to: USDC_ETH, data: "0x70a08231" + padded }, "latest"],
    })) as string | null;

    const usdcRaw = BigInt(usdcResult ?? "0x0");
    const usdcBalance = (Number(usdcRaw) / 1e6).toFixed(2) + " USDC";

    return { nativeBalance, usdcBalance };
  } catch {
    return { nativeBalance: null, usdcBalance: null };
  }
}

type SolanaTokenAccount = {
  account: {
    data: {
      parsed: {
        info: {
          tokenAmount: { uiAmount: number };
        };
      };
    };
  };
};

export async function fetchSolanaBalances(
  address: string,
): Promise<{ nativeBalance: string | null; usdcBalance: string | null }> {
  try {
    const solResult = (await rpcPost(SOL_RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    })) as { value?: number } | null;

    const lamports = solResult?.value ?? 0;
    const nativeBalance = (lamports / 1e9).toFixed(4) + " SOL";

    const usdcResult = (await rpcPost(SOL_RPC, {
      jsonrpc: "2.0",
      id: 2,
      method: "getTokenAccountsByOwner",
      params: [address, { mint: USDC_SOL }, { encoding: "jsonParsed" }],
    })) as { value?: SolanaTokenAccount[] } | null;

    let usdcTotal = 0;
    for (const acct of usdcResult?.value ?? []) {
      usdcTotal += acct.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    }
    const usdcBalance = usdcTotal.toFixed(2) + " USDC";

    return { nativeBalance, usdcBalance };
  } catch {
    return { nativeBalance: null, usdcBalance: null };
  }
}
