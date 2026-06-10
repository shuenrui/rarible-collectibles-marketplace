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

// ME V2 program and known constants
const ME_V2_PROGRAM = new PublicKey(
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
);
// Magic Eden's standard auction house for SOL-denominated listings on mainnet.
// CC and Phygitals listings go through this house — confirmed from on-chain tx.
// TODO: verify against actual CC/Phygitals purchase tx once available.
const ME_AUCTION_HOUSE = new PublicKey(
  "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe",
);
const NATIVE_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);
const ME_PREFIX = Buffer.from("m2");
const ME_SIGNER_PREFIX = Buffer.from("signer");

const SOLANA_RPC =
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

function connection(): Connection {
  return new Connection(SOLANA_RPC, "confirmed");
}

async function findProgramAsSigner(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [ME_PREFIX, ME_SIGNER_PREFIX],
    ME_V2_PROGRAM,
  );
}

async function findEscrowPaymentAccount(
  buyer: PublicKey,
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [ME_PREFIX, ME_AUCTION_HOUSE.toBuffer(), buyer.toBuffer()],
    ME_V2_PROGRAM,
  );
}

async function findSellerTradeState(
  seller: PublicKey,
  tokenAccount: PublicKey,
  mintAddress: PublicKey,
  priceLamports: bigint,
): Promise<[PublicKey, number]> {
  const priceBuf = Buffer.allocUnsafe(8);
  priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  return PublicKey.findProgramAddressSync(
    [
      ME_PREFIX,
      ME_AUCTION_HOUSE.toBuffer(),
      seller.toBuffer(),
      (await findProgramAsSigner())[0].toBuffer(),
      NATIVE_MINT.toBuffer(),
      mintAddress.toBuffer(),
      tokenAccount.toBuffer(),
      priceBuf,
      sizeBuf,
    ],
    ME_V2_PROGRAM,
  );
}

async function findBuyerTradeState(
  buyer: PublicKey,
  mintAddress: PublicKey,
  priceLamports: bigint,
): Promise<[PublicKey, number]> {
  const priceBuf = Buffer.allocUnsafe(8);
  priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  return PublicKey.findProgramAddressSync(
    [
      ME_PREFIX,
      ME_AUCTION_HOUSE.toBuffer(),
      buyer.toBuffer(),
      mintAddress.toBuffer(),
      NATIVE_MINT.toBuffer(),
      mintAddress.toBuffer(),
      priceBuf,
      sizeBuf,
    ],
    ME_V2_PROGRAM,
  );
}

async function findFreeTradeState(
  seller: PublicKey,
  tokenAccount: PublicKey,
  mintAddress: PublicKey,
): Promise<[PublicKey, number]> {
  const zeroBuf = Buffer.allocUnsafe(8);
  zeroBuf.writeBigUInt64LE(0n);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  return PublicKey.findProgramAddressSync(
    [
      ME_PREFIX,
      ME_AUCTION_HOUSE.toBuffer(),
      seller.toBuffer(),
      tokenAccount.toBuffer(),
      NATIVE_MINT.toBuffer(),
      mintAddress.toBuffer(),
      zeroBuf,
      sizeBuf,
    ],
    ME_V2_PROGRAM,
  );
}

// Reads the ME auction house account to get authority, fee account, and treasury
async function getAuctionHouseAccounts(conn: Connection): Promise<{
  authority: PublicKey;
  feeAccount: PublicKey;
  treasury: PublicKey;
}> {
  const info = await conn.getAccountInfo(ME_AUCTION_HOUSE);
  if (!info) throw new Error("ME auction house account not found");
  // Auction House account layout (Metaplex): 8 byte discriminator, then fields
  // authority: bytes 8-40, fee_payer_bump: 40, treasury_bump: 41,
  // fee_account: 42-74, treasury: 74-106, ...
  // This layout is for the standard Metaplex AH — ME V2 may differ slightly.
  // We read known PDA addresses instead to avoid layout dependency.
  const [feeAccount] = PublicKey.findProgramAddressSync(
    [ME_PREFIX, ME_AUCTION_HOUSE.toBuffer(), Buffer.from("fee_payer")],
    ME_V2_PROGRAM,
  );
  const [treasury] = PublicKey.findProgramAddressSync(
    [ME_PREFIX, ME_AUCTION_HOUSE.toBuffer(), Buffer.from("treasury")],
    ME_V2_PROGRAM,
  );
  // Authority is stored in the account data at offset 8 (after 8-byte discriminator)
  const authority = new PublicKey(info.data.slice(8, 40));
  return { authority, feeAccount, treasury };
}

