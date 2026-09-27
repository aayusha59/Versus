import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/** Which outcome token. Side A of a market is YES, side B is NO. */
export type Side = "yes" | "no";

export type Cluster = "localnet" | "devnet" | "mainnet";

export type AssetKind = "stock" | "crypto";

/**
 * Minimal wallet interface (structurally identical to Anchor's `Wallet`),
 * so browser wallet adapters and Node keypair wallets both fit.
 */
export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

/** Decoded resolution template (mirrors the on-chain `ResolutionTemplate` enum, PLAN section 2). */
export type Template =
  | {
      kind: "capCompare";
      /** Pyth feed id, 32-byte hex without 0x. */
      feedA: string;
      feedB: string;
      /** Shares outstanding, whole shares. YES if priceA*sharesA > priceB*sharesB. */
      sharesA: bigint;
      sharesB: bigint;
    }
  | {
      kind: "ratioOutperform";
      feedA: string;
      feedB: string;
      /** (priceA/priceB) at creation, scaled by 1e9. YES if the ratio at resolve is above it. */
      startRatioE9: bigint;
    }
  | {
      kind: "priceAbove";
      feed: string;
      /** USD threshold scaled by 1e6. */
      thresholdE6: bigint;
    };

export type MarketStatus =
  | { kind: "open" }
  | { kind: "resolved"; winner: Side; priceA: bigint; priceB: bigint; resolvedTs: number };

/** Decoded `Market` account. */
export interface Market {
  address: PublicKey;
  creator: PublicKey;
  nonce: bigint;
  bump: number;
  question: string;
  sideALabel: string;
  sideBLabel: string;
  collateralMint: PublicKey;
  collateralVault: PublicKey;
  yesMint: PublicKey;
  noMint: PublicKey;
  pairAMint: PublicKey;
  pairBMint: PublicKey;
  rewardVaultA: PublicKey;
  rewardVaultB: PublicKey;
  template: Template;
  resolveTs: number;
  graceSecs: number;
  resolver: PublicKey;
  crank: PublicKey;
  feeBpsHolders: number;
  feeBpsCreator: number;
  feeBpsPlatform: number;
  status: MarketStatus;
  /** Meteora pool addresses; `PublicKey.default` until `set_pools` has run. */
  poolA: PublicKey;
  poolB: PublicKey;
  totalMinted: bigint;
  totalRedeemed: bigint;
  rewardsPaidA: bigint;
  rewardsPaidB: bigint;
  epochs: number;
}

/** Displayed odds. `yes + no === 1`; `impliedSum` is the un-normalised sum and drifts around 1. */
export interface Odds {
  yes: number;
  no: number;
  /** Raw P(yes) in dollars = price of YES in pair A units * pair A USD price. */
  yesRaw: number;
  noRaw: number;
  /** yesRaw + noRaw. Above 1 means the two pools together price the set above its $1 redemption. */
  impliedSum: number;
}

export interface Position {
  market: PublicKey;
  side: Side;
  mint: PublicKey;
  tokenAccount: PublicKey;
  /** Raw token amount (6 decimals). */
  amount: bigint;
}

export interface RewardEpoch {
  market: PublicKey;
  side: Side;
  epoch: number;
  /** Raw pair-token amount paid out in this epoch. */
  total: bigint;
  /** Number of recipients paid. */
  count: number;
  signatures: string[];
  ts: number;
  /**
   * Per-recipient payouts decoded from the distribute transaction's token-balance deltas
   * (every positive pair-token delta not owned by the market PDA). Lets a client sum what one
   * wallet earned without an indexer.
   */
  recipients: RewardRecipient[];
}

export interface RewardRecipient {
  owner: PublicKey;
  tokenAccount: PublicKey;
  /** Raw pair-token amount received in this epoch. */
  amount: bigint;
}

/* ---------- Deployment JSON (string-encoded keys so the web app can import it) ---------- */

export interface DeployedMint {
  symbol: string;
  mint: string;
  decimals: number;
}

export interface DeployedPool {
  pool: string;
  /** Position account of the operator's initial LP position. */
  position: string;
  /** Mint of the position NFT (its ATA under the operator is `positionNftAccount`). */
  positionNft: string;
  positionNftAccount: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenAVault: string;
  tokenBVault: string;
}

/** A pair-token/USDC pool. Token A is the pair token, token B is USDC, so the pool price is the USD price. */
export interface DeployedPairPool extends DeployedPool {
  symbol: string;
  /** Seed price used at bootstrap (devnet only; mainnet reads Pyth). */
  seedPriceUsd: number;
}

export type TemplateJson =
  | { kind: "capCompare"; feedA: string; feedB: string; sharesA: string; sharesB: string }
  | { kind: "ratioOutperform"; feedA: string; feedB: string; startRatioE9: string }
  | { kind: "priceAbove"; feed: string; thresholdE6: string };

export interface DeployedMarket {
  address: string;
  nonce: string;
  creator: string;
  question: string;
  sideALabel: string;
  sideBLabel: string;
  /** Registry symbols, e.g. "AAPL" and "NVDA". */
  pairA: string;
  pairB: string;
  collateralMint: string;
  yesMint: string;
  noMint: string;
  /** YES / pairA pool (token A = YES, token B = pairA; fees accrue in pairA). */
  poolA: DeployedPool | null;
  /** NO / pairB pool (token A = NO, token B = pairB; fees accrue in pairB). */
  poolB: DeployedPool | null;
  poolsSet: boolean;
  template: TemplateJson;
  resolveTs: number;
  graceSecs: number;
}

export interface PoolConfig {
  /** Flat base fee in bps on every pool. */
  feeBps: number;
  /** Meteora `CollectFeeMode`: 0 BothToken, 1 OnlyB (quote only), 2 Compounding. We use 1. */
  collectFeeMode: number;
}

export interface Deployment {
  cluster: Cluster;
  rpcUrl: string;
  programId: string;
  operator: string;
  createdAt: string;
  updatedAt: string;
  poolConfig: PoolConfig;
  /** Keyed by registry symbol ("USDC", "AAPL", ...). */
  mints: Record<string, DeployedMint>;
  /** Keyed by pair symbol ("AAPL", ...). */
  pairPools: Record<string, DeployedPairPool>;
  markets: DeployedMarket[];
}
