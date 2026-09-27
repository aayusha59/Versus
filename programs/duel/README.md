# `duel` on-chain program

Anchor 0.32.1 program for paired prediction duels: a market is a head-to-head question with two
fully collateralized outcome tokens (YES / NO). Anyone mints a full set (1 YES + 1 NO) for 1 unit
of collateral and can merge it back at any time. After `resolve_ts` the market resolves
permissionlessly from Pyth prices (or by the resolver after a grace period) and the winning token
redeems 1:1 for collateral. Trading-fee rewards in the paired stock tokens are deposited into
per-side vaults and paid out pro-rata by a crank.

| | |
|---|---|
| Program ID | `AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25` |
| IDL | `programs/duel/target/idl/duel.json`, copied to `packages/sdk/idl/duel.json` |
| TS types | `programs/duel/target/types/duel.ts`, copied to `packages/sdk/idl/duel.ts` |
| Program keypair | `programs/duel/target/deploy/duel-keypair.json` (gitignored; also `~/duel-keys/duel-keypair.json` in WSL) |
| Pyth receiver ids accepted by `resolve` | `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` (default), `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp` (pro-compatible) |

## Layout

```
programs/duel/
  Anchor.toml, Cargo.toml          Anchor workspace (anchor 0.32.1, agave 3.0.13)
  programs/duel/src/
    lib.rs                         instruction entry points
    state.rs                       Market, Side, ResolutionTemplate, MarketStatus, constants
    errors.rs                      DuelError
    events.rs                      MarketCreated, PoolsSet, SetMinted, SetMerged, MarketResolved,
                                   Redeemed, RewardsDeposited, RewardsPaid
    math.rs                        CapCompare / RatioOutperform / PriceAbove fixed-point math (unit tested)
    pyth.rs                        manual PriceUpdateV2 reader (unit tested)
    instructions/*.rs              one module per instruction
  tests/duel.ts                    mocha suite (run from Windows against the WSL validator)
  tests/fixtures/                  synthetic Pyth PriceUpdateV2 accounts for `resolve` tests
  wsl/build.sh, wsl/validator.sh   the WSL halves of the build / test loop
  .keys/id.json                    copy of the WSL wallet for the Windows test runner (gitignored)
```

## Accounts

`Market` PDA: seeds `["market", creator, nonce_le_u64]`. `yes_mint` PDA `["yes", market]`, `no_mint`
PDA `["no", market]`; both are classic SPL Token mints with 6 decimals and mint + freeze authority =
market PDA, so any AMM accepts them permissionlessly. `collateral_vault`, `reward_vault_a` and
`reward_vault_b` are associated token accounts owned by the market PDA. The collateral and pair
mints may be SPL Token or Token-2022 (`token_interface`); the YES / NO mints are always SPL Token.

`Market` fields follow PLAN.md section 2 exactly, plus a trailing `reserved: [u8; 64]`.
Semantics worth knowing:

- `Side { Yes, No }`: `Yes` is side A (YES mint, `pair_a_mint`, `reward_vault_a`, `price_a`,
  `shares_a`); `No` is side B.
- `MarketStatus::Resolved { winner, price_a, price_b, resolved_ts }`: prices are USD scaled by 1e6
  (`price_b = 0` for `PriceAbove`). `resolve_manual` takes the same units.
- `total_minted` is the number of outstanding full sets (minted minus merged); `total_redeemed` is
  the number of winning tokens redeemed. Vault balance == `total_minted - total_redeemed`.
- Outcome tokens are 1:1 with collateral **base units** (1 USDC = 1 YES + 1 NO).
- `ResolutionTemplate`:
  - `CapCompare { feed_a, feed_b, shares_a, shares_b }`: YES iff `price_a * shares_a > price_b * shares_b`
    (u128, exponents normalized per feed; ties go to NO).
  - `RatioOutperform { feed_a, feed_b, start_ratio_e9 }`: YES iff `(price_a / price_b) * 1e9 > start_ratio_e9`.
  - `PriceAbove { feed, threshold_e6 }`: YES iff `price * 1e6 > threshold_e6`.

## Instructions

