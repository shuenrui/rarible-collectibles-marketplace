// Execution adapter types — implements @Codex's ExecutableListing interface design
// from #rarible-marketplace:e5349a8f (2026-06-10)

export type ChainKind = "evm" | "solana";

export type ListingSource =
  | "collector_crypt"
  | "phygitals"
  | "courtyard"
  | "beezie"
  | "renaiss";

export type ExecutionRail =
  | "magic_eden_v2"
  | "tensor"
  | "beezie_router"
  | "courtyard_book"
  | "source_proprietary";

export type ExecutableListing = {
  listingId: string;
  source: ListingSource;
  rail: ExecutionRail;
  chain: ChainKind;
  chainId: number;

  asset: {
    contractAddress?: string;
    tokenId?: string;
    mintAddress?: string;
    collectionAddress?: string;
  };

  market: {
    sellerAddress?: string;
    settlementTokenAddress?: string;
    settlementSymbol?: string;
    priceAtomic: string;
    priceDisplay: string;
    currencyDecimals: number;
    expiresAt?: string;
  };

  freshness: {
    quotedAt: string;
    quoteTtlSec?: number;
    stillActive: boolean;
  };

  execution: {
    model: "api_quoted" | "contract_derived" | "partner_signed";
    payload: RailExecutionPayload;
    approvals?: ApprovalRequirement[];
    signaturesRequired: SignatureRequirement[];
  };
};

export type ApprovalRequirement = {
  tokenAddress: string;
  spender: string;
  amountAtomic?: string;
  standard: "erc20" | "erc721" | "erc1155" | "spl";
};

export type SignatureRequirement = {
  actor: "buyer" | "seller" | "partner";
  type: "eip712" | "permit" | "wallet_tx" | "server_side";
  required: boolean;
  note?: string;
};

// --- Rail-specific payloads ---

export type MagicEdenV2Payload = {
  rail: "magic_eden_v2";
  auctionHouse: string;
  mintAddress: string;
  sellerAddress: string;
  buyerAddress?: string;
  priceLamportsOrAtomic: string;
  quoteSource: "sdk" | "api";
  unsignedTransactionBase64?: string;
  programIds: string[];
};

export type BeezieRouterPayload = {
  rail: "beezie_router";
  routerAddress: string;
  paymentToken: string;
  bid: {
    bidder: string;
    recipient: string;
    salt: string;
    bidAmount: string;
    expiration: string;
    collection: string;
    tokenId: string;
  };
  orderSource: "api" | "reconstructed";
  basicOrderParameters?: unknown;
  calldataPreview?: string;
};

export type CourtyardBookPayload = {
  rail: "courtyard_book";
  orderbookAddress: string;
  usdcAddress: string;
  registryAddress: string;
  tradeSource: "api" | "partner_api";
  bid?: unknown;
  ask?: unknown;
  trade?: unknown;
  requiresPartnerSignature: boolean;
};

export type RailExecutionPayload =
  | MagicEdenV2Payload
  | BeezieRouterPayload
  | CourtyardBookPayload;

// --- Adapter interfaces ---

export interface ListingSourceAdapter {
  getExecutableListing(
    listingId: string,
    buyerWallet?: string,
  ): Promise<ExecutableListing>;
}

export interface ExecutionRailAdapter {
  getFreshQuote(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<ExecutableListing>;
  validateExecutable(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<ExecutableValidation>;
  buildUnsignedExecution(
    input: ExecutableListing,
    buyerWallet: string,
  ): Promise<UnsignedExecutionPayload>;
  reconcile(txHash: string, input: ExecutableListing): Promise<ExecutionResult>;
}

export type ExecutableValidation = {
  ok: boolean;
  reasons: string[];
  requiresApprovals: ApprovalRequirement[];
  requiresPartnerStep: boolean;
};

export type UnsignedExecutionPayload =
  | {
      chain: "evm";
      to: string;
      data: string;
      value: string;
      approvals?: ApprovalRequirement[];
    }
  | {
      chain: "solana";
      unsignedTransactionBase64: string;
      programIds: string[];
    };

export type ExecutionResult = {
  txHash: string;
  status: "submitted" | "confirmed" | "failed";
  sourceListingStatus?: "active" | "sold" | "cancelled" | "unknown";
};
