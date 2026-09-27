# Build Plan: Paired Prediction Duels on Solana

Target: a working devnet deployment plus a fully browsable web app by the end of this session,
shaped for the Solana Foundation "Perps and Prediction Markets" hackathon (Oct 9, 2026) and the
Colosseum Crypto World's Fair Solana track (Oct 12, 2026).

## 0. Product in one paragraph

A market is a head-to-head question ("Will Apple be more valuable than Nvidia on Dec 31?") with
two outcome tokens, YES and NO, fully collateralized by USDC. YES trades in a Meteora DAMM v2
pool against AAPLx; NO trades against NVDAx. Both pools collect their trading fee in the stock
token only. A crank claims those fees and pays them pro-rata to holders of that side, so betting
on Apple earns Apple. Resolution reads Pyth AAPL/USD and NVDA/USD, multiplies by stored share
counts, and the winning token redeems for one USDC. Anyone can create a new duel from a template.

## 1. Repository layout (pnpm monorepo, root package `duel`)

```
.impeccable.md            design context (audience, tone) for the frontend skill
DESIGN.md                 binding visual spec
PLAN.md                   this file
programs/duel/            Anchor 0.32 workspace: the on-chain program
packages/sdk/             TypeScript client: program, Meteora pools, Pyth, routing, rewards math
apps/web/                 Next.js 15 app
scripts/                  devnet bootstrap, rewards crank, resolver, faucet
docs/                     README assets, pitch outline, submission checklist
```

Toolchain: Node 22 + pnpm 9 on Windows for TS; Solana CLI 3.0.13 + Anchor 0.32.1 inside WSL
Ubuntu for the program (`wsl -d Ubuntu -- bash -lc '...'`). WSL sees the repo at
`/mnt/c/Users/1arya/AppData/Roaming/Claude/scratch-workspaces/.../scratch-2026-09-26-076840`.
Deploy keypair: `~/.config/solana/id.json` in WSL (`GtQ8ZPUWHkbU4s2oRGNPmLh8ZX2wEfovCvHAp1d4Bigj`).

## 2. On-chain program `duel` (Anchor 0.32.1, Rust)

Program ID: generated at build; written to `Anchor.toml`, `declare_id!`, and `packages/sdk/idl/duel.json`.

### Accounts

`Market` (PDA `["market", creator, nonce_u64]`)
- `creator: Pubkey`, `nonce: u64`, `bump: u8`
- `question: String` (max 160)
- `side_a_label: String` (max 24, e.g. "Apple"), `side_b_label: String` (max 24, e.g. "Nvidia")
- `collateral_mint: Pubkey` (USDC or mock), `collateral_vault: Pubkey` (ATA owned by market PDA)
- `yes_mint: Pubkey`, `no_mint: Pubkey` (6 decimals, mint authority = market PDA)
- `pair_a_mint: Pubkey` (AAPLx), `pair_b_mint: Pubkey` (NVDAx)
- `reward_vault_a: Pubkey`, `reward_vault_b: Pubkey` (ATAs of pair mints owned by market PDA)
- `template: ResolutionTemplate` enum:
  - `CapCompare { feed_a: [u8;32], feed_b: [u8;32], shares_a: u64, shares_b: u64 }` YES if price_a*shares_a > price_b*shares_b
  - `RatioOutperform { feed_a, feed_b, start_ratio_e9: u64 }` YES if (price_a/price_b) at resolve > start ratio
  - `PriceAbove { feed, threshold_e6: u64 }`
- `resolve_ts: i64`, `grace_secs: i64` (manual fallback allowed after resolve_ts + grace)
- `resolver: Pubkey` (manual fallback authority), `crank: Pubkey` (rewards distributor)
- `fee_bps_holders: u16`, `fee_bps_creator: u16`, `fee_bps_platform: u16` (informational; the pool fee itself lives in Meteora)
- `status: MarketStatus` enum `Open | Resolved { winner: Side, price_a: i64, price_b: i64, resolved_ts: i64 }`
- `pool_a: Pubkey`, `pool_b: Pubkey` (Meteora pool addresses, set after bootstrap via `set_pools`)
- `total_minted: u64`, `total_redeemed: u64`, `rewards_paid_a: u64`, `rewards_paid_b: u64`, `epochs: u32`

### Instructions

