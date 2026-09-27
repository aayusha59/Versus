/**
 * Resolve a market.
 *
 *   pnpm --filter scripts resolve -- --market <pk|label>
 *       posts Pyth price updates from Hermes (needs PYTH_API_KEY) and calls `resolve`
 *   pnpm --filter scripts resolve -- --market <pk|label> --manual [--winner yes|no] [--price-a 340.1 --price-b 224.5]
 *       resolver-only fallback after resolve_ts + grace_secs; prices default to Hermes if reachable
 *
 * Flags: --no-cleanup keeps the PriceUpdateV2 accounts (rent) after resolving.
 */
import { PublicKey } from "@solana/web3.js";
import { DuelClient, evaluateTemplate, findMarket, getLatestPrices, loadDeployment, postPriceUpdates, templateFeeds, type Side } from "@versus/sdk";
import { CLUSTER, RPC_URL, die, explorerTx, flagString, getConnection, loadKeypair, parseArgs, walletFor } from "./env.js";

async function main() {
  const args = parseArgs();
  const key = flagString(args, "market") ?? args.positional[0] ?? die("usage: resolve --market <pk|label> [--manual] [--winner yes|no] [--price-a X --price-b Y]");
  const manual = args.flags.manual === true;

  const connection = getConnection();
  const operator = loadKeypair();
  const dep = await loadDeployment(CLUSTER);
  const entry = findMarket(dep, key) ?? die(`market "${key}" not in deployment`);
  const client = DuelClient.fromDeployment(connection, dep, walletFor(operator));
  const marketPk = new PublicKey(entry.address);
  const market = await client.fetchMarket(marketPk);

  console.log(`cluster=${CLUSTER} rpc=${RPC_URL}`);
  console.log(`${entry.sideALabel} vs ${entry.sideBLabel} ${marketPk.toBase58()} status=${market.status.kind} resolve_ts=${new Date(market.resolveTs * 1000).toISOString()}`);
  if (market.status.kind === "resolved") die(`already resolved: winner=${market.status.winner}`, 0);

  const now = Math.floor(Date.now() / 1000);
  const [feedA, feedB] = templateFeeds(market.template);

  if (!manual) {
    if (now < market.resolveTs) console.warn(`resolve_ts is ${market.resolveTs - now}s away; the program will reject this (NotYetResolvable)`);
    console.log(`posting Pyth updates for ${[feedA, feedB].filter(Boolean).join(", ")}`);
    let posted;
    try {
      posted = await postPriceUpdates({ connection, wallet: walletFor(operator), feedIds: [feedA, feedB].filter((f): f is string => !!f) });
    } catch (e) {
      die(`could not post Pyth updates: ${(e as Error).message}\nFallback: re-run with --manual after resolve_ts + grace_secs.`);
    }
    console.log(`posted: ${Object.entries(posted.accounts).map(([id, pk]) => `${id.slice(0, 8)} -> ${pk.toBase58()}`).join(", ")}`);
    try {
      const sig = await client.resolve(marketPk, posted.accounts[feedA], feedB ? posted.accounts[feedB] : null);
      console.log(`resolved  ${explorerTx(sig)}`);
    } finally {
      if (args.flags["no-cleanup"] !== true) {
        const sigs = await posted.cleanup();
        console.log(`closed ${sigs.length} price update tx(s)`);
      }
    }
  } else {
    const graceEnd = market.resolveTs + market.graceSecs;
    if (now < graceEnd) console.warn(`grace period ends in ${graceEnd - now}s; the program will reject this (GraceNotElapsed) unless resolve_ts is in the past`);
    let priceA = num(flagString(args, "price-a"));
    let priceB = num(flagString(args, "price-b")) ?? (feedB ? undefined : 0);
    if (priceA === undefined || priceB === undefined) {
      try {
        const prices = await getLatestPrices([feedA, feedB].filter((f): f is string => !!f));
        priceA ??= prices[feedA].price;
        priceB ??= feedB ? prices[feedB].price : 0;
        console.log(`Hermes prices: A=${priceA} B=${priceB}`);
      } catch (e) {
        die(`no prices: pass --price-a and --price-b (Hermes said: ${(e as Error).message})`);
      }
    }
    const winnerFlag = flagString(args, "winner") as Side | undefined;
    if (winnerFlag && winnerFlag !== "yes" && winnerFlag !== "no") die("--winner must be yes or no");
    const winner: Side = winnerFlag ?? evaluateTemplate(market.template, priceA, priceB);
    const e6 = (x: number) => BigInt(Math.round(x * 1e6));
    console.log(`resolve_manual winner=${winner} price_a=${priceA} price_b=${priceB}`);
    const sig = await client.resolveManual(marketPk, winner, e6(priceA), e6(priceB));
    console.log(`resolved  ${explorerTx(sig)}`);
  }

  const after = await client.fetchMarket(marketPk);
  if (after.status.kind === "resolved") {
    console.log(`status: resolved, winner=${after.status.winner} (${after.status.winner === "yes" ? entry.sideALabel : entry.sideBLabel}) price_a=${Number(after.status.priceA) / 1e6} price_b=${Number(after.status.priceB) / 1e6}`);
  }
}

function num(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) die(`not a number: ${s}`);
  return n;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
