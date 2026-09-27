/**
 * Bootstrap a cluster: mock mints, pair/USDC pools, three markets with their YES/NO pools,
 * and packages/sdk/deployments/<cluster>.json.
 *
 * Idempotent: every step checks the chain (and the existing deployment file) before creating
 * anything, so re-running after a partial failure continues where it stopped. Market PDAs use
 * fixed nonces (1, 2, 3) per operator so the same operator always gets the same markets.
 *
 *   pnpm --filter scripts bootstrap            # RPC_URL / KEYPAIR_PATH from .env
 *   pnpm --filter scripts bootstrap -- --fee-bps 100 --seed-usd 250000
 */
import { PublicKey, sendAndConfirmTransaction, type Keypair } from "@solana/web3.js";
import { createMint, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  ASSETS,
  DUEL_PROGRAM_ID,
  DuelClient,
  createPairPool,
  emptyDeployment,
  getPoolState,
  listPositionsInPool,
  loadDeploymentIfExists,
  poolAddressFor,
  poolExists,
  saveDeployment,
  templateToJson,
  type DeployedPool,
  type Deployment,
  type Template,
} from "@versus/sdk";
import { CLUSTER, PROGRAM_ID_OVERRIDE, RPC_URL, ensureSol, explorerTx, flagNumber, flagString, fmt, getConnection, loadKeypair, parseArgs, walletFor } from "./env.js";

const DECIMALS = 6;
const SUPPLY = 10_000_000n * 10n ** BigInt(DECIMALS); // 10M of each mock token to the operator

/**
 * Seed USD prices for the pair/USDC pools. These are devnet seed numbers only (the on-chain pools
 * are the price source there); mainnet odds read Pyth instead.
 */
const SEED_PRICES: Record<string, number> = {
  AAPL: 340.35,
  NVDA: 223.96,
  TSLA: 250,
  F: 11,
  BTC: 65000,
  ETH: 2400,
};
const MOCK_SYMBOLS = ["USDC", "AAPL", "NVDA", "TSLA", "F", "BTC", "ETH"] as const;

const RESOLVE_TS = Math.floor(Date.UTC(2026, 11, 31, 21, 0, 0) / 1000); // 2026-12-31T21:00:00Z, after US close
const GRACE = 86_400;
const SET_SIZE = 5_000n * 10n ** BigInt(DECIMALS); // mint a set of 5,000 per market
const OUTCOME_SEED = 2_000n * 10n ** BigInt(DECIMALS); // 2,000 of each outcome token seeds its pool

interface MarketDef {
  nonce: number;
  question: string;
  sideALabel: string;
  sideBLabel: string;
  pairA: string;
  pairB: string;
  template: Template;
  /** Defaults to RESOLVE_TS. */
  resolveTs?: number;
}

const MARKETS: MarketDef[] = [
  {
    nonce: 1,
    question: "Will Apple be worth more than Nvidia on December 31, 2026?",
    sideALabel: "Apple",
    sideBLabel: "Nvidia",
    pairA: "AAPL",
    pairB: "NVDA",
    template: {
      kind: "capCompare",
      feedA: ASSETS.AAPL.pythFeedId,
      feedB: ASSETS.NVDA.pythFeedId,
      // Placeholder share counts: update from the latest 10-Q before mainnet.
      sharesA: 14_800_000_000n,
      sharesB: 24_400_000_000n,
    },
  },
  {
    nonce: 2,
    question: "Will Bitcoin outperform Ethereum by December 31, 2026?",
    sideALabel: "Bitcoin",
    sideBLabel: "Ethereum",
    pairA: "BTC",
    pairB: "ETH",
    template: {
      kind: "ratioOutperform",
      feedA: ASSETS.BTC.pythFeedId,
      feedB: ASSETS.ETH.pythFeedId,
      // Start ratio from the seed prices; on mainnet take it from Pyth at creation.
      startRatioE9: BigInt(Math.round((SEED_PRICES.BTC / SEED_PRICES.ETH) * 1e9)),
    },
  },
  {
    nonce: 3,
    question: "Will Tesla still be worth more than Ford on December 31, 2026?",
    sideALabel: "Tesla",
    sideBLabel: "Ford",
    pairA: "TSLA",
    pairB: "F",
    template: {
      kind: "capCompare",
      feedA: ASSETS.TSLA.pythFeedId,
      feedB: ASSETS.F.pythFeedId,
      // Placeholder share counts: update from the latest 10-Q before mainnet.
      sharesA: 3_200_000_000n,
      sharesB: 3_900_000_000n,
    },
  },
];

