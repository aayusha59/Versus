/**
 * Offline / read-only smoke test of the SDK. No transactions are sent.
 *
 *   pnpm --filter scripts smoke                       # math + encoding only
 *   pnpm --filter scripts smoke -- --pool <damm v2 pool> [--rpc https://api.mainnet-beta.solana.com]
 *       also fetches the pool, quotes a swap, and builds (does not send) swap and pool-creation txs
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { getPriceFromSqrtPrice } from "@meteora-ag/cp-amm-sdk";
import {
  ASSETS,
  DuelClient,
  buildSwapIx,
  chunk,
  computeProRata,
  createPairPool,
  evaluateTemplate,
  getLatestPrices,
  getMintInfo,
  getPoolState,
  oddsFromPrices,
  poolAddressFor,
  priceFromSqrtPrice,
  pythLocalnetAccounts,
  quoteAmountForPrice,
  quoteSwap,
  sideArg,
  templateArg,
  type Holder,
  type Market,
} from "@versus/sdk";
import { flagString, parseArgs } from "./env.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}
function close(a: number, b: number, rel = 1e-6): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
}

async function main() {
  const args = parseArgs();
  const ok = (s: string) => console.log("  ok  " + s);

  console.log("== odds");
  const o = oddsFromPrices({ yesPriceInA: 0.5 / 340.35, noPriceInB: 0.5 / 223.96, pairAUsd: 340.35, pairBUsd: 223.96 });
  assert(close(o.yes, 0.5) && close(o.no, 0.5) && close(o.impliedSum, 1), `50/50 odds ${JSON.stringify(o)}`);
  const o2 = oddsFromPrices({ yesPriceInA: 0.7 / 340.35, noPriceInB: 0.4 / 223.96, pairAUsd: 340.35, pairBUsd: 223.96 });
  assert(close(o2.impliedSum, 1.1) && close(o2.yes, 0.7 / 1.1), `drifted odds ${JSON.stringify(o2)}`);
  ok(`odds normalise (impliedSum ${o2.impliedSum.toFixed(3)} -> yes ${o2.yes.toFixed(3)})`);

  console.log("== sqrt price");
  // sqrt(0.5/340.35) in Q64 for 6/6 decimals; compare with the cp-amm helper.
  const price = 0.5 / 340.35;
  const sqrtQ64 = new BN((Math.sqrt(price) * 2 ** 64).toLocaleString("fullwide", { useGrouping: false }).split(".")[0]);
  const mine = priceFromSqrtPrice(sqrtQ64, 6, 6);
  const theirs = Number(getPriceFromSqrtPrice(sqrtQ64, 6, 6).toString());
  assert(close(mine, price, 1e-9) && close(theirs, price, 1e-9), `sqrt price roundtrip mine=${mine} theirs=${theirs} want=${price}`);
  const q = quoteAmountForPrice(2_000_000_000n, price, 6, 6);
  assert(close(Number(q.toString()), 2_000_000_000 * price, 1e-6), `quoteAmountForPrice ${q.toString()}`);
  ok(`priceFromSqrtPrice matches cp-amm (${mine.toExponential(4)}), 2000 YES pairs with ${Number(q) / 1e6} AAPLx`);

  console.log("== rewards");
  const kp = () => Keypair.generate().publicKey;
  const holders: Holder[] = [
    { owner: kp(), tokenAccount: kp(), amount: 600n },
    { owner: kp(), tokenAccount: kp(), amount: 300n },
    { owner: kp(), tokenAccount: kp(), amount: 100n },
  ];
  const pr = computeProRata(1_000_000n, holders);
  assert(pr.total === 1_000_000n && pr.payouts.map((p) => p.amount).join() === "600000,300000,100000", `pro rata ${pr.payouts.map((p) => p.amount)}`);
  const pr2 = computeProRata(1_000_000n, holders, { minHolderValueUsd: 0.2, priceUsd: 1, rewardDecimals: 6 });
  assert(pr2.payouts.length === 2 && pr2.skipped === 1, `min usd filter ${pr2.payouts.length}/${pr2.skipped}`);
  assert(chunk(Array.from({ length: 30 }, (_, i) => i), 12).map((c) => c.length).join() === "12,12,6", "chunk 12");
  ok("computeProRata + min-usd filter + chunk(12)");

  console.log("== templates");
  const cap = { kind: "capCompare" as const, feedA: ASSETS.AAPL.pythFeedId, feedB: ASSETS.NVDA.pythFeedId, sharesA: 14_800_000_000n, sharesB: 24_400_000_000n };
  assert(evaluateTemplate(cap, 340.35, 223.96) === "no", "AAPL 340*14.8B < NVDA 224*24.4B -> no");
  assert(evaluateTemplate(cap, 400, 223.96) === "yes", "AAPL 400*14.8B > NVDA -> yes");
  const t = templateArg(cap) as { capCompare?: { feedA: number[] } };
  assert(t.capCompare && t.capCompare.feedA.length === 32, "templateArg bytes");
  assert(JSON.stringify(sideArg("no")) === '{"no":{}}', "sideArg");
  ok("evaluateTemplate / templateArg / sideArg");

  console.log("== pyth");
  const loc = pythLocalnetAccounts();
  console.log("  clone programs:", loc.programs.map((p) => p.toBase58()).join(" "));
  console.log("  clone accounts:", loc.accounts.map((p) => p.toBase58()).join(" "));
  try {
    const p = await getLatestPrices([ASSETS.AAPL.pythFeedId]);
    ok(`Hermes AAPL ${p[ASSETS.AAPL.pythFeedId].price} (API key present)`);
  } catch (e) {
    console.log("  info  Hermes: " + (e as Error).message.split("\n")[0].slice(0, 140));
  }

  console.log("== client (offline)");
  const rpc = flagString(args, "rpc") ?? "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const client = new DuelClient(connection);
  const creator = Keypair.generate().publicKey;
  const market = client.marketPda(creator, 1);
  const { yesMint, noMint } = client.outcomeMints(market);
  ok(`marketPda ${market.toBase58().slice(0, 8)} yes ${yesMint.toBase58().slice(0, 8)} no ${noMint.toBase58().slice(0, 8)}`);

  const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const AAPLX = new PublicKey(ASSETS.AAPL.mint!);
  const NVDAX = new PublicKey(ASSETS.NVDA.mint!);
  try {
    const built = await client.createMarketIx({
      creator,
      nonce: 1,
      question: "Will Apple be worth more than Nvidia on December 31, 2026?",
      sideALabel: "Apple",
      sideBLabel: "Nvidia",
      collateralMint: USDC,
      pairAMint: AAPLX,
      pairBMint: NVDAX,
      template: cap,
      resolveTs: 1_798_664_400,
      graceSecs: 86_400,
    });
    assert(built.ix.keys.length === 16 && built.market.equals(market), `create_market ix keys=${built.ix.keys.length}`);
    ok(`create_market ix encodes (${built.ix.data.length} bytes, ${built.ix.keys.length} accounts; pair token programs resolved from mainnet mints)`);
    const fakeMarket: Market = {
      address: market, creator, nonce: 1n, bump: 255, question: "", sideALabel: "Apple", sideBLabel: "Nvidia",
      collateralMint: USDC, collateralVault: kp(), yesMint, noMint, pairAMint: AAPLX, pairBMint: NVDAX, rewardVaultA: kp(), rewardVaultB: kp(),
      template: cap, resolveTs: 0, graceSecs: 0, resolver: creator, crank: creator, feeBpsHolders: 10_000, feeBpsCreator: 0, feeBpsPlatform: 0,
      status: { kind: "resolved", winner: "yes", priceA: 0n, priceB: 0n, resolvedTs: 0 }, poolA: kp(), poolB: kp(),
      totalMinted: 0n, totalRedeemed: 0n, rewardsPaidA: 0n, rewardsPaidB: 0n, epochs: 0,
    };
    const [mint, redeem, dep, dist, rm] = await Promise.all([
      client.mintSetIx(fakeMarket, 5_000_000_000n, creator),
      client.redeemIx(fakeMarket, 1n, creator),
      client.depositRewardsIx(fakeMarket, "yes", 1n, creator),
      client.distributeIx(fakeMarket, "no", [kp(), kp()], [1n, 2n], creator),
      client.resolveManualIx(market, "yes", 340_350_000n, 223_960_000n, creator),
    ]);
    ok(`mint_set ${mint.keys.length} keys, redeem ${redeem.keys.length}, deposit_rewards ${dep.keys.length}, distribute ${dist.keys.length} (2 remaining), resolve_manual ${rm.data.length} bytes`);
  } catch (e) {
    console.log("  FAIL client ix building: " + (e as Error).message);
    throw e;
  }

  const poolArg = flagString(args, "pool");
  if (!poolArg) {
    console.log("== pools: pass --pool <mainnet DAMM v2 pool> to test quotes against a live pool");
  } else {
    console.log("== pools (read-only against " + rpc + ")");
    const pool = new PublicKey(poolArg);
    const state = await getPoolState(connection, pool);
    const [a, b] = await Promise.all([getMintInfo(connection, state.tokenAMint), getMintInfo(connection, state.tokenBMint)]);
    const px = priceFromSqrtPrice(state.sqrtPrice, a.decimals, b.decimals);
    ok(`pool ${pool.toBase58().slice(0, 8)} A=${state.tokenAMint.toBase58().slice(0, 6)}(${a.decimals}) B=${state.tokenBMint.toBase58().slice(0, 6)}(${b.decimals}) price A in B = ${px} collectFeeMode=${state.collectFeeMode}`);
    const amountIn = new BN(10).pow(new BN(a.decimals)); // 1 token A
    const quote = await quoteSwap(connection, { address: pool, state }, state.tokenAMint, amountIn, 100);
    ok(`quote 1 A -> ${Number(quote.amountOut) / 10 ** b.decimals} B (min ${Number(quote.minAmountOut) / 10 ** b.decimals}), fee ${quote.fee.toString()} in ${quote.feeMint.equals(state.tokenBMint) ? "B" : "A"}, impact ${quote.priceImpactBps} bps`);
    const payer = Keypair.generate().publicKey;
    const ixs = await buildSwapIx({ connection, payer, pool, poolState: state, inputMint: state.tokenAMint, outputMint: state.tokenBMint, amountIn, minAmountOut: quote.minAmountOut });
    ok(`swap built: ${ixs.length} instruction(s)`);
    const quoteBack = await quoteSwap(connection, { address: pool, state }, state.tokenBMint, quote.amountOut, 100);
    ok(`reverse quote ${Number(quote.amountOut) / 10 ** b.decimals} B -> ${Number(quoteBack.amountOut) / 10 ** a.decimals} A`);
    // Pool creation tx (not sent): USDC / wBTC as two plain SPL mints.
    const WBTC = new PublicKey("3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh");
    const created = await createPairPool({ connection, payer, tokenA: WBTC, tokenB: USDC, tokenADecimals: 8, tokenBDecimals: 6, priceInB: 65_000, tokenAAmount: 100_000_000n, feeBps: 100 });
    assert(created.pool.equals(poolAddressFor(WBTC, USDC)), "derived pool address");
    ok(`createCustomPool tx built: ${created.tx.instructions.length} ix, pool ${created.pool.toBase58().slice(0, 8)}, 1 wBTC + ${Number(created.tokenBAmount) / 1e6} USDC, sqrtPrice ${created.initSqrtPrice.toString().slice(0, 8)}...`);
  }
  console.log("\nsmoke: all good");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
