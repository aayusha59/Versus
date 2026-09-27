import type BN from "bn.js";
import type { PoolState } from "@meteora-ag/cp-amm-sdk";
import type { PublicKey } from "@solana/web3.js";
import type { Odds } from "./types.js";

const TWO_POW_64 = 2 ** 64;

/**
 * Convert a Meteora Q64 sqrt price to a plain number: price of token A in units of token B
 * (how many B per one A, in natural units).
 * Formula (from cp-amm `getPriceFromSqrtPrice`): (sqrtPrice / 2^64)^2 * 10^(decA - decB).
 * Double precision is plenty for display and odds.
 */
export function priceFromSqrtPrice(sqrtPrice: BN, tokenADecimals: number, tokenBDecimals: number): number {
  const s = Number(sqrtPrice.toString()) / TWO_POW_64;
  return s * s * 10 ** (tokenADecimals - tokenBDecimals);
}

/** Price of token A in token B for a pool. */
export function poolPriceAInB(pool: PoolState, tokenADecimals: number, tokenBDecimals: number): number {
  return priceFromSqrtPrice(pool.sqrtPrice, tokenADecimals, tokenBDecimals);
}

/**
 * Price of `mint` in terms of the other token of the pool, whichever side it sits on.
 * Throws if the mint is not in the pool.
 */
export function poolPriceOf(
  pool: PoolState,
  mint: PublicKey,
  decimals: { tokenA: number; tokenB: number },
): number {
  const aInB = poolPriceAInB(pool, decimals.tokenA, decimals.tokenB);
  if (pool.tokenAMint.equals(mint)) return aInB;
  if (pool.tokenBMint.equals(mint)) return 1 / aInB;
  throw new Error(`mint ${mint.toBase58()} is not in pool`);
}

/**
 * Odds from the two outcome pools.
 *
 * @param yesPriceInA price of one YES in pair-A units (pool A: token A = YES, token B = pair A)
 * @param noPriceInB  price of one NO in pair-B units
 * @param pairAUsd    USD price of pair A (from the USDC/pair pool on devnet, Pyth on mainnet)
 * @param pairBUsd    USD price of pair B
 *
 * yesRaw = yesPriceInA * pairAUsd is what one YES costs in dollars; a fully arbitraged market
 * has yesRaw + noRaw = 1 because a YES+NO set redeems for exactly $1. The displayed pair is
 * normalised to sum to 1; `impliedSum` is the raw sum and its drift from 1 is a UI stat.
 */
export function oddsFromPrices(params: {
  yesPriceInA: number;
  noPriceInB: number;
  pairAUsd: number;
  pairBUsd: number;
}): Odds {
  const yesRaw = params.yesPriceInA * params.pairAUsd;
  const noRaw = params.noPriceInB * params.pairBUsd;
  const impliedSum = yesRaw + noRaw;
  if (!(impliedSum > 0) || !Number.isFinite(impliedSum)) {
    return { yes: 0.5, no: 0.5, yesRaw, noRaw, impliedSum };
  }
  const yes = yesRaw / impliedSum;
  return { yes, no: 1 - yes, yesRaw, noRaw, impliedSum };
}

/**
 * `oddsFromPools(poolA, poolB, pairAUsd, pairBUsd)`; outcome mints and pair mints are all 6 decimals
 * on devnet, but pass `decimals` for mainnet pairs (xStocks are 8 dp).
 */
export function oddsFromPools(
  poolA: PoolState,
  poolB: PoolState,
  pairAUsd: number,
  pairBUsd: number,
  decimals: { yes?: number; no?: number; pairA?: number; pairB?: number } = {},
): Odds {
  const yesPriceInA = poolPriceAInB(poolA, decimals.yes ?? 6, decimals.pairA ?? 6);
  const noPriceInB = poolPriceAInB(poolB, decimals.no ?? 6, decimals.pairB ?? 6);
  return oddsFromPrices({ yesPriceInA, noPriceInB, pairAUsd, pairBUsd });
}

/** Odds from already-known sqrt prices (used by `previewBet` for the post-trade state). */
export function oddsFromSqrtPrices(
  sqrtPriceA: BN,
  sqrtPriceB: BN,
  pairAUsd: number,
  pairBUsd: number,
  decimals: { yes?: number; no?: number; pairA?: number; pairB?: number } = {},
): Odds {
  const yesPriceInA = priceFromSqrtPrice(sqrtPriceA, decimals.yes ?? 6, decimals.pairA ?? 6);
  const noPriceInB = priceFromSqrtPrice(sqrtPriceB, decimals.no ?? 6, decimals.pairB ?? 6);
  return oddsFromPrices({ yesPriceInA, noPriceInB, pairAUsd, pairBUsd });
}

/** Price of YES in pair-A units that makes P(yes) = p, given pair A's USD price. */
export function outcomePriceForProbability(p: number, pairUsd: number): number {
  return p / pairUsd;
}

/** Format odds as a percentage string, e.g. "62%". */
export function formatPct(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`;
}
