# Submission checklist

Two live targets, three days apart, one repo. Submit the Foundation hackathon first, use the gap to polish, then submit Colosseum.

## Targets

| Target | Deadline | Prize | Link | Notes |
|---|---|---|---|---|
| Solana Foundation "Perps and Prediction Markets" | Oct 9, 2026 | $100K single track: $50K / $30K / $20K | hackathons.solana.com/hackathons/perps-and-prediction-markets | Launched about Sept 18 as a one-week build; 291 registered. Rubric: "could this be a real app people use," a functional end-to-end demo, and justified Solana integration |
| Colosseum Crypto World's Fair, Solana track | Oct 12, 2026 (closes 06:59 UTC on Oct 13) | Solana track $100K (10 × $10K). Overall pool $840K: grand prize $30K, 20 × $15K. $250K pre-seed accelerator for 10+ teams | colosseum.com/worldsfair | 6,718 builders joined. Work must be done inside the window, from Sept 14, which this repo satisfies. No sponsor bounties; prizes are chain-level. Zcash and Robinhood Chain tracks exist for a later port |
| Superteam Earn side-tracks | Same window | Vietnam 10K USDG; Brazil $5K; Ukraine up to $10K | superteam.fun/earn/hackathon/crypto-worlds-fair | Same submission, extra shots; residency rules per track |
| pump.fun "Build in Public" | Ongoing | $3M pool; $250K selections | github.com/pump-fun/pump-public-docs | On thesis after pump.fun's $1M Pumpcade pre-seed (Apr 2, 2026). Not a deadline; file after Colosseum |
| Kalshi builder grants | Listing closed | Up to 10K USDC | news.kalshi.com | Only relevant once Kalshi markets are importable via DFlow |

## Colosseum judging criteria, mapped to this repo

| Criterion | Evidence |
|---|---|
| Functionality | `programs/duel` with `anchor test` green; devnet program ID in `Anchor.toml` and `packages/sdk/idl/duel.json`; `packages/sdk/deployments/devnet.json` with three markets and six pools; the end-to-end flow in `docs/PITCH.md` §B: connect, faucet, bet, odds flip, sell, crank, ledger, resolve, redeem |
| Potential Impact | `docs/PRIOR_ART.md` market context: $5.8B tokenized-equity DEX volume on Solana in Q2 2026 (about 95% of global), $43.7B global prediction-market notional in June 2026, $7.73M pump.fun Holder Rewards paid in two weeks |
| Novelty | `docs/PRIOR_ART.md` table: no market or launchpad pays holders in a stock token, and no one pairs outcome tokens to xStocks. `docs/ARCHITECTURE.md` §7 on why the composition exists only on Solana |
| UX | `apps/web` built to `DESIGN.md`: one-signature bet with a three-line receipt, split-flap tote board, ledger of payouts, inline status lines instead of toasts; Lighthouse accessibility ≥ 95 on `/` (PLAN §7.6); demo mode renders every route offline |
| Open-source and composability | Public repo with license; Anchor IDL committed; outcome tokens are plain SPL mints; pools are plain Meteora DAMM v2 pools any router can hit; `packages/sdk` is a standalone TypeScript client |
| Business Plan | `docs/PITCH.md` §C: fee split fields on the `Market` account, reference points from StonkFun and pump.fun, 30-day plan; `docs/ARCHITECTURE.md` §8 trust upgrade path |

Colosseum's stated test for forecasting products is "how to price beliefs today and who decides the truth tomorrow." Answer both in the submission text: beliefs are priced in the YES/AAPLx and NO/NVDAx pools; truth is Pyth, then the fallback ladder, with the grace period as the dispute window.

## Pitch-video rules (Colosseum)

- At most 3 minutes. It is reviewed first and decides shortlisting.
- Judges want: team background, the problem, target users, the reasoning behind Solana architecture decisions, and evidence of early users on X or Telegram.
- Script: `docs/PITCH.md` §A. Fill the team slot at 2:40 before recording. The Solana-architecture reasoning is the 0:55 to 1:25 beat plus `docs/ARCHITECTURE.md` §7.
- Solana Foundation rubric emphasizes the functional end-to-end demo; reuse the technical demo from `docs/PITCH.md` §B as a second video.

## Pre-submission checklist

- [ ] Public repo with a license file; `README.md` explains mechanism, architecture, and how to run in under two minutes of reading (PLAN §7.7) and links `docs/ARCHITECTURE.md`
- [ ] Pitch video, at most 3:00, uploaded (unlisted is fine); technical demo video, 2:30 to 3:00
- [ ] Deployed devnet program ID printed in README, `Anchor.toml`, `packages/sdk/idl/duel.json`, and `deployments/devnet.json`
- [ ] Live demo URL; demo mode (`NEXT_PUBLIC_DEMO=1`) works with no wallet; devnet mode works with Phantom, Solflare, Backpack
- [ ] `anchor test` passes in WSL; `pnpm bootstrap:devnet` creates mints, three markets, six pools
- [ ] `pnpm resolve -- --market <pk> --manual` resolves a test market and redeem works
- [ ] X thread: what it is, a 20-second clip of the board flipping, a call for 20 to 30 testers; collect handles and wallet count as early-user evidence; link the thread in both forms
- [ ] Disclaimers in the app: geo notice (US blocked), risk disclosure on first bet, xStocks issuer pause and seize powers, rewards are redistribution of trading fees, not legal or investment advice
- [ ] Architecture diagram exported as an image from the Mermaid in `docs/ARCHITECTURE.md` for the form
- [ ] Team bios with X or Telegram handles
- [ ] Design QA: zero violations of the `DESIGN.md` forbidden list
- [ ] Foundation form: same materials, lead with the end-to-end demo and the Solana-only composition
- [ ] Colosseum form: same materials, lead with the pitch video and the early-user thread; answer the "price beliefs today, decide truth tomorrow" question in the description

## Open items

- [ ] **Confirm whether one project may be submitted to both the Foundation hackathon and Colosseum.** Colosseum requires work done inside its window (from Sept 14), which is satisfied. Ask on both forms or Discords before Oct 9; if exclusive, Colosseum's prize pool and accelerator are larger.
- [ ] Confirm Superteam Earn side-track residency eligibility.
- [ ] Confirm whether the Colosseum accelerator application is bundled with the hackathon submission or filed separately.
- [ ] Confirm whether the "48 badged mints" figure for Meteora quote tokens is current before citing it anywhere (marked unverified in the research).

## Timeline

| Date | Action |
|---|---|
| Sept 27 to Oct 8 | Build to PLAN §7 acceptance criteria; record videos once the devnet flow is stable |
| Oct 8 | Post the X thread; freeze the demo deployment |
| Oct 9 | Submit Solana Foundation |
| Oct 9 to 12 | Polish, get 20 to 30 people to trade it, fold their handles into the Colosseum form |
| Oct 12 | Submit Colosseum before 06:59 UTC Oct 13 |

## Sources

From `prediction-paired-launchpad-research.md` (compiled Sept 26, 2026):

- hackathons.solana.com/hackathons/perps-and-prediction-markets
- colosseum.com/worldsfair · blog.colosseum.com/perfecting-your-hackathon-submission · blog.colosseum.com/cypherpunk-hackathon-project-rfps-prediction-markets · blog.colosseum.com (Breakout, Cypherpunk, Frontier winners)
- superteam.fun/earn/hackathon/crypto-worlds-fair
- github.com/pump-fun/pump-public-docs · theblock.co (Apr 2, 2026 Pumpcade)
- news.kalshi.com/p/kalshi-solana-tokenized-predictions
