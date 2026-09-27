/**
 * Rewards crank. Every loop it lists the on-chain markets whose `crank` is this key (bootstrap
 * markets and web-created ones, whose LP position NFTs the creator hands to this key), and for
 * every market and side:
 *   1. claim the operator's LP position fees on the outcome/pair pool (fees are quote-only, so
 *      they arrive as pair tokens: AAPLx for the YES side of Apple vs Nvidia),
 *   2. deposit_rewards into the side's reward vault,
 *   3. snapshot holders of the outcome token,
 *   4. distribute pro-rata in chunks of 12,
 *   5. print one ledger line per epoch.
 *
 *   pnpm --filter scripts crank -- --once
 *   pnpm --filter scripts crank -- --interval 300 [--market <pk|label>] [--min-usd 0.01] [--include-operator] [--dry-run]
 */
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  DuelClient,
  chunk,
  claimPositionFee,
  computeProRata,
  findMarket,
  formatLedgerLine,
  getCpAmm,
  getMintInfo,
  getPoolState,
  listPositions,
  loadDeployment,
  pairUsdFromPool,
  snapshotHolders,
  templateToJson,
  unclaimedFees,
  type DeployedMarket,
  type DeployedPool,
  type Deployment,
  type Market,
  type Side,
} from "@versus/sdk";
import { CLUSTER, RPC_URL, explorerTx, flagNumber, flagString, fmt, getConnection, loadKeypair, parseArgs, walletFor } from "./env.js";

