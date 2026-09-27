# Pitch

Three parts: the pitch video (3:00), the technical demo (2:30 to 3:00), and judge Q&A. Sports-page voice: short, numbers first. The tote board is the hero; keep the camera on it when the odds flip.

## A. Pitch video (3:00)

| Time | On screen | Voice |
|---|---|---|
| 0:00 to 0:20 | Apple vs Nvidia duel page. Tote board reads Apple 54, Nvidia 46. A bet lands, digits flip, a PAID IN AAPLX stamp prints on the ledger. | "Bet on Apple. Get paid in Apple. A prediction market where every bet on Apple pays its holders in Apple stock, and every bet on Nvidia pays in Nvidia. On Solana, today." |
| 0:20 to 0:55 | Left: a Solana prediction position sitting still for months, "Paid to holders: 0." Right: dated StonkFun and pump.fun headlines. | "Prediction markets on Solana give you no reason to hold. You buy, you wait, it pays nothing until resolution. The paired-coin meta just proved the opposite works. StonkFun launched STONK quoted in SPYx on July 23. ZCAT, paired to Zcash, paid about $2.8 million in ZEC across 470 thousand payouts by September 7 and about $8 million by September 16. The week of September 16 to 23, StonkFun out-earned pump.fun, $8.13 million to $7.99 million. pump.fun answered with Custom Pairs on September 9, 93 quote assets including xStocks, and Holder Rewards on September 12: $7.73 million to 480 thousand holders by September 26. Same lesson every time. Pay people in the thing they believe in." |
| 0:55 to 1:25 | The money-flow diagram from ARCHITECTURE.md in ink and vermilion. | "So we built the duel. One question, two sides, fully collateralized by USDC. YES trades against tokenized Apple, NO against tokenized Nvidia, on Meteora pools that collect their fee in the stock token only. A crank pays those fees to holders of each side a few times a day. Resolution reads Pyth's Apple and Nvidia feeds, multiplies by shares outstanding, and the winner redeems for a dollar. Lose the bet, keep the Apple you were paid." |
| 1:25 to 2:15 | Live devnet, one beat per cut. | "Connect. Faucet. Bet Apple: one signature, two hops, USDC to AAPLx to YES." (board flips) "The board moves." "Sell half. That pays Apple holders too." "Run the crank." (AAPLx balance ticks up, ledger row appears) "Paid 3.1 AAPLx to 412 holders at 14:20 UTC." "Open a new duel from a template: Tesla vs Ford, resolves from Pyth on a date you pick." |
| 2:15 to 2:40 | Three dated numbers on cream paper. | "Why now. Tokenized stocks live on Solana and nowhere else at scale: 95 percent of global tokenized-equity DEX volume, $5.8 billion in Q2 2026. Global prediction-market notional hit $43.7 billion in June. Colosseum asked for permissionless prediction markets where anyone can create and trade predictions. The paired-coin meta is eight weeks old, and nobody has paired it to an outcome." |
| 2:40 to 2:52 | Team slot. | [Placeholder: names, one line of background each, prior shipped work, X handles.] |
| 2:52 to 3:00 | Repo, devnet program ID, live URL, X thread. | "Program on devnet, code open, app live. We want the Solana track and an accelerator seat to take this to mainnet with real xStocks." |

## B. Technical demo (2:30 to 3:00)

PLAN §7 item 3 in order, item 4 as the coda. 1280 wide, browser left, terminal right, devnet mode, Phantom.

| Step | Show | Say |
|---|---|---|
| 1. Connect | `/` The Board: DEVNET stamp, UTC clock in the rail. Connect, pick Phantom in our wallet dialog. | "Devnet. Three duels from the bootstrap, six Meteora pools behind them." |
| 2. Faucet | Faucet in the rail. Inline status: "Minted 1,000 USDC." | "Mock USDC and mock xStocks; the registry maps each to its mainnet mint." |
| 3. Bet Apple | Open Apple vs Nvidia. Select Apple, enter 200. Receipt: You receive, Fee (paid to holders) in AAPLx, Odds after. Sign once. Explorer: two swap instructions. | "One transaction, two swaps. USDC to AAPLx on the stock pool, AAPLx to YES on the odds pool. The fee stays in AAPLx." |
| 4. Odds flip | Cut to `/`: the OddsBar moves. Back on the duel: tote board flips to Apple leads. | "YES price in AAPLx times AAPLx in dollars, normalized against NO. Implied sum printed under it." |
| 5. Sell half | Sell tab, 50 percent, sign. Board ticks back. | "Selling pays the fee in AAPLx too. Every Apple-side trade pays Apple holders." |
| 6. Crank | Terminal: `pnpm crank -- --once`. Lines: claimPositionFee, deposit_rewards, snapshot N holders, distribute, RewardsPaid. | "Claim from Meteora, deposit to the reward vault, snapshot holders, distribute in chunks of twelve. The program checks the crank key and that the sum fits the vault." |
| 7. Ledger | Ledger gains a row: time UTC, side, AAPLx amount, holders paid, tx link. "Your corner" shows earned AAPLx. Phantom shows the higher balance. | "Paid to the wallet, in Apple, from the RewardsPaid event." |
| 8. Resolve, redeem | Terminal: `pnpm resolve -- --market <test> --manual` on a test market with resolve_ts in the past. RESOLVED stamp; `/me` shows Redeem; sign; USDC lands. | "Real duels resolve permissionlessly from posted Pyth updates. Manual resolve is resolver-only and only after the grace window, which is the public dispute period." |

