/**
 * Bet / sell / redeem from the command line, through the same SDK paths the web app uses.
 *
 *   pnpm --filter scripts bet -- --market Apple --odds
 *   pnpm --filter scripts bet -- --market Apple --side yes --usdc 25 [--keypair ./.keys/bettor.json] [--slippage-bps 100]
 *   pnpm --filter scripts bet -- --market Apple --side yes --sell 10
 *   pnpm --filter scripts bet -- --market "(test)" --redeem [amount]
 *
 * On localnet/devnet the bettor gets SOL (airdrop) and mock USDC (minted by the operator key at
 * KEYPAIR_PATH) automatically when short. `--keypair` defaults to the operator itself.
 */
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, sendAndConfirmTransaction, type Connection } from "@solana/web3.js";
import {
  DuelClient,
  buildBetTx,
  buildSellTx,
  findMarket,
  formatPct,
  loadDeployment,
  loadMarketPools,
  routingFromDeployment,
  type Odds,
  type Side,
} from "@duel/sdk";
import { CLUSTER, RPC_URL, die, ensureSol, explorerTx, flagNumber, flagString, fmt, getConnection, loadKeypair, parseArgs, walletFor } from "./env.js";
import { faucet } from "./faucet.js";

async function balance(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    return BigInt((await connection.getTokenAccountBalance(ata, "confirmed")).value.amount);
  } catch {
    return 0n;
  }
}

function showOdds(label: string, o: Odds) {
  console.log(`${label}: YES ${formatPct(o.yes, 1)} / NO ${formatPct(o.no, 1)}  (raw ${o.yesRaw.toFixed(4)} + ${o.noRaw.toFixed(4)} = ${o.impliedSum.toFixed(4)})`);
}