1. `create_market(params)` creates Market, YES/NO mints, collateral vault, reward vaults.
2. `set_pools(pool_a, pool_b)` creator-only, once.
3. `mint_set(amount)` transfer `amount` collateral in, mint `amount` YES and `amount` NO to the signer.
4. `merge_set(amount)` burn `amount` YES and NO, return `amount` collateral.
5. `resolve()` permissionless after `resolve_ts`; reads Pyth `PriceUpdateV2` accounts via
   `pyth-solana-receiver-sdk` with `get_price_no_older_than(clock, max_age = 6h, feed_id)`; the
   6-hour window covers the last close for equities. Sets `status = Resolved`.
6. `resolve_manual(winner, price_a, price_b)` resolver-only after `resolve_ts + grace_secs`.
7. `redeem(amount)` burn winning tokens, transfer `amount` collateral out.
8. `deposit_rewards(side, amount)` anyone can deposit pair tokens into a reward vault (the crank
   uses this after claiming Meteora position fees).
9. `distribute(side, amounts: Vec<u64>)` crank-only; remaining accounts are the recipients' ATAs
   in the same order; transfers from the reward vault; emits `RewardsPaid { market, side, epoch, total, count }`.
   Max 12 recipients per call. Program checks `sum(amounts) <= vault balance`.

Errors: `NotYetResolvable`, `AlreadyResolved`, `NotResolved`, `WrongSide`, `StaleOracle`,
`GraceNotElapsed`, `Unauthorized`, `TooManyRecipients`, `InsufficientRewards`.

Events: `MarketCreated`, `SetMinted`, `SetMerged`, `MarketResolved`, `Redeemed`, `RewardsPaid`.

Tests (`programs/duel/tests/duel.ts`, run with `anchor test` against a local validator in WSL):
create → mint → merge → resolve_manual after clock warp (use `resolve_ts` in the past) → redeem;
distribute with three recipients; negative cases for each error.

## 3. SDK `packages/sdk`

Exports (`src/index.ts`):
- `DuelClient(connection, wallet?)` built from the IDL with `@coral-xyz/anchor`.
  - `createMarket(params): Promise<{ market, yesMint, noMint, tx }>`
  - `mintSet`, `mergeSet`, `redeem`, `resolveManual`, `depositRewards`, `distribute`
  - `fetchMarket(pk)`, `fetchAllMarkets()`
- `pools.ts` on `@meteora-ag/cp-amm-sdk`: `createPairPool({ tokenA: yesMint, tokenB: aaplMint, priceInB, feeBps, collectFeeMode: quoteOnly })`,
  `getPoolState`, `quoteSwap`, `buildSwapIx`, `claimPositionFee`.
- `routing.ts`: `buildBetTx({ side, usdcAmount })` = swap USDC→pair token (USDC/pair pool) then
  pair→outcome (outcome/pair pool) in one transaction; `buildSellTx` is the reverse;
  `previewBet` returns `{ outcomeOut, feePaidInPair, oddsBefore, oddsAfter }`.
- `odds.ts`: `oddsFromPools(poolA, poolB, pairAUsd, pairBUsd)` → `{ yes: number, no: number, impliedSum }`
  where `yes = priceOfYesInPairA * pairAUsd` and the displayed pair is normalized to sum to 1.
- `rewards.ts`: `snapshotHolders(mint)` via `getProgramAccounts` / token-2022-aware parsing;
  `computeProRata(vaultBalance, holders, minUsd)`; `chunkDistribute`.
- `pyth.ts`: feed IDs for AAPL, NVDA (and index variants), `postPriceUpdates(hermesUrl, feedIds)`
  using `@pythnetwork/pyth-solana-receiver`.
- `registry.ts`: asset registry `{ symbol, name, mint (mainnet), mockMint (devnet), pythFeedId, decimals, kind: 'stock'|'crypto' }`
  for AAPL, NVDA, TSLA, F, SPY, GLD, BTC, ETH, ZEC, HYPE, SOL.
- `types.ts`: `Market`, `Side`, `Odds`, `Position`, `RewardEpoch`, `Template`, `Deployment`.
- `deployments/devnet.json` written by the bootstrap script: program ID, mock mints, markets, pools.

## 4. Scripts `scripts/`

