import type {
  BetPreview,
  Fighter,
  Market,
  MarketStatus,
  Odds,
  Position,
  RewardEpoch,
  SellPreview,
  Side,
  Template,
} from "../types";
import { getAsset, type Asset } from "../registry";
import { composeQuestion, priceAboveRight, slugify } from "../compose";
import { DataError, type Balance, type DuelData, type OddsPoint } from "./adapter";

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58(rng: () => number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += B58[Math.floor(rng() * B58.length)];
  return s;
}

const sigRng = mulberry32(0x5eed);
const fakeSig = () => b58(sigRng, 88);
const fakeKey = () => b58(sigRng, 44);

export const DEMO_OWNER = "DEmoCorner7Hq4v9Y2wZk3XbM1pRtN6sVfGjLcAaBdEe";
const OPERATOR = "GtQ8ZPUWHkbU4s2oRGNPmLh8ZX2wEfovCvHAp1d4Bigj";
const USDC_MOCK = "USDCmockDuel7Q8aH3p2r9tX1vB4nZ6kM5jL8wC2yF3g";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const TICK_MS = 4_000;

/* ------------------------------------------------------------------ */
/* Fixture builders                                                    */
/* ------------------------------------------------------------------ */

function fighter(
  asset: Asset,
  opts: { change30d: number; holders: number; feesPaid: number; price?: number },
): Fighter {
  const price = opts.price ?? asset.refPrice;
  return {
    label: asset.label,
    symbol: asset.symbol,
    pairSymbol: asset.pairSymbol,
    pairMint: asset.mint,
    feedName: asset.feedName,
    feedId: asset.feedId,
    price,
    marketCap: asset.shares ? price * asset.shares : 0,
    sharesOutstanding: asset.shares,
    change30d: opts.change30d,
    holders: opts.holders,
    feesPaid: opts.feesPaid,
  };
}

function odds(a: number, impliedSum = 1.006): Odds {
  return { a, b: 1 - a, impliedSum };
}

type MarketSeed = Omit<
  Market,
  | "network"
  | "creator"
  | "collateralMint"
  | "yesMint"
  | "noMint"
  | "poolA"
  | "poolB"
  | "graceSecs"
  | "resolver"
  | "crank"
  | "feeBpsCreator"
  | "feeBpsPlatform"
  | "oddsUpdatedAt"
  | "depthUsd"
> &
  Partial<Pick<Market, "depthUsd" | "creator">>;

