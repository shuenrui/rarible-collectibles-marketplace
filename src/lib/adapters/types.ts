export type AdapterCheckpoint = {
  chainId: number;
  lastProcessedBlock: bigint;
  updatedAt: string;
};

export type ListingImage = {
  url: string;
  type: "front" | "back" | "slab" | "other";
};

export type NormalizedListingUpsert = {
  sourcePlatform: "courtyard" | "beezie" | "phygitals" | "collector_crypt" | "renaiss" | "other";
  sourceListingId: string;
  sourceItemId?: string;
  sourceUrl: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  images?: ListingImage[];
  categoryL1: "pokemon" | "sports_cards" | "one_piece" | "yugioh" | "comics" | "sealed_products" | "other";
  categoryL2?: string;
  franchise?: string;
  setName?: string;
  cardNumber?: string;
  year?: number;
  conditionType: "graded" | "raw" | "sealed" | "unknown";
  grader: "psa" | "bgs" | "cgc" | "sgc" | "fanatics" | "alt" | "other" | "none";
  gradeValue?: string;
  gradeNormalized?: "psa10" | "psa9" | "psa8" | "bgs10" | "bgs95" | "cgc10" | "raw" | "sealed" | "other";
  gradeLabelRaw?: string;
  listingType: "fixed_price" | "auction" | "offer";
  priceAmount: string;
  priceCurrency: string;
  priceUsd?: string;
  lastPriceUpdateAt: string;
  chainId: number;
  contractAddress: string;
  tokenId: string;
  tokenStandard: "erc721" | "erc1155" | "spl" | "other";
  vaulted: boolean;
  redeemable: boolean;
  authProvider?: string;
  listingStatus: "active" | "sold" | "cancelled" | "expired" | "unknown";
  listedAt?: string;
  soldAt?: string;
  sellerAddress?: string;
  sellerHandle?: string;
  sellerVerified: boolean;
  syncConfidence: number;
  dataQualityFlags?: Record<string, unknown>;
  rawSourcePayload: Record<string, unknown>;
  syncedAt: string;
};

export type AdapterOutput = {
  upserts: NormalizedListingUpsert[];
  tombstones: string[];
  errors: Array<{ sourceId?: string; message: string }>;
  checkpoint: AdapterCheckpoint;
};