| Instruction | Who | Accounts (in order) |
|---|---|---|
| `create_market(params)` | anyone | `creator` (signer, payer), `market`, `collateral_mint`, `pair_a_mint`, `pair_b_mint`, `yes_mint`, `no_mint`, `collateral_vault`, `reward_vault_a`, `reward_vault_b`, `token_program` (SPL), `collateral_token_program`, `pair_a_token_program`, `pair_b_token_program`, `associated_token_program`, `system_program` |
| `set_pools(pool_a, pool_b)` | creator, once | `creator` (signer), `market` |
| `mint_set(amount)` | anyone, while Open | `user` (signer, payer), `market`, `collateral_mint`, `collateral_vault`, `user_collateral`, `yes_mint`, `no_mint`, `user_yes` (ATA, created if needed), `user_no` (ATA, created if needed), `token_program`, `collateral_token_program`, `associated_token_program`, `system_program` |
| `merge_set(amount)` | anyone | `user` (signer), `market`, `collateral_mint`, `collateral_vault`, `user_collateral`, `yes_mint`, `no_mint`, `user_yes`, `user_no`, `token_program`, `collateral_token_program` |
| `resolve()` | anyone, after `resolve_ts` | `market`, `price_update_a`, `price_update_b` (optional: pass `null` for `PriceAbove`) |
| `resolve_manual(winner, price_a, price_b)` | resolver, after `resolve_ts + grace_secs` | `resolver` (signer), `market` |
| `redeem(amount)` | anyone, after resolution | `user` (signer), `market`, `outcome_mint` (the winning mint), `user_outcome`, `collateral_mint`, `collateral_vault`, `user_collateral`, `token_program`, `collateral_token_program` |
| `deposit_rewards(side, amount)` | anyone | `depositor` (signer), `market`, `pair_mint`, `reward_vault`, `depositor_token`, `pair_token_program` |
| `distribute(side, amounts)` | crank | `crank` (signer), `market`, `pair_mint`, `reward_vault`, `pair_token_program`, then **remaining accounts** = recipient token accounts of `pair_mint` (writable), `amounts.len() == remaining.len() <= 12`, `sum(amounts) <= vault balance` |

`CreateMarketParams { nonce: u64, question: String (<=160 bytes), side_a_label, side_b_label (<=24 bytes),
template, resolve_ts: i64, grace_secs: i64, resolver: Pubkey, crank: Pubkey, fee_bps_holders,
fee_bps_creator, fee_bps_platform: u16 }` (fee bps must sum to <= 10,000; they are informational).

### `resolve` account layout and oracle checks

`price_update_a` / `price_update_b` are Pyth `PriceUpdateV2` accounts (as posted by
`@pythnetwork/pyth-solana-receiver` `postPriceUpdates`). For `CapCompare` and `RatioOutperform`
`price_update_a` must carry `feed_a` and `price_update_b` must carry `feed_b`; for `PriceAbove` only
`price_update_a` (with `feed`) is read and `price_update_b` may be `null`. Each account must:

1. be owned by one of the Pyth receiver program ids listed above;
2. start with the `PriceUpdateV2` discriminator `[34, 241, 35, 99, 157, 126, 244, 205]`;
3. have `verification_level == Full` (`InsufficientVerification` otherwise);
4. carry the feed id from the template (`FeedMismatch` otherwise);
5. have `publish_time >= clock.unix_timestamp - 6h` (`StaleOracle` otherwise). The 6-hour window
   covers the 21:00 UTC equity close.

Errors (all in `DuelError`): `NotYetResolvable`, `AlreadyResolved`, `NotResolved`, `WrongSide`,
`StaleOracle`, `GraceNotElapsed`, `Unauthorized`, `TooManyRecipients`, `InsufficientRewards`, plus
`InvalidAmount`, `InvalidParams`, `PoolsAlreadySet`, `InvalidOracleAccount`,
`InsufficientVerification`, `FeedMismatch`, `InvalidOraclePrice`, `MissingOracle`, `MathOverflow`,
`RecipientCountMismatch`, `InvalidRecipient`, `CollateralShortfall`.

### Pyth path

