import { ComputeBudgetProgram, Connection, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { oddsFromPools, oddsFromSqrtPrices, poolPriceAInB } from "./odds.js";
import { buildSwapIx, getPoolStates, quoteSwap, toBN, type PoolState } from "./pools.js";
import { findMarket } from "./deployments.js";
import type { DeployedMarket, Deployment, Odds, Side } from "./types.js";

/**
 * Bet routing. A bet on YES is two swaps in one transaction:
 *   USDC -> pair A   on the pair A / USDC pool
 *   pair A -> YES    on the YES / pair A pool
 * A sell is the reverse. The second leg's input is the *minimum* output of the first leg, so the
 * transaction can never fail for lack of balance; any pair tokens received above that minimum
 * stay in the bettor's pair-token account (a few bps of dust at most).
 */

export interface MarketRouting {
  market: DeployedMarket;
  usdcMint: PublicKey;
  usdcDecimals: number;
  yesMint: PublicKey;
  noMint: PublicKey;
  pairAMint: PublicKey;
  pairBMint: PublicKey;
  pairADecimals: number;
  pairBDecimals: number;
  /** pair A / USDC pool (token A = pair, token B = USDC). */
  pairPoolA: PublicKey;
  pairPoolB: PublicKey;
  /** YES / pair A pool (token A = YES, token B = pair A). */
  poolA: PublicKey;
  /** NO / pair B pool. */
  poolB: PublicKey;
}

export function routingFromDeployment(dep: Deployment, market: DeployedMarket | string): MarketRouting {
  const m = typeof market === "string" ? findMarket(dep, market) : market;
  if (!m) throw new Error(`market ${String(market)} not in deployment`);
  if (!m.poolA || !m.poolB) throw new Error(`market ${m.address} has no outcome pools yet`);
  const usdc = dep.mints.USDC;
  const pa = dep.mints[m.pairA];
  const pb = dep.mints[m.pairB];
  const ppa = dep.pairPools[m.pairA];
  const ppb = dep.pairPools[m.pairB];
  if (!usdc || !pa || !pb) throw new Error(`deployment is missing mints for ${m.pairA}/${m.pairB}/USDC`);
  if (!ppa || !ppb) throw new Error(`deployment is missing USDC pools for ${m.pairA}/${m.pairB}`);
  return {
    market: m,
    usdcMint: new PublicKey(usdc.mint),
    usdcDecimals: usdc.decimals,
    yesMint: new PublicKey(m.yesMint),
    noMint: new PublicKey(m.noMint),
    pairAMint: new PublicKey(pa.mint),
    pairBMint: new PublicKey(pb.mint),
    pairADecimals: pa.decimals,
    pairBDecimals: pb.decimals,
    pairPoolA: new PublicKey(ppa.pool),
    pairPoolB: new PublicKey(ppb.pool),
    poolA: new PublicKey(m.poolA.pool),
    poolB: new PublicKey(m.poolB.pool),
  };
}

export interface MarketPools {
  poolA: PoolState;
  poolB: PoolState;
  pairPoolA: PoolState;
  pairPoolB: PoolState;
  /** USD price of pair A / B, from the USDC pools unless overridden (mainnet: Pyth). */
  pairAUsd: number;
  pairBUsd: number;
  odds: Odds;
}

/** Fetch all four pools of a market and derive pair USD prices and current odds. */
export async function loadMarketPools(
  connection: Connection,
  r: MarketRouting,
  pairUsdOverride?: { a: number; b: number },
): Promise<MarketPools> {
  const [poolA, poolB, pairPoolA, pairPoolB] = await getPoolStates(connection, [r.poolA, r.poolB, r.pairPoolA, r.pairPoolB]);
  return marketPoolsFromStates(r, { poolA, poolB, pairPoolA, pairPoolB }, pairUsdOverride);
}

/** Same as `loadMarketPools` with states already fetched (e.g. one batched call for every market). */
export function marketPoolsFromStates(
  r: MarketRouting,
  s: { poolA: PoolState; poolB: PoolState; pairPoolA: PoolState; pairPoolB: PoolState },
  pairUsdOverride?: { a: number; b: number },
): MarketPools {
  const pairAUsd = pairUsdOverride?.a ?? pairUsdFromPool(s.pairPoolA, r.pairAMint, r.pairADecimals, r.usdcDecimals);
  const pairBUsd = pairUsdOverride?.b ?? pairUsdFromPool(s.pairPoolB, r.pairBMint, r.pairBDecimals, r.usdcDecimals);
  const odds = oddsFromPools(s.poolA, s.poolB, pairAUsd, pairBUsd, { pairA: r.pairADecimals, pairB: r.pairBDecimals });
  return { ...s, pairAUsd, pairBUsd, odds };
}

/** USD price of `pairMint` from its USDC pool, whichever side it sits on. */
export function pairUsdFromPool(pool: PoolState, pairMint: PublicKey, pairDecimals: number, usdcDecimals: number): number {
  if (pool.tokenAMint.equals(pairMint)) return poolPriceAInB(pool, pairDecimals, usdcDecimals);
  if (pool.tokenBMint.equals(pairMint)) return 1 / poolPriceAInB(pool, usdcDecimals, pairDecimals);
  throw new Error(`pair mint ${pairMint.toBase58()} is not in its USDC pool`);
}

function sideOf(r: MarketRouting, side: Side) {
  return side === "yes"
    ? { outcomeMint: r.yesMint, pairMint: r.pairAMint, pairPool: r.pairPoolA, outcomePool: r.poolA, pairDecimals: r.pairADecimals }
    : { outcomeMint: r.noMint, pairMint: r.pairBMint, pairPool: r.pairPoolB, outcomePool: r.poolB, pairDecimals: r.pairBDecimals };
}

export interface BetParams {
  connection: Connection;
  routing: MarketRouting;
  side: Side;
  /** Raw USDC amount (6 dp). */
  usdcAmount: bigint | BN;
  /** Slippage per leg in bps (default 100). */
  slippageBps?: number;
  /** Already-fetched pool states (saves RPC calls; `previewBet` fetches otherwise). */
  pools?: MarketPools;
  /** Override pair USD prices (mainnet: from Pyth). */
  pairUsd?: { a: number; b: number };
}

export interface BetPreview {
  side: Side;
  usdcIn: BN;
  /** Pair tokens bought with the USDC (expected). */
  pairOut: BN;
  /** Pair tokens actually routed into the outcome pool (minimum of leg 1). */
  pairIn: BN;
  outcomeOut: BN;
  minOutcomeOut: BN;
  /** Fee taken by the outcome pool, in pair-token units (this is what holders later receive). */
  feePaidInPair: BN;
  /** Fee taken by the USDC pool, in USDC. */
  feePaidInUsdc: BN;
  oddsBefore: Odds;
  oddsAfter: Odds;
  /** Price impact on the outcome pool, bps. */
  priceImpactBps: number;
  /** Effective USD paid per outcome token (usdcIn / outcomeOut). */
  avgPriceUsd: number;
  pairUsd: number;
}

export async function previewBet(p: BetParams): Promise<BetPreview> {
  const r = p.routing;
  const pools = p.pools ?? (await loadMarketPools(p.connection, r, p.pairUsd));
  const s = sideOf(r, p.side);
  const slippageBps = p.slippageBps ?? 100;
  const usdcIn = toBN(p.usdcAmount);

  const leg1 = await quoteSwap(
    p.connection,
    { address: s.pairPool, state: p.side === "yes" ? pools.pairPoolA : pools.pairPoolB },
    r.usdcMint,
    usdcIn,
    slippageBps,
  );
  const pairIn = leg1.minAmountOut;
  const leg2 = await quoteSwap(
    p.connection,
    { address: s.outcomePool, state: p.side === "yes" ? pools.poolA : pools.poolB },
    s.pairMint,
    pairIn,
    slippageBps,
  );

  const oddsAfter =
    p.side === "yes"
      ? oddsFromSqrtPrices(leg2.nextSqrtPrice, pools.poolB.sqrtPrice, pools.pairAUsd, pools.pairBUsd, { pairA: r.pairADecimals, pairB: r.pairBDecimals })
      : oddsFromSqrtPrices(pools.poolA.sqrtPrice, leg2.nextSqrtPrice, pools.pairAUsd, pools.pairBUsd, { pairA: r.pairADecimals, pairB: r.pairBDecimals });

  const pairUsd = p.side === "yes" ? pools.pairAUsd : pools.pairBUsd;
  const outcomeOutNum = Number(leg2.amountOut.toString()) / 1e6;
  const usdcNum = Number(usdcIn.toString()) / 10 ** r.usdcDecimals;
  return {
    side: p.side,
    usdcIn,
    pairOut: leg1.amountOut,
    pairIn,
    outcomeOut: leg2.amountOut,
    minOutcomeOut: leg2.minAmountOut,
    feePaidInPair: leg2.fee,
    feePaidInUsdc: leg1.fee,
    oddsBefore: pools.odds,
    oddsAfter,
    priceImpactBps: leg2.priceImpactBps,
    avgPriceUsd: outcomeOutNum > 0 ? usdcNum / outcomeOutNum : 0,
    pairUsd,
  };
}

export interface TxOptions {
  payer: PublicKey;
  computeUnits?: number;
  priorityFeeMicroLamports?: number;
  /** Set `recentBlockhash` (default true). */
  withBlockhash?: boolean;
}

async function assemble(connection: Connection, o: TxOptions, ixs: Parameters<Transaction["add"]>): Promise<Transaction> {
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: o.computeUnits ?? 400_000 }));
  if (o.priorityFeeMicroLamports) tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: o.priorityFeeMicroLamports }));
  tx.add(...ixs);
  tx.feePayer = o.payer;
  if (o.withBlockhash !== false) tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  return tx;
}

