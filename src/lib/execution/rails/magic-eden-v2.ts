import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type {
  ExecutableListing,
  ExecutionRailAdapter,
  ExecutableValidation,
  UnsignedExecutionPayload,
  ExecutionResult,
  MagicEdenV2Payload,
} from "../types";

const ME_V2_PROGRAM = new PublicKey(
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
);
// Fallback only — getFreshQuote resolves this dynamically from ME's listing API.
// Shipping real transactions against this address without confirming via a live
// CC/Phygitals tx hash is unsafe.
// Confirmed from on-chain tx 3g6r5EmAUM9... (CC purchase, 2026-06-10).
// requiresSignOff=false on this AH, so the "notary" second signer in CC's
// txs is CC-app-level — omitting it from our tx should still pass on-chain.
const ME_AUCTION_HOUSE_FALLBACK = "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe";

// CC and Phygitals use USDC (not SOL) as treasury mint — confirmed from CC tx.
// PDA seeds and escrow account type differ from SOL-based auction houses.
const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const USDC_DECIMALS = 6;

const ME_PREFIX = Buffer.from("m2");
const ME_SIGNER_PREFIX = Buffer.from("signer");

const SOLANA_RPC =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const ME_API = "https://api-mainnet.magiceden.dev/v2";

function connection(): Connection {
  return new Connection(SOLANA_RPC, "confirmed");
}

// Calls ME's public listing endpoint to get the live price + auction house for a mint.
// Returns null if the token isn't currently listed on ME (may have sold or been delisted).
async function resolveMeListing(mintAddress: string): Promise<{
  auctionHouse: string;
  price: number;
  seller: string;
} | null> {
  try {
    const res = await fetch(
      `${ME_API}/tokens/${mintAddress}/listings`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      },
    );
    if (!res.ok) return null;
    const listings = await res.json();
    if (!Array.isArray(listings) || listings.length === 0) return null;
    const first = listings[0];
    if (!first.auctionHouse || !first.price || !first.seller) return null;
    return {
      auctionHouse: first.auctionHouse as string,
      price: first.price as number,
      seller: first.seller as string,
    };
  } catch {
    return null;
  }
}

// --- PDA helpers (all accept auctionHouse as param) ---

function pdaProgramAsSigner(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ME_PREFIX, ME_SIGNER_PREFIX],
    ME_V2_PROGRAM,
  );
}

function pdaEscrowPaymentAccount(
  auctionHouse: PublicKey,
  buyer: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ME_PREFIX, auctionHouse.toBuffer(), buyer.toBuffer()],
    ME_V2_PROGRAM,
  );
}

function pdaSellerTradeState(
  auctionHouse: PublicKey,
  seller: PublicKey,
  tokenAccount: PublicKey,
  mintAddress: PublicKey,
  priceLamports: bigint,
): [PublicKey, number] {
  const [programAsSigner] = pdaProgramAsSigner();
  const priceBuf = Buffer.allocUnsafe(8);
  priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  return PublicKey.findProgramAddressSync(
    [
      ME_PREFIX,
      auctionHouse.toBuffer(),
      seller.toBuffer(),
      programAsSigner.toBuffer(),
      USDC_MINT.toBuffer(),
      mintAddress.toBuffer(),
      tokenAccount.toBuffer(),
      priceBuf,
      sizeBuf,
    ],
    ME_V2_PROGRAM,
  );
}

function pdaBuyerTradeState(
  auctionHouse: PublicKey,
  buyer: PublicKey,
  mintAddress: PublicKey,
  priceLamports: bigint,
): [PublicKey, number] {
  const priceBuf = Buffer.allocUnsafe(8);
  priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  return PublicKey.findProgramAddressSync(
    [
      ME_PREFIX,
      auctionHouse.toBuffer(),
      buyer.toBuffer(),
      mintAddress.toBuffer(),
      USDC_MINT.toBuffer(),
      mintAddress.toBuffer(),
      priceBuf,
      sizeBuf,
    ],
    ME_V2_PROGRAM,
  );
}

