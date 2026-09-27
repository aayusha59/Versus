# Duel web app

The board, the duel card, the create form and "My corners" for paired prediction duels on
Solana. Next.js 15 App Router, React 19, Tailwind v4 with the DESIGN.md tokens, Radix primitives
for behaviour, wallet-adapter for Phantom, Solflare and Backpack (plus a Burner test wallet on
localnet and devnet).

## Run

```sh
pnpm install
pnpm --filter web dev        # http://localhost:3000, demo mode by default
pnpm --filter web build      # production build, zero type errors expected
pnpm --filter web start
pnpm --filter web typecheck
```

No wallet, RPC or deployment is needed to browse every route: demo mode is the default.

## Environment

| Variable                 | Default                        | Meaning                                                                                                              |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_DEMO`       | unset                          | `1` forces demo mode (fixtures plus a ticking odds simulator, nothing touches a chain).                              |
| `NEXT_PUBLIC_DEPLOYMENT` | unset                          | `localnet` or `devnet`: which `packages/sdk/deployments/<cluster>.json` to serve (both are bundled statically). Unset means demo. |
| `NEXT_PUBLIC_RPC_URL`    | the deployment's `rpcUrl`      | RPC endpoint for the wallet adapter and the SDK, e.g. `http://127.0.0.1:8999`. Shown under the network stamp.        |
| `FAUCET_KEYPAIR_PATH`    | `../../scripts/.keys/id.json`  | Server only. Operator keypair (mint authority) the `/api/faucet` route uses on localnet/devnet. Never read on the client. |

Demo mode is on when `NEXT_PUBLIC_DEMO=1` **or** when `NEXT_PUBLIC_DEPLOYMENT` names no cluster,
so a fresh checkout always runs. Copy `.env.example` to `.env.local` to change it.

## Chain mode from a cold start (localnet)

Solana and Anchor live in WSL; everything else runs on Windows with Node 22 and pnpm 9. Four
terminals, in this order:

```sh
# 1. validator (WSL, ~1 min: clones Meteora DAMM v2, the Pyth receiver and Token-2022 from mainnet,
#    loads programs/duel/target/deploy/duel.so, keeps transaction history for the session)
pnpm --filter scripts validator -- --run --rpc-port 8999

# 2. bootstrap: 7 mock mints, 6 pair/USDC pools, 4 markets, writes packages/sdk/deployments/localnet.json
RPC_URL=http://127.0.0.1:8999 pnpm --filter scripts bootstrap -- --with-test-market

# 3. web app in chain mode (or put these three lines in apps/web/.env.local)
NEXT_PUBLIC_DEPLOYMENT=localnet NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8999 FAUCET_KEYPAIR_PATH=../../scripts/.keys/id.json \
  pnpm --filter web dev

# 4. after betting: pay the fees out to holders (once, or every 5 minutes)
RPC_URL=http://127.0.0.1:8999 pnpm --filter scripts crank -- --once
```

Then in the browser: Connect wallet -> "Burner (test wallet)" -> open a duel -> Faucet (1 SOL and
1,000 mock USDC) -> bet -> the tote board moves -> sell -> run the crank -> reload: the ledger shows
the epoch and "Your corner" shows the pair token you earned; `/me` lists the position; `/new` opens
a fresh duel in six wallet-signed transactions. Devnet is the same with `NEXT_PUBLIC_DEPLOYMENT=devnet`
and `RPC_URL=https://api.devnet.solana.com` for the scripts (the program must be deployed and the
operator funded first; `packages/sdk/deployments/devnet.json` ships as an empty placeholder until
`bootstrap` overwrites it).

## Routes

- `/` The Board. Every duel as a full-width row: matchup, OddsBar, resolves-in, pair tokens,
  fees paid out, one stamp. Live first, settled below with the loser struck through.
- `/d/[id]` The Duel. Headline and question on the left, the split-flap ToteBoard hanging on the
  right, BetPanel under it, then Tale of the tape, the 30-day odds chart, the payout ledger,
  "Your corner" and "How it resolves". Settled duels show the winner stamp and a redeem action.