/** USDC -> pair -> outcome, two swaps plus a compute budget instruction, in one transaction. */
export async function buildBetTx(p: BetParams & TxOptions): Promise<{ tx: Transaction; preview: BetPreview }> {
  const r = p.routing;
  const s = sideOf(r, p.side);
  const preview = await previewBet(p);
  const pools = p.pools ?? undefined;
  const leg1 = await buildSwapIx({
    connection: p.connection,
    payer: p.payer,
    pool: s.pairPool,
    poolState: pools ? (p.side === "yes" ? pools.pairPoolA : pools.pairPoolB) : undefined,
    inputMint: r.usdcMint,
    outputMint: s.pairMint,
    amountIn: preview.usdcIn,
    minAmountOut: preview.pairIn,
  });
  const leg2 = await buildSwapIx({
    connection: p.connection,
    payer: p.payer,
    pool: s.outcomePool,
    poolState: pools ? (p.side === "yes" ? pools.poolA : pools.poolB) : undefined,
    inputMint: s.pairMint,
    outputMint: s.outcomeMint,
    amountIn: preview.pairIn,
    minAmountOut: preview.minOutcomeOut,
  });
  const tx = await assemble(p.connection, p, [...leg1, ...leg2]);
  return { tx, preview };
}

export interface SellParams {
  connection: Connection;
  routing: MarketRouting;
  side: Side;
  /** Raw outcome-token amount (6 dp). */
  outcomeAmount: bigint | BN;
  slippageBps?: number;
  pools?: MarketPools;
  pairUsd?: { a: number; b: number };
}