/** Test markets (`--with-test-market`): resolve_ts two grace periods ago, so both resolve paths are open. */
const TEST_MARKETS: Record<string, { base: MarketDef; question: string }> = {
  "aapl-nvda": { base: MARKETS[0], question: "(test) Was Apple worth more than Nvidia yesterday?" },
  // Crypto feeds tick 24/7, so this one can settle through Pyth (`resolve` without --manual) at any hour.
  "btc-eth": { base: MARKETS[1], question: "(test) Did Bitcoin outperform Ethereum?" },
};

async function main() {
  const args = parseArgs();
  const feeBps = flagNumber(args, "fee-bps", 100);
  const seedUsd = flagNumber(args, "seed-usd", 250_000); // USDC per pair pool side
  // --skip-markets stages mints + pair/USDC pools before the program is deployed; re-run without it later.
  const skipMarkets = args.flags["skip-markets"] === true;
  // --with-test-market adds a market whose resolve_ts + grace is already in the past, so `resolve`
  // and `redeem` can be exercised (acceptance criterion 4). --test-nonce picks a fresh one once
  // the last is spent; --test-pair aapl-nvda (default, manual resolve) or btc-eth (Pyth resolve).
  const withTestMarket = args.flags["with-test-market"] === true;
  const testNonce = flagNumber(args, "test-nonce", 99);
  const testPair = flagString(args, "test-pair") ?? "aapl-nvda";
  const test = TEST_MARKETS[testPair];
  if (withTestMarket && !test) throw new Error(`--test-pair must be one of ${Object.keys(TEST_MARKETS).join(", ")}`);

  const connection = getConnection();
  const operator = loadKeypair();
  const wallet = walletFor(operator);
  const programId = PROGRAM_ID_OVERRIDE ?? DUEL_PROGRAM_ID;

  console.log(`cluster=${CLUSTER} rpc=${RPC_URL}`);
  console.log(`operator=${operator.publicKey.toBase58()} program=${programId.toBase58()}`);

  const programInfo = await connection.getAccountInfo(programId);
  if (!programInfo?.executable && !skipMarkets) {
    throw new Error(
      `Program ${programId.toBase58()} is not deployed on ${RPC_URL}. Deploy it first (anchor deploy), set PROGRAM_ID, or pass --skip-markets to stage mints and pools only.`,
    );
  }
  const bal = await ensureSol(connection, operator.publicKey, 3);
  console.log(`balance=${bal.toFixed(3)} SOL`);

  let dep: Deployment =
    (await loadDeploymentIfExists(CLUSTER)) ??
    emptyDeployment({ cluster: CLUSTER, rpcUrl: RPC_URL, programId: programId.toBase58(), operator: operator.publicKey.toBase58(), feeBps });
  if (dep.programId !== programId.toBase58()) {
    console.warn(`deployment file has program ${dep.programId}; overriding with ${programId.toBase58()}`);
    dep.programId = programId.toBase58();
  }
  if (dep.operator !== operator.publicKey.toBase58()) {
    console.warn(`deployment file operator ${dep.operator} differs from keypair; markets from the old operator will be kept but new ones use this key`);
    dep.operator = operator.publicKey.toBase58();
  }
  dep.rpcUrl = RPC_URL;
  dep.poolConfig = { feeBps, collectFeeMode: 1 };
  await pruneDeployment(connection, new DuelClient(connection, wallet, { programId }), dep);

  /* ------------------------------------------------------------ 1. mock mints */
  console.log("\n== mints");
  for (const sym of MOCK_SYMBOLS) {
    const existing = dep.mints[sym];
    if (existing && (await connection.getAccountInfo(new PublicKey(existing.mint)))) {
      console.log(`  ${sym.padEnd(5)} ${existing.mint} (exists)`);
    } else {
      const mint = await createMint(connection, operator, operator.publicKey, null, DECIMALS);
      dep.mints[sym] = { symbol: sym, mint: mint.toBase58(), decimals: DECIMALS };
      console.log(`  ${sym.padEnd(5)} ${mint.toBase58()} (created)`);
      await saveDeployment(dep);
    }
    // Mint the supply once (only when the operator's account is empty, so re-runs do not inflate).
    const mint = new PublicKey(dep.mints[sym].mint);
    const ata = await getOrCreateAssociatedTokenAccount(connection, operator, mint, operator.publicKey);
    if (ata.amount === 0n) {
      await mintTo(connection, operator, mint, ata.address, operator, SUPPLY);
      console.log(`         minted ${fmt(SUPPLY)} ${sym} to operator`);
    }
  }
  const usdcMint = new PublicKey(dep.mints.USDC.mint);

  /* ------------------------------------------------------------ 2. pair / USDC pools */
  console.log("\n== pair/USDC pools (token A = pair, token B = USDC, fee " + feeBps + " bps in USDC)");
  for (const sym of Object.keys(SEED_PRICES)) {
    const price = SEED_PRICES[sym];
    const pairMint = new PublicKey(dep.mints[sym].mint);
    const pool = poolAddressFor(pairMint, usdcMint);
    if (await poolExists(connection, pool)) {
      if (dep.pairPools[sym]?.pool !== pool.toBase58()) {
        dep.pairPools[sym] = { symbol: sym, seedPriceUsd: price, ...(await recoverPool(connection, pool, operator.publicKey)) };
        await saveDeployment(dep);
      }
      console.log(`  ${sym.padEnd(5)} ${pool.toBase58()} (exists) $${price}`);
      continue;
    }
    const pairAmount = BigInt(Math.floor((seedUsd / price) * 10 ** DECIMALS));
    const created = await createPairPool({
      connection,
      payer: operator.publicKey,
      tokenA: pairMint,
      tokenB: usdcMint,
      tokenADecimals: DECIMALS,
      tokenBDecimals: DECIMALS,
      priceInB: price,
      tokenAAmount: pairAmount,
      feeBps,
    });
    const sig = await sendAndConfirmTransaction(connection, created.tx, [operator, ...created.signers], { commitment: "confirmed" });
    const state = await getPoolState(connection, created.pool);
    dep.pairPools[sym] = {
      symbol: sym,
      seedPriceUsd: price,
      pool: created.pool.toBase58(),
      position: created.position.toBase58(),
      positionNft: created.positionNft.publicKey.toBase58(),
      positionNftAccount: created.positionNftAccount.toBase58(),
      tokenAMint: state.tokenAMint.toBase58(),
      tokenBMint: state.tokenBMint.toBase58(),
      tokenAVault: state.tokenAVault.toBase58(),
      tokenBVault: state.tokenBVault.toBase58(),
    };
    await saveDeployment(dep);
    console.log(`  ${sym.padEnd(5)} ${created.pool.toBase58()} (created) $${price}  ${fmt(pairAmount)} ${sym} + ${fmt(created.tokenBAmount)} USDC  ${explorerTx(sig)}`);
  }

  /* ------------------------------------------------------------ 3. markets */
  if (skipMarkets) {
    const p = await saveDeployment(dep);
    console.log(`\n--skip-markets: wrote ${p} with ${Object.keys(dep.mints).length} mints and ${Object.keys(dep.pairPools).length} pair pools; re-run without the flag once the program is deployed.`);
    return;
  }
  console.log("\n== markets");
  const client = new DuelClient(connection, wallet, { programId });
  const defs = withTestMarket
    ? [...MARKETS, { ...test.base, nonce: testNonce, question: test.question, resolveTs: Math.floor(Date.now() / 1000) - 2 * GRACE }]
    : MARKETS;
  for (const def of defs) {
    const resolveTs = def.resolveTs ?? RESOLVE_TS;
    const marketPk = client.marketPda(operator.publicKey, def.nonce);
    let market = await client.fetchMarketIfExists(marketPk);
    let entry = dep.markets.find((m) => m.address === marketPk.toBase58());
    if (!market) {
      const res = await client.createMarket({
        nonce: def.nonce,
        question: def.question,
        sideALabel: def.sideALabel,
        sideBLabel: def.sideBLabel,
        collateralMint: usdcMint,
        pairAMint: new PublicKey(dep.mints[def.pairA].mint),
        pairBMint: new PublicKey(dep.mints[def.pairB].mint),
        template: def.template,
        resolveTs,
        graceSecs: GRACE,
        resolver: operator.publicKey,
        crank: operator.publicKey,
        feeBpsHolders: 10_000,
      });
      market = await client.fetchMarket(res.market);
      console.log(`  ${def.sideALabel} vs ${def.sideBLabel}: ${res.market.toBase58()} (created)  ${explorerTx(res.tx)}`);
    } else {
      console.log(`  ${def.sideALabel} vs ${def.sideBLabel}: ${marketPk.toBase58()} (exists)`);
    }
    if (!entry) {
      entry = {
        address: marketPk.toBase58(),
        nonce: String(def.nonce),
        creator: operator.publicKey.toBase58(),
        question: def.question,
        sideALabel: def.sideALabel,
        sideBLabel: def.sideBLabel,
        pairA: def.pairA,
        pairB: def.pairB,
        collateralMint: usdcMint.toBase58(),
        yesMint: market.yesMint.toBase58(),
        noMint: market.noMint.toBase58(),
        poolA: null,
        poolB: null,
        poolsSet: false,
        template: templateToJson(def.template),
        resolveTs,
        graceSecs: GRACE,
      };
      dep.markets.push(entry);
      await saveDeployment(dep);
    }

    // Mint a set of 5,000 so the operator can seed both outcome pools.
    const yesAta = getAssociatedTokenAddressSync(market.yesMint, operator.publicKey);
    const yesBal = await tokenBalance(connection, yesAta);
    if (yesBal < OUTCOME_SEED) {
      const sig = await client.mintSet(market, SET_SIZE);
      console.log(`     minted set of ${fmt(SET_SIZE)}  ${explorerTx(sig)}`);
    }

    // YES / pair A and NO / pair B pools at 50/50: price of YES in pair A = 0.5 / pairA_usd.
    for (const side of ["A", "B"] as const) {
      const key = side === "A" ? "poolA" : "poolB";
      const pairSym = side === "A" ? def.pairA : def.pairB;
      const outcomeMint = side === "A" ? market.yesMint : market.noMint;
      const pairMint = new PublicKey(dep.mints[pairSym].mint);
      const pairUsd = SEED_PRICES[pairSym];
      const pool = poolAddressFor(outcomeMint, pairMint);
      if (await poolExists(connection, pool)) {
        if (entry[key]?.pool !== pool.toBase58()) {
          entry[key] = await recoverPool(connection, pool, operator.publicKey);
          await saveDeployment(dep);
        }
        console.log(`     ${side === "A" ? "YES" : "NO "} / ${pairSym.padEnd(4)} ${pool.toBase58()} (exists)`);
        continue;
      }
      const created = await createPairPool({
        connection,
        payer: operator.publicKey,
        tokenA: outcomeMint,
        tokenB: pairMint,
        tokenADecimals: DECIMALS,
        tokenBDecimals: DECIMALS,
        priceInB: 0.5 / pairUsd,
        tokenAAmount: OUTCOME_SEED,
        feeBps,
      });
      const sig = await sendAndConfirmTransaction(connection, created.tx, [operator, ...created.signers], { commitment: "confirmed" });
      const state = await getPoolState(connection, created.pool);
      entry[key] = {
        pool: created.pool.toBase58(),
        position: created.position.toBase58(),
        positionNft: created.positionNft.publicKey.toBase58(),
        positionNftAccount: created.positionNftAccount.toBase58(),
        tokenAMint: state.tokenAMint.toBase58(),
        tokenBMint: state.tokenBMint.toBase58(),
        tokenAVault: state.tokenAVault.toBase58(),
        tokenBVault: state.tokenBVault.toBase58(),
      };
      await saveDeployment(dep);
      console.log(
        `     ${side === "A" ? "YES" : "NO "} / ${pairSym.padEnd(4)} ${created.pool.toBase58()} (created) ${fmt(OUTCOME_SEED)} + ${fmt(created.tokenBAmount)} ${pairSym}  ${explorerTx(sig)}`,
      );
    }

    if (market.poolA.equals(PublicKey.default) || market.poolB.equals(PublicKey.default)) {
      const sig = await client.setPools(marketPk, new PublicKey(entry.poolA!.pool), new PublicKey(entry.poolB!.pool));
      console.log(`     set_pools  ${explorerTx(sig)}`);
    }
    entry.poolsSet = true;
    await saveDeployment(dep);
  }

  const p = await saveDeployment(dep);
  console.log(`\nWrote ${p}`);
  console.log(`Markets: ${dep.markets.length}, pair pools: ${Object.keys(dep.pairPools).length}, mints: ${Object.keys(dep.mints).length}`);
}