function pdaFreeTradeState(
  auctionHouse: PublicKey,
  seller: PublicKey,
  tokenAccount: PublicKey,
  mintAddress: PublicKey,
): [PublicKey, number] {
  const zeroBuf = Buffer.allocUnsafe(8);
  zeroBuf.writeBigUInt64LE(0n);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  return PublicKey.findProgramAddressSync(
    [
      ME_PREFIX,
      auctionHouse.toBuffer(),
      seller.toBuffer(),
      tokenAccount.toBuffer(),
      USDC_MINT.toBuffer(),
      mintAddress.toBuffer(),
      zeroBuf,
      sizeBuf,
    ],
    ME_V2_PROGRAM,
  );
}

// Reads live auction house account: authority is stored at bytes 8-40 (after discriminator).
// Fee account and treasury are PDAs derived from the auction house address.
async function getAuctionHouseAccounts(
  conn: Connection,
  auctionHouse: PublicKey,
): Promise<{ authority: PublicKey; feeAccount: PublicKey; treasury: PublicKey }> {
  const info = await conn.getAccountInfo(auctionHouse);
  if (!info) throw new Error(`Auction house account not found: ${auctionHouse.toBase58()}`);
  const [feeAccount] = PublicKey.findProgramAddressSync(
    [ME_PREFIX, auctionHouse.toBuffer(), Buffer.from("fee_payer")],
    ME_V2_PROGRAM,
  );
  const [treasury] = PublicKey.findProgramAddressSync(
    [ME_PREFIX, auctionHouse.toBuffer(), Buffer.from("treasury")],
    ME_V2_PROGRAM,
  );
  const authority = new PublicKey(info.data.slice(8, 40));
  return { authority, feeAccount, treasury };
}

// --- Instruction builders ---
// Discriminators confirmed from decoded CC purchase tx
// 3g6r5EmAUM9umNJWNSMf4LE7wBpeRRDumvfjNbELuVbgGqWnvtjvciX8DA9aqyWrVstukKVtbVVEutGPsUin6RtV
const IX = {
  deposit:      Buffer.from([242,  35, 198, 137,  82, 225, 242, 182]), // ✅ confirmed
  buy:          Buffer.from([184,  23, 238,  97, 103, 197, 211,  61]), // ✅ confirmed
  executeSale:  Buffer.from([236, 163, 204, 173,  71, 144, 235, 118]), // ✅ confirmed
} as const;

function ixDeposit(
  buyer: PublicKey,
  auctionHouse: PublicKey,
  escrow: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.concat([IX.deposit, (() => { const b = Buffer.allocUnsafe(8); b.writeBigUInt64LE(amount); return b; })()]);
  const keys: AccountMeta[] = [
    { pubkey: buyer,               isSigner: true,  isWritable: true  },
    { pubkey: auctionHouse,        isSigner: false, isWritable: false },
    { pubkey: escrow,              isSigner: false, isWritable: true  },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,  isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: ME_V2_PROGRAM, data });
}

function ixBuy(
  buyer: PublicKey,
  sellerTokenAccount: PublicKey,
  mintAddress: PublicKey,
  auctionHouse: PublicKey,
  authority: PublicKey,
  feeAccount: PublicKey,
  escrow: PublicKey,
  buyerTradeState: PublicKey,
  buyerTradeStateBump: number,
  priceLamports: bigint,
): TransactionInstruction {
  const priceBuf = Buffer.allocUnsafe(8); priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf  = Buffer.allocUnsafe(8); sizeBuf.writeBigUInt64LE(1n);
  const data = Buffer.concat([IX.buy, Buffer.from([buyerTradeStateBump]), priceBuf, sizeBuf]);
  const keys: AccountMeta[] = [
    { pubkey: buyer,               isSigner: true,  isWritable: true  },
    { pubkey: sellerTokenAccount,  isSigner: false, isWritable: false },
    { pubkey: USDC_MINT,         isSigner: false, isWritable: false },
    { pubkey: mintAddress,         isSigner: false, isWritable: false },
    { pubkey: auctionHouse,        isSigner: false, isWritable: false },
    { pubkey: authority,           isSigner: false, isWritable: false },
    { pubkey: feeAccount,          isSigner: false, isWritable: true  },
    { pubkey: escrow,              isSigner: false, isWritable: true  },
    { pubkey: buyerTradeState,     isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,  isSigner: false, isWritable: false },
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: ME_V2_PROGRAM, data });
}

