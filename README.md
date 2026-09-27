# Duel

**Bet on Apple. Get paid in Apple.**

A duel is a head-to-head question with a date on it: "Will Apple be more valuable than Nvidia on December 31, 2026?" Two sides, YES and NO, each fully backed by USDC. Bet Apple and the fee on your trade is collected in tokenized Apple stock and paid to everyone holding the Apple side. Bet Nvidia, get paid in Nvidia. On the date, Pyth reads both prices, the winner redeems for one USDC a token, and the loser keeps the shares it was paid. One small Anchor program plus Meteora DAMM v2, Pyth, and xStocks.

## How it works

1. `mint_set` takes 1 USDC and mints 1 YES plus 1 NO; `merge_set` reverses it.
2. YES trades in a Meteora DAMM v2 pool against AAPLx, NO against NVDAx. Both pools collect their fee in the stock token only.
3. A crank claims each pool's fees, deposits them into that side's reward vault, snapshots holders, and pays out pro-rata in the stock token.
4. After `resolve_ts`, anyone calls `resolve` with posted Pyth `PriceUpdateV2` accounts. Price times stored share count decides it. Winning tokens `redeem` for one USDC each.

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repo map

| Path | What | Status |
|---|---|---|
| `programs/duel` | Anchor 0.32.1 program, ID `AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25` | Built in WSL; 39 mocha and 10 unit tests pass |
| `packages/sdk` | TypeScript client: program, pools, Pyth, routing, odds, rewards, registry | Verified on localnet |
| `scripts` | `validator`, `bootstrap`, `bet`, `crank`, `resolve`, `faucet`, `smoke` | Verified on localnet |
| `apps/web` | Next.js 15 app: board, duel, create, my corners | Complete; chain adapter in integration |
| `docs` | Architecture, pitch, submission, prior art | Written |

## Run it

Rust and Solana tooling in WSL Ubuntu; Node 22 and pnpm 9 on Windows. Cold start on localnet:

```sh
pnpm install

# terminal 1: validator, mainnet clones of DAMM v2 and Pyth, duel preloaded
pnpm --filter scripts validator -- --run --rpc-port 8999

# terminal 2: mock mints, pools, three duels, one resolvable test market
export RPC_URL=http://127.0.0.1:8999
pnpm --filter scripts bootstrap -- --with-test-market

# terminal 3: web app in chain mode
NEXT_PUBLIC_DEPLOYMENT=localnet NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8999 pnpm --filter web dev

# terminal 2, after a few bets: pay holders
pnpm --filter scripts crank -- --once
```

Open http://localhost:3000. On localnet and devnet the wallet picker offers a Burner test wallet, no extension needed; the rail faucet mints mock USDC. `scripts/README.md` has the full CLI run-through: bet, sell, ledger, `resolve --manual`, redeem. Stop the validator with `wsl -d Ubuntu -- pkill -f solana-test-validator`.

**Demo mode.** `NEXT_PUBLIC_DEMO=1 pnpm --filter web dev` renders every route from fixtures with ticking odds and no network. Default on a fresh checkout.

## Status

- Program built and tested (39 mocha, 10 unit); IDL committed to `packages/sdk/idl`.
- SDK and scripts verified end to end on localnet (Agave 3.0.13, Sept 26, 2026).
- Web app complete; chain adapter and Burner wallet landing now.
- Devnet deployment pending; devnet airdrops were rate-limited. Fund `GtQ8ZPUWHkbU4s2oRGNPmLh8ZX2wEfovCvHAp1d4Bigj` with about 3 SOL, then:

```sh
wsl -d Ubuntu -- bash -lc 'cd ~/duel && anchor deploy --provider.cluster devnet'
RPC_URL=https://api.devnet.solana.com pnpm --filter scripts bootstrap
```

## Known limits

- The operator wallet owns the Meteora LP positions and claims their fees.
- Rewards accounting is off-chain; the payout is on-chain through `distribute`, which checks the crank key and the vault balance.
- `resolve_manual` by the resolver after `resolve_ts + grace_secs` is the fallback for stale feeds.
- Hermes now requires an API key, so `resolve --manual` is the demo path; plain `resolve` needs `PYTH_API_KEY`.
- xStocks are mocked on devnet and localnet; the registry maps each mock to its mainnet mint.
- Share counts for `CapCompare` are placeholders set at creation.

Upgrade path for each: `docs/ARCHITECTURE.md` §8.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): mechanism, diagrams, risks
- [`docs/PITCH.md`](docs/PITCH.md): pitch and demo scripts, judge Q&A
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md): targets, judging criteria, checklist
- [`docs/PRIOR_ART.md`](docs/PRIOR_ART.md): differentiation, market context

## Disclaimer

Not offered in restricted jurisdictions, including the United States. Outcome tokens can go to zero. Fee rewards are a redistribution of other traders' fees. xStocks can be paused or seized by their issuer. Not legal or investment advice.