function baseMarket(partial: MarketSeed): Market {
  return {
    network: "demo",
    creator: OPERATOR,
    collateralMint: USDC_MOCK,
    yesMint: fakeKey(),
    noMint: fakeKey(),
    poolA: fakeKey(),
    poolB: fakeKey(),
    graceSecs: 6 * 3600,
    resolver: OPERATOR,
    crank: OPERATOR,
    feeBpsCreator: 0,
    feeBpsPlatform: 0,
    oddsUpdatedAt: Date.now(),
    depthUsd: 42_000,
    ...partial,
  };
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

type Kind = "CapCompare" | "RatioOutperform";

/** A UTC bell time: [year, month index, day, hour]. */
type Bell = [number, number, number, number];

interface Seed {
  id: string;
  a: string;
  b: string;
  kind: Kind;
  /** Days from creation to now (open) or to the bell (settled). */
  age: number;
  bell: Bell;
  /** Left-side odds now, or the closing odds once settled. */
  oddsA: number;
  implied?: number;
  feeBps?: number;
  minted: number;
  depth: number;
  holders: [number, number];
  /** Fees paid out to each side so far, in that side's pair token. */
  fees: [number, number];
  /** 30-day price moves, as fractions. */
  change: [number, number];
  epochs: number;
  settled?: { winner: Side; redeemed: number; manual?: boolean };
}

/**
 * Twenty-one live duels and five settled ones. Cap-compare odds follow the registry's
 * price-times-shares; outperform duels pit crypto, indexes and commodities against each other.
 * Board numbers are assigned in creation order, so the list order here does not matter.
 */
const SEEDS: Seed[] = [
  /* Live */
  { id: "apple-vs-nvidia", a: "AAPL", b: "NVDA", kind: "CapCompare", age: 41, bell: [2026, 11, 31, 21], oddsA: 0.54, implied: 1.008, minted: 184_200, depth: 58_000, holders: [412, 388], fees: [31.42, 40.18], change: [0.062, -0.031], epochs: 112 },
  { id: "bitcoin-vs-gold", a: "BTC", b: "GLD", kind: "RatioOutperform", age: 58, bell: [2026, 11, 31, 21], oddsA: 0.49, implied: 1.005, minted: 141_000, depth: 44_000, holders: [508, 462], fees: [0.0388, 9.84], change: [0.041, 0.052], epochs: 168 },
  { id: "microsoft-vs-apple", a: "MSFT", b: "AAPL", kind: "CapCompare", age: 52, bell: [2026, 11, 31, 21], oddsA: 0.42, implied: 1.007, minted: 132_500, depth: 46_000, holders: [301, 364], fees: [7.92, 12.46], change: [0.021, 0.062], epochs: 150 },
  { id: "google-vs-amazon", a: "GOOGL", b: "AMZN", kind: "CapCompare", age: 47, bell: [2026, 10, 20, 21], oddsA: 0.71, implied: 1.009, minted: 88_700, depth: 31_000, holders: [276, 198], fees: [14.8, 9.63], change: [0.077, -0.018], epochs: 128 },
  { id: "solana-vs-ethereum", a: "SOL", b: "ETH", kind: "RatioOutperform", age: 36, bell: [2026, 9, 31, 0], oddsA: 0.57, implied: 1.006, minted: 76_300, depth: 27_000, holders: [389, 297], fees: [12.42, 0.871], change: [0.104, 0.087], epochs: 98 },
  { id: "nvidia-vs-bitcoin", a: "NVDA", b: "BTC", kind: "RatioOutperform", age: 33, bell: [2026, 11, 31, 21], oddsA: 0.52, implied: 1.004, minted: 118_900, depth: 39_000, holders: [421, 377], fees: [16.7, 0.0291], change: [-0.031, 0.041], epochs: 96 },
  { id: "meta-vs-netflix", a: "META", b: "NFLX", kind: "CapCompare", age: 29, bell: [2026, 11, 18, 21], oddsA: 0.93, implied: 1.012, feeBps: 50, minted: 19_600, depth: 9_000, holders: [88, 41], fees: [1.12, 0.34], change: [0.048, 0.061], epochs: 62 },
  { id: "coinbase-vs-robinhood", a: "COIN", b: "HOOD", kind: "CapCompare", age: 27, bell: [2026, 11, 31, 21], oddsA: 0.38, implied: 1.006, minted: 64_200, depth: 22_000, holders: [244, 271], fees: [6.31, 17.9], change: [-0.052, 0.138], epochs: 74 },
  { id: "sp-500-vs-nasdaq-100", a: "SPY", b: "QQQ", kind: "RatioOutperform", age: 24, bell: [2026, 11, 18, 21], oddsA: 0.36, implied: 1.003, feeBps: 30, minted: 210_400, depth: 72_000, holders: [612, 588], fees: [9.72, 11.4], change: [0.019, 0.031], epochs: 71 },
  { id: "bitcoin-vs-ethereum", a: "BTC", b: "ETH", kind: "RatioOutperform", age: 19, bell: [2026, 10, 30, 0], oddsA: 0.39, implied: 1.004, minted: 96_400, depth: 36_000, holders: [296, 341], fees: [0.0412, 1.218], change: [0.041, 0.087], epochs: 61 },
  { id: "amd-vs-broadcom", a: "AMD", b: "AVGO", kind: "CapCompare", age: 17, bell: [2026, 9, 16, 20], oddsA: 0.07, implied: 1.014, minted: 8_400, depth: 4_200, holders: [63, 29], fees: [0.92, 0.41], change: [0.093, 0.027], epochs: 40 },
  { id: "microstrategy-vs-bitcoin", a: "MSTR", b: "BTC", kind: "RatioOutperform", age: 15, bell: [2026, 10, 13, 21], oddsA: 0.44, implied: 1.005, minted: 52_800, depth: 19_000, holders: [231, 206], fees: [4.87, 0.0187], change: [-0.112, 0.041], epochs: 44 },
  { id: "palantir-vs-nvidia", a: "PLTR", b: "NVDA", kind: "RatioOutperform", age: 13, bell: [2026, 9, 27, 21], oddsA: 0.41, implied: 1.006, minted: 47_100, depth: 17_000, holders: [318, 262], fees: [8.24, 4.13], change: [0.146, -0.031], epochs: 38 },
  { id: "xrp-vs-dogecoin", a: "XRP", b: "DOGE", kind: "RatioOutperform", age: 12, bell: [2026, 9, 30, 0], oddsA: 0.66, implied: 1.008, minted: 33_900, depth: 12_000, holders: [402, 517], fees: [418.6, 6_120], change: [0.052, -0.071], epochs: 35 },
  { id: "tesla-vs-ford", a: "TSLA", b: "F", kind: "CapCompare", age: 9, bell: [2026, 9, 30, 20], oddsA: 0.91, implied: 1.011, feeBps: 50, minted: 22_800, depth: 14_000, holders: [203, 57], fees: [4.06, 88.5], change: [0.118, 0.012], epochs: 24 },
  { id: "sui-vs-avalanche", a: "SUI", b: "AVAX", kind: "RatioOutperform", age: 8, bell: [2026, 10, 30, 0], oddsA: 0.53, implied: 1.004, minted: 27_400, depth: 10_000, holders: [214, 188], fees: [186.2, 21.7], change: [0.071, 0.033], epochs: 22 },
  { id: "hyperliquid-vs-solana", a: "HYPE", b: "SOL", kind: "RatioOutperform", age: 7, bell: [2026, 9, 24, 0], oddsA: 0.62, implied: 1.007, minted: 39_800, depth: 15_000, holders: [267, 241], fees: [24.9, 4.62], change: [-0.093, 0.104], epochs: 19 },
  { id: "chainlink-vs-solana", a: "LINK", b: "SOL", kind: "RatioOutperform", age: 5, bell: [2026, 11, 11, 0], oddsA: 0.31, implied: 1.003, minted: 18_200, depth: 7_000, holders: [141, 176], fees: [17.3, 1.94], change: [0.012, 0.104], epochs: 13 },
  { id: "bnb-vs-ethereum", a: "BNB", b: "ETH", kind: "RatioOutperform", age: 4, bell: [2026, 11, 31, 0], oddsA: 0.45, implied: 1.005, minted: 21_700, depth: 8_500, holders: [122, 163], fees: [0.61, 0.152], change: [0.038, 0.087], epochs: 10 },
  { id: "tesla-vs-meta", a: "TSLA", b: "META", kind: "CapCompare", age: 2, bell: [2027, 2, 31, 21], oddsA: 0.33, implied: 1.009, minted: 14_600, depth: 6_000, holders: [97, 74], fees: [0.48, 0.27], change: [0.118, 0.048], epochs: 5 },
  { id: "gold-vs-sp-500", a: "GLD", b: "SPY", kind: "RatioOutperform", age: 1, bell: [2026, 11, 31, 21], oddsA: 0.55, implied: 1.004, feeBps: 30, minted: 9_800, depth: 4_800, holders: [58, 44], fees: [0.21, 0.11], change: [0.052, 0.019], epochs: 2 },

  /* Settled */
  { id: "zcash-vs-hyperliquid", a: "ZEC", b: "HYPE", kind: "RatioOutperform", age: 30, bell: [2026, 8, 15, 0], oddsA: 0.71, implied: 1.002, minted: 41_300, depth: 20_000, holders: [148, 176], fees: [61.7, 44.2], change: [0.284, -0.093], epochs: 90, settled: { winner: "a", redeemed: 0.676 } },
  { id: "nvidia-vs-microsoft", a: "NVDA", b: "MSFT", kind: "CapCompare", age: 24, bell: [2026, 8, 11, 21], oddsA: 0.84, implied: 1.003, minted: 73_400, depth: 26_000, holders: [288, 231], fees: [9.41, 4.06], change: [-0.031, 0.021], epochs: 70, settled: { winner: "a", redeemed: 0.9 } },
  { id: "ethereum-vs-solana", a: "ETH", b: "SOL", kind: "RatioOutperform", age: 14, bell: [2026, 8, 1, 0], oddsA: 0.34, implied: 1.004, minted: 58_900, depth: 21_000, holders: [276, 344], fees: [0.94, 14.7], change: [0.087, 0.104], epochs: 42, settled: { winner: "b", redeemed: 0.88 } },
  { id: "apple-vs-microsoft", a: "AAPL", b: "MSFT", kind: "CapCompare", age: 30, bell: [2026, 8, 18, 21], oddsA: 0.63, implied: 1.005, minted: 97_600, depth: 33_000, holders: [352, 301], fees: [11.7, 6.28], change: [0.062, 0.021], epochs: 88, settled: { winner: "a", redeemed: 0.72 } },
  { id: "dogecoin-vs-xrp", a: "DOGE", b: "XRP", kind: "RatioOutperform", age: 21, bell: [2026, 8, 20, 0], oddsA: 0.48, implied: 1.009, minted: 24_600, depth: 9_000, holders: [388, 296], fees: [4_210, 271.4], change: [-0.071, 0.052], epochs: 60, settled: { winner: "b", redeemed: 0.41, manual: true } },
];

/** The A/B price ratio the day the duel opened: today's ratio unwound by each side's move since. */
function startRatio(a: Asset, b: Asset, s: Seed): number {
  const f = Math.min(1, s.age / 30);
  const r = ((a.refPrice / b.refPrice) * (1 + s.change[1] * f)) / (1 + s.change[0] * f);
  return Number(r.toPrecision(4));
}

function buildFixtures(now: number): Market[] {
  const markets = SEEDS.map((s) => {
    const A = getAsset(s.a);
    const B = getAsset(s.b);
    const resolveTs = Date.UTC(s.bell[0], s.bell[1], s.bell[2], s.bell[3], 0, 0);
    const createdTs = (s.settled ? resolveTs : now) - s.age * DAY;
    const a = fighter(A, { change30d: s.change[0], holders: s.holders[0], feesPaid: s.fees[0] });
    const b = fighter(B, { change30d: s.change[1], holders: s.holders[1], feesPaid: s.fees[1] });
    const template: Template =
      s.kind === "CapCompare"
        ? { kind: "CapCompare", feedA: A.feedId, feedB: B.feedId, sharesA: A.shares ?? 0, sharesB: B.shares ?? 0 }
        : { kind: "RatioOutperform", feedA: A.feedId, feedB: B.feedId, startRatio: startRatio(A, B, s) };
    const closing = odds(s.oddsA, s.implied ?? 1.006);
    const status: MarketStatus = s.settled
      ? {
          kind: "resolved",
          winner: s.settled.winner,
          priceA: a.price,
          priceB: b.price,
          // Manual settlements land after the 6h grace period; oracle ones a few minutes after the bell.
          resolvedTs: resolveTs + (s.settled.manual ? 6 * HOUR + 12 * 60_000 : 4 * 60_000),
          closingOdds: closing,
          manual: s.settled.manual ?? false,
        }
      : { kind: "open" };
    return baseMarket({
      id: s.id,
      no: 0,
      question: composeQuestion(s.kind, A, B, resolveTs, 0),
      a,
      b,
      template,
      createdTs,
      resolveTs,
      feeBpsHolders: s.feeBps ?? 100,
      status,
      totalMinted: s.minted,
      totalRedeemed: s.settled ? Math.round(s.minted * s.settled.redeemed) : 0,
      rewardsPaidA: s.fees[0],
      rewardsPaidB: s.fees[1],
      epochs: s.epochs,
      odds: s.settled ? (s.settled.winner === "a" ? { a: 1, b: 0, impliedSum: 1 } : { a: 0, b: 1, impliedSum: 1 }) : closing,
      depthUsd: s.depth,
    });
  });
  // Board numbers follow creation order.
  markets.sort((x, y) => x.createdTs - y.createdTs).forEach((m, i) => {
    m.no = i + 1;
  });
  return markets;
}

/** 30 daily points ending at the current odds (a bridged random walk). */
function buildHistory(m: Market, now: number, seed: number): OddsPoint[] {
  const rng = mulberry32(seed);
  const end = m.status.kind === "resolved" ? m.status.closingOdds.a : m.odds.a;
  const n = 30;
  const raw: number[] = [end];
  for (let i = 1; i <= n; i++) {
    const prev = raw[i - 1];
    const step = (rng() - 0.5) * 0.05 + (0.5 - prev) * 0.03;
    raw.push(Math.min(0.96, Math.max(0.04, prev + step)));
  }
  raw.reverse();
  const drift = raw[n] - end;
  const endTs = m.status.kind === "resolved" ? m.status.resolvedTs : now;
  return raw.map((v, i) => ({
    t: endTs - (n - i) * DAY,
    a: Math.min(0.97, Math.max(0.03, v - (drift * i) / n)),
  }));
}

/** Up to ten recent payouts per duel, alternating sides, spaced by the duel's own epoch cadence. */
function buildLedger(markets: Market[], now: number): RewardEpoch[] {
  const rng = mulberry32(0xc0ffee);
  const out: RewardEpoch[] = [];
  for (const m of markets) {
    const count = Math.min(10, m.epochs);
    if (count === 0) continue;
    const endAt =
      m.status.kind === "resolved" ? m.status.resolvedTs - 4 * HOUR : now - (5 + Math.floor(rng() * 170)) * 60_000;
    const every = Math.max(HOUR, ((endAt - m.createdTs) / m.epochs) * 2);
    for (let i = 0; i < count; i++) {
      const side: Side = i % 2 === 0 ? "a" : "b";
      const f = side === "a" ? m.a : m.b;
      const perEpoch = f.feesPaid / Math.max(8, m.epochs / 4);
      const amt = perEpoch * (0.6 + rng() * 0.9);
      out.push({
        marketId: m.id,
        epoch: m.epochs - i,
        side,
        ts: endAt - Math.floor(i / 2) * every - (side === "b" ? 7 * 60_000 : 0) - Math.floor(rng() * 9) * 60_000,
        amountPair: Math.round(amt * 10_000) / 10_000,
        holders: Math.max(3, Math.round(f.holders * (0.82 + rng() * 0.16))),
        signature: fakeSig(),
      });
    }
  }
  return out.sort((x, y) => y.ts - x.ts);
}

/* ------------------------------------------------------------------ */
/* Pricing (constant-product outcome/pair pool, quote-only fee)        */
/* ------------------------------------------------------------------ */

function rawPrice(m: Market, side: Side): number {
  return (side === "a" ? m.odds.a : m.odds.b) * m.odds.impliedSum;
}

function normalize(a: number, b: number): Odds {
  const sum = a + b;
  return { a: a / sum, b: b / sum, impliedSum: sum };
}

function feeBpsTotal(m: Market): number {
  return m.feeBpsHolders + m.feeBpsCreator + m.feeBpsPlatform;
}

function quoteBuy(m: Market, side: Side, usdc: number): BetPreview {
  const price = rawPrice(m, side);
  const other = rawPrice(m, side === "a" ? "b" : "a");
  const pairPrice = side === "a" ? m.a.price : m.b.price;
  const fee = feeBpsTotal(m) / 10_000;
  const pairIn = usdc / pairPrice;
  const feeInPair = pairIn * fee;
  const netUsd = usdc * (1 - fee);
  const y = m.depthUsd;
  const x = m.depthUsd / price;
  const y2 = y + netUsd;
  const x2 = (x * y) / y2;
  const out = x - x2;
  const newPrice = y2 / x2;
  const oddsAfter = side === "a" ? normalize(newPrice, other) : normalize(other, newPrice);
  const avg = out > 0 ? netUsd / out : price;
  return {
    outcomeOut: out,
    pairIn,
    feeInPair,
    oddsAfter,
    priceImpactBps: Math.max(0, (avg / price - 1) * 10_000),
  };
}

function quoteSell(m: Market, side: Side, size: number): SellPreview {
  const price = rawPrice(m, side);
  const other = rawPrice(m, side === "a" ? "b" : "a");
  const pairPrice = side === "a" ? m.a.price : m.b.price;
  const fee = feeBpsTotal(m) / 10_000;
  const y = m.depthUsd;
  const x = m.depthUsd / price;
  const x2 = x + size;
  const y2 = (x * y) / x2;
  const grossUsd = y - y2;
  const pairOut = (grossUsd / pairPrice) * (1 - fee);
  const feeInPair = (grossUsd / pairPrice) * fee;
  const usdcOut = pairOut * pairPrice;
  const newPrice = y2 / x2;
  const oddsAfter = side === "a" ? normalize(newPrice, other) : normalize(other, newPrice);
  const avg = size > 0 ? grossUsd / size : price;
  return {
    usdcOut,
    pairOut,
    feeInPair,
    oddsAfter,
    priceImpactBps: Math.max(0, (1 - avg / price) * 10_000),
  };
}

/* ------------------------------------------------------------------ */
/* The adapter                                                         */
/* ------------------------------------------------------------------ */

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createDemoData(): DuelData {
  const now = Date.now();
  const markets = buildFixtures(now);
  const history = new Map<string, OddsPoint[]>();
  markets.forEach((m, i) => history.set(m.id, buildHistory(m, now, 0x1234 + i * 97)));
  let ledger = buildLedger(markets, now);

  const positions = new Map<string, Position>();
  const balances = new Map<string, Balance>();
  const listeners = new Set<() => void>();
  const walk = mulberry32(0xbeef);
  let ticks = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const posKey = (id: string, owner: string, side: Side) => `${id}:${owner}:${side}`;

  // The demo corner arrives with a live position and a settled one, so /positions has something to show.
  const seedPositions = () => {
    const an = markets.find((m) => m.id === "apple-vs-nvidia");
    if (an) {
      positions.set(posKey(an.id, DEMO_OWNER, "a"), {
        marketId: an.id,
        owner: DEMO_OWNER,
        side: "a",
        size: 250,
        cost: 128.4,
        value: 250 * an.odds.a,
        earnedPair: 1.84,
        claimablePair: 0.0213,
        redeemableUsdc: 0,
      });
    }
    const zh = markets.find((m) => m.id === "zcash-vs-hyperliquid");
    if (zh) {
      positions.set(posKey(zh.id, DEMO_OWNER, "a"), {
        marketId: zh.id,
        owner: DEMO_OWNER,
        side: "a",
        size: 120,
        cost: 78.6,
        value: 120,
        earnedPair: 3.412,
        claimablePair: 0,
        redeemableUsdc: 120,
      });
    }
    balances.set(DEMO_OWNER, { usdc: 1_000, pair: { AAPLx: 1.84, ZEC: 3.412 } });
  };
  seedPositions();

  const balanceOf = (owner: string): Balance => {
    let b = balances.get(owner);
    if (!b) {
      b = { usdc: 0, pair: {} };
      balances.set(owner, b);
    }
    return b;
  };

  const markValue = (p: Position) => {
    const m = markets.find((x) => x.id === p.marketId);
    if (!m) return;
    if (m.status.kind === "resolved") {
      const won = m.status.winner === p.side;
      p.value = won ? p.size : 0;
      p.redeemableUsdc = won ? p.size : 0;
    } else {
      p.value = p.size * (p.side === "a" ? m.odds.a : m.odds.b);
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const clone = (m: Market): Market => ({ ...m, odds: { ...m.odds }, a: { ...m.a }, b: { ...m.b } });

  const tick = () => {
    ticks += 1;
    const t = Date.now();
    for (const m of markets) {
      if (m.status.kind !== "open") continue;
      const base = history.get(m.id)?.[0]?.a ?? 0.5;
      const step = (walk() - 0.5) * 0.018 + (base - m.odds.a) * 0.01;
      const a = Math.min(0.97, Math.max(0.03, m.odds.a + step));
      const implied = 1 + 0.002 + walk() * 0.01;
      if (Math.round(a * 100) !== Math.round(m.odds.a * 100)) m.oddsUpdatedAt = t;
      m.odds = { a, b: 1 - a, impliedSum: implied };
      const h = history.get(m.id);
      if (h) {
        h.push({ t, a });
        if (h.length > 400) h.splice(0, h.length - 400);
      }
    }
    // A payout lands every ten ticks so the ledger moves during a demo.
    if (ticks % 10 === 0) {
      const open = markets.filter((m) => m.status.kind === "open");
      if (open.length > 0) {
        const m = open[ticks % open.length];
        const side: Side = walk() > 0.5 ? "a" : "b";
        const f = side === "a" ? m.a : m.b;
        const amt =
          Math.round((f.feesPaid / Math.max(8, m.epochs / 4)) * (0.5 + walk()) * 10_000) / 10_000;
        m.epochs += 1;
        f.feesPaid += amt;
        if (side === "a") m.rewardsPaidA += amt;
        else m.rewardsPaidB += amt;
        ledger = [
          {
            marketId: m.id,
            epoch: m.epochs,
            side,
            ts: t,
            amountPair: amt,
            holders: f.holders,
            signature: fakeSig(),
          },
          ...ledger,
        ];
        for (const p of positions.values()) {
          if (p.marketId === m.id && p.side === side) {
            const share = amt * (p.size / Math.max(p.size, m.totalMinted / 2));
            p.earnedPair += share;
            p.claimablePair = 0;
            const bal = balanceOf(p.owner);
            bal.pair[f.pairSymbol] = (bal.pair[f.pairSymbol] ?? 0) + share;
          }
        }
      }
    }
    for (const p of positions.values()) markValue(p);
    emit();
  };

  const ensureTimer = () => {
    if (timer || typeof window === "undefined") return;
    timer = setInterval(tick, TICK_MS);
  };

  const find = (id: string): Market => {
    const m = markets.find((x) => x.id === id);
    if (!m) throw new DataError("No duel by that name.");
    return m;
  };

  const emptyPosition = (id: string, owner: string, side: Side): Position => ({
    marketId: id,
    owner,
    side,
    size: 0,
    cost: 0,
    value: 0,
    earnedPair: 0,
    claimablePair: 0,
    redeemableUsdc: 0,
  });

  return {
    network: "demo",

    async listMarkets() {
      return markets.map(clone);
    },

    async getMarket(id) {
      const m = markets.find((x) => x.id === id);
      return m ? clone(m) : null;
    },

    async getOddsHistory(id) {
      return [...(history.get(id) ?? [])];
    },

    async getLedger(id) {
      return ledger.filter((e) => e.marketId === id);
    },

    async getPosition(id, owner, side) {
      if (!owner) return null;
      if (side) {
        const p = positions.get(posKey(id, owner, side));
        return p ? { ...p } : null;
      }
      const both = (["a", "b"] as Side[])
        .map((s) => positions.get(posKey(id, owner, s)))
        .filter((p): p is Position => !!p)
        .sort((x, y) => y.size - x.size);
      return both[0] ? { ...both[0] } : null;
    },

    async listPositions(owner) {
      if (!owner) return [];
      return [...positions.values()]
        .filter((p) => p.owner === owner && p.size > 0)
        .map((p) => ({ ...p }));
    },

    async getBalance(owner) {
      if (!owner) return { usdc: 0, pair: {} };
      const b = balanceOf(owner);
      return { usdc: b.usdc, pair: { ...b.pair } };
    },

    async previewBet(id, side, usdc) {
      const m = find(id);
      if (m.status.kind !== "open") throw new DataError("This duel is settled.");
      return quoteBuy(m, side, Math.max(0, usdc));
    },

    async previewSell(id, side, size) {
      const m = find(id);
      if (m.status.kind !== "open") throw new DataError("This duel is settled.");
      return quoteSell(m, side, Math.max(0, size));
    },

    async placeBet(id, side, usdc, owner) {
      const m = find(id);
      if (m.status.kind !== "open") throw new DataError("This duel is settled.");
      if (!(usdc > 0)) throw new DataError("Enter an amount.");
      const bal = balanceOf(owner);
      if (bal.usdc + 1e-9 < usdc) {
        throw new DataError(`Not enough USDC. You have ${bal.usdc.toFixed(2)}.`);
      }
      const q = quoteBuy(m, side, usdc);
      // Optimistic: state moves now, the "signature" lands after simulated confirmation.
      bal.usdc -= usdc;
      m.odds = q.oddsAfter;
      m.oddsUpdatedAt = Date.now();
      m.totalMinted += q.outcomeOut;
      const key = posKey(id, owner, side);
      const p = positions.get(key) ?? emptyPosition(id, owner, side);
      const isNew = p.size === 0;
      p.size += q.outcomeOut;
      p.cost += usdc;
      markValue(p);
      positions.set(key, p);
      const f = side === "a" ? m.a : m.b;
      if (isNew) f.holders += 1;
      history.get(id)?.push({ t: Date.now(), a: m.odds.a });
      emit();
      await delay(650 + Math.random() * 500);
      return { signature: fakeSig() };
    },

    async sell(id, side, size, owner) {
      const m = find(id);
      if (m.status.kind !== "open") throw new DataError("This duel is settled. Redeem instead.");
      const key = posKey(id, owner, side);
      const p = positions.get(key);
      const name = side === "a" ? m.a.label : m.b.label;
      if (!p || p.size <= 0) throw new DataError(`You hold no ${name}.`);
      if (size > p.size + 1e-9) throw new DataError(`You hold ${p.size.toFixed(2)} ${name}.`);
      const q = quoteSell(m, side, size);
      const bal = balanceOf(owner);
      bal.usdc += q.usdcOut;
      m.odds = q.oddsAfter;
      m.oddsUpdatedAt = Date.now();
      p.size -= size;
      p.cost = Math.max(0, p.cost - q.usdcOut);
      markValue(p);
      if (p.size <= 1e-6) {
        positions.delete(key);
        const f = side === "a" ? m.a : m.b;
        f.holders = Math.max(0, f.holders - 1);
      }
      history.get(id)?.push({ t: Date.now(), a: m.odds.a });
      emit();
      await delay(650 + Math.random() * 500);
      return { signature: fakeSig() };
    },

    async createMarket(params) {
      const a = getAsset(params.a.symbol);
      const b = params.b ? getAsset(params.b.symbol) : null;
      if (params.template.kind !== "PriceAbove" && !b) throw new DataError("Pick a right corner.");
      if (b && b.symbol === a.symbol) throw new DataError("A fighter cannot duel itself.");
      if (!(params.seedUsdc >= 10)) throw new DataError("Seed at least 10 USDC.");
      if (params.resolveTs <= Date.now() + HOUR) {
        throw new DataError("Resolution must be at least an hour out.");
      }
      const t = Date.now();
      const threshold = params.template.kind === "PriceAbove" ? params.template.threshold : 0;
      const baseId = b
        ? `${slugify(a.label)}-vs-${slugify(b.label)}`
        : `${slugify(a.label)}-above-${Math.round(threshold)}`;
      let id = baseId;
      let n = 2;
      while (markets.some((m) => m.id === id)) id = `${baseId}-${n++}`;
      const right: Fighter = b
        ? fighter(b, { change30d: 0, holders: 1, feesPaid: 0 })
        : {
            ...fighter(a, { change30d: 0, holders: 1, feesPaid: 0 }),
            label: priceAboveRight(threshold),
            symbol: "USDC",
            pairSymbol: "USDC",
            pairMint: USDC_MOCK,
          };
      const m = baseMarket({
        id,
        no: markets.length + 1,
        creator: params.creator,
        question:
          params.question || composeQuestion(params.template.kind, a, b, params.resolveTs, threshold),
        a: fighter(a, { change30d: 0, holders: 1, feesPaid: 0 }),
        b: right,
        template: params.template,
        createdTs: t,
        resolveTs: params.resolveTs,
        feeBpsHolders: params.feeBps,
        status: { kind: "open" },
        totalMinted: params.seedUsdc,
        totalRedeemed: 0,
        rewardsPaidA: 0,
        rewardsPaidB: 0,
        epochs: 0,
        odds: odds(0.5, 1.0),
        depthUsd: params.seedUsdc / 2,
      });
      markets.push(m);
      history.set(id, [{ t, a: 0.5 }]);
      const bal = balanceOf(params.creator);
      bal.usdc = Math.max(0, bal.usdc - params.seedUsdc);
      emit();
      await delay(900 + Math.random() * 600);
      return { id, signature: fakeSig() };
    },

    async redeem(id, owner) {
      const m = find(id);
      if (m.status.kind !== "resolved") throw new DataError("Not settled yet.");
      const winner = m.status.winner;
      const key = posKey(id, owner, winner);
      const p = positions.get(key);
      if (!p || p.size <= 0) throw new DataError("Nothing to redeem on the winning side.");
      const amt = p.size;
      const bal = balanceOf(owner);
      bal.usdc += amt;
      m.totalRedeemed += amt;
      positions.delete(key);
      emit();
      await delay(600 + Math.random() * 400);
      return { signature: fakeSig() };
    },

    async faucet(owner) {
      const bal = balanceOf(owner);
      bal.usdc += 1_000;
      emit();
      await delay(400 + Math.random() * 300);
      return { signature: fakeSig() };
    },

    subscribe(listener) {
      listeners.add(listener);
      ensureTimer();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}
