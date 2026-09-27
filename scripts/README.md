# scripts

Operational scripts for the Versus deployment (the `duel` program). Run with `pnpm --filter scripts <name>` (or from the
repo root: `pnpm bootstrap:devnet`, `pnpm crank`, `pnpm resolve`). Pass script flags after `--`.

## Environment

Copy `.env.example` to `.env` (in `scripts/` or the repo root):

| var | default | meaning |
|---|---|---|
| `RPC_URL` | `http://127.0.0.1:8899` | localnet, or `https://api.devnet.solana.com` |
| `KEYPAIR_PATH` | `./.keys/id.json` | operator keypair (JSON byte array); relative to `scripts/`. Generated on localnet if missing |
| `CLUSTER` | derived from `RPC_URL` | force `localnet` / `devnet` / `mainnet` |
| `PROGRAM_ID` | IDL address | override the program id |
| `PYTH_API_KEY` | | Hermes key (required for `resolve` without `--manual`; Pyth Core upgrade, Aug 2026) |
| `HERMES_URL` | `https://pyth.dourolabs.app/hermes` | Hermes host |

To reuse the WSL deploy key on Windows: `KEYPAIR_PATH=\\wsl$\Ubuntu\home\<user>\.config\solana\id.json`.

## Scripts

### `bootstrap`

Idempotent cluster bootstrap. Creates 7 mock mints (USDC, AAPLx, NVDAx, TSLAx, Fx, wBTC, wETH; 6 dp;
10M each to the operator), 6 pair/USDC pools at seed prices (AAPL 340.35, NVDA 223.96, TSLA 250,
F 11, BTC 65000, ETH 2400), three markets (Apple vs Nvidia, Bitcoin vs Ethereum, Tesla vs Ford),
mints a set of 5,000 per market, creates the YES/pairA and NO/pairB pools at 50/50, calls
`set_pools`, and writes `packages/sdk/deployments/<cluster>.json`. Every step checks the chain
first, so re-running continues where it stopped. Market PDAs use nonces 1..3 per operator.

```
pnpm --filter scripts bootstrap -- [--fee-bps 100] [--seed-usd 250000] [--skip-markets] [--with-test-market]
```

- `--skip-markets` stages mints and pair/USDC pools before the program is deployed (devnet staging).
- `--with-test-market` adds a fourth market (nonce 99) whose `resolve_ts + grace` is already in the
  past so `resolve --manual` and `redeem` can be exercised.

### `bet`

Bet, sell, redeem or print odds through the exact SDK paths the web app uses (`buildBetTx`,
`buildSellTx`, `DuelClient.redeem`). On localnet/devnet the bettor is airdropped SOL and minted
mock USDC by the operator key when short.

```
pnpm --filter scripts bet -- --market Apple --odds
pnpm --filter scripts bet -- --market Apple --side yes --usdc 25 [--keypair ./.keys/bettor.json] [--slippage-bps 100]
pnpm --filter scripts bet -- --market Apple --side yes --sell 5 --keypair ./.keys/bettor.json
pnpm --filter scripts bet -- --market "(test)" --redeem [amount] --keypair ./.keys/bettor.json
pnpm --filter scripts bet -- --market Apple --ledger            # RewardsPaid epochs decoded from logs
```

### `smoke`

Offline / read-only SDK checks (odds math, pro-rata, sqrt-price parity with cp-amm, instruction
encoding against the IDL) plus, with `--pool <mainnet DAMM v2 pool>`, a live quote and swap /
pool-creation transaction build (nothing is sent).

```
pnpm --filter scripts smoke
pnpm --filter scripts smoke -- --pool GruYGjMXysREXk2UEkTAXbvRjEc3iJyLtpAD7A9yfXEK
```

### `crank`

Rewards crank: claim LP fees on each outcome pool (quote-only, so fees are pair tokens), deposit
them into the market's reward vault, snapshot outcome-token holders, `distribute` pro-rata in
chunks of 12, print a ledger line per epoch. The pool vault, the market and (by default) the
operator are excluded from the snapshot.

```
pnpm --filter scripts crank -- --once
pnpm --filter scripts crank -- --interval 300 [--market "Apple"] [--min-usd 0.01] [--include-operator] [--dry-run]
```

### `resolve`

```
pnpm --filter scripts resolve -- --market <pk|label>                # post Pyth updates, call resolve
pnpm --filter scripts resolve -- --market <pk|label> --manual       # resolve_manual, prices from Hermes
pnpm --filter scripts resolve -- --market <pk|label> --manual --winner yes --price-a 340.1 --price-b 224.5
```