async function main() {
  const args = parseArgs();
  const once = args.flags.once === true;
  const interval = flagNumber(args, "interval", 300);
  const minUsd = flagNumber(args, "min-usd", 0.01);
  const dryRun = args.flags["dry-run"] === true;
  const includeOperator = args.flags["include-operator"] === true;
  const only = flagString(args, "market");

  const connection = getConnection();
  const operator = loadKeypair();
  const dep = await loadDeployment(CLUSTER);
  const client = DuelClient.fromDeployment(connection, dep, walletFor(operator));
  console.log(`crank cluster=${CLUSTER} rpc=${RPC_URL} operator=${operator.publicKey.toBase58()} ${once ? "(once)" : `every ${interval}s`}${dryRun ? " DRY RUN" : ""}`);

  for (;;) {
    const all = await crankTargets(connection, client, dep, operator.publicKey);
    const targets = only ? [findMarket({ ...dep, markets: all }, only) ?? dieMarket(only)] : all;
    for (const entry of targets) {
      try {
        await crankMarket({ connection, client, dep, entry, operator, minUsd, dryRun, includeOperator });
      } catch (e) {
        console.error(`  ${entry.sideALabel} vs ${entry.sideBLabel}: ${(e as Error).message}`);
      }
    }
    if (once) break;
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

function dieMarket(key: string): never {
  throw new Error(`market "${key}" not found among the markets this key cranks`);
}

/**
 * Every on-chain market whose `crank` is this key: the deployment's entries as written, plus
 * markets created elsewhere (the web app), whose LP positions the creator handed to this key.
 */
async function crankTargets(
  connection: ReturnType<typeof getConnection>,
  client: DuelClient,
  dep: Deployment,
  crank: PublicKey,
): Promise<DeployedMarket[]> {
  const markets = (await client.fetchAllMarkets()).filter((m) => m.crank.equals(crank));
  const symbolByMint = new Map(Object.values(dep.mints).map((m) => [m.mint, m.symbol]));
  const positions = await listPositions(connection, crank);
  const out: DeployedMarket[] = [];
  for (const m of markets) {
    const address = m.address.toBase58();
    const known = dep.markets.find((x) => x.address === address);
    if (known) {
      out.push(known);
      continue;
    }
    if (m.poolA.equals(PublicKey.default) || m.poolB.equals(PublicKey.default)) continue;
    const pool = async (address: PublicKey): Promise<DeployedPool | null> => {
      const pos = positions.find((p) => p.pool.equals(address));
      if (!pos) return null;
      const s = await getPoolState(connection, address);
      return {
        pool: address.toBase58(),
        position: pos.position.toBase58(),
        positionNft: pos.positionNft.toBase58(),
        positionNftAccount: pos.positionNftAccount.toBase58(),
        tokenAMint: s.tokenAMint.toBase58(),
        tokenBMint: s.tokenBMint.toBase58(),
        tokenAVault: s.tokenAVault.toBase58(),
        tokenBVault: s.tokenBVault.toBase58(),
      };
    };
    const symbol = (mint: PublicKey) => symbolByMint.get(mint.toBase58()) ?? mint.toBase58().slice(0, 4);
    out.push({
      address,
      nonce: m.nonce.toString(),
      creator: m.creator.toBase58(),
      question: m.question,
      sideALabel: m.sideALabel,
      sideBLabel: m.sideBLabel,
      pairA: symbol(m.pairAMint),
      pairB: symbol(m.pairBMint),
      collateralMint: m.collateralMint.toBase58(),
      yesMint: m.yesMint.toBase58(),
      noMint: m.noMint.toBase58(),
      poolA: await pool(m.poolA),
      poolB: await pool(m.poolB),
      poolsSet: true,
      template: templateToJson(m.template),
      resolveTs: m.resolveTs,
      graceSecs: m.graceSecs,
    });
  }
  return out;
}

interface Ctx {
  connection: ReturnType<typeof getConnection>;
  client: DuelClient;
  dep: Deployment;
  entry: DeployedMarket;
  operator: ReturnType<typeof loadKeypair>;
  minUsd: number;
  dryRun: boolean;
  includeOperator: boolean;
}

async function crankMarket(ctx: Ctx) {
  const { connection, client, dep, entry, operator } = ctx;
  const market = await client.fetchMarket(new PublicKey(entry.address));
  console.log(`\n${entry.sideALabel} vs ${entry.sideBLabel} (${entry.address.slice(0, 8)}) epochs=${market.epochs} status=${market.status.kind}`);
  for (const side of ["yes", "no"] as const) {
    await crankSide(ctx, market, side);
  }
  void dep;
}

async function crankSide(ctx: Ctx, market: Market, side: Side) {
  const { connection, client, dep, entry, operator, minUsd, dryRun, includeOperator } = ctx;
  const poolEntry = side === "yes" ? entry.poolA : entry.poolB;
  const pairSym = side === "yes" ? entry.pairA : entry.pairB;
  if (!poolEntry) {
    console.log(`  ${side.toUpperCase()}: this key holds no LP position in the pool, skipping`);
    return;
  }
  const pool = new PublicKey(poolEntry.pool);
  const outcomeMint = side === "yes" ? market.yesMint : market.noMint;
  const pairMint = side === "yes" ? market.pairAMint : market.pairBMint;
  const rewardVault = side === "yes" ? market.rewardVaultA : market.rewardVaultB;
  const pairInfo = await getMintInfo(connection, pairMint);

  /* 1. claim fees */
  const poolState = await getPoolState(connection, pool);
  const positionState = await getCpAmm(connection).fetchPositionState(new PublicKey(poolEntry.position));
  const fees = unclaimedFees(poolState, positionState);
  const claimable = BigInt(fees.feeB.toString()); // quote-only: fees are token B = pair token
  let claimed = 0n;
  if (claimable > 0n && !dryRun) {
    const tx = await claimPositionFee({
      connection,
      owner: operator.publicKey,
      pool,
      poolState,
      position: new PublicKey(poolEntry.position),
      positionNftAccount: new PublicKey(poolEntry.positionNftAccount),
    });
    const sig = await sendAndConfirmTransaction(connection, tx, [operator], { commitment: "confirmed" });
    claimed = claimable;
    console.log(`  ${side.toUpperCase()}: claimed ${fmt(claimed)} ${pairSym} of LP fees  ${explorerTx(sig)}`);
  } else {
    console.log(`  ${side.toUpperCase()}: ${fmt(claimable)} ${pairSym} claimable${dryRun ? " (dry run)" : ""}`);
  }

  /* 2. deposit into the reward vault */
  if (claimed > 0n) {
    const sig = await client.depositRewards(market, side, claimed);
    console.log(`  ${side.toUpperCase()}: deposited ${fmt(claimed)} ${pairSym}  ${explorerTx(sig)}`);
  }

  const vault = await tokenBalance(connection, rewardVault);
  if (vault === 0n) {
    console.log(`  ${side.toUpperCase()}: reward vault empty`);
    return;
  }

  /* 3. snapshot holders (exclude the pool vault, the market's own accounts, and by default the operator) */
  const exclude = [market.address, ...(includeOperator ? [] : [operator.publicKey])];
  const holders = await snapshotHolders(connection, outcomeMint, {
    exclude,
    excludeAccounts: [poolState.tokenAVault, poolState.tokenBVault],
  });
  const pairPool = dep.pairPools[pairSym];
  const pairUsd = pairPool ? pairUsdFromPool(await getPoolState(connection, new PublicKey(pairPool.pool)), pairMint, pairInfo.decimals, dep.mints.USDC.decimals) : 0;
  const { payouts, total, skipped } = computeProRata(vault, holders, {
    minHolderValueUsd: pairUsd > 0 ? minUsd : 0,
    priceUsd: pairUsd,
    rewardDecimals: pairInfo.decimals,
  });
  console.log(`  ${side.toUpperCase()}: vault ${fmt(vault, pairInfo.decimals)} ${pairSym} (~$${(Number(vault) / 10 ** pairInfo.decimals * pairUsd).toFixed(2)}), ${holders.length} holders, ${payouts.length} payouts, ${skipped} below $${minUsd}`);
  if (payouts.length === 0 || dryRun) return;

  /* 4. distribute in chunks of 12 */
  const recipients = payouts.map((p) => ({
    ...p,
    ata: getAssociatedTokenAddressSync(pairMint, p.owner, true, pairInfo.programId),
  }));
  await ensureAtas(ctx, pairMint, pairInfo.programId, recipients.map((r) => ({ owner: r.owner, ata: r.ata })));

  const sigs: string[] = [];
  for (const group of chunk(recipients, 12)) {
    const sig = await client.distribute(
      market,
      side,
      group.map((r) => r.ata),
      group.map((r) => r.amount),
    );
    sigs.push(sig);
  }

  /* 5. ledger line */
  const after = await client.fetchMarket(market.address);
  console.log(
    "  " +
      formatLedgerLine({ market: market.address.toBase58(), side, epoch: after.epochs, total, count: payouts.length, symbol: pairSym, decimals: pairInfo.decimals }) +
      `  ${sigs.map(explorerTx).join(" ")}`,
  );
}

async function ensureAtas(ctx: Ctx, mint: PublicKey, programId: PublicKey, list: { owner: PublicKey; ata: PublicKey }[]) {
  const { connection, operator } = ctx;
  const infos = await connection.getMultipleAccountsInfo(list.map((l) => l.ata));
  const missing = list.filter((_, i) => !infos[i]);
  for (const group of chunk(missing, 8)) {
    const tx = new Transaction();
    for (const m of group) tx.add(createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, m.ata, m.owner, mint, programId));
    await sendAndConfirmTransaction(connection, tx, [operator], { commitment: "confirmed" });
  }
  if (missing.length) console.log(`  created ${missing.length} recipient token accounts`);
}

async function tokenBalance(connection: ReturnType<typeof getConnection>, ata: PublicKey): Promise<bigint> {
  try {
    const b = await connection.getTokenAccountBalance(ata, "confirmed");
    return BigInt(b.value.amount);
  } catch {
    return 0n;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