export interface SellPreview {
  side: Side;
  outcomeIn: BN;
  pairOut: BN;
  pairIn: BN;
  usdcOut: BN;
  minUsdcOut: BN;
  feePaidInPair: BN;
  feePaidInUsdc: BN;
  oddsBefore: Odds;
  oddsAfter: Odds;
  priceImpactBps: number;
  avgPriceUsd: number;
}

export async function previewSell(p: SellParams): Promise<SellPreview> {
  const r = p.routing;
  const pools = p.pools ?? (await loadMarketPools(p.connection, r, p.pairUsd));
  const s = sideOf(r, p.side);
  const slippageBps = p.slippageBps ?? 100;
  const outcomeIn = toBN(p.outcomeAmount);

  const leg1 = await quoteSwap(
    p.connection,
    { address: s.outcomePool, state: p.side === "yes" ? pools.poolA : pools.poolB },
    s.outcomeMint,
    outcomeIn,
    slippageBps,
  );
  const pairIn = leg1.minAmountOut;
  const leg2 = await quoteSwap(
    p.connection,
    { address: s.pairPool, state: p.side === "yes" ? pools.pairPoolA : pools.pairPoolB },
    s.pairMint,
    pairIn,
    slippageBps,
  );
  const oddsAfter =
    p.side === "yes"
      ? oddsFromSqrtPrices(leg1.nextSqrtPrice, pools.poolB.sqrtPrice, pools.pairAUsd, pools.pairBUsd, { pairA: r.pairADecimals, pairB: r.pairBDecimals })
      : oddsFromSqrtPrices(pools.poolA.sqrtPrice, leg1.nextSqrtPrice, pools.pairAUsd, pools.pairBUsd, { pairA: r.pairADecimals, pairB: r.pairBDecimals });
  const usdcNum = Number(leg2.amountOut.toString()) / 10 ** r.usdcDecimals;
  const outNum = Number(outcomeIn.toString()) / 1e6;
  return {
    side: p.side,
    outcomeIn,
    pairOut: leg1.amountOut,
    pairIn,
    usdcOut: leg2.amountOut,
    minUsdcOut: leg2.minAmountOut,
    feePaidInPair: leg1.fee,
    feePaidInUsdc: leg2.fee,
    oddsBefore: pools.odds,
    oddsAfter,
    priceImpactBps: leg1.priceImpactBps,
    avgPriceUsd: outNum > 0 ? usdcNum / outNum : 0,
  };
}

/** outcome -> pair -> USDC. */
export async function buildSellTx(p: SellParams & TxOptions): Promise<{ tx: Transaction; preview: SellPreview }> {
  const r = p.routing;
  const s = sideOf(r, p.side);
  const preview = await previewSell(p);
  const pools = p.pools ?? undefined;
  const leg1 = await buildSwapIx({
    connection: p.connection,
    payer: p.payer,
    pool: s.outcomePool,
    poolState: pools ? (p.side === "yes" ? pools.poolA : pools.poolB) : undefined,
    inputMint: s.outcomeMint,
    outputMint: s.pairMint,
    amountIn: preview.outcomeIn,
    minAmountOut: preview.pairIn,
  });
  const leg2 = await buildSwapIx({
    connection: p.connection,
    payer: p.payer,
    pool: s.pairPool,
    poolState: pools ? (p.side === "yes" ? pools.pairPoolA : pools.pairPoolB) : undefined,
    inputMint: s.pairMint,
    outputMint: r.usdcMint,
    amountIn: preview.pairIn,
    minAmountOut: preview.minUsdcOut,
  });
  const tx = await assemble(p.connection, p, [...leg1, ...leg2]);
  return { tx, preview };
}
