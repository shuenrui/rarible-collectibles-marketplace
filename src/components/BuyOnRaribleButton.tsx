"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import {
  useSignAndSendTransaction,
  useWallets,
  type ConnectedStandardSolanaWallet,
} from "@privy-io/react-auth/solana";

const SOLANA_MAINNET = "solana:mainnet" as const;
const EXECUTABLE_SOURCES = new Set(["collector_crypt", "phygitals"]);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type QuoteResponse = {
  unsigned?: {
    chain?: "solana";
    unsignedTransactionBase64?: string;
    programIds?: string[];
  };
};

type ConfirmResponse = {
  txHash: string;
  status: "submitted" | "confirmed" | "failed";
  sourceListingStatus?: "active" | "sold" | "cancelled" | "unknown";
};

type BuyOnRaribleButtonProps = {
  listingId: string;
  sourcePlatform: string;
};

type BuyState =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string; txHash: string };

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) {
    leadingZeroes += 1;
  }

  let output = "1".repeat(leadingZeroes);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    output += BASE58_ALPHABET[digits[i]];
  }
  return output;
}

function normalizeError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed";
  const error = "error" in payload ? payload.error : undefined;
  const reasons = "reasons" in payload ? payload.reasons : undefined;

  if (Array.isArray(reasons) && reasons.length > 0) {
    return reasons.join(" ");
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Request failed";
}

async function confirmUntilSettled(
  listingId: string,
  buyerWallet: string,
  txHash: string,
): Promise<ConfirmResponse> {
  let latest: ConfirmResponse = {
    txHash,
    status: "submitted",
    sourceListingStatus: "unknown",
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch("/api/execute/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, buyerWallet, txHash }),
    });

    const payload = (await response.json()) as ConfirmResponse | { error?: string };
    if (!response.ok) {
      throw new Error(normalizeError(payload));
    }

    latest = payload as ConfirmResponse;
    if (latest.status !== "submitted") {
      return latest;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }

  return latest;
}

function shortHash(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function BuyOnRaribleButton({
  listingId,
  sourcePlatform,
}: BuyOnRaribleButtonProps) {
  const router = useRouter();
  const { ready: privyReady, authenticated, login } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [state, setState] = useState<BuyState>({ kind: "idle" });

  const supported = EXECUTABLE_SOURCES.has(sourcePlatform);

  const selectedWallet = useMemo<ConnectedStandardSolanaWallet | null>(() => {
    if (!wallets.length) return null;
    return wallets[0];
  }, [wallets]);

  if (!supported) {
    return null;
  }

  const handleBuy = async () => {
    if (!privyReady) {
      setState({ kind: "error", message: "Account state is still loading." });
      return;
    }

    if (!authenticated) {
      login();
      return;
    }

    if (!walletsReady || !selectedWallet) {
      setState({
        kind: "error",
        message:
          "No connected Solana wallet is ready yet. Open your dashboard once if Privy still needs to finish wallet creation.",
      });
      return;
    }

    try {
      setState({ kind: "working", label: "Quoting live listing…" });
      const quoteResponse = await fetch("/api/execute/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          buyerWallet: selectedWallet.address,
        }),
      });
      const quotePayload = (await quoteResponse.json()) as
        | QuoteResponse
        | { error?: string; reasons?: string[] };
      if (!quoteResponse.ok) {
        throw new Error(normalizeError(quotePayload));
      }

      const { unsigned } = quotePayload as QuoteResponse;
      const unsignedBase64 = unsigned?.unsignedTransactionBase64;
      if (!unsignedBase64) {
        throw new Error("Quote did not return a signable Solana transaction.");
      }

      setState({ kind: "working", label: "Waiting for wallet signature…" });
      const signed = await signAndSendTransaction({
        wallet: selectedWallet,
        transaction: decodeBase64(unsignedBase64),
        chain: SOLANA_MAINNET,
      });

      const txHash = encodeBase58(signed.signature);

      setState({ kind: "working", label: "Confirming on-chain purchase…" });
      const confirmation = await confirmUntilSettled(
        listingId,
        selectedWallet.address,
        txHash,
      );

      if (confirmation.status === "failed") {
        throw new Error("Transaction landed but execution failed on-chain.");
      }

      router.refresh();

      setState({
        kind: "success",
        txHash,
        message:
          confirmation.status === "confirmed"
            ? "Purchase confirmed."
            : "Transaction submitted. Final sale state should settle shortly.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Purchase failed.";
      setState({ kind: "error", message });
    }
  };

  const buttonLabel = (() => {
    if (!authenticated) return "Continue to secure checkout";
    if (state.kind === "working") return state.label;
    return "Buy on Rarible";
  })();

  const disabled = state.kind === "working" || (authenticated && !walletsReady);

  return (
    <div className="space-y-3">
      {!authenticated ? (
        <div className="border border-white/10 bg-white/5 px-3 py-3 text-[11px] leading-relaxed text-white/65">
          Pay by card or crypto. Ownership is tracked on-chain; your item stays vaulted until you redeem it.
          Shipping and redemption fees apply. You will create a Rarible account via Google with Privy, so no separate wallet setup is required first.
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleBuy}
        disabled={disabled}
        className="block w-full border-2 border-black bg-[#FEDB02] py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {buttonLabel}
      </button>

      {selectedWallet ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/50">
          Settlement wallet: {selectedWallet.address}
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p className="text-sm text-red-300">{state.message}</p>
      ) : null}

      {state.kind === "success" ? (
        <p className="text-sm text-emerald-300">
          {state.message} Tx {shortHash(state.txHash)}.
        </p>
      ) : null}
    </div>
  );
}