function ixExecuteSale(
  buyer: PublicKey,
  seller: PublicKey,
  sellerTokenAccount: PublicKey,
  buyerTokenAccount: PublicKey,
  mintAddress: PublicKey,
  auctionHouse: PublicKey,
  authority: PublicKey,
  feeAccount: PublicKey,
  treasury: PublicKey,
  escrow: PublicKey,
  sellerTradeState: PublicKey,
  buyerTradeState: PublicKey,
  freeTradeState: PublicKey,
  freeTradeStateBump: number,
  programAsSigner: PublicKey,
  programAsSignerBump: number,
  priceLamports: bigint,
): TransactionInstruction {
  const priceBuf = Buffer.allocUnsafe(8); priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf  = Buffer.allocUnsafe(8); sizeBuf.writeBigUInt64LE(1n);
  const data = Buffer.concat([
    IX.executeSale,
    Buffer.from([freeTradeStateBump, programAsSignerBump]),
    priceBuf,
    sizeBuf,
  ]);
  const keys: AccountMeta[] = [
    { pubkey: buyer,               isSigner: false, isWritable: true  },
    { pubkey: seller,              isSigner: false, isWritable: true  },
    { pubkey: sellerTokenAccount,  isSigner: false, isWritable: true  },
    { pubkey: buyerTokenAccount,   isSigner: false, isWritable: true  },
    { pubkey: USDC_MINT,         isSigner: false, isWritable: false },
    { pubkey: mintAddress,         isSigner: false, isWritable: false },
    { pubkey: escrow,              isSigner: false, isWritable: true  },
    { pubkey: auctionHouse,        isSigner: false, isWritable: false },
    { pubkey: authority,           isSigner: false, isWritable: false },
    { pubkey: feeAccount,          isSigner: false, isWritable: true  },
    { pubkey: treasury,            isSigner: false, isWritable: true  },
    { pubkey: sellerTradeState,    isSigner: false, isWritable: true  },
    { pubkey: buyerTradeState,     isSigner: false, isWritable: true  },
    { pubkey: freeTradeState,      isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: programAsSigner,     isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,  isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: ME_V2_PROGRAM, data });
}

// --- Rail adapter ---

