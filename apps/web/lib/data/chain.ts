import "../polyfills";
import { ComputeBudgetProgram, Connection, PublicKey, Transaction, type Signer } from "@solana/web3.js";
import { AccountLayout, MintLayout, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  DuelClient,
  buildBetTx,
  buildSellTx,
  buildSwapIx,
  createPairPool,
  getPoolStatesBatch,
  marketPoolsFromStates,
  pairUsdFromPool,
  poolFeeBps,
  poolLpFees,
  previewBet as sdkPreviewBet,
  previewSell as sdkPreviewSell,
  quoteAmountForPrice,
  quoteSwap,
  routingFromDeployment,
  snapshotHolders,
  toBN,
  type DeployedMarket,
  type Deployment,
  type Market as SdkMarket,
  type MarketPools,
  type MarketRouting,
  type PoolState,
  type RewardEpoch as SdkRewardEpoch,
  type Side as SdkSide,
  type Template as SdkTemplate,
} from "@duel/sdk/browser";
import type {
  BetPreview,
  CreateMarketParams,
  Fighter,
  Market,
  Odds,
  Position,
  RewardEpoch,
  SellPreview,
  Side,
  Template,
  TxResult,
} from "../types";
import { getAsset, type Asset } from "../registry";
import { DataError, type DuelData, type OddsPoint, type WalletSigner } from "./adapter";
import { getDeployment, rpcUrlFor, type ChainCluster } from "./deployment";

/**
 * Chain adapter: `DuelData` over `@duel/sdk` for a localnet or devnet deployment.
 *
 * Reads: one `fetchAllMarkets` (program accounts), one batched fetch of every outcome and
 * pair/USDC pool, one batched fetch of outcome mints and pool vaults, and the connected
 * owner's token accounts, every POLL_MS. Odds come from `oddsFromPools`; pair USD prices from
 * the pair/USDC pools (mainnet would read Pyth). Holder counts refresh every HOLDERS_MS and the
 * ledger whenever the market's epoch counter moves.
 *
 * Writes go through the wallet-adapter (`bindWallet`): bet and sell are the SDK's two-hop
 * transactions, redeem is `DuelClient.redeemIx`, and create-market reproduces the bootstrap
 * per-market flow as six wallet-signed transactions with a progress line per step.
 *
 * Client-side state until an indexer exists (all keyed by cluster in localStorage):
 *   - odds history is sampled on every poll (the first point is seeded at 50/50),
 *   - ledger rows are cached once seen, because a test validator prunes transaction history,
 *   - bet cost per (market, owner, side) so P&L can be shown.
 * "Earned" is the sum of RewardsPaid transfers to the owner, decoded from each distribute
 * transaction's token-balance deltas (`RewardEpoch.recipients` in the SDK), not pro-rata.
 */

const POLL_MS = 5_000;
const HOLDERS_MS = 30_000;
const LEDGER_STALE_MS = 60_000;
const HISTORY_MIN_GAP_MS = 60_000;
const HISTORY_CAP = 400;
const LEDGER_LIMIT = 50;
const GRACE_SECS = 86_400;
const SLIPPAGE_BPS = 100;
const MIN_FEE_LAMPORTS = 1_000_000; // 0.001 SOL keeps a burner able to pay a few transactions

const OUTCOME_DECIMALS = 6;

interface Entry {
  sdk: SdkMarket;
  dep: DeployedMarket;
  routing: MarketRouting;
  pools: MarketPools;
  supply: { yes: bigint; no: bigint };
  /** Outcome tokens sitting in the pool vault and in the operator's wallet: not paid by the crank. */
  poolHeld: { yes: bigint; no: bigint };
  operatorHeld: { yes: bigint; no: bigint };
  holders: { a: number; b: number };
  holdersAt: number;
  feeBps: number;
  oddsUpdatedAt: number;
  ledger: { rows: RewardEpoch[]; earned: Map<string, { a: bigint; b: bigint }>; epochs: number; at: number } | null;
  ui: Market;
}

interface OwnerState {
  /** Raw balances by mint. */
  tokens: Map<string, bigint>;
  lamports: number;
  at: number;
}

interface CachedEpoch {
  epoch: number;
  side: "a" | "b";
  ts: number;
  amountPair: number;
  holders: number;
  signature: string;
  recipients: { owner: string; amount: string }[];
}

const num = (raw: { toString(): string } | bigint, decimals: number) => Number(raw.toString()) / 10 ** decimals;
const toRaw = (whole: number, decimals: number) => BigInt(Math.round(whole * 10 ** decimals));
const sdkSide = (s: Side): SdkSide => (s === "a" ? "yes" : "no");
const uiSide = (s: SdkSide): Side => (s === "yes" ? "a" : "b");
const oddsOf = (o: { yes: number; no: number; impliedSum: number }): Odds => ({ a: o.yes, b: o.no, impliedSum: o.impliedSum });
const hex0x = (h: string) => (h.startsWith("0x") ? h : `0x${h}`);
const strip0x = (h: string) => h.replace(/^0x/i, "").toLowerCase();

/* ------------------------------------------------------------------ */
/* localStorage (guarded; the adapter also runs during SSR of client components) */
/* ------------------------------------------------------------------ */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full */
  }
}

/* ------------------------------------------------------------------ */
/* Error copy                                                          */
/* ------------------------------------------------------------------ */