`pyth-solana-receiver-sdk` is **not** a dependency. Checked on crates.io: 0.6.1 resolves its
`anchor-lang >= 0.28` requirement to anchor-lang 1.x and fails to compile next to anchor 0.32.1
(duplicate `solana-program` 2.x / 5.x trees); 1.0.0 pins anchor-lang 0.31.1; 2.0.0 requires
anchor-lang 1.x. `src/pyth.rs` therefore decodes the documented Borsh layout by hand
(discriminator, `write_authority`, `verification_level`, `price_message`, `posted_slot`) and
re-implements `get_price_no_older_than` with the same checks as the SDK. The discriminator and
layout are covered by `cargo test`, and the full `resolve` path is covered end-to-end in mocha with
synthetic `PriceUpdateV2` accounts injected into the local validator.

## Build, test, deploy

Rust / Anchor / Solana live only in WSL Ubuntu; Node / pnpm live on Windows. Every command below is
written for a Git Bash / PowerShell prompt on Windows; `<repo>` is the repo root as WSL sees it
(`/mnt/c/Users/.../scratch-2026-09-26-076840`).

```bash
# 0. once: JS deps for the test runner (standalone install, not part of the pnpm workspace)
cd programs/duel && pnpm install --ignore-workspace

# 1. build in WSL (syncs to ~/duel, builds there, copies IDL/types/.so/keypair/Cargo.lock back
#    and the IDL + types into packages/sdk/idl)
wsl -d Ubuntu -- bash -lc 'bash <repo>/programs/duel/wsl/build.sh'

# 2. unit tests (math + Pyth layout) and lints in WSL
wsl -d Ubuntu -- bash -lc 'cd ~/duel && cargo test -p duel && cargo fmt --check && cargo clippy -p duel -- -D warnings'

# 3. fresh Pyth fixtures (publish_time = now; must be < 6h old when the tests run)
pnpm --dir programs/duel fixtures

# 4. local validator in WSL with the program preloaded and the fixtures injected, wallet funded
wsl -d Ubuntu -- bash -lc 'bash <repo>/programs/duel/wsl/validator.sh'

# 5. mocha suite from Windows (defaults: ANCHOR_PROVIDER_URL=http://127.0.0.1:8899,
#    ANCHOR_WALLET=programs/duel/.keys/id.json, a copy of ~/.config/solana/id.json from WSL)
pnpm --dir programs/duel test

# 6. stop the validator
wsl -d Ubuntu -- bash -lc 'pkill -f solana-test-validator'
```

Deploy to devnet (needs about 3 SOL on `GtQ8ZPUWHkbU4s2oRGNPmLh8ZX2wEfovCvHAp1d4Bigj`):

```bash
wsl -d Ubuntu -- bash -lc 'solana airdrop 2 -u devnet'
wsl -d Ubuntu -- bash -lc 'cd ~/duel && anchor deploy --provider.cluster devnet'
# or: solana program deploy ~/duel/target/deploy/duel.so --program-id ~/duel/target/deploy/duel-keypair.json -u devnet
```

Notes:

- `anchor test` is not usable here because Node is not installed in WSL; the split above is the
  equivalent. `Anchor.toml` still carries the `[scripts] test` line for a machine that has both.
- `Cargo.lock` is committed and is resolved MSRV-aware (`.cargo/config.toml` sets
  `resolver.incompatible-rust-versions = "fallback"`, the package sets `rust-version = "1.84"`) so
  that the platform-tools cargo (1.84, no edition 2024) can parse every transitive dependency.
  If you ever regenerate the lockfile, do it from `programs/duel` so the config applies.
- `create_market` initializes six accounts in one transaction and uses about 118k CU, inside the
  default 200k budget. `distribute` with 3 recipients uses about 22k CU; 12 recipients stays well
  under 100k, but give the crank a `setComputeUnitLimit(400_000)` for safety.
- The mocha suite (39 tests) covers the full lifecycle, every listed error, both token programs
  (Token-2022 pair A, SPL pair B) and the Pyth `resolve` path for all three templates.
- The local validator ledger (`~/duel-ledger` in WSL) grows by gigabytes over a long session and
  the WSL VHD never shrinks on its own; stop the validator and `rm -rf ~/duel-ledger` when done.
- Collateral mints with a Token-2022 transfer fee are rejected at `mint_set` (`CollateralShortfall`)
  because the vault would be under-collateralized.