export class MagicEdenV2RailAdapter implements ExecutionRailAdapter {
  async getFreshQuote(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<ExecutableListing> {
    const payload = input.execution.payload as MagicEdenV2Payload;
    const conn = connection();

    // 1. Try ME listing API to resolve current auction house + price + confirm still listed.
    const meListing = await resolveMeListing(payload.mintAddress);

    let resolvedAuctionHouse = payload.auctionHouse;
    let stillActive = false;

    if (meListing) {
      resolvedAuctionHouse = meListing.auctionHouse;
      stillActive = true;
      // Update price from live ME response. CC/Phygitals priced in USDC (6 decimals).
      const liveLamports = BigInt(Math.round(meListing.price * 1_000_000));
      const updatedPayload: MagicEdenV2Payload = {
        ...payload,
        auctionHouse: resolvedAuctionHouse,
        buyerAddress: buyerWallet,
        priceLamportsOrAtomic: liveLamports.toString(),
        quoteSource: "api",
      };
      return {
        ...input,
        market: {
          ...input.market,
          priceAtomic: liveLamports.toString(),
          priceDisplay: meListing.price.toString(),
        },
        freshness: {
          quotedAt: new Date().toISOString(),
          quoteTtlSec: 30,
          stillActive: true,
        },
        execution: { ...input.execution, payload: updatedPayload },
      };
    }

    // 2. ME API unavailable or listing not found — fall back to RPC token account check.
    // This tells us if seller still holds the NFT but can't resolve the auction house.
    const mint = new PublicKey(payload.mintAddress);
    const seller = new PublicKey(payload.sellerAddress);
    const sellerATA = getAssociatedTokenAddressSync(mint, seller);
    const tokenInfo = await conn.getTokenAccountBalance(sellerATA).catch(() => null);
    stillActive = tokenInfo !== null && Number(tokenInfo.value.amount) === 1;

    return {
      ...input,
      freshness: {
        quotedAt: new Date().toISOString(),
        quoteTtlSec: 30,
        stillActive,
      },
      execution: {
        ...input.execution,
        payload: { ...payload, auctionHouse: resolvedAuctionHouse, buyerAddress: buyerWallet },
      },
    };
  }

  async validateExecutable(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<ExecutableValidation> {
    const payload = input.execution.payload as MagicEdenV2Payload;
    const reasons: string[] = [];

    if (!input.freshness.stillActive) {
      reasons.push("Listing is no longer active");
    }

    // Refuse to build a transaction with the fallback auction house — it's unconfirmed.
    if (payload.auctionHouse === ME_AUCTION_HOUSE_FALLBACK && payload.quoteSource !== "api") {
      reasons.push(
        "Auction house address not confirmed from live listing data. " +
          "Call getFreshQuote first or provide a verified purchase tx hash.",
      );
    }

    const conn = connection();
    const buyerKey = new PublicKey(buyerWallet);

    // CC/Phygitals are USDC-priced — check buyer's USDC token balance, not SOL.
    const buyerUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, buyerKey);
    let usdcBalance = 0n;
    try {
      const tokenInfo = await conn.getTokenAccountBalance(buyerUsdcAta);
      usdcBalance = BigInt(tokenInfo.value.amount);
    } catch {
      // ATA doesn't exist → zero balance
    }
    const priceAtomic = BigInt(payload.priceLamportsOrAtomic);
    if (usdcBalance < priceAtomic) {
      const have = (Number(usdcBalance) / 1_000_000).toFixed(2);
      const need = (Number(priceAtomic) / 1_000_000).toFixed(2);
      reasons.push(`Insufficient USDC: have ${have}, need ${need}`);
    }

    // Also check SOL covers network fees (~0.001 SOL)
    const solBalance = await conn.getBalance(buyerKey).catch(() => 0);
    if (solBalance < 1_000_000) {
      reasons.push(`Insufficient SOL for fees: have ${solBalance} lamports, need ~1000000`);
    }

    return {
      ok: reasons.length === 0,
      reasons,
      requiresApprovals: [],
      requiresPartnerStep: false,
    };
  }

  async buildUnsignedExecution(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<UnsignedExecutionPayload> {
    const payload = input.execution.payload as MagicEdenV2Payload;

    const auctionHouse = new PublicKey(payload.auctionHouse);
    const buyer = new PublicKey(buyerWallet);
    const seller = new PublicKey(payload.sellerAddress);
    const mint = new PublicKey(payload.mintAddress);
    const priceLamports = BigInt(payload.priceLamportsOrAtomic);

    const sellerATA = getAssociatedTokenAddressSync(mint, seller);
    const buyerATA  = getAssociatedTokenAddressSync(mint, buyer);

    const [escrow]                         = pdaEscrowPaymentAccount(auctionHouse, buyer);
    const [programAsSigner, pasBump]       = pdaProgramAsSigner();
    const [sellerTradeState]               = pdaSellerTradeState(auctionHouse, seller, sellerATA, mint, priceLamports);
    const [buyerTradeState, btsBump]       = pdaBuyerTradeState(auctionHouse, buyer, mint, priceLamports);
    const [freeTradeState, ftsBump]        = pdaFreeTradeState(auctionHouse, seller, sellerATA, mint);

    const conn = connection();
    const { authority, feeAccount, treasury } = await getAuctionHouseAccounts(conn, auctionHouse);
    const { blockhash } = await conn.getLatestBlockhash();

    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: buyer });
    tx.add(
      ixDeposit(buyer, auctionHouse, escrow, priceLamports),
      ixBuy(buyer, sellerATA, mint, auctionHouse, authority, feeAccount, escrow, buyerTradeState, btsBump, priceLamports),
      ixExecuteSale(buyer, seller, sellerATA, buyerATA, mint, auctionHouse, authority, feeAccount, treasury, escrow, sellerTradeState, buyerTradeState, freeTradeState, ftsBump, programAsSigner, pasBump, priceLamports),
    );

    return {
      chain: "solana",
      unsignedTransactionBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      programIds: [ME_V2_PROGRAM.toBase58()],
    };
  }

  async reconcile(
    txHash: string,
    _input: ExecutableListing,
  ): Promise<ExecutionResult> {
    const conn = connection();
    try {
      const result = await conn.getTransaction(txHash, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!result) return { txHash, status: "submitted", sourceListingStatus: "unknown" };
      if (result.meta?.err) return { txHash, status: "failed", sourceListingStatus: "unknown" };
      return { txHash, status: "confirmed", sourceListingStatus: "sold" };
    } catch {
      return { txHash, status: "submitted", sourceListingStatus: "unknown" };
    }
  }
}