- `/new` Make a duel. Template ToggleGroup, two asset Selects from `lib/registry.ts`, the bell
  (UTC), seed USDC, a fee slider styled as a tote rail, and a live preview of the headline and
  a 50/50 board. Submitting navigates to the new card.
- `/me` My corners. Positions across duels with size, value, earned in the pair token, and
  redeem buttons after resolution. Empty state teaches connecting a wallet.

## Data layer

`lib/data/adapter.ts` is the only interface the UI talks to (`DuelData`). `lib/data/index.ts`
exports `getData()`, which picks an adapter:

- `lib/data/demo.ts` — three live fixture duels (Apple vs Nvidia, Bitcoin vs Ethereum, Tesla vs
  Ford) plus one settled (Zcash vs Hyperliquid, Zcash wins), a seeded random walk that ticks the
  odds every 4 seconds, a ledger of payouts with UTC times and fake signatures that grows while
  you watch, and in-memory positions and balances that update optimistically on bet, sell,
  redeem and faucet. The picker offers a "Demo corner" so `/me` and the bet panel work with no
  extension installed.
- `lib/data/chain.ts` — `DuelData` over `@duel/sdk/browser` for the localnet or devnet
  deployment (`lib/data/deployment.ts` picks the bundled JSON). Every 5 s it fetches all markets
  (`fetchAllMarkets`), every outcome and pair/USDC pool in one batched call, outcome supplies and
  pool vaults, and the connected owner's token accounts; odds come from `oddsFromPools` with pair
  USD prices read from the USDC pools. Bets and sells are the SDK's two-hop transactions
  (`buildBetTx`/`buildSellTx`) signed by the wallet adapter and confirmed by polling
  `getSignatureStatuses`; redeem is `redeemIx`; create-market replays the bootstrap flow as six
  wallet-signed transactions (create_market, mint_set, buy both pair tokens, YES pool at 50/50,
  NO pool at 50/50, set_pools) with a progress sentence per step; faucet calls `/api/faucet`.
  Client-side state until an indexer exists, keyed by cluster in `localStorage`: odds history is
  sampled on every poll (first point seeded at 50/50), ledger rows are cached once seen, and bet
  cost per (market, owner, side). "Earned" is the sum of `RewardsPaid` transfers to the owner,
  decoded from each distribute transaction's token-balance deltas (`RewardEpoch.recipients` in
  the SDK); "Accruing" is the pool's undistributed LP fee times the owner's share of the outcome
  tokens outside the pool and the operator's wallet (the crank's exclusion rule).
- `lib/data/devnet.ts` — re-exports the chain adapter under its old name.
- `app/api/faucet/route.ts` — server route: airdrops 1 SOL (localnet) or tops up from the
  operator (devnet) and mints 1,000 mock USDC with the operator key; refuses on mainnet.

`lib/types.ts` mirrors the SDK types (`Market`, `Side`, `Odds`, `Position`, `RewardEpoch`,
`Template`, `Deployment`) so the chain adapter is a mapping, not a rewrite. React Query sits on
top (`lib/hooks.ts`); the adapter's `subscribe` invalidates the cache on every tick. Explorer links
use `?cluster=custom&customUrl=<rpc>` on localnet.

## Design

`DESIGN.md` at the repo root is binding. Tokens live in `app/globals.css` as CSS variables and
are exposed to Tailwind through `@theme inline`; Tailwind's default palette, fonts, radii and
shadows are wiped so nothing off-spec can slip in. Fonts are Archivo (variable, `wdth` axis for
the condensed fight-poster headlines and the wordmark) and Instrument Serif italic, both via
`next/font/google`. Components are under `components/`; none of them wrap content in a card.

## Wallets

`@solana/wallet-adapter-react` with the Phantom and Solflare adapters; Backpack registers through
Wallet Standard and is detected automatically. The picker (`components/WalletButton.tsx`) is a
Radix Dialog listing the three as hairline rows; there is no wallet-adapter-react-ui or its CSS.

`lib/wallet/burner.ts` adds "Burner (test wallet)": a `BaseSignerWalletAdapter` that generates a
Keypair, keeps the secret in `localStorage` under `duel:burner-wallet-secret-key`, signs locally
and reconnects on its own after a reload. It is registered only when the deployment cluster is
localnet or devnet, never on mainnet. Test funds only.