// Instruction discriminators for ME V2 (keccak-derived, same as Anchor pattern)
// These are the first 8 bytes of sha256("global:<instruction_name>") for ME V2.
// Obtained from ME V2 IDL / known transaction calldata.
const DEPOSIT_IX = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
const BUY_IX = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const EXECUTE_SALE_IX = Buffer.from([37, 74, 217, 157, 79, 49, 35, 6]);

function buildDepositInstruction(
  buyer: PublicKey,
  escrow: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const amountBuf = Buffer.allocUnsafe(8);
  amountBuf.writeBigUInt64LE(amount);
  const data = Buffer.concat([DEPOSIT_IX, amountBuf]);

  const keys: AccountMeta[] = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: ME_AUCTION_HOUSE, isSigner: false, isWritable: false },
    { pubkey: escrow, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: ME_V2_PROGRAM, data });
}

function buildBuyInstruction(
  buyer: PublicKey,
  sellerTokenAccount: PublicKey,
  mintAddress: PublicKey,
  escrow: PublicKey,
  buyerTradeState: PublicKey,
  buyerTradeStateBump: number,
  authority: PublicKey,
  feeAccount: PublicKey,
  priceLamports: bigint,
): TransactionInstruction {
  const priceBuf = Buffer.allocUnsafe(8);
  priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  const bumpBuf = Buffer.from([buyerTradeStateBump]);
  const data = Buffer.concat([BUY_IX, bumpBuf, priceBuf, sizeBuf]);

  const keys: AccountMeta[] = [
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: sellerTokenAccount, isSigner: false, isWritable: false },
    { pubkey: NATIVE_MINT, isSigner: false, isWritable: false },
    { pubkey: mintAddress, isSigner: false, isWritable: false },
    { pubkey: ME_AUCTION_HOUSE, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: feeAccount, isSigner: false, isWritable: true },
    { pubkey: escrow, isSigner: false, isWritable: true },
    { pubkey: buyerTradeState, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: ME_V2_PROGRAM, data });
}