async function main() {
  const args = parseArgs();
  const key = flagString(args, "market") ?? die("usage: bet --market <pk|label> (--odds | --side yes|no --usdc N | --side yes|no --sell N | --redeem [N])");
  const connection = getConnection();
  const dep = await loadDeployment(CLUSTER);
  const entry = findMarket(dep, key) ?? die(`market "${key}" not in deployment`);
  const routing = routingFromDeployment(dep, entry);
  const kpPath = flagString(args, "keypair");
  const bettor = loadKeypair(kpPath);
  const client = DuelClient.fromDeployment(connection, dep, walletFor(bettor));
  const slippageBps = flagNumber(args, "slippage-bps", 100);
  console.log(`cluster=${CLUSTER} rpc=${RPC_URL} bettor=${bettor.publicKey.toBase58()}`);
  console.log(`${entry.sideALabel} vs ${entry.sideBLabel} (${entry.address})`);

  if (args.flags.ledger === true) {
    const epochs = await client.fetchRewardEpochs(new PublicKey(entry.address));
    const m = await client.fetchMarket(new PublicKey(entry.address));
    console.log(`epochs on chain: ${m.epochs}; rewards paid A ${fmt(m.rewardsPaidA)} ${entry.pairA}, B ${fmt(m.rewardsPaidB)} ${entry.pairB}`);
    for (const e of epochs) {
      console.log(`  [epoch ${e.epoch}] ${e.side.toUpperCase().padEnd(3)} ${fmt(e.total)} ${e.side === "yes" ? entry.pairA : entry.pairB} to ${e.count} holder(s) at ${new Date(e.ts * 1000).toISOString()} ${e.signatures[0].slice(0, 8)}..`);
    }
    return;
  }

  let pools = await loadMarketPools(connection, routing);
  showOdds("odds", pools.odds);
  console.log(`pair prices: ${entry.pairA} $${pools.pairAUsd.toFixed(2)}  ${entry.pairB} $${pools.pairBUsd.toFixed(2)}`);
  if (args.flags.odds === true) return;

  const side = flagString(args, "side") as Side | undefined;
  const usdc = flagString(args, "usdc");
  const sell = flagString(args, "sell");
  const redeem = args.flags.redeem;

  const outcomeMint = side === "no" ? routing.noMint : routing.yesMint;
  const pairMint = side === "no" ? routing.pairBMint : routing.pairAMint;
  const outcomeAta = getAssociatedTokenAddressSync(outcomeMint, bettor.publicKey, true);
  const pairAta = getAssociatedTokenAddressSync(pairMint, bettor.publicKey, true);
  const usdcAta = getAssociatedTokenAddressSync(routing.usdcMint, bettor.publicKey, true);
  const snapshot = async () => ({ usdc: await balance(connection, usdcAta), outcome: await balance(connection, outcomeAta), pair: await balance(connection, pairAta) });

  if (usdc !== undefined) {
    if (side !== "yes" && side !== "no") die("--side yes|no is required");
    const raw = BigInt(Math.round(Number(usdc) * 10 ** routing.usdcDecimals));
    if (CLUSTER !== "mainnet") {
      await ensureSol(connection, bettor.publicKey, 1);
      const have = await balance(connection, usdcAta);
      if (have < raw) {
        const operator = loadKeypair();
        const r = await faucet({ connection, authority: operator, deployment: dep, to: bettor.publicKey, amount: Number(usdc) + 10 });
        console.log(`faucet: minted ${Number(usdc) + 10} USDC to bettor  ${explorerTx(r.signature)}`);
      }
    }
    const before = await snapshot();
    const { tx, preview } = await buildBetTx({ connection, routing, side, usdcAmount: raw, slippageBps, payer: bettor.publicKey, pools });
    console.log(
      `preview: ${usdc} USDC -> ${fmt(preview.pairOut)} ${side === "yes" ? entry.pairA : entry.pairB} -> ${fmt(preview.outcomeOut)} ${side.toUpperCase()} (min ${fmt(preview.minOutcomeOut)}), ` +
        `avg $${preview.avgPriceUsd.toFixed(4)}/token, fee ${fmt(preview.feePaidInPair)} ${side === "yes" ? entry.pairA : entry.pairB} to holders, impact ${preview.priceImpactBps} bps`,
    );
    showOdds("odds after (preview)", preview.oddsAfter);
    const sig = await sendAndConfirmTransaction(connection, tx, [bettor], { commitment: "confirmed" });
    console.log(`bet sent  ${explorerTx(sig)}`);
    const after = await snapshot();
    console.log(`balances: USDC ${fmt(before.usdc)} -> ${fmt(after.usdc)}, ${side.toUpperCase()} ${fmt(before.outcome)} -> ${fmt(after.outcome)}, pair dust ${fmt(after.pair - before.pair)}`);
    pools = await loadMarketPools(connection, routing);
    showOdds("odds after (chain)", pools.odds);
    return;
  }

  if (sell !== undefined) {
    if (side !== "yes" && side !== "no") die("--side yes|no is required");
    const raw = BigInt(Math.round(Number(sell) * 1e6));
    const before = await snapshot();
    if (before.outcome < raw) die(`bettor holds ${fmt(before.outcome)} ${side.toUpperCase()}, cannot sell ${sell}`);
    const { tx, preview } = await buildSellTx({ connection, routing, side, outcomeAmount: raw, slippageBps, payer: bettor.publicKey, pools });
    console.log(`preview: ${sell} ${side.toUpperCase()} -> ${fmt(preview.pairOut)} pair -> ${fmt(preview.usdcOut)} USDC (min ${fmt(preview.minUsdcOut)}), fee ${fmt(preview.feePaidInPair)} pair, impact ${preview.priceImpactBps} bps`);
    const sig = await sendAndConfirmTransaction(connection, tx, [bettor], { commitment: "confirmed" });
    console.log(`sell sent  ${explorerTx(sig)}`);
    const after = await snapshot();
    console.log(`balances: USDC ${fmt(before.usdc)} -> ${fmt(after.usdc)}, ${side.toUpperCase()} ${fmt(before.outcome)} -> ${fmt(after.outcome)}`);
    pools = await loadMarketPools(connection, routing);
    showOdds("odds after (chain)", pools.odds);
    return;
  }

  if (redeem !== undefined) {
    const market = await client.fetchMarket(new PublicKey(entry.address));
    if (market.status.kind !== "resolved") die("market is not resolved yet");
    const winMint = market.status.winner === "yes" ? market.yesMint : market.noMint;
    const winAta = getAssociatedTokenAddressSync(winMint, bettor.publicKey, true);
    const held = await balance(connection, winAta);
    const raw = typeof redeem === "string" ? BigInt(Math.round(Number(redeem) * 1e6)) : held;
    if (raw === 0n || held < raw) die(`bettor holds ${fmt(held)} ${market.status.winner.toUpperCase()}; nothing to redeem`);
    const usdcBefore = await balance(connection, usdcAta);
    const sig = await client.redeem(market, raw);
    const usdcAfter = await balance(connection, usdcAta);
    console.log(`redeemed ${fmt(raw)} ${market.status.winner.toUpperCase()} -> USDC ${fmt(usdcBefore)} -> ${fmt(usdcAfter)}  ${explorerTx(sig)}`);
    return;
  }

  die("nothing to do: pass --odds, --usdc, --sell or --redeem");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
