# Versus web app

Versus: the board, the duel card, the create form and "My corners" for paired prediction duels on
Solana. Next.js 15 App Router, React 19, Tailwind v4 with the DESIGN.md tokens, Radix primitives
for behaviour, wallet-adapter for Phantom, Solflare and Backpack (plus a Burner test wallet on
localnet and devnet).

## Run

```sh
pnpm install
pnpm --filter versus-web dev        # http://localhost:3000, demo mode by default
pnpm --filter versus-web build      # production build, zero type errors expected
pnpm --filter versus-web start
pnpm --filter versus-web typecheck
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
  pnpm --filter versus-web dev

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

- `/` Landing. The v0 IRL template with Versus copy: full-viewport dithered background, hero,
  "powered by" marquee (Solana, Pyth, Meteora, xStocks), three feature cards, the four steps, a
  call to action, footer.
- `/board` The board. Live duels as cards (matchup, question, odds bar, Back A / Back B), with
  All / Stocks / Crypto / Settled filters.
- `/d/[id]` The duel. Tale of the tape, odds chart, payout ledger and rules on the left; the
  split-flap tote board, bet panel and your position sticky on the right. `?side=b` preselects
  the right corner.
- `/new` Create. Template chooser, two asset selects, the bell (UTC), seed USDC, fee slider, and
  a live preview card.
- `/positions` Positions (was `/me`, which redirects). Balance, value and earnings up top, one
  card per side held, redeem after resolution.
- `/how-it-works` The four steps, the mechanism, FAQ.

## Data layer

`lib/data/adapter.ts` is the only interface the UI talks to (`DuelData`). `lib/data/index.ts`
exports `getData()`, which picks an adapter:

- `lib/data/demo.ts` — twenty-one live fixture duels across stocks, crypto, indexes and gold
  (Apple vs Nvidia, Bitcoin vs Gold, Coinbase vs Robinhood, XRP vs Dogecoin, ...) plus five
  settled ones (Zcash vs Hyperliquid, Zcash wins, among them), all declared in one `SEEDS` table
  and numbered in creation order, a seeded random walk that ticks the odds every 4 seconds, a ledger of payouts with UTC times and fake signatures that grows while
  you watch, and in-memory positions and balances that update optimistically on bet, sell,
  redeem and faucet. The picker offers a "Demo corner" so `/me` and the bet panel work with no
  extension installed.
- `lib/data/chain.ts` — `DuelData` over `@versus/sdk/browser` for the localnet or devnet
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
- `app/api/logo/[symbol]/route.ts` — server route: the fighter logo for a registry symbol. Walks
  the keyless sources in `lib/logos.ts` (Parqet, then Financial Modeling Prep or CoinCap, then the
  company favicon via DuckDuckGo), returns the first image with a day-long cache header, 404s
  otherwise. `components/AssetLogo.tsx` shows a monogram until the image lands and keeps it if
  the route 404s, so logos never block a card.

`lib/types.ts` mirrors the SDK types (`Market`, `Side`, `Odds`, `Position`, `RewardEpoch`,
`Template`, `Deployment`) so the chain adapter is a mapping, not a rewrite. React Query sits on
top (`lib/hooks.ts`); the adapter's `subscribe` invalidates the cache on every tick. Explorer links
use `?cluster=custom&customUrl=<rpc>` on localnet.

## Design

`DESIGN.md` at the repo root is binding. The landing page is the v0 "IRL event" template with
only the copy changed; its primitives live in `components/ui`, `components/motion-primitives`,
`components/Dither.tsx` and `components/DecryptedText.tsx`. Tokens are the template's shadcn
neutral dark set plus the app's side colours (green for A, red for B), all in `app/globals.css`.
Fonts are Geist and Geist Mono via `next/font/google`.

## Landing animation pins

The dithered background (`components/Dither.tsx`) is the template's component verbatim, and it
only behaves with the template's library versions: `three@0.167`, `@react-three/fiber@9.5`,
`@react-three/postprocessing@3.0.4`, `postprocessing@6.39.5`, `motion@12`. Two things break it:
a newer three/fiber pair freezes the wave, and two copies of `postprocessing` in `node_modules`
make the composer's `instanceof Effect` check fail, so the dither pass is skipped and the wave
renders as smooth smoke. Keep the app's `postprocessing` at the exact version the bindings
resolve (`readlink node_modules/postprocessing`), and restart `next dev` after changing any of
them.

## Wallets

`@solana/wallet-adapter-react` with the Phantom and Solflare adapters; Backpack registers through
Wallet Standard and is detected automatically. The picker (`components/WalletButton.tsx`) is a
Radix Dialog listing the three as hairline rows; there is no wallet-adapter-react-ui or its CSS.

`lib/wallet/burner.ts` adds "Burner (test wallet)": a `BaseSignerWalletAdapter` that generates a
Keypair, keeps the secret in `localStorage` under `versus:burner-wallet-secret-key`, signs locally
and reconnects on its own after a reload. It is registered only when the deployment cluster is
localnet or devnet, never on mainnet. Test funds only.