function describeError(e: unknown): DataError {
  if (e instanceof DataError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const logs = (e as { logs?: string[] })?.logs?.join("\n") ?? "";
  const all = `${msg}\n${logs}`;
  if (/user rejected|rejected the request|declined/i.test(all)) return new DataError("Signature declined in the wallet.");
  if (/insufficient funds for (rent|fee)|Attempt to debit an account but found no record/i.test(all)) {
    return new DataError("No SOL for fees. Tap the faucet first.");
  }
  if (/insufficient funds|0x1\b/.test(all) && /Transfer|transfer/.test(all)) return new DataError("Not enough tokens for that trade.");
  if (/ExceededSlippage|slippage|0x1771|0x1772/i.test(all)) return new DataError("Price moved more than 1%. Try again.");
  if (/blockhash not found|block height exceeded/i.test(all)) return new DataError("The transaction expired before it landed. Try again.");
  if (/failed to fetch|networkerror|ECONNREFUSED/i.test(all)) return new DataError("The RPC did not answer. Is the validator running?");
  return new DataError(msg.length > 200 ? `${msg.slice(0, 200)}…` : msg);
}

/* ------------------------------------------------------------------ */
/* The adapter                                                         */
/* ------------------------------------------------------------------ */

export function createChainData(cluster: ChainCluster): DuelData {
  const dep: Deployment = getDeployment(cluster);
  const rpcUrl = rpcUrlFor(cluster);
  const connection = new Connection(rpcUrl, { commitment: "confirmed" });
  const client = new DuelClient(connection, undefined, { programId: new PublicKey(dep.programId) });

  const usdcMint = dep.mints.USDC ? new PublicKey(dep.mints.USDC.mint) : null;
  // The crank (scripts/src/crank.ts) skips the bootstrap operator by default; mirror that in
  // the "accruing" share so a bettor's estimate matches what the crank will pay.
  const operator = dep.operator ? new PublicKey(dep.operator) : null;
  const usdcDecimals = dep.mints.USDC?.decimals ?? 6;
  const symbolByMint = new Map<string, string>();
  for (const m of Object.values(dep.mints)) symbolByMint.set(m.mint, m.symbol);

  const entries = new Map<string, Entry>();
  let order: string[] = [];
  const routings = new Map<string, MarketRouting>();
  const owners = new Map<string, OwnerState>();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let loading: Promise<void> | null = null;
  let loadedOnce = false;
  let lastError: Error | null = null;
  let wallet: WalletSigner | null = null;

  const key = (part: string) => `duel:${cluster}:${part}`;
  const emit = () => listeners.forEach((l) => l());

  /* ---------------------------------------------------------------- registry helpers */

  function assetFor(symbol: string): Asset | null {
    try {
      return getAsset(symbol);
    } catch {
      return null;
    }
  }

  /** A DeployedMarket for any on-chain market whose pair mints are mocks we know (web-created ones too). */
  function deployedFor(m: SdkMarket): DeployedMarket | null {
    const address = m.address.toBase58();
    const known = dep.markets.find((x) => x.address === address);
    if (known && known.poolA && known.poolB) return known;
    if (m.poolA.equals(PublicKey.default) || m.poolB.equals(PublicKey.default)) return null;
    const pairA = symbolByMint.get(m.pairAMint.toBase58());
    const pairB = symbolByMint.get(m.pairBMint.toBase58());
    if (!pairA || !pairB || pairA === "USDC" || pairB === "USDC") return null;
    const stub = (pool: PublicKey, a: PublicKey, b: PublicKey) => ({
      pool: pool.toBase58(),
      position: "",
      positionNft: "",
      positionNftAccount: "",
      tokenAMint: a.toBase58(),
      tokenBMint: b.toBase58(),
      tokenAVault: "",
      tokenBVault: "",
    });
    return {
      address,
      nonce: m.nonce.toString(),
      creator: m.creator.toBase58(),
      question: m.question,
      sideALabel: m.sideALabel,
      sideBLabel: m.sideBLabel,
      pairA,
      pairB,
      collateralMint: m.collateralMint.toBase58(),
      yesMint: m.yesMint.toBase58(),
      noMint: m.noMint.toBase58(),
      poolA: stub(m.poolA, m.yesMint, m.pairAMint),
      poolB: stub(m.poolB, m.noMint, m.pairBMint),
      poolsSet: true,
      template: templateJson(m.template),
      resolveTs: m.resolveTs,
      graceSecs: m.graceSecs,
    };
  }

  function templateJson(t: SdkTemplate) {
    switch (t.kind) {
      case "capCompare":
        return { kind: t.kind, feedA: t.feedA, feedB: t.feedB, sharesA: t.sharesA.toString(), sharesB: t.sharesB.toString() };
      case "ratioOutperform":
        return { kind: t.kind, feedA: t.feedA, feedB: t.feedB, startRatioE9: t.startRatioE9.toString() };
      case "priceAbove":
        return { kind: t.kind, feed: t.feed, thresholdE6: t.thresholdE6.toString() };
    }
  }

  function templateUi(t: SdkTemplate): Template {
    switch (t.kind) {
      case "capCompare":
        return { kind: "CapCompare", feedA: hex0x(t.feedA), feedB: hex0x(t.feedB), sharesA: Number(t.sharesA), sharesB: Number(t.sharesB) };
      case "ratioOutperform":
        return { kind: "RatioOutperform", feedA: hex0x(t.feedA), feedB: hex0x(t.feedB), startRatio: Number(t.startRatioE9) / 1e9 };
      case "priceAbove":
        return { kind: "PriceAbove", feed: hex0x(t.feed), threshold: Number(t.thresholdE6) / 1e6 };
    }
  }

  function routingFor(d: DeployedMarket): MarketRouting | null {
    const hit = routings.get(d.address);
    if (hit) return hit;
    try {
      const r = routingFromDeployment(dep, d);
      routings.set(d.address, r);
      return r;
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------------- odds history (client-sampled) */

  function historyOf(id: string): OddsPoint[] {
    return readJson<OddsPoint[]>(key(`odds:${id}`), []);
  }

  function sampleOdds(id: string, a: number, now: number, force = false): void {
    if (typeof window === "undefined") return;
    const h = historyOf(id);
    const last = h[h.length - 1];
    if (!last) {
      // Every duel opens at 50/50; seed that as the first point so the chart has a baseline.
      h.push({ t: now - 1_000, a: 0.5 }, { t: now, a });
    } else if (force || Math.abs(a - last.a) >= 0.001 || now - last.t >= HISTORY_MIN_GAP_MS) {
      h.push({ t: now, a });
    } else {
      return;
    }
    if (h.length > HISTORY_CAP) h.splice(0, h.length - HISTORY_CAP);
    writeJson(key(`odds:${id}`), h);
  }

  /* ---------------------------------------------------------------- cost basis (client-tracked) */

  const costKey = (id: string, owner: string, side: Side) => key(`cost:${id}:${owner}:${side}`);
  const costOf = (id: string, owner: string, side: Side) => readJson<number>(costKey(id, owner, side), 0);
  const setCost = (id: string, owner: string, side: Side, v: number) => writeJson(costKey(id, owner, side), Math.max(0, v));

  /* ---------------------------------------------------------------- market snapshot */

  function fighter(sym: string, pairMint: PublicKey, price: number, shares: number | null, holders: number, feesPaid: number, feedId: string): Fighter {
    const asset = assetFor(sym);
    const seed = dep.pairPools[sym]?.seedPriceUsd;
    return {
      label: asset?.label ?? sym,
      symbol: sym,
      pairSymbol: asset?.pairSymbol ?? `${sym}x`,
      pairMint: pairMint.toBase58(),
      feedName: asset?.feedName ?? `${sym}/USD`,
      feedId,
      price,
      marketCap: shares ? price * shares : 0,
      sharesOutstanding: shares,
      // No price history on a mock cluster: the move since the pair pool was seeded.
      change30d: seed && seed > 0 ? price / seed - 1 : 0,
      holders,
      feesPaid,
    };
  }

  function buildUi(e: Omit<Entry, "ui">, no: number): Market {
    const m = e.sdk;
    const t = templateUi(m.template);
    const pairDecA = e.routing.pairADecimals;
    const pairDecB = e.routing.pairBDecimals;
    const sharesA = t.kind === "CapCompare" ? t.sharesA : (assetFor(e.dep.pairA)?.shares ?? null);
    const sharesB = t.kind === "CapCompare" ? t.sharesB : (assetFor(e.dep.pairB)?.shares ?? null);
    const feedA = t.kind === "PriceAbove" ? t.feed : t.feedA;
    const feedB = t.kind === "PriceAbove" ? t.feed : t.feedB;
    const odds = oddsOf(e.pools.odds);
    const id = m.address.toBase58();
    const status: Market["status"] =
      m.status.kind === "resolved"
        ? {
            kind: "resolved",
            winner: uiSide(m.status.winner),
            priceA: Number(m.status.priceA) / 1e6,
            priceB: Number(m.status.priceB) / 1e6,
            resolvedTs: m.status.resolvedTs * 1000,
            closingOdds: odds,
            manual: false,
          }
        : { kind: "open" };
    const createdKey = key(`seen:${id}`);
    let createdTs = readJson<number>(createdKey, 0);
    if (!createdTs) {
      const fromDep = dep.markets.some((x) => x.address === id) ? Date.parse(dep.createdAt) : Date.now();
      createdTs = Number.isFinite(fromDep) ? fromDep : Date.now();
      writeJson(createdKey, createdTs);
    }
    // Depth: pair-token value on each side of the outcome pool, from fee-exclusive LP metrics is
    // not available, so approximate with the pool's quoted mid: 2x the pair side value seeded.
    const depthUsd = Number(e.supply.yes - e.poolHeld.yes) > 0 ? num(e.poolHeld.yes, OUTCOME_DECIMALS) * odds.a * 2 : 0;
    return {
      id,
      no,
      network: cluster,
      creator: m.creator.toBase58(),
      question: m.question,
      a: fighter(e.dep.pairA, m.pairAMint, e.pools.pairAUsd, sharesA, e.holders.a, num(m.rewardsPaidA, pairDecA), feedA),
      b: fighter(e.dep.pairB, m.pairBMint, e.pools.pairBUsd, sharesB, e.holders.b, num(m.rewardsPaidB, pairDecB), feedB),
      collateralMint: m.collateralMint.toBase58(),
      yesMint: m.yesMint.toBase58(),
      noMint: m.noMint.toBase58(),
      poolA: m.poolA.toBase58(),
      poolB: m.poolB.toBase58(),
      template: t,
      createdTs,
      resolveTs: m.resolveTs * 1000,
      graceSecs: m.graceSecs,
      resolver: m.resolver.toBase58(),
      crank: m.crank.toBase58(),
      feeBpsHolders: e.feeBps,
      feeBpsCreator: 0,
      feeBpsPlatform: 0,
      status,
      totalMinted: num(m.totalMinted, usdcDecimals),
      totalRedeemed: num(m.totalRedeemed, usdcDecimals),
      rewardsPaidA: num(m.rewardsPaidA, pairDecA),
      rewardsPaidB: num(m.rewardsPaidB, pairDecB),
      epochs: m.epochs,
      odds,
      oddsUpdatedAt: e.oddsUpdatedAt,
      depthUsd,
    };
  }

  /** Order: bootstrapped markets in deployment order, then web-created ones by nonce (a timestamp). */
  function sortIds(list: SdkMarket[]): string[] {
    const depIndex = new Map(dep.markets.map((m, i) => [m.address, i] as const));
    return [...list]
      .sort((x, y) => {
        const xi = depIndex.get(x.address.toBase58());
        const yi = depIndex.get(y.address.toBase58());
        if (xi !== undefined && yi !== undefined) return xi - yi;
        if (xi !== undefined) return -1;
        if (yi !== undefined) return 1;
        return x.nonce < y.nonce ? -1 : x.nonce > y.nonce ? 1 : 0;
      })
      .map((m) => m.address.toBase58());
  }

  /* ---------------------------------------------------------------- polling */

  async function fetchPoolsFor(list: { routing: MarketRouting }[]): Promise<Map<string, PoolState>> {
    const addrs = new Map<string, PublicKey>();
    for (const { routing: r } of list) {
      for (const p of [r.poolA, r.poolB, r.pairPoolA, r.pairPoolB]) addrs.set(p.toBase58(), p);
    }
    const keys = [...addrs.keys()];
    const states = await getPoolStatesBatch(connection, keys.map((k) => addrs.get(k)!));
    const out = new Map<string, PoolState>();
    states.forEach((s, i) => {
      if (s) out.set(keys[i], s);
    });
    return out;
  }

  async function fetchSupplyAndVaults(list: { sdk: SdkMarket; pools: MarketPools }[]) {
    const accounts: PublicKey[] = [];
    const PER = 6;
    for (const { sdk, pools } of list) {
      const opYes = operator ? getAssociatedTokenAddressSync(sdk.yesMint, operator, true) : sdk.yesMint;
      const opNo = operator ? getAssociatedTokenAddressSync(sdk.noMint, operator, true) : sdk.noMint;
      accounts.push(sdk.yesMint, sdk.noMint, pools.poolA.tokenAVault, pools.poolB.tokenAVault, opYes, opNo);
    }
    const infos = accounts.length ? await connection.getMultipleAccountsInfo(accounts, "confirmed") : [];
    return list.map((_, i) => {
      const [yesMint, noMint, vaultA, vaultB, opYes, opNo] = infos.slice(i * PER, i * PER + PER);
      const supplyOf = (info: (typeof infos)[number]) => (info ? MintLayout.decode(info.data).supply : 0n);
      const amountOf = (info: (typeof infos)[number]) => (info && info.data.length >= AccountLayout.span ? AccountLayout.decode(info.data).amount : 0n);
      return {
        supply: { yes: supplyOf(yesMint), no: supplyOf(noMint) },
        poolHeld: { yes: amountOf(vaultA), no: amountOf(vaultB) },
        operatorHeld: operator ? { yes: amountOf(opYes), no: amountOf(opNo) } : { yes: 0n, no: 0n },
      };
    });
  }

  async function countHolders(mint: PublicKey, market: PublicKey, vault: PublicKey): Promise<number> {
    const rows = await snapshotHolders(connection, mint, { exclude: [market], excludeAccounts: [vault] });
    return rows.length;
  }

  async function refresh(): Promise<void> {
    const now = Date.now();
    const all = await client.fetchAllMarkets();
    const prepared: { sdk: SdkMarket; dep: DeployedMarket; routing: MarketRouting }[] = [];
    for (const m of all) {
      const d = deployedFor(m);
      if (!d) continue;
      const r = routingFor(d);
      if (!r) continue;
      prepared.push({ sdk: m, dep: d, routing: r });
    }
    const poolMap = await fetchPoolsFor(prepared);
    const withPools = prepared.flatMap((p) => {
      const r = p.routing;
      const poolA = poolMap.get(r.poolA.toBase58());
      const poolB = poolMap.get(r.poolB.toBase58());
      const pairPoolA = poolMap.get(r.pairPoolA.toBase58());
      const pairPoolB = poolMap.get(r.pairPoolB.toBase58());
      if (!poolA || !poolB || !pairPoolA || !pairPoolB) return [];
      const pools = marketPoolsFromStates(r, { poolA, poolB, pairPoolA, pairPoolB });
      return [{ ...p, pools }];
    });
    const extra = await fetchSupplyAndVaults(withPools);

    const ids = sortIds(withPools.map((w) => w.sdk));
    const next = new Map<string, Entry>();
    for (let i = 0; i < withPools.length; i++) {
      const w = withPools[i];
      const id = w.sdk.address.toBase58();
      const prev = entries.get(id);
      const a = w.pools.odds.yes;
      const moved = !prev || Math.abs(prev.pools.odds.yes - a) >= 0.005;
      const partial: Omit<Entry, "ui"> = {
        sdk: w.sdk,
        dep: w.dep,
        routing: w.routing,
        pools: w.pools,
        supply: extra[i].supply,
        poolHeld: extra[i].poolHeld,
        operatorHeld: extra[i].operatorHeld,
        holders: prev?.holders ?? { a: 0, b: 0 },
        holdersAt: prev?.holdersAt ?? 0,
        feeBps: poolFeeBps(w.pools.poolA) || dep.poolConfig.feeBps,
        oddsUpdatedAt: moved ? now : (prev?.oddsUpdatedAt ?? now),
        ledger: prev?.ledger ?? null,
      };
      if (now - partial.holdersAt >= HOLDERS_MS) {
        try {
          const [ha, hb] = await Promise.all([
            countHolders(w.sdk.yesMint, w.sdk.address, w.pools.poolA.tokenAVault),
            countHolders(w.sdk.noMint, w.sdk.address, w.pools.poolB.tokenAVault),
          ]);
          partial.holders = { a: ha, b: hb };
          partial.holdersAt = now;
        } catch {
          partial.holdersAt = now - HOLDERS_MS + 10_000; // retry in 10s, keep the old count
        }
      }
      const entry: Entry = { ...partial, ui: buildUi(partial, ids.indexOf(id) + 1) };
      next.set(id, entry);
      if (w.sdk.status.kind === "open") sampleOdds(id, a, now);
    }
    for (const id of entries.keys()) if (!next.has(id)) entries.delete(id);
    for (const [id, e] of next) entries.set(id, e);
    order = ids;

    // Ledger: refetch when the epoch counter moved or the last read is stale.
    for (const e of entries.values()) {
      const stale = !e.ledger || e.ledger.epochs !== e.sdk.epochs || now - e.ledger.at >= LEDGER_STALE_MS;
      if (stale) {
        try {
          await loadLedger(e);
        } catch {
          /* keep whatever we had */
        }
      }
    }

    const bound = wallet?.publicKey?.toBase58();
    if (bound) {
      try {
        await loadOwner(bound, true);
      } catch {
        /* balances stay as they were */
      }
    }
    loadedOnce = true;
    lastError = null;
  }

  async function ensureLoaded(): Promise<void> {
    if (loadedOnce) return;
    if (!loading) {
      loading = refresh()
        .catch((e) => {
          lastError = e instanceof Error ? e : new Error(String(e));
          throw lastError;
        })
        .finally(() => {
          loading = null;
        });
    }
    await loading;
  }

  async function tick(): Promise<void> {
    if (loading) return;
    loading = refresh()
      .then(() => emit())
      .catch((e) => {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (!loadedOnce) emit();
      })
      .finally(() => {
        loading = null;
      });
    await loading;
  }

  function need(id: string): Entry {
    const e = entries.get(id);
    if (!e) throw new DataError("No duel by that name.");
    return e;
  }

  /* ---------------------------------------------------------------- ledger */

  const ledgerKey = (id: string) => key(`ledger:${id}`);

  function cachedRows(id: string): CachedEpoch[] {
    return readJson<CachedEpoch[]>(ledgerKey(id), []);
  }

  function toCached(id: string, rows: SdkRewardEpoch[], pairDec: { a: number; b: number }): CachedEpoch[] {
    return rows.map((r) => {
      const side = uiSide(r.side);
      return {
        epoch: r.epoch,
        side,
        ts: r.ts * 1000,
        amountPair: num(r.total, side === "a" ? pairDec.a : pairDec.b),
        holders: r.count,
        signature: r.signatures[0],
        recipients: r.recipients.map((x) => ({ owner: x.owner.toBase58(), amount: x.amount.toString() })),
      };
    });
  }

  async function loadLedger(e: Entry): Promise<void> {
    const id = e.sdk.address.toBase58();
    const fresh = await client.fetchRewardEpochs(e.sdk.address, LEDGER_LIMIT);
    const pairDec = { a: e.routing.pairADecimals, b: e.routing.pairBDecimals };
    const merged = new Map<string, CachedEpoch>();
    for (const row of cachedRows(id)) merged.set(row.signature, row);
    for (const row of toCached(id, fresh, pairDec)) merged.set(row.signature, row);
    const rows = [...merged.values()].sort((x, y) => y.ts - x.ts || y.epoch - x.epoch);
    writeJson(ledgerKey(id), rows);
    const earned = new Map<string, { a: bigint; b: bigint }>();
    for (const row of rows) {
      for (const rc of row.recipients) {
        const cur = earned.get(rc.owner) ?? { a: 0n, b: 0n };
        if (row.side === "a") cur.a += BigInt(rc.amount);
        else cur.b += BigInt(rc.amount);
        earned.set(rc.owner, cur);
      }
    }
    e.ledger = {
      rows: rows.map((r) => ({ marketId: id, epoch: r.epoch, side: r.side, ts: r.ts, amountPair: r.amountPair, holders: r.holders, signature: r.signature })),
      earned,
      epochs: e.sdk.epochs,
      at: Date.now(),
    };
  }

  /* ---------------------------------------------------------------- owner balances */

  async function loadOwner(owner: string, force = false): Promise<OwnerState> {
    const hit = owners.get(owner);
    if (hit && !force && Date.now() - hit.at < POLL_MS) return hit;
    const pk = new PublicKey(owner);
    const [parsed, lamports] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
      connection.getBalance(pk, "confirmed"),
    ]);
    const tokens = new Map<string, bigint>();
    for (const { account } of parsed.value) {
      const info = account.data.parsed?.info as { mint?: string; tokenAmount?: { amount?: string } } | undefined;
      if (!info?.mint || !info.tokenAmount?.amount) continue;
      tokens.set(info.mint, (tokens.get(info.mint) ?? 0n) + BigInt(info.tokenAmount.amount));
    }
    const state = { tokens, lamports, at: Date.now() };
    owners.set(owner, state);
    return state;
  }

  function positionFor(e: Entry, owner: string, st: OwnerState, side: Side): Position | null {
    const m = e.sdk;
    const mint = side === "a" ? m.yesMint : m.noMint;
    const raw = st.tokens.get(mint.toBase58()) ?? 0n;
    if (raw <= 0n) return null;
    const size = num(raw, OUTCOME_DECIMALS);
    const id = m.address.toBase58();
    const odds = side === "a" ? e.pools.odds.yes : e.pools.odds.no;
    const pairDec = side === "a" ? e.routing.pairADecimals : e.routing.pairBDecimals;
    const earnedRaw = e.ledger?.earned.get(owner)?.[side] ?? 0n;
    // Accruing: LP fees the outcome pool has collected but the crank has not paid yet, times this
    // wallet's share of the outcome tokens outside the pool.
    const pool = side === "a" ? e.pools.poolA : e.pools.poolB;
    const paid = side === "a" ? m.rewardsPaidA : m.rewardsPaidB;
    const undistributed = poolLpFees(pool).b - paid;
    const supply = side === "a" ? e.supply.yes : e.supply.no;
    const held = side === "a" ? e.poolHeld.yes : e.poolHeld.no;
    const opHeld = owner === operator?.toBase58() ? 0n : side === "a" ? e.operatorHeld.yes : e.operatorHeld.no;
    const eligible = supply - held - opHeld;
    const share = eligible > 0n ? Math.min(1, Number(raw) / Number(eligible)) : 0;
    const claimable = undistributed > 0n ? num(undistributed, pairDec) * share : 0;
    const resolved = m.status.kind === "resolved";
    const won = resolved && m.status.kind === "resolved" && uiSide(m.status.winner) === side;
    return {
      marketId: id,
      owner,
      side,
      size,
      cost: costOf(id, owner, side),
      value: resolved ? (won ? size : 0) : size * odds,
      earnedPair: num(earnedRaw, pairDec),
      claimablePair: claimable,
      redeemableUsdc: won ? size : 0,
    };
  }

  /* ---------------------------------------------------------------- signing */

  function requireWallet(owner: string): WalletSigner & { publicKey: PublicKey } {
    if (!wallet?.publicKey) throw new DataError("Connect a wallet to sign.");
    if (wallet.publicKey.toBase58() !== owner) throw new DataError("Wallet changed. Reconnect and try again.");
    return wallet as WalletSigner & { publicKey: PublicKey };
  }

  async function sendAndConfirm(tx: Transaction, w: WalletSigner & { publicKey: PublicKey }, signers: Signer[] = []): Promise<string> {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = w.publicKey;
    let signature: string;
    try {
      signature = await w.sendTransaction(tx, connection, { signers, preflightCommitment: "confirmed" });
    } catch (e) {
      throw describeError(e);
    }
    // Poll instead of subscribing: no WebSocket dependency on a test validator.
    const started = Date.now();
    for (;;) {
      const st = (await connection.getSignatureStatuses([signature])).value[0];
      if (st?.err) throw new DataError(`Transaction ${signature.slice(0, 8)}… failed on chain.`);
      if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return signature;
      if (Date.now() - started > 60_000) throw new DataError("The transaction did not confirm in time.");
      const height = await connection.getBlockHeight("confirmed");
      if (height > lastValidBlockHeight) throw new DataError("The transaction expired before it landed. Try again.");
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  async function freshPools(e: Entry): Promise<MarketPools> {
    const map = await fetchPoolsFor([e]);
    const r = e.routing;
    const poolA = map.get(r.poolA.toBase58());
    const poolB = map.get(r.poolB.toBase58());
    const pairPoolA = map.get(r.pairPoolA.toBase58());
    const pairPoolB = map.get(r.pairPoolB.toBase58());
    if (!poolA || !poolB || !pairPoolA || !pairPoolB) throw new DataError("A pool for this duel is missing.");
    const pools = marketPoolsFromStates(r, { poolA, poolB, pairPoolA, pairPoolB });
    e.pools = pools;
    return pools;
  }

  async function afterTx(e: Entry, owner: string): Promise<void> {
    try {
      await freshPools(e);
      // Supply, pool vault and operator balances feed the "accruing" share; refresh them now
      // rather than waiting for the next poll.
      const [extra] = await fetchSupplyAndVaults([e]);
      e.supply = extra.supply;
      e.poolHeld = extra.poolHeld;
      e.operatorHeld = extra.operatorHeld;
      const a = e.pools.odds.yes;
      const moved = Math.abs(e.ui.odds.a - a) >= 0.005;
      if (moved) e.oddsUpdatedAt = Date.now();
      e.ui = buildUi(e, e.ui.no);
      sampleOdds(e.ui.id, a, Date.now(), true);
      await loadOwner(owner, true);
    } catch {
      /* the next poll repairs it */
    }
    emit();
  }

  function usdcBalanceOf(st: OwnerState): number {
    return usdcMint ? num(st.tokens.get(usdcMint.toBase58()) ?? 0n, usdcDecimals) : 0;
  }

  /* ---------------------------------------------------------------- create market helpers */

  /** USDC needed on a pair/USDC pool to receive at least `target` pair tokens after slippage. */
  async function usdcForPair(pool: PublicKey, state: PoolState, pairUsd: number, target: ReturnType<typeof toBN>) {
    if (!usdcMint) throw new DataError("This deployment has no USDC mint.");
    let usdcIn = toBN(BigInt(Math.ceil(num(target, OUTCOME_DECIMALS) * pairUsd * 1.03 * 10 ** usdcDecimals)));
    for (let i = 0; i < 6; i++) {
      const q = await quoteSwap(connection, { address: pool, state }, usdcMint, usdcIn, SLIPPAGE_BPS);
      if (q.minAmountOut.gte(target)) return { usdcIn, minOut: q.minAmountOut };
      usdcIn = usdcIn.muln(103).divn(100);
    }
    throw new DataError("Could not size the pair-token purchase. Try a smaller seed.");
  }

  /* ---------------------------------------------------------------- the interface */

  return {
    network: cluster,

    bindWallet(w) {
      wallet = w;
      const owner = w?.publicKey?.toBase58();
      if (owner && loadedOnce) {
        loadOwner(owner, true)
          .then(() => emit())
          .catch(() => undefined);
      }
    },

    async listMarkets() {
      await ensureLoaded();
      if (!loadedOnce && lastError) throw describeError(lastError);
      return order.map((id) => entries.get(id)!.ui).filter(Boolean);
    },

    async getMarket(id) {
      await ensureLoaded();
      return entries.get(id)?.ui ?? null;
    },

    async getOddsHistory(id) {
      await ensureLoaded();
      return historyOf(id);
    },

    async getLedger(id) {
      await ensureLoaded();
      const e = entries.get(id);
      if (!e) return [];
      if (!e.ledger) {
        try {
          await loadLedger(e);
        } catch {
          return [];
        }
      }
      return e.ledger?.rows ?? [];
    },

    async getPosition(id, owner, side) {
      if (!owner) return null;
      await ensureLoaded();
      const e = entries.get(id);
      if (!e) return null;
      const st = await loadOwner(owner);
      if (side) return positionFor(e, owner, st, side);
      const both = (["a", "b"] as Side[]).map((s) => positionFor(e, owner, st, s)).filter((p): p is Position => !!p);
      return both.sort((x, y) => y.size - x.size)[0] ?? null;
    },

    async listPositions(owner) {
      if (!owner) return [];
      await ensureLoaded();
      const st = await loadOwner(owner);
      const out: Position[] = [];
      for (const id of order) {
        const e = entries.get(id)!;
        for (const s of ["a", "b"] as Side[]) {
          const p = positionFor(e, owner, st, s);
          if (p) out.push(p);
        }
      }
      return out;
    },

    async getBalance(owner) {
      if (!owner) return { usdc: 0, pair: {} };
      const st = await loadOwner(owner);
      const pair: Record<string, number> = {};
      for (const m of Object.values(dep.mints)) {
        if (m.symbol === "USDC") continue;
        const raw = st.tokens.get(m.mint) ?? 0n;
        if (raw > 0n) pair[assetFor(m.symbol)?.pairSymbol ?? `${m.symbol}x`] = num(raw, m.decimals);
      }
      return { usdc: usdcBalanceOf(st), pair };
    },

    async previewBet(id, side, usdc): Promise<BetPreview> {
      await ensureLoaded();
      const e = need(id);
      if (e.sdk.status.kind !== "open") throw new DataError("This duel is settled.");
      const raw = toRaw(Math.max(0, usdc), usdcDecimals);
      if (raw <= 0n) return { outcomeOut: 0, pairIn: 0, feeInPair: 0, oddsAfter: e.ui.odds, priceImpactBps: 0 };
      const pairDec = side === "a" ? e.routing.pairADecimals : e.routing.pairBDecimals;
      try {
        const p = await sdkPreviewBet({ connection, routing: e.routing, side: sdkSide(side), usdcAmount: raw, slippageBps: SLIPPAGE_BPS, pools: e.pools });
        return {
          outcomeOut: num(p.outcomeOut, OUTCOME_DECIMALS),
          pairIn: num(p.pairIn, pairDec),
          feeInPair: num(p.feePaidInPair, pairDec),
          oddsAfter: oddsOf(p.oddsAfter),
          priceImpactBps: p.priceImpactBps,
        };
      } catch (err) {
        throw describeError(err);
      }
    },

    async previewSell(id, side, size): Promise<SellPreview> {
      await ensureLoaded();
      const e = need(id);
      if (e.sdk.status.kind !== "open") throw new DataError("This duel is settled.");
      const raw = toRaw(Math.max(0, size), OUTCOME_DECIMALS);
      if (raw <= 0n) return { usdcOut: 0, pairOut: 0, feeInPair: 0, oddsAfter: e.ui.odds, priceImpactBps: 0 };
      const pairDec = side === "a" ? e.routing.pairADecimals : e.routing.pairBDecimals;
      try {
        const p = await sdkPreviewSell({ connection, routing: e.routing, side: sdkSide(side), outcomeAmount: raw, slippageBps: SLIPPAGE_BPS, pools: e.pools });
        return {
          usdcOut: num(p.usdcOut, usdcDecimals),
          pairOut: num(p.pairOut, pairDec),
          feeInPair: num(p.feePaidInPair, pairDec),
          oddsAfter: oddsOf(p.oddsAfter),
          priceImpactBps: p.priceImpactBps,
        };
      } catch (err) {
        throw describeError(err);
      }
    },

    async placeBet(id, side, usdc, owner): Promise<TxResult> {
      await ensureLoaded();
      const e = need(id);
      if (e.sdk.status.kind !== "open") throw new DataError("This duel is settled.");
      if (!(usdc > 0)) throw new DataError("Enter an amount.");
      const w = requireWallet(owner);
      const st = await loadOwner(owner, true);
      if (st.lamports < MIN_FEE_LAMPORTS) throw new DataError("No SOL for fees. Tap the faucet first.");
      const have = usdcBalanceOf(st);
      if (have + 1e-9 < usdc) throw new DataError(`Not enough USDC. You have ${have.toFixed(2)}.`);
      const raw = toRaw(usdc, usdcDecimals);
      let tx: Transaction;
      try {
        const pools = await freshPools(e);
        ({ tx } = await buildBetTx({
          connection,
          routing: e.routing,
          side: sdkSide(side),
          usdcAmount: raw,
          slippageBps: SLIPPAGE_BPS,
          pools,
          payer: w.publicKey,
          withBlockhash: false,
        }));
      } catch (err) {
        throw describeError(err);
      }
      const signature = await sendAndConfirm(tx, w);
      setCost(id, owner, side, costOf(id, owner, side) + usdc);
      await afterTx(e, owner);
      return { signature };
    },

    async sell(id, side, size, owner): Promise<TxResult> {
      await ensureLoaded();
      const e = need(id);
      if (e.sdk.status.kind !== "open") throw new DataError("This duel is settled. Redeem instead.");
      const w = requireWallet(owner);
      const st = await loadOwner(owner, true);
      const name = side === "a" ? e.ui.a.label : e.ui.b.label;
      const held = positionFor(e, owner, st, side)?.size ?? 0;
      if (held <= 0) throw new DataError(`You hold no ${name}.`);
      if (size > held + 1e-9) throw new DataError(`You hold ${held.toFixed(2)} ${name}.`);
      if (st.lamports < MIN_FEE_LAMPORTS) throw new DataError("No SOL for fees. Tap the faucet first.");
      const raw = toRaw(size, OUTCOME_DECIMALS);
      let tx: Transaction;
      let usdcOut = 0;
      try {
        const pools = await freshPools(e);
        const built = await buildSellTx({
          connection,
          routing: e.routing,
          side: sdkSide(side),
          outcomeAmount: raw,
          slippageBps: SLIPPAGE_BPS,
          pools,
          payer: w.publicKey,
          withBlockhash: false,
        });
        tx = built.tx;
        usdcOut = num(built.preview.usdcOut, usdcDecimals);
      } catch (err) {
        throw describeError(err);
      }
      const signature = await sendAndConfirm(tx, w);
      setCost(id, owner, side, costOf(id, owner, side) - usdcOut);
      await afterTx(e, owner);
      return { signature };
    },

    async createMarket(params: CreateMarketParams, onProgress) {
      await ensureLoaded();
      const w = requireWallet(params.creator);
      if (!usdcMint) throw new DataError("This deployment has no USDC mint.");
      if (params.template.kind === "PriceAbove") {
        throw new DataError("Price-above duels are not routed on this deployment yet. Pick Cap compare or Outperform.");
      }
      if (!params.b) throw new DataError("Pick a right corner.");
      if (params.b.symbol === params.a.symbol) throw new DataError("A fighter cannot duel itself.");
      const available = Object.keys(dep.pairPools);
      const mintA = dep.mints[params.a.symbol];
      const mintB = dep.mints[params.b.symbol];
      const poolA = dep.pairPools[params.a.symbol];
      const poolB = dep.pairPools[params.b.symbol];
      if (!mintA || !poolA) throw new DataError(`No mock ${params.a.symbol} on ${cluster}. Pick from ${available.join(", ")}.`);
      if (!mintB || !poolB) throw new DataError(`No mock ${params.b.symbol} on ${cluster}. Pick from ${available.join(", ")}.`);
      if (!(params.seedUsdc >= 10)) throw new DataError("Seed at least 10 USDC.");
      if (params.resolveTs <= Date.now() + 3_600_000) throw new DataError("Resolution must be at least an hour out.");
      const st = await loadOwner(params.creator, true);
      if (st.lamports < 20_000_000) throw new DataError("Opening a duel needs about 0.02 SOL for rent. Tap the faucet first.");
      const have = usdcBalanceOf(st);
      if (have + 1e-9 < params.seedUsdc) throw new DataError(`Not enough USDC. You have ${have.toFixed(2)}.`);

      const progress = (text: string) => onProgress?.(text);
      const pairAMint = new PublicKey(mintA.mint);
      const pairBMint = new PublicKey(mintB.mint);
      const pairPoolA = new PublicKey(poolA.pool);
      const pairPoolB = new PublicKey(poolB.pool);
      const labelA = params.a.label;
      const labelB = params.b.label;
      const symA = assetFor(params.a.symbol)?.pairSymbol ?? `${params.a.symbol}x`;
      const symB = assetFor(params.b.symbol)?.pairSymbol ?? `${params.b.symbol}x`;

      try {
        // Live pair prices from the USDC pools: the outcome pools open at exactly 50/50 against them.
        const [ppa, ppb] = await getPoolStatesBatch(connection, [pairPoolA, pairPoolB]);
        if (!ppa || !ppb) throw new DataError("A pair/USDC pool is missing on this deployment.");
        const pairAUsd = pairUsdFromPool(ppa, pairAMint, mintA.decimals, usdcDecimals);
        const pairBUsd = pairUsdFromPool(ppb, pairBMint, mintB.decimals, usdcDecimals);

        const template: SdkTemplate =
          params.template.kind === "CapCompare"
            ? {
                kind: "capCompare",
                feedA: strip0x(params.template.feedA),
                feedB: strip0x(params.template.feedB),
                sharesA: BigInt(Math.round(params.template.sharesA)),
                sharesB: BigInt(Math.round(params.template.sharesB)),
              }
            : {
                kind: "ratioOutperform",
                feedA: strip0x(params.template.feedA),
                feedB: strip0x(params.template.feedB),
                startRatioE9: BigInt(Math.round((pairAUsd / pairBUsd) * 1e9)),
              };

        // Seed S splits into a set of S/2.04 (S/2.04 USDC in, that many YES and NO out) and the
        // pair tokens each pool needs at 50/50 (half the set's value per side), with 1% fee headroom.
        const setRaw = BigInt(Math.floor((params.seedUsdc / 2.04) * 10 ** usdcDecimals));
        const setWhole = num(setRaw, usdcDecimals);
        const needA = quoteAmountForPrice(setRaw, 0.5 / pairAUsd, OUTCOME_DECIMALS, mintA.decimals);
        const needB = quoteAmountForPrice(setRaw, 0.5 / pairBUsd, OUTCOME_DECIMALS, mintB.decimals);

        // 1. create_market
        progress(`1 of 6. Opening ${labelA} vs ${labelB} on chain.`);
        const created = await client.createMarketIx({
          nonce: BigInt(Date.now()),
          question: params.question,
          sideALabel: labelA.slice(0, 24),
          sideBLabel: labelB.slice(0, 24),
          collateralMint: usdcMint,
          pairAMint,
          pairBMint,
          template,
          resolveTs: Math.floor(params.resolveTs / 1000),
          graceSecs: GRACE_SECS,
          resolver: w.publicKey,
          crank: w.publicKey,
          feeBpsHolders: 10_000,
          feeBpsCreator: 0,
          feeBpsPlatform: 0,
          creator: w.publicKey,
        });
        await sendAndConfirm(new Transaction().add(created.ix), w);
        const market = await client.fetchMarket(created.market);

        // 2. mint_set
        progress(`2 of 6. Minting the set: ${setWhole.toFixed(2)} USDC in, ${setWhole.toFixed(2)} ${labelA} and ${setWhole.toFixed(2)} ${labelB} out.`);
        await sendAndConfirm(new Transaction().add(await client.mintSetIx(market, setRaw, w.publicKey)), w);

        // 3. buy the pair tokens both pools need
        progress(`3 of 6. Buying ${num(needA, mintA.decimals).toFixed(4)} ${symA} and ${num(needB, mintB.decimals).toFixed(4)} ${symB} to seed the pools.`);
        const buyA = await usdcForPair(pairPoolA, ppa, pairAUsd, needA);
        const buyB = await usdcForPair(pairPoolB, ppb, pairBUsd, needB);
        const swapA = await buildSwapIx({ connection, payer: w.publicKey, pool: pairPoolA, poolState: ppa, inputMint: usdcMint, outputMint: pairAMint, amountIn: buyA.usdcIn, minAmountOut: buyA.minOut });
        const swapB = await buildSwapIx({ connection, payer: w.publicKey, pool: pairPoolB, poolState: ppb, inputMint: usdcMint, outputMint: pairBMint, amountIn: buyB.usdcIn, minAmountOut: buyB.minOut });
        await sendAndConfirm(new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...swapA, ...swapB), w);

        // 4 + 5. outcome pools at 50/50 (token A = outcome, token B = pair, fee in the pair only)
        progress(`4 of 6. Seeding the ${labelA} pool at 50–50 in ${symA}.`);
        const poolAx = await createPairPool({
          connection,
          payer: w.publicKey,
          tokenA: market.yesMint,
          tokenB: pairAMint,
          tokenADecimals: OUTCOME_DECIMALS,
          tokenBDecimals: mintA.decimals,
          priceInB: 0.5 / pairAUsd,
          tokenAAmount: setRaw,
          feeBps: params.feeBps,
        });
        await sendAndConfirm(poolAx.tx, w, poolAx.signers);

        progress(`5 of 6. Seeding the ${labelB} pool at 50–50 in ${symB}.`);
        const poolBx = await createPairPool({
          connection,
          payer: w.publicKey,
          tokenA: market.noMint,
          tokenB: pairBMint,
          tokenADecimals: OUTCOME_DECIMALS,
          tokenBDecimals: mintB.decimals,
          priceInB: 0.5 / pairBUsd,
          tokenAAmount: setRaw,
          feeBps: params.feeBps,
        });
        await sendAndConfirm(poolBx.tx, w, poolBx.signers);

        // 6. set_pools
        progress("6 of 6. Linking both pools to the market.");
        const signature = await sendAndConfirm(new Transaction().add(await client.setPoolsIx(created.market, poolAx.pool, poolBx.pool, w.publicKey)), w);

        const id = created.market.toBase58();
        writeJson(key(`seen:${id}`), Date.now());
        setCost(id, params.creator, "a", 0);
        loadedOnce = false;
        await ensureLoaded();
        emit();
        return { id, signature };
      } catch (err) {
        throw describeError(err);
      }
    },

    async redeem(id, owner): Promise<TxResult> {
      await ensureLoaded();
      const e = need(id);
      const m = e.sdk;
      if (m.status.kind !== "resolved") throw new DataError("Not settled yet.");
      const w = requireWallet(owner);
      const st = await loadOwner(owner, true);
      const winner = uiSide(m.status.winner);
      const mint = winner === "a" ? m.yesMint : m.noMint;
      const raw = st.tokens.get(mint.toBase58()) ?? 0n;
      if (raw <= 0n) throw new DataError("Nothing to redeem on the winning side.");
      if (st.lamports < MIN_FEE_LAMPORTS) throw new DataError("No SOL for fees. Tap the faucet first.");
      let tx: Transaction;
      try {
        tx = new Transaction().add(await client.redeemIx(m, raw, w.publicKey));
      } catch (err) {
        throw describeError(err);
      }
      const signature = await sendAndConfirm(tx, w);
      setCost(id, owner, winner, 0);
      await afterTx(e, owner);
      return { signature };
    },

    async faucet(owner): Promise<TxResult> {
      let res: Response;
      try {
        res = await fetch("/api/faucet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ owner }),
        });
      } catch {
        throw new DataError("The faucet did not answer.");
      }
      const body = (await res.json().catch(() => ({}))) as { signature?: string; error?: string };
      if (!res.ok || !body.signature) throw new DataError(body.error ?? "Faucet is dry.");
      try {
        await loadOwner(owner, true);
      } catch {
        /* next poll */
      }
      emit();
      return { signature: body.signature };
    },

    subscribe(listener) {
      listeners.add(listener);
      if (!timer && typeof window !== "undefined") {
        void tick();
        timer = setInterval(() => void tick(), POLL_MS);
      }
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
