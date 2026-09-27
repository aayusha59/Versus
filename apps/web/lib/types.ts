/**
 * Web-side mirror of `packages/sdk/src/types.ts` (PLAN section 3).
 * The SDK is built by another agent; these types are kept structurally
 * compatible so the devnet adapter can map SDK objects onto them.
 */

export type Side = "a" | "b";

export type Network = "demo" | "devnet" | "localnet";

export interface Odds {
  /** Probability-like price of the left (YES) side, 0..1, normalized to sum to 1 with `b`. */
  a: number;
  /** Probability-like price of the right (NO) side, 0..1. */
  b: number;
  /** Raw sum of the two pool prices before normalization. >1 means the pair trades at a premium. */
  impliedSum: number;
}

export type AssetKind = "stock" | "crypto" | "etf" | "commodity";

export type Template =
  | {
      kind: "CapCompare";
      feedA: string;
      feedB: string;
      sharesA: number;
      sharesB: number;
    }
  | {
      kind: "RatioOutperform";
      feedA: string;
      feedB: string;
      /** price_a / price_b at market creation */
      startRatio: number;
    }
  | {
      kind: "PriceAbove";
      feed: string;
      threshold: number;
    };

export type TemplateKind = Template["kind"];

export interface Fighter {
  /** Short, printable name: "Apple" */
  label: string;
  /** Ticker in the registry: "AAPL" */
  symbol: string;
  /** Pair token symbol the side is paid in: "AAPLx" */
  pairSymbol: string;
  pairMint: string;
  /** Pyth feed name for display: "AAPL/USD" */
  feedName: string;
  feedId: string;
  price: number;
  marketCap: number;
  sharesOutstanding: number | null;
  change30d: number;
  holders: number;
  /** Total fees paid out to the holders of this side, in pair token units. */
  feesPaid: number;
}

export type MarketStatus =
  | { kind: "open" }
  | {
      kind: "resolved";
      winner: Side;
      priceA: number;
      priceB: number;
      resolvedTs: number;
      closingOdds: Odds;
      /** True when `resolve_manual` was used after the grace period. */
      manual: boolean;
    };

export interface Market {
  id: string;
  /** Sequential number on the board, for "No. 01" kickers. */
  no: number;
  network: Network;
  creator: string;
  question: string;
  a: Fighter;
  b: Fighter;
  collateralMint: string;
  yesMint: string;
  noMint: string;
  poolA: string | null;
  poolB: string | null;
  template: Template;
  createdTs: number;
  resolveTs: number;
  graceSecs: number;
  resolver: string;
  crank: string;
  feeBpsHolders: number;
  feeBpsCreator: number;
  feeBpsPlatform: number;
  status: MarketStatus;
  totalMinted: number;
  totalRedeemed: number;
  rewardsPaidA: number;
  rewardsPaidB: number;
  epochs: number;
  odds: Odds;
  /** Unix ms of the last odds change, for the "updated" line on the board. */
  oddsUpdatedAt: number;
  /** USD-denominated depth of each outcome pool, used for price-impact previews. */
  depthUsd: number;
}

export interface Position {
  marketId: string;
  owner: string;
  side: Side;
  /** Outcome tokens held (6 dp on chain, whole units here). */
  size: number;
  /** USDC spent, net of sells. */
  cost: number;
  /** Current mark value in USDC at the live odds. */
  value: number;
  /** Pair-token rewards received so far (already in the wallet). */
  earnedPair: number;
  /** Pair-token rewards accrued this epoch, not yet cranked. */
  claimablePair: number;
  /** USDC redeemable after resolution if this side won. */
  redeemableUsdc: number;
}

export interface RewardEpoch {
  marketId: string;
  epoch: number;
  side: Side;
  /** Unix ms */
  ts: number;
  amountPair: number;
  holders: number;
  signature: string;
}

export interface DeploymentMarket {
  id: string;
  yesMint: string;
  noMint: string;
  poolA: string;
  poolB: string;
}

export interface Deployment {
  network: "devnet" | "localnet";
  programId: string;
  rpcUrl: string;
  collateralMint: string;
  mocks: Record<string, string>;
  markets: DeploymentMarket[];
}

export interface BetPreview {
  outcomeOut: number;
  pairIn: number;
  feeInPair: number;
  oddsAfter: Odds;
  priceImpactBps: number;
}

export interface SellPreview {
  usdcOut: number;
  pairOut: number;
  feeInPair: number;
  oddsAfter: Odds;
  priceImpactBps: number;
}

export interface CreateMarketParams {
  template: Template;
  question: string;
  a: { symbol: string; label: string };
  b: { symbol: string; label: string } | null;
  resolveTs: number;
  seedUsdc: number;
  feeBps: number;
  creator: string;
}

export interface TxResult {
  signature: string;
}