async function tokenBalance(connection: ReturnType<typeof getConnection>, ata: PublicKey): Promise<bigint> {
  try {
    const b = await connection.getTokenAccountBalance(ata, "confirmed");
    return BigInt(b.value.amount);
  } catch {
    return 0n;
  }
}

/** Drop mints, pools and markets the deployment file lists but the cluster no longer has (e.g. after `--reset`). */
async function pruneDeployment(connection: ReturnType<typeof getConnection>, client: DuelClient, dep: Deployment): Promise<void> {
  const gone = async (address: string) => !(await connection.getAccountInfo(new PublicKey(address)));
  for (const [sym, m] of Object.entries(dep.mints)) {
    if (await gone(m.mint)) {
      console.warn(`  pruning mint ${sym} ${m.mint} (not on chain)`);
      delete dep.mints[sym];
    }
  }
  for (const [sym, p] of Object.entries(dep.pairPools)) {
    if (await gone(p.pool)) {
      console.warn(`  pruning pair pool ${sym} ${p.pool} (not on chain)`);
      delete dep.pairPools[sym];
    }
  }
  const markets = [];
  for (const m of dep.markets) {
    const onChain = await client.fetchMarketIfExists(new PublicKey(m.address));
    if (!onChain) {
      console.warn(`  pruning market ${m.nonce} ${m.address} (not on chain)`);
      continue;
    }
    // Market PDAs survive a validator reset but the mints behind them do not; trust the chain.
    m.collateralMint = onChain.collateralMint.toBase58();
    m.yesMint = onChain.yesMint.toBase58();
    m.noMint = onChain.noMint.toBase58();
    for (const key of ["poolA", "poolB"] as const) {
      const p = m[key];
      if (p && (await gone(p.pool))) {
        m[key] = null;
        m.poolsSet = false;
      }
    }
    markets.push(m);
  }
  dep.markets = markets;
}

/** Rebuild a DeployedPool entry for a pool that exists on-chain but is missing from the file. */
async function recoverPool(connection: ReturnType<typeof getConnection>, pool: PublicKey, owner: PublicKey): Promise<DeployedPool> {
  const state = await getPoolState(connection, pool);
  const positions = await listPositionsInPool(connection, pool, owner);
  const pos = positions[0];
  if (!pos) throw new Error(`pool ${pool.toBase58()} exists but ${owner.toBase58()} owns no position in it; cannot recover`);
  return {
    pool: pool.toBase58(),
    position: pos.position.toBase58(),
    positionNft: pos.positionNft.toBase58(),
    positionNftAccount: pos.positionNftAccount.toBase58(),
    tokenAMint: state.tokenAMint.toBase58(),
    tokenBMint: state.tokenBMint.toBase58(),
    tokenAVault: state.tokenAVault.toBase58(),
    tokenBVault: state.tokenBVault.toBase58(),
  };
}

// Keep the type import used (Keypair is what loadKeypair returns).
void (null as unknown as Keypair);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
