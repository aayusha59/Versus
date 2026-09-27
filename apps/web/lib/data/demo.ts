import type {
  BetPreview,
  Fighter,
  Market,
  Odds,
  Position,
  RewardEpoch,
  SellPreview,
  Side,
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

function buildFixtures(now: number): Market[] {
  const AAPL = getAsset("AAPL");
  const NVDA = getAsset("NVDA");
  const BTC = getAsset("BTC");
  const ETH = getAsset("ETH");
  const TSLA = getAsset("TSLA");
  const F = getAsset("F");
  const ZEC = getAsset("ZEC");
  const HYPE = getAsset("HYPE");

  const appleNvidia = baseMarket({
    id: "apple-vs-nvidia",
    no: 1,
    question: "Will Apple be worth more than Nvidia on Dec 31?",
    a: fighter(AAPL, { change30d: 0.062, holders: 412, feesPaid: 31.42 }),
    b: fighter(NVDA, { change30d: -0.031, holders: 388, feesPaid: 40.18 }),
    template: {
      kind: "CapCompare",
      feedA: AAPL.feedId,
      feedB: NVDA.feedId,
      sharesA: AAPL.shares ?? 0,
      sharesB: NVDA.shares ?? 0,
    },
    createdTs: now - 41 * DAY,
    resolveTs: Date.UTC(2026, 11, 31, 21, 0, 0),
    feeBpsHolders: 100,
    status: { kind: "open" },
    totalMinted: 184_200,
    totalRedeemed: 0,
    rewardsPaidA: 31.42,
    rewardsPaidB: 40.18,
    epochs: 112,
    odds: odds(0.54, 1.008),
    depthUsd: 58_000,
  });

  const btcEth = baseMarket({
    id: "bitcoin-vs-ethereum",
    no: 2,
    question: "Will Bitcoin outperform Ethereum from here to Nov 30?",
    a: fighter(BTC, { change30d: 0.041, holders: 296, feesPaid: 0.0412 }),
    b: fighter(ETH, { change30d: 0.087, holders: 341, feesPaid: 1.218 }),
    template: { kind: "RatioOutperform", feedA: BTC.feedId, feedB: ETH.feedId, startRatio: 27.76 },
    createdTs: now - 19 * DAY,
    resolveTs: Date.UTC(2026, 10, 30, 0, 0, 0),
    feeBpsHolders: 100,
    status: { kind: "open" },
    totalMinted: 96_400,
    totalRedeemed: 0,
    rewardsPaidA: 0.0412,
    rewardsPaidB: 1.218,
    epochs: 61,
    odds: odds(0.39, 1.004),
    depthUsd: 36_000,
  });

  const teslaFord = baseMarket({
    id: "tesla-vs-ford",
    no: 3,
    question: "Will Tesla be worth more than Ford on Oct 30?",
    a: fighter(TSLA, { change30d: 0.118, holders: 203, feesPaid: 4.06 }),
    b: fighter(F, { change30d: 0.012, holders: 57, feesPaid: 88.5 }),
    template: {
      kind: "CapCompare",
      feedA: TSLA.feedId,
      feedB: F.feedId,
      sharesA: TSLA.shares ?? 0,
      sharesB: F.shares ?? 0,
    },
    createdTs: now - 9 * DAY,
    resolveTs: Date.UTC(2026, 9, 30, 20, 0, 0),
    feeBpsHolders: 50,
    status: { kind: "open" },
    totalMinted: 22_800,
    totalRedeemed: 0,
    rewardsPaidA: 4.06,
    rewardsPaidB: 88.5,
    epochs: 24,
    odds: odds(0.91, 1.011),
    depthUsd: 14_000,
  });

  const resolvedTs = Date.UTC(2026, 8, 15, 0, 0, 0);
  const zecHype = baseMarket({
    id: "zcash-vs-hyperliquid",
    no: 4,
    question: "Will Zcash outperform Hyperliquid from here to Sep 15?",
    a: fighter(ZEC, { change30d: 0.284, holders: 148, feesPaid: 61.7, price: 62.4 }),
    b: fighter(HYPE, { change30d: -0.093, holders: 176, feesPaid: 44.2, price: 44.1 }),
    template: { kind: "RatioOutperform", feedA: ZEC.feedId, feedB: HYPE.feedId, startRatio: 1.02 },
    createdTs: resolvedTs - 30 * DAY,
    resolveTs: resolvedTs,
    feeBpsHolders: 100,
    status: {
      kind: "resolved",
      winner: "a",
      priceA: 62.4,
      priceB: 44.1,
      resolvedTs: resolvedTs + 4 * 60_000,
      closingOdds: odds(0.71, 1.002),
      manual: false,
    },
    totalMinted: 41_300,
    totalRedeemed: 27_910,
    rewardsPaidA: 61.7,
    rewardsPaidB: 44.2,
    epochs: 90,
    odds: { a: 1, b: 0, impliedSum: 1 },
    depthUsd: 20_000,
  });

  return [appleNvidia, btcEth, teslaFord, zecHype];
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

function buildLedger(markets: Market[], now: number): RewardEpoch[] {
  const rng = mulberry32(0xc0ffee);
  const out: RewardEpoch[] = [];
  const plan: Array<{ id: string; count: number; every: number; endAt: number }> = [
    { id: "apple-vs-nvidia", count: 10, every: 6 * HOUR, endAt: now - 26 * 60_000 },
    { id: "bitcoin-vs-ethereum", count: 6, every: 8 * HOUR, endAt: now - 71 * 60_000 },
    { id: "tesla-vs-ford", count: 4, every: 12 * HOUR, endAt: now - 3 * HOUR },
    { id: "zcash-vs-hyperliquid", count: 4, every: 8 * HOUR, endAt: Date.UTC(2026, 8, 14, 20, 0, 0) },
  ];
  for (const p of plan) {
    const m = markets.find((x) => x.id === p.id);
    if (!m) continue;
    for (let i = 0; i < p.count; i++) {
      const side: Side = i % 2 === 0 ? "a" : "b";
      const f = side === "a" ? m.a : m.b;
      const perEpoch = f.feesPaid / Math.max(8, m.epochs / 4);
      const amt = perEpoch * (0.6 + rng() * 0.9);
      out.push({
        marketId: m.id,
        epoch: m.epochs - i,
        side,
        ts:
          p.endAt -
          Math.floor(i / 2) * p.every -
          (side === "b" ? 7 * 60_000 : 0) -
          Math.floor(rng() * 9) * 60_000,
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

  // The demo corner arrives with a live position and a settled one, so /me has something to show.
  const seedPositions = () => {
    const an = markets[0];
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
    const zh = markets[3];
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