`resolve` needs `PYTH_API_KEY`; `--manual` is the demo path (PLAN section 8).

### `faucet`

```
pnpm --filter scripts faucet -- <wallet> [amount=1000] [--mint AAPL]
```

### `validator`

Prints (or with `--run` starts, via `wsl -d Ubuntu`) a local validator with Meteora DAMM v2 and the
Pyth receiver cloned from mainnet. Flags: `--rpc-port 8999` (also shifts faucet/gossip/dynamic ports
so it can coexist with `anchor test` on 8899), `--ledger /tmp/duel-test-ledger` (WSL-native path;
a ledger on `/mnt/c` is very slow), `--limit-ledger-size 50000000` (default; the test validator
otherwise keeps only 10,000 shreds, a few minutes of slots, after which `getSignaturesForAddress`
forgets the crank's transactions and the web ledger / "earned" go blank).

```
solana-test-validator --reset --url https://api.mainnet-beta.solana.com \
  --clone-upgradeable-program cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG \
  --clone-upgradeable-program rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ \
  --clone-upgradeable-program HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ \
  --clone-upgradeable-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --maybe-clone DaWUKXCyXsnzcvLUyeJRWou8KTn7XtadgTsdhJ6RHS7b \
  --maybe-clone 8hQfT7SVhkCrzUSgBq6u2wYEt1sH3xmofZ5ss3YaydZW \
  --maybe-clone C7RmcKdjeFscYSyekkmCjvHcnBQd7qJDkeB9RmRtuB3L \
  --maybe-clone 8d9szTd157GKCLcxBqiLUgB7mek3v65rbsy2ErRyjwQ5 \
  --bpf-program AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25 /mnt/c/.../programs/duel/target/deploy/duel.so \
  --limit-ledger-size 50000000 \
  --ledger /tmp/duel-test-ledger
```

The `--bpf-program` line is added automatically when `programs/duel/target/deploy/duel.so` exists
(then no `anchor deploy` is needed).

- `cpamdp...` is DAMM v2 (same id on mainnet and devnet).
- `rec5EKMGg6MxZY...` is the live Pyth Solana Receiver (the older `rec5EKMGg6sxjz...` is not deployed
  on mainnet or devnet any more); `HDwc...` is Pyth's Wormhole core bridge. The `--maybe-clone`
  entries are the receiver config, treasury 0, and Wormhole guardian sets 0 and 1.
- `TokenzQd...` is Token-2022. The validator's built-in Token-2022 fails cp-amm's position-NFT
  metadata realloc (`Failed to reallocate account data`); cloning the mainnet build fixes it.
- `--clone-upgradeable-program` exists in Agave 3.0.13 (`solana-test-validator --help`).
- `--reset` is required, otherwise clones are silently ignored on an existing ledger.

## Localnet run-through (verified 2026-09-26 against Agave 3.0.13 in WSL)

```
pnpm --filter scripts validator -- --run --rpc-port 8999      # terminal 1 (WSL validator, ~1 min to clone)
export RPC_URL=http://127.0.0.1:8999                           # terminal 2
pnpm --filter scripts bootstrap -- --with-test-market
pnpm --filter scripts bet -- --market Apple --side yes --usdc 25 --keypair ./.keys/bettor.json
pnpm --filter scripts bet -- --market Apple --side yes --sell 5 --keypair ./.keys/bettor.json
pnpm --filter scripts crank -- --once
pnpm --filter scripts bet -- --market Apple --ledger
pnpm --filter scripts resolve -- --market "(test)" --manual --winner yes --price-a 340.35 --price-b 223.96
pnpm --filter scripts bet -- --market "(test)" --redeem --keypair ./.keys/bettor.json
pnpm --filter scripts faucet -- <your wallet> 1000
```

Then the web app in chain mode (`apps/web/README.md`, "Chain mode from a cold start"):
`NEXT_PUBLIC_DEPLOYMENT=localnet NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8999 pnpm --filter versus-web dev`.

Stop the validator with `wsl -d Ubuntu -- pkill -f solana-test-validator`.

## Devnet

```
RPC_URL=https://api.devnet.solana.com KEYPAIR_PATH=<funded key> pnpm --filter scripts bootstrap
```

Devnet airdrops are rate limited; `bootstrap` needs roughly 1 SOL of rent for 12 pools, 3 markets,
and the token accounts. The program must already be deployed on devnet (`anchor deploy`).