- `bootstrap.ts` (devnet): create mock mints (USDC 6dp, AAPLx 6dp, NVDAx 6dp), mint supply to the
  operator, create USDC/AAPLx and USDC/NVDAx pools at Pyth prices, create the flagship market
  (Apple vs Nvidia, CapCompare, resolve Dec 31 2026 21:00 UTC), mint a set of 5,000, create
  YES/AAPLx and NO/NVDAx pools at 50/50 (quote-only fee, 100 bps), `set_pools`, write
  `deployments/devnet.json`. Then two more duels: Bitcoin vs Ethereum (RatioOutperform) and
  Tesla vs Ford (CapCompare) so the board is not empty.
- `crank.ts`: for each market and side, claim Meteora position fees → `deposit_rewards` →
  snapshot holders → `distribute` in chunks. Loop every N minutes or run once.
- `resolve.ts`: post Pyth updates from Hermes and call `resolve`; fallback `resolve_manual`.
- `faucet.ts`: mint mock USDC to a given wallet (the web app calls this in devnet mode through a
  route handler).

## 5. Web app `apps/web`

Routes:
- `/` The Board: every duel as a full-width row: matchup headline, OddsBar, resolves-in,
  pair tokens, fees paid out, status stamp. Above the list, a one-line editorial masthead.
- `/d/[market]` The Duel: hero (headline + Instrument Serif question + ToteBoard), BetPanel,
  TaleOfTheTape, odds Chart, Ledger of payouts, "Your corner" (position, earned, claimable),
  "How it resolves" (template, feeds, share counts, time, fallback).
- `/new` Create a duel: template ToggleGroup, two asset Selects from the registry, date,
  seed amount, fee, live preview of the resulting headline and tote board, submit.
- `/me` My corners: positions across duels, earned per pair token, redeem buttons after resolution.

State: `@tanstack/react-query` over the SDK. Demo mode (`NEXT_PUBLIC_DEMO=1`) swaps the SDK
for fixtures with a ticking odds simulator so every screen works offline. Devnet mode reads
`deployments/devnet.json`.

Wallet: `@solana/wallet-adapter-react` + wallets for Phantom, Solflare, Backpack; our own
WalletButton and picker per DESIGN.md. Geo notice and risk disclosure inline on first bet.

Tailwind v4 with the DESIGN.md tokens in `globals.css`. Fonts via `next/font/google`
(Archivo variable with `wdth` axis, Instrument Serif italic).

## 6. Work breakdown and owners

| # | Task | Owner | Depends on |
|---|---|---|---|
| A | Anchor program, tests, devnet deploy, IDL to `packages/sdk/idl` | subagent `program` | devnet SOL |
| B | SDK: Meteora pools, routing, odds, rewards math, Pyth, registry; program client once IDL lands | subagent `sdk` | A for the client only |
| C | Web app: design system, all four routes, demo mode, wallet | subagent `web` | DESIGN.md, SDK types |
| D | Scripts: bootstrap, crank, resolve, faucet; run bootstrap on devnet | subagent `sdk` after B | A, B |
| E | Integration: web against devnet deployment, end-to-end bet/sell/crank/resolve run | lead | A–D |
| F | Design QA against DESIGN.md DON'Ts, responsive pass, copy pass | subagent `design-qa` | C |
| G | README, architecture diagram, pitch outline, submission checklist | subagent `docs` | E |

## 7. Acceptance criteria

1. `anchor test` passes in WSL; program deployed to devnet; IDL committed.
2. `pnpm bootstrap:devnet` creates mints, three markets, six pools, and writes `deployments/devnet.json`.
3. In the web app on devnet: connect wallet → faucet USDC → bet Apple → odds flip on the board →
   sell half → crank pays AAPLx to the wallet → ledger shows the payout.
4. `pnpm resolve -- --market <pk> --manual` resolves a test market with `resolve_ts` in the past and
   redeem works.
5. Demo mode renders every route with no network.
6. Design QA: zero violations of DESIGN.md forbidden list; Lighthouse accessibility ≥ 95 on `/`.
7. README explains the mechanism, the architecture, and how to run it in under two minutes of reading.

## 8. Known risks and fallbacks

- Devnet airdrops are rate-limited. Fallback: deploy with a smaller program footprint; if
  deployment is impossible, run against a local validator in WSL and document it.
- Meteora cp-amm on devnet: if `createCustomPool` is unavailable or config-gated, fall back to a
  minimal constant-product pool inside our own program (`pool_swap` instruction) with identical
  quote-only fee semantics. The SDK interface stays the same.
- Pyth devnet posting: if Hermes posting fails, `resolve_manual` covers the demo.
- xStocks do not exist on devnet; mock mints stand in and the registry maps them to mainnet mints.
