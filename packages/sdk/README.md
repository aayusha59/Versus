# @versus/sdk

TypeScript client for Versus, paired prediction duels: the `duel` Anchor program, Meteora DAMM v2 pools,
Pyth prices, bet routing, odds, and rewards math. Two entries: `@versus/sdk` (everything, Node) and
`@versus/sdk/browser` (everything except `pyth.ts`, whose receiver dependency reaches gRPC through
jito-ts, and the Node file helpers in `deployments-node.ts`). The web app imports the browser entry
and the deployment JSON statically.

## Usage

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import devnet from "@versus/sdk/deployments/devnet.json";
import { DuelClient, parseDeployment, routingFromDeployment, loadMarketPools, buildBetTx } from "@versus/sdk";

const connection = new Connection(devnet.rpcUrl, "confirmed");
const dep = parseDeployment(devnet);
const client = DuelClient.fromDeployment(connection, dep, wallet);          // wallet: wallet-adapter or anchor Wallet
const routing = routingFromDeployment(dep, "Apple");                         // by label or address
const pools = await loadMarketPools(connection, routing);                    // { odds: { yes, no, impliedSum }, pairAUsd, ... }
const { tx, preview } = await buildBetTx({ connection, routing, side: "yes", usdcAmount: 25_000_000n, payer: wallet.publicKey, pools });
console.log(preview.oddsBefore.yes, "->", preview.oddsAfter.yes, "fee in AAPLx:", preview.feePaidInPair.toString());
await wallet.sendTransaction(tx, connection);
```

## Modules

| module | exports |
|---|---|
| `client.ts` | `DuelClient` (`createMarket`, `setPools`, `mintSet`, `mergeSet`, `redeem`, `resolve`, `resolveManual`, `depositRewards`, `distribute`, each with an `...Ix` builder; `fetchMarket`, `fetchAllMarkets`, `fetchRewardEpochs` (each epoch carries `recipients`: per-wallet payouts decoded from the transaction's token-balance deltas), `marketPda`, `outcomeMints`), `rewardRecipients`, `evaluateTemplate`, `templateFeeds`, `sideArg`, `DUEL_PROGRAM_ID` |
| `pools.ts` | `createPairPool` (DAMM v2 `createCustomPool`, flat fee, `CollectFeeMode.OnlyB`), `getPoolState`, `getPoolStates`, `getPoolStatesBatch` (one RPC round trip), `poolFeeBps`, `poolLpFees`, `quoteSwap`, `buildSwapIx`, `claimPositionFee`, `listPositions`, `listPositionsInPool`, `unclaimedFees`, `poolAddressFor`, `poolExists`, `getMintInfo` |
| `routing.ts` | `routingFromDeployment`, `loadMarketPools`, `marketPoolsFromStates`, `previewBet`, `buildBetTx`, `previewSell`, `buildSellTx`, `pairUsdFromPool` |
| `feeds.ts` | `normalizeFeedId`, `feedIdBytes`, `feedIdFromBytes` (no `Buffer`; re-exported by both entries) |
| `odds.ts` | `oddsFromPools`, `oddsFromPrices`, `oddsFromSqrtPrices`, `priceFromSqrtPrice`, `poolPriceOf`, `formatPct` |
| `rewards.ts` | `snapshotHolders`, `computeProRata`, `chunk` (max 12 per `distribute`), `formatLedgerLine` |
| `pyth.ts` | `getLatestPrices`, `getLatestPricesBySymbol`, `getLatestVaas`, `postPriceUpdates`, `PYTH_FEEDS`, `HERMES_URL`, `PYTH_RECEIVER_PROGRAM_ID`, `pythLocalnetAccounts` |
| `registry.ts` | `ASSETS` (AAPL, NVDA, TSLA, F, SPY, GLD, BTC, ETH, ZEC, HYPE, SOL: mainnet mint, decimals, Pyth feed), `getAsset`, `assetsForDeployment`, `mintForCluster` |
| `deployments.ts` | `parseDeployment`, `findMarket`, `emptyDeployment`, `clusterFromRpcUrl` (browser-safe) |
| `deployments-node.ts` | `loadDeployment`, `loadDeploymentIfExists`, `saveDeployment`, `deploymentPath` (Node only, lazy `node:fs`) |
| `types.ts` | `Market`, `Side`, `Odds`, `Position`, `RewardEpoch`, `Template`, `Deployment`, `DeployedMarket`, ... |

## Conventions

- Outcome pools: token A = YES/NO, token B = pair token (AAPLx). Fee mode `OnlyB` (= 1) so the
  trading fee is always taken in the pair token; the crank pays it to holders of that side.
- Pair/USDC pools: token A = pair token, token B = USDC, so `poolPriceAInB` is the USD price.
- Prices from `priceFromSqrtPrice` are "token B per token A" in natural units.
- Odds: `yesRaw = priceOfYesInPairA * pairAUsd`; displayed `yes`/`no` are normalised to sum to 1;
  `impliedSum` is the raw sum and its drift from 1 is a UI stat.
- Hermes requires `PYTH_API_KEY` (Bearer) since the Pyth Core upgrade; devnet odds read pair
  prices from the USDC pools and never touch Hermes.
- `idl/duel.json` is the Anchor 0.32 IDL from `anchor build` (program
  `AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25`); `idl/duel.ts` is its camelCase type. Copy both from
  `programs/duel/target/{idl,types}` after every program change.
- `deployments/<cluster>.json` is written by `scripts/src/bootstrap.ts`. `localnet.json` only matches
  the validator it was bootstrapped on; `devnet.json` is the one the web app should ship with (it is
  an empty placeholder until `bootstrap` runs against devnet, so the web app can import it statically).
- The root `package.json` pins `@solana/web3.js` to one version via `pnpm.overrides` (the Pyth
  receiver's `jito-ts` otherwise pulls a second copy whose `rpc-websockets` import breaks at runtime).

## Scripts

```
pnpm --filter @versus/sdk typecheck
pnpm --filter @versus/sdk build      # emits dist/
```