## C. Judge Q&A

**Doesn't meme flow pollute the odds?** Yes, attention moves the displayed probability. That is the noise-trader subsidy prediction markets need; Multicoin called it an "embedded manipulation cost" in October 2025. Arbitrageurs fade it: mint a set for $1, sell the overpriced side, and the `impliedSum` readout says when. A de-noised probability beside the raw one is on the roadmap.

**What happens to the losing side?** Its token goes to zero and its pool drains to worthless tokens. That is what resolution means, and the page says so. Holders keep every stock-token payout received along the way: a Nvidia backer who loses still has the NVDAx they were paid. The losing pool's LP (the operator today) absorbs that loss; on mainnet, seed liquidity is the cost of opening a market.

**Legal and CFTC exposure?** Event contracts are contested in 2026: CFTC proposed rules June 10, the NY Attorney General sued Kalshi July 31, a CFTC emergency order August 11, a Ninth Circuit ruling August 28 that sports event contracts are not swaps, and a September 25 appeals ruling letting states regulate sports prediction markets. None of it addresses tokenized or DeFi markets. We keep flagship markets to asset prices, geo-block the US in the frontend, show a risk disclosure before the first bet, and note that xStocks are not offered to US persons. Not legal advice.

**xStocks can be paused or seized. Then what?** True: Token-2022 with Pausable and Permanent Delegate, so Backed (Kraken-owned) can freeze or seize inside our pools and vaults. We disclose it on every duel. Collateral is USDC, so a pause halts trading and payouts but cannot touch the $1 redemption. Ondo's tokens run a transfer hook and trade by RFQ, so they are not a substitute yet.

**Why not Kalshi via DFlow, or Jupiter?** DFlow's Kalshi tokens need Proof KYC for primary buys, carry an issuer freeze authority, cover only Kalshi's markets (none of its 14,394 series is Apple vs Nvidia by market cap), and the developer docs return 404 as of September 26. Jupiter Forecast tokens have an issuer-held permanent delegate and only 5- and 15-minute BTC rounds; Jupiter Predict uses position PDAs, not tokens. A permissionless duel needs a plain mint anyone can pool. Importing Kalshi markets through DFlow is a later feature.

**On-chain versus off-chain today?** On-chain: market state, YES and NO mints, the USDC collateral vault and both reward vaults, mint, merge, redeem, Pyth-based resolve, distribute transfers with the RewardsPaid event, and the Meteora pools. Off-chain: the crank's holder snapshot and pro-rata math, the operator's Meteora fee claim, Hermes posting, odds computation, and the web app. ARCHITECTURE.md §8 lists the upgrade for each.

**Business model?** Each pool charges a quote-only fee, 100 bps on devnet. The market declares a split in `fee_bps_holders`, `fee_bps_creator`, `fee_bps_platform`. Reference points: StonkFun standard mode is 1.25 percent with 0.5 percent to the creator and its reward mode sends about 97.5 percent to holders; pump.fun Custom Pairs pay a 0.05 to 1 percent creator fee in the quote asset. Proposed mainnet default, not yet set in the bootstrap: 80 holders, 10 creator, 10 platform. The platform cut arrives in stock tokens.

**What ships in 30 days?** Mainnet with real xStocks and USDC. LP positions moved to a program PDA. On-chain time-weighted rewards. Resolver-gated share-count updates with a freeze date. Pyth Index fallback inside `resolve`. Fee split enforced on-chain. De-noised odds. More registry assets: TSLA, F, SPY, GLD, BTC, ETH, ZEC, HYPE, SOL. Twenty to thirty real traders from an X thread. Audit scoping.

## Sources

From `prediction-paired-launchpad-research.md` (compiled Sept 26, 2026):

- StonkFun and ZCAT: datawallet.com/crypto/stonk-fun-explained · blocmates.com/articles/what-is-stonkfun-heres-how-it-works · theblock.co (Sept 6, 2026 STONK story) · coindesk.com (Sept 7, 2026 ZCAT story) · cryptobriefing.com/zcash-8m-zec-distributions-solana-zcat
- pump.fun: thedefiant.io (Custom Pairs) · cryptobriefing.com/pumpfun-holder-rewards-cashback-deprecated · github.com/pump-fun/pump-public-docs
- Volume: cryptobriefing.com/solana-dex-tokenized-stocks-volume · solanacompass.com (prediction-market monthly volume $43.7B)
- Colosseum RFP: blog.colosseum.com/cypherpunk-hackathon-project-rfps-prediction-markets
- Regulatory: dlapiper.com (Sept 2026 tracker) · cnbc.com (Sept 25, 2026 appeals ruling) · cdn.ca9.uscourts.gov (Aug 28, 2026 opinion)
- DFlow and Jupiter: quicknode.com guide "kalshi-prediction-markets-with-dflow" · solana.com/news/dflow-prediction-markets-api · developers.jup.ag/docs/prediction/forecast
- xStocks and Ondo: docs.xstocks.fi/developers · ondo.finance/blog/global-markets-live-on-solana
- Odds pollution: multicoin.capital/2025/10/23/building-the-attention-economy