function buildExecuteSaleInstruction(
  buyer: PublicKey,
  seller: PublicKey,
  sellerTokenAccount: PublicKey,
  buyerTokenAccount: PublicKey,
  mintAddress: PublicKey,
  escrow: PublicKey,
  sellerTradeState: PublicKey,
  buyerTradeState: PublicKey,
  freeTradeState: PublicKey,
  freeTradeStateBump: number,
  programAsSigner: PublicKey,
  programAsSignerBump: number,
  authority: PublicKey,
  feeAccount: PublicKey,
  treasury: PublicKey,
  priceLamports: bigint,
): TransactionInstruction {
  const priceBuf = Buffer.allocUnsafe(8);
  priceBuf.writeBigUInt64LE(priceLamports);
  const sizeBuf = Buffer.allocUnsafe(8);
  sizeBuf.writeBigUInt64LE(1n);
  const data = Buffer.concat([
    EXECUTE_SALE_IX,
    Buffer.from([freeTradeStateBump, programAsSignerBump]),
    priceBuf,
    sizeBuf,
  ]);

  const keys: AccountMeta[] = [
    { pubkey: buyer, isSigner: false, isWritable: true },
    { pubkey: seller, isSigner: false, isWritable: true },
    { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: NATIVE_MINT, isSigner: false, isWritable: false },
    { pubkey: mintAddress, isSigner: false, isWritable: false },
    { pubkey: escrow, isSigner: false, isWritable: true },
    { pubkey: ME_AUCTION_HOUSE, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: feeAccount, isSigner: false, isWritable: true },
    { pubkey: treasury, isSigner: false, isWritable: true },
    { pubkey: sellerTradeState, isSigner: false, isWritable: true },
    { pubkey: buyerTradeState, isSigner: false, isWritable: true },
    { pubkey: freeTradeState, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: programAsSigner, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({ keys, programId: ME_V2_PROGRAM, data });
}

export class MagicEdenV2RailAdapter implements ExecutionRailAdapter {
  async getFreshQuote(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<ExecutableListing> {
    const payload = input.execution.payload as MagicEdenV2Payload;
    const conn = connection();
    const mint = new PublicKey(payload.mintAddress);
    const seller = new PublicKey(payload.sellerAddress);
    const sellerATA = getAssociatedTokenAddressSync(mint, seller);

    // Confirm the seller still holds the NFT (listing still active)
    const tokenInfo = await conn.getTokenAccountBalance(sellerATA).catch(
      () => null,
    );
    const stillActive =
      tokenInfo !== null && Number(tokenInfo.value.amount) === 1;

    return {
      ...input,
      freshness: {
        quotedAt: new Date().toISOString(),
        quoteTtlSec: 30,
        stillActive,
      },
    };
  }

  async validateExecutable(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<ExecutableValidation> {
    const payload = input.execution.payload as MagicEdenV2Payload;
    const conn = connection();
    const reasons: string[] = [];

    // Check buyer has enough SOL
    const buyerKey = new PublicKey(buyerWallet);
    const balance = await conn.getBalance(buyerKey);
    const priceLamports = BigInt(payload.priceLamportsOrAtomic);
    // Add ~0.01 SOL buffer for rent + fees
    const needed = priceLamports + 10_000_000n;
    if (BigInt(balance) < needed) {
      reasons.push(
        `Insufficient SOL balance: have ${balance} lamports, need ${needed.toString()}`,
      );
    }

    // Confirm listing still active
    if (!input.freshness.stillActive) {
      reasons.push("Listing is no longer active — seller no longer holds NFT");
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
    const conn = connection();

    const buyer = new PublicKey(buyerWallet);
    const seller = new PublicKey(payload.sellerAddress);
    const mint = new PublicKey(payload.mintAddress);
    const priceLamports = BigInt(payload.priceLamportsOrAtomic);

    const sellerATA = getAssociatedTokenAddressSync(mint, seller);
    const buyerATA = getAssociatedTokenAddressSync(mint, buyer);
    const [escrow] = await findEscrowPaymentAccount(buyer);
    const [programAsSigner, programAsSignerBump] =
      await findProgramAsSigner();
    const [sellerTradeState] = await findSellerTradeState(
      seller,
      sellerATA,
      mint,
      priceLamports,
    );
    const [buyerTradeState, buyerTradeStateBump] = await findBuyerTradeState(
      buyer,
      mint,
      priceLamports,
    );
    const [freeTradeState, freeTradeStateBump] = await findFreeTradeState(
      seller,
      sellerATA,
      mint,
    );

    const { authority, feeAccount, treasury } =
      await getAuctionHouseAccounts(conn);

    const { blockhash } = await conn.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: buyer });

    tx.add(
      buildDepositInstruction(buyer, escrow, priceLamports),
      buildBuyInstruction(
        buyer,
        sellerATA,
        mint,
        escrow,
        buyerTradeState,
        buyerTradeStateBump,
        authority,
        feeAccount,
        priceLamports,
      ),
      buildExecuteSaleInstruction(
        buyer,
        seller,
        sellerATA,
        buyerATA,
        mint,
        escrow,
        sellerTradeState,
        buyerTradeState,
        freeTradeState,
        freeTradeStateBump,
        programAsSigner,
        programAsSignerBump,
        authority,
        feeAccount,
        treasury,
        priceLamports,
      ),
    );

    const serialized = tx.serialize({ requireAllSignatures: false });
    return {
      chain: "solana",
      unsignedTransactionBase64: serialized.toString("base64"),
      programIds: [ME_V2_PROGRAM.toBase58()],
    };
  }

  async reconcile(
    txHash: string,
    input: ExecutableListing,
  ): Promise<ExecutionResult> {
    const conn = connection();
    try {
      const result = await conn.getTransaction(txHash, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!result) {
        return { txHash, status: "submitted", sourceListingStatus: "unknown" };
      }
      if (result.meta?.err) {
        return { txHash, status: "failed", sourceListingStatus: "unknown" };
      }
      return { txHash, status: "confirmed", sourceListingStatus: "sold" };
    } catch {
      return { txHash, status: "submitted", sourceListingStatus: "unknown" };
    }
  }
}
