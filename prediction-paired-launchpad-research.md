# Coins Paired to Prediction Markets on Solana — Research and Design

Compiled September 26, 2026. Facts carry dates and sources. Items marked **[unverified]** came only from secondary sources or could not be confirmed.

---

## TL;DR

1. **It is buildable today, and nobody has shipped it.** The "paired to anything" meta (StonkFun, pump.fun Custom Pairs) is only eight weeks old. Every primitive needed to pair a coin with a prediction-market outcome token already exists on Solana: permissionless outcome-token vaults (MetaDAO conditional vault, classic SPL), a bonding curve that accepts any SPL mint as quote (Meteora Dynamic Bonding Curve), equity price oracles (Pyth AAPL/NVDA feeds), and tokenized stocks (xStocks). No launchpad currently offers outcome tokens as a quote asset.
2. **Recommended build:** a launchpad where each coin's bonding curve is quoted in a YES or NO outcome token of a prediction market. Buying the coin mechanically buys the outcome token, which moves the odds. Trading fees are collected in the outcome token and streamed to holders ("free YES"). At resolution the winning side's coin becomes dollar-backed and the losing side's coin dies. Flagship demo market: "Will Apple's market cap exceed Nvidia's on December 31, 2026?" resolved by Pyth equity feeds.
3. **Two live, on-topic hackathon deadlines:** Solana Foundation "Perps and Prediction Markets" ($100K, deadline **October 9, 2026**) and Colosseum Crypto World's Fair Solana track ($100K track prize inside an $840K pool plus a $250K accelerator, deadline **October 12, 2026** at 06:59 UTC on the 13th). Colosseum has explicitly asked for "permissionless prediction markets where anyone can create and trade predictions," and prediction-market projects took top consumer slots in its last three hackathons.
4. **Biggest risks:** oracle/settlement manipulation if a market ever resolves on the coin's own price (never do that), regulatory exposure of event contracts (geo-block the US, keep demo markets to asset prices), and the "closed loop" critique of reflection-style rewards.

---

## 1. What pump.fun and StonkFun have been doing (the meta you described)

### StonkFun (stonkfun.xyz, X handle @LaunchOnSF) — Solana

Note: `stonk.fun` does not resolve. The Solana launchpad is **StonkFun at stonkfun.xyz**. `stonks.fun` is a different product on Robinhood Chain.

| Item | Fact |
|---|---|
| Launch | STONK token July 23, 2026 (quoted in SPYx); platform public early August 2026 |
| Core idea | "Launch coins paired with anything": quote asset is creator-chosen — xStocks (SPYx, NVDAx, QQQx), PreStocks pre-IPO tokens, crypto majors (ZEC, WBTC, HYPE, TAO, INJ, AAVE), stablecoins, SOL, or another StonkFun coin |
| Infrastructure | Until Sept 5: tokens launched directly into Raydium CLMM pools. Since Sept 6: **Raydium LaunchLab bonding curves** (Raydium shipped "any token pair" support Sept 7, 2026; StonkFun was the first integration), graduating to Raydium CPMM with locked LP |
| Standard mode | 1.25% trade fee (0.25% Raydium + 1% StonkFun, of which 0.5% to creator), paid in the quote asset |
| Reward mode (the ZCAT model) | Token-2022 mint with a permanent 1% or 3% **transfer tax**. A StonkFun-operated collector wallet harvests taxed tokens, sells them into the coin's own pool for the quote asset, and airdrops the quote asset pro-rata to every wallet holding ≥ $20. ~97.5% to holders. No creator fee in this mode |
| Platform token | ~60% of platform revenue buys and burns STONK; a further cut buys the top-15 coins on the platform ("flywheel") |
| Stats | Sept 6: $1.5M daily revenue, out-earning pump.fun that day. Sept 14: $1.47B cumulative volume, ~$427M from tokenized-equity pairs, 42% of launches quoted in tokenized stocks, 10.5% in SOL. Sept 16–23 weekly revenue $8.13M vs pump.fun $7.99M. >$40M in rewards distributed to holders (team claim) |
| Team | Pseudonymous; one wallet controls every reward coin's tax and payouts |

### $ZCAT (Anonymous Cat) — the example you gave

- Launched on StonkFun August 30, 2026 (before the LaunchLab switch, so it is a direct **ZEC/ZCAT Raydium CLMM pool**). 3% transfer tax, reward mode.
- "Paired to ZEC" means three separate things: (1) the LP's quote token is ZEC, so ZCAT's dollar price = ZCAT-in-ZEC × ZEC-in-USD; (2) the 3% tax is sold for ZEC and airdropped in ZEC to holders several times a day; (3) there is no creator fee.
- Sept 7: ~$2.8M in ZEC paid across 470K+ payouts as ZEC crossed $1,200 (CoinDesk). Sept 16: ~$8M in ZEC distributed (Crypto Briefing). Peak market cap ~$170–183M; ~$80M on Sept 26. 61% of supply has passed through the tax collector and been sold into the pool (Bitquery, Sept 22).
- Other coins in the meta: MASK (ZEC), Super Inu (NVDAx), PURR (HYPE, >$1M HYPE distributed), ALLINU (DraftKings), GROK (SpaceX pre-IPO), Artificial Inu on Robinhood Chain (NVDA, ~$300M peak).

### pump.fun in 2026 (dated)

| Date | Shipped |
|---|---|
| Jan 15 | Callouts (creator push alerts) |
| Feb 17 | Cashback Coins: creator fee routed to traders |
| Apr 2 | Led $1M pre-seed in **Pumpcade** — 60s–30min prediction markets inside livestreams |
| May 21 | USDC quote pairs |
| Jul 21 | BOOST mode: ~20% of graduation liquidity diverted to a timed buyback-and-burn |
| **Sep 9** | **Custom Pairs**: 93 quote assets — xStocks, Backpack/Sunrise stocks, wBTC, wETH, PUMP, TRUMP, ZEC, HYPE, ANSEM. Creator fee 0.05–1% **paid in the quote asset**, splittable to 10 recipients. 50% of revenue to PUMP buyback-and-burn |
| **Sep 12** | **Holder Rewards** replaces Cashback: fees paid pro-rata to holders (≥ $20) several times an hour **in the quote token**. $7.73M distributed to 480K holders by Sept 26 |

Also: Raydium LaunchLab any-quote-token (Sept 7), Meteora DBC "stock tokens" release v0.2.1 (Sept 9), StockLaunch on Meteora quoted in Backpack-issued stocks with time-weighted holder rewards (Sept 15–16), Bags non-SOL quote launches into DAMM v2 (xStocks, Ondo). The whole ecosystem converged on "quote in anything + pay holders in the quote" within one month.

---

## 2. Why the meta works, and how it breaks

**The reflexive loop, mechanically**

1. Coin's USD price = coin price in the major × the major's USD price. A 10% move in ZEC reprices every ZEC-quoted coin 10% with zero trades. The coin is a high-beta wrapper on the major.
2. To buy the coin you must hold the major on Solana. The pool accumulates the major. Coin volume becomes continuous demand for the major.
3. Payouts are in the major, so the same fee revenue converts to bigger dollar airdrops when the major rises → headlines → more attention → more volume → more of the major bought.
4. Platform-token buybacks stack on top (STONK, PUMP, RAY).

**Documented failure modes**

- Closed loop: rewards come only from other people's trades (SafeMoon critique; CoinDesk's own caveat on ZCAT).
- Tax friction: 6% round trip on a 3% tax; deters arbitrage and CEX listing.
- Continuous sell pressure from the collector: $56.3M of taxed coins sold into pools Aug 23–Sept 22 across StonkFun (Bitquery); 160 coins lost >50% of supply to tax extraction.
- Single-key control of taxes and payouts by an anonymous operator.
- Liquidity chasm: reward-mode coins graduate with ~$17K pools; only 1.3% of 1,346 reward coins ever reached $5M.
- Leverage cuts both ways: a ZEC pullback hits pool value and narrative simultaneously.

**Why prediction markets are a better "major" than ZEC for this loop:** an outcome token has a hard terminal value ($1 or $0) on a known date, so the coin's lifecycle has a built-in climax, and the "major" (the odds) is something attention is *supposed* to move. Prediction markets also structurally need noise traders to subsidize informed traders; meme flow is exactly that subsidy.

---

## 3. Prediction-market building blocks on Solana (what can be a quote token)

Verified by on-chain probes and docs on Sept 26, 2026 unless flagged.

| Venue | Outcome tokens on-chain? | Token program | Restrictions | Usable as launchpad quote? |
|---|---|---|---|---|
| **MetaDAO conditional vault** (`VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg`) | Yes, N-outcome conditional tokens | Classic SPL Token | None. Any SPL underlying (USDC, a memecoin). Oracle is any pubkey you choose. License BUSL-1.1 (check terms for commercial use) | **Best generic primitive.** Plain SPL means Meteora DBC accepts it as a quote permissionlessly |
| **DFlow × Kalshi** (programs `pReDicTmks…`, `abrn446…`) | Yes | Token-2022 (metadata only, no transfer hook, no permanent delegate) | Issuer PDA holds freeze authority; primary buys require DFlow Proof KYC; only Kalshi's own markets; **public developer docs have been pulled** (all prior URLs 404 as of Sept 26) though programs still process transactions daily. MoonPay reportedly acquired DFlow May 2026 **[unverified]** | Feasible later as an "import a Kalshi market" feature; not for MVP |
| **Jupiter Forecast** (native, since June 4, 2026) | Yes | Token-2022 with **permanent delegate** held by issuer | 5- and 15-minute BTC rounds only; USDC deposits; API blocks US/KR | No (rounds too short, issuer can pull tokens) |
| **Jupiter Predict** (Kalshi + Polymarket mirrored) | No, Position PDAs | — | US/KR/AU blocked | No |
| **Polymarket** | No Solana tokens (ERC-1155 on Polygon) | — | — | No |
| **World** (in Phantom since July 1, 2026) | "Standard SPL token" per Phantom **[unverified]** | Unknown, docs gated | Settles in Phantom's CASH stablecoin | Unverified |
| **PNP Exchange** (`8PyE2dizL52ga7ytqLtqRyjwWp4yXEx8M5Z4BAHgHuTb`) | Yes, YES/NO SPL mints | SPL / Token-2022 capable | Permissionless; small liquidity; resolution by designated wallet or AI proxy | Feasible; its sister product Bubblegum is the closest prior art (see §10) |
| **Drift BET** | No | — | Drift exploited April 1, 2026 (~$285M), relaunching as perps-only Velocity | No |
| **Pascal, Hedgehog, Monaco/BetDEX, Divvy, Hxro, Triad, PRDT** | Account-based or undocumented | — | Monaco appears dormant | No |
| **Paradigm pm-AMM port** (`sparkfun-labs/pm-amm`, MIT, devnet) | Yes, SPL YES/NO mints | SPL | Admin-only resolve; unaudited | Good reference if you want your own odds AMM |

**Volume context:** global prediction-market notional $43.7B in June 2026; Solana-native protocols earned ~$1.4M/month in protocol revenue in Q2 2026 (CoinShares). Kalshi-on-Solana did $28.6M in its first six weeks (Dec 2025–Jan 2026).

**Regulatory context (2026):** CFTC proposed event-contract rules June 10; NY Attorney General sued Kalshi July 31; CFTC emergency order Aug 11; Ninth Circuit ruled Aug 28 that sports event contracts are not swaps (circuit split); appeals court on Sept 25 let states regulate sports prediction markets. None of the CFTC actions address tokenized or DeFi markets. Keep demo markets to asset prices, geo-block the US in the frontend, and add disclaimers. Not legal advice.

---

## 4. Tokenized stocks: what "pair YES with Apple" can actually mean on Solana

**Correction on Robinhood Chain.** Robinhood Chain mainnet went live July 1, 2026 (Arbitrum Orbit L2). Its Stock Tokens are 18-decimal ERC-20 *derivative debt instruments*, not available to US/UK/Canada users, and **not bridgeable to or composable with Solana** (the only bridge is USDC-Solana → USDG-Robinhood Chain via Across). So a Solana build cannot use them. Use these instead:

| Issuer | Solana status | Permissioning | Notes |
|---|---|---|---|
| **xStocks** (Backed, now Kraken-owned) | Live since June 30, 2025; 60+ tickers (AAPLx, NVDAx, TSLAx, SPYx…) | Secondary transfers unrestricted, no KYC for DEX trades; mint/redeem needs KYC + $5K minimum; not offered to US persons | Token-2022 with ScaledUiAmount (dividends via multiplier), Pausable, Permanent Delegate (issuer can freeze/seize even inside an AMM). Already **badged** as quote tokens in Meteora DBC and DAMM v2. ~95% of global tokenized-equity DEX volume is on Solana ($5.8B in Q2 2026) |
| **Ondo Global Markets** | Live Jan 21, 2026; 200+ stocks (AAPLon, NVDAon) | **Active transfer hook** enforcing eligibility; liquidity via Jupiter RFQ, not AMM pools | Restricted, not fully permissionless |
| **Backpack Securities stocks** | New 2026 issuer; used by StockLaunch and pump.fun Custom Pairs **[secondary sources]** | Unknown | — |
| Superstate Opening Bell | Live | Strict allowlist | Unusable as quote |
| Dinari | Not on Solana yet (Aug 2026: "coming soon") | KYC | — |
| Remora | **Defunct** since Feb 23, 2026 | — | Do not build on |

**Oracles for "Apple market cap vs Nvidia market cap":**

- Pyth Core equity feeds on Solana: `Equity.US.AAPL/USD` (id `49f6b65c…`) and `Equity.US.NVDA/USD` (id `b1073854…`), 50 ms channel, market hours only. Push accounts on **shard 1** (shard 0 stale since Aug 14, 2026). Pull path via `pyth-solana-receiver-sdk` and Hermes. 24/7 synthetic `Equity.Index.AAPL/USD` and `Equity.Index.NVDA/USD` feeds also exist. Sept 25 prints: AAPL $340.35, NVDA $223.96.
- Chainlink Data Streams on Solana: US equities since Aug 2025, 24/5 since Jan 2026; the official xStocks oracle.
- Switchboard On-Demand: custom feeds from any HTTP API (feed ID = SHA-256 of the definition, verifiable on-chain). Use this if you want a market-cap number straight from a data vendor.
- **No oracle publishes shares outstanding or market cap.** Store share counts in a program config account updated from filings, or use a Switchboard custom job. Kalshi has no Apple-vs-Nvidia market-cap series (all 14,394 series scanned), so DFlow tokens cannot resolve this question.

---

## 5. Design: three ways to pair a coin with a prediction

Let a market M have outcome tokens YES and NO with YES + NO = 1 unit of collateral (USDC), redeemable after resolution.

### Mode A — Conditional coin (quote = YES). Recommended flagship.

- The coin's bonding curve (Meteora DBC) uses the **YES mint as `quote_mint`**. After graduation the DAMM v2 pool is COIN/YES.
- **Price:** coin USD price = coin-in-YES × YES-in-USD, with YES-in-USD ∈ (0, 1). If the odds move from 30% to 60%, the coin doubles in dollars with no coin trades. Leverage on odds, exactly like ZCAT's leverage on ZEC.
- **The odds move when the coin trades:** to buy the coin a user needs YES. Route: USDC → YES via the YES/USDC odds pool (pushes YES up), or split USDC into YES + NO in the vault and sell NO (pushes NO down). Either way the displayed probability rises. YES locked in the coin's curve and pool is removed from circulation, the same sink effect as ZEC in the ZCAT pool. Selling reverses it.
- **Fees:** DBC `collect_fee_mode = quote only`, so fees accrue in YES. `fee_claimer` = your rewards PDA. Distribute YES to coin holders time-weighted (StockLaunch pattern) or via periodic merkle drops. "Free YES."
- **Resolution:** if M resolves YES, every YES in the pool is worth $1, the coin is now effectively USDC-quoted, and it survives with hard-backed liquidity. If M resolves NO, the quote side is worth zero and the coin dies. This is the honest version of "the coin only exists in the world where the event happens." Two coins on opposite sides of one market is a duel: two enter, one survives.
- **What you are really selling:** a leveraged, attention-amplified position on an outcome, with fee yield in the outcome token. This is the exact analogue of "leveraged ZEC exposure with ZEC yield."

### Mode B — Reward coin (quote = USDC or SOL, fees buy YES)

- Ordinary bonding curve. Fees are collected in USDC, swapped into YES on the odds pool, and streamed to holders. The coin survives resolution regardless; holders just receive outcome tokens that pay $1 or $0.
- Weaker odds impact (only the fee flow buys YES), but no death-at-resolution. Offer it as the safe mode, the way StonkFun offers Standard vs Reward.

### Mode C — Stock-collateralized duel (your Apple/Nvidia idea, upgraded)

- Run two conditional vaults on the same question with different underlyings: vault 1 splits **AAPLx** into YES-AAPLx / NO-AAPLx; vault 2 splits **NVDAx** into YES-NVDAx / NO-NVDAx. Both resolve from the same oracle.
- Launch the Apple-side coin quoted in **YES-AAPLx** and the Nvidia-side coin quoted in **NO-NVDAx**. Buying the Apple coin requires Apple shares that only exist if Apple flips Nvidia. Fees to holders are paid in conditional Apple shares. Triple leverage: attention × odds × the stock.
- The literal reading of your idea also works with much less machinery: make the odds pools YES/AAPLx and NO/NVDAx on DAMM v2 (xStocks are already badged), so trading fees on the prediction itself accrue in AAPLx and NVDAx.
- Cost: MetaDAO's vault uses classic SPL only, so a stock underlying requires a vault fork on `token_interface` plus handling xStocks' ScaledUiAmount multiplier and the issuer's pause/seize powers. Ship Mode A with USDC collateral for the deadline; present Mode C as the roadmap slide.

### A note on "attention pumps the odds"

It does, mechanically, and that is the pitch: meme flow becomes a persistent bid on YES. From an epistemics view that is noise, and arbitrageurs will fade it, which means meme traders subsidize informed traders. That is the classic argument for why prediction markets need subsidized liquidity. Show both numbers in the UI: the raw AMM probability and a "de-noised" probability from the YES/NO pool excluding coin-routed flow. Judges will ask about this; having the answer ready is a differentiator.

---

## 6. The flagship market: "Will Apple's market cap exceed Nvidia's at the close on December 31, 2026?"

- **Resolution rule:** at the first Solana slot after 21:00 UTC on the resolution date, read Pyth `Equity.US.AAPL/USD` and `Equity.US.NVDA/USD` (shard 1 push accounts, or a posted `PriceUpdateV2` with max-age tolerance covering the market close). Multiply each by the share count stored in the market's config account. YES if AAPL cap > NVDA cap. Share counts are set at creation from the latest 10-Q and updatable only by the resolver before a freeze date, with the values displayed in the UI.
- **Why this market:** two of the largest companies on earth, a question people already argue about, price feeds already on Solana, a hard resolution date, and no dependency on any human resolver.
- **Fallback:** if Pyth feeds are stale at resolution (holiday, outage), fall back to the 24/7 `Equity.Index` feeds, then to Switchboard custom feed, then to a timelocked admin override with a public dispute window.
- **Two launch coins:** an Apple-side coin quoted in YES and an Nvidia-side coin quoted in NO. Their combined market caps on the leaderboard are a live "who is winning the attention war" gauge.

---

## 7. Architecture and stack

```
User (USDC)
   │
   ├─► Odds pools (Meteora DAMM v2): YES/USDC and NO/USDC, seeded with complete sets
   │        └─ displayed probability = YES price
   ├─► Outcome vault (MetaDAO conditional_vault on mainnet, or a minimal Anchor fork):
   │        split USDC → YES + NO · merge · redeem after resolve
   ├─► Resolver program (Anchor): reads Pyth, writes payout numerators to the vault's Question
   ├─► Coin launch (Meteora DBC config): quote_mint = YES, collect_fee_mode = quote only,
   │        fee_claimer = rewards PDA, migration → DAMM v2 COIN/YES with locked LP
   └─► Rewards program: claims partner fees (YES) and streams to holders time-weighted
Frontend: Next.js + wallet adapter; two-hop swap USDC→YES→COIN built client-side
```

| Component | Concrete choice | IDs / packages |
|---|---|---|
| Outcome tokens | MetaDAO conditional vault (classic SPL, N-outcome, any oracle pubkey) | Program `VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg`; source `metaDAOproject/programs` (BUSL-1.1, audited by Neodyme and Zenith); TS `futarchy-sdk`. If you fork, keep mints classic SPL or Token-2022 metadata-only so DBC accepts them without a badge |
| Bonding curve | Meteora Dynamic Bonding Curve, program v0.2.1 (Sept 9, 2026) | Program `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`; `@meteora-ag/dynamic-bonding-curve-sdk` v1.5.x; fee scheduler for anti-snipe, up to 20 curve segments, partner/creator fee split, locked LP on migration |
| Graduated pool + odds pools | Meteora DAMM v2 | Program `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`; `@meteora-ag/cp-amm-sdk`; quote-only fee mode; permanent-lock positions still earn fees |
| Oracle | Pyth Core equity feeds (shard 1) + Pyth Index fallback | `pyth-solana-receiver-sdk`; Hermes at `https://pyth.dourolabs.app/hermes` (legacy endpoint needs an API key since Aug 26, 2026) |
| Holder rewards | Time-weighted accumulator (balance × seconds) in an Anchor program, or Jito/Saber merkle distributor with periodic snapshots | `jito-foundation/distributor`, `saber-hq/merkle-distributor` |
| Alternative curve | Raydium LaunchLab (any quote since Sept 7, 2026) | Program `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`. Each quote mint needs a Raydium admin-created GlobalConfig, so it is not self-serve for a brand-new YES mint. DBC is the right choice |
| Routing | Jupiter indexes DBC and DAMM v2 pools, but do the two-hop client-side for the demo | Jupiter Swap API v2 |

**Gotchas found in the docs**

- DBC's keeper auto-migrates only for known quote mints (SOL, USDC, JUP, badged stock tokens at ≥ $750 equivalent). For a custom YES quote you crank migration yourself (migrator.meteora.ag or the migration instruction).
- DBC token badges forbid transfer fees on quote mints, so a StonkFun-style transfer tax cannot live on the outcome token. Put fees on the coin's trades (DBC fee), not on transfers.
- Pyth equity feeds tick only during US market hours; build staleness tolerance and use the close.
- xStocks Pausable and Permanent Delegate mean the issuer can freeze or seize tokens inside your pool. State it in the docs.
- MetaDAO's program license is BUSL-1.1. Using the deployed program via CPI is normal, but read the license before shipping a competing commercial product on a fork.

---

## 8. Thirteen-day build plan (Sept 27 → Oct 9, then polish to Oct 12)

| Days | Deliverable |
|---|---|
| 1–3 | Outcome vault + resolver on devnet: create market, split, merge, redeem, resolve via Pyth AAPL/NVDA with share-count config. Integration test that YES + NO always equals collateral |
| 3–5 | Odds pools on DAMM v2 (YES/USDC, NO/USDC) seeded with complete sets; DBC config with `quote_mint = YES`; script that launches a coin and executes USDC → YES → COIN. Confirm the displayed probability moves when the coin is bought |
| 5–8 | Rewards: `fee_claimer` PDA, claim partner fees in YES, time-weighted holder distribution (or snapshot + airdrop crank for MVP). Migration crank to DAMM v2 |
| 8–11 | Frontend: markets list, coin pages with two prices (in YES and in USD), live odds chart, "free YES" feed, launch flow (pick market, pick side, set fee). Geo-block + disclaimers |
| 11–13 | Flagship Apple-vs-Nvidia market and two coins on devnet (mainnet-lite if budget allows; DBC and the MetaDAO vault are live on mainnet). ≤3-min pitch video, 2–3-min technical demo, README with architecture, open-source repo, X thread to gather early users |
| 13–16 | Polish, get 20–30 people to trade it, submit Colosseum |

Team split for three people: one on Anchor (vault + resolver + rewards), one on Meteora integration and cranks, one on frontend and pitch.

---

## 9. Hackathons: where to submit and what judges want

| Hackathon | Deadline | Prize | Fit |
|---|---|---|---|
| **Solana Foundation "Perps and Prediction Markets"** (hackathons.solana.com) | **Oct 9, 2026** | $100K: $50K / $30K / $20K, single track; 291 registered | Direct fit. Launched ~Sept 18 as a one-week build; rubric is "could this be a real app people use," functional end-to-end demo, justified Solana integration |
| **Colosseum Crypto World's Fair** (colosseum.com/worldsfair) | **Oct 12, 2026** (06:59 UTC Oct 13) | Solana track $100K (10 × $10K); overall $840K, grand prize $30K, 20 × $15K; $250K pre-seed accelerator for 10+ teams | Direct fit. Also Zcash and Robinhood Chain tracks exist if you ever port. 6,718 builders joined |
| Superteam Earn side-tracks (Vietnam 10K USDG, Brazil $5K, Ukraine up to $10K) | Same window | Small | Same submission, extra shots |
| pump.fun "Build in Public" | Ongoing | $3M pool; $250K selections | pump.fun invested in Pumpcade (prediction markets); a "coins paired to predictions" tool is on-thesis |
| Kalshi builder grants | Ongoing (listing currently closed) | Up to 10K USDC | Later, if you import Kalshi markets via DFlow |

Check whether one project may be submitted to both the Foundation hackathon and Colosseum; Colosseum requires work done inside its window (from Sept 14), which you satisfy.

**Colosseum judging (official rules):** Functionality, Potential Impact, Novelty, UX, Open-source and composability, Business Plan. The ≤3-minute pitch video is reviewed first and decides shortlisting; judges want team background, the problem, target users, the reasoning behind Solana architecture decisions, and evidence of early users on X or Telegram. No sponsor bounties exist inside Colosseum anymore; prizes are chain-level.

**What has won:** prediction-market projects took top consumer places three hackathons running (Trepa and Melee Markets at Breakout 2025; Capitola, Fora, Superfan at Cypherpunk 2025; Mentioned, Senthos, Memetic Machines at Frontier 2026). Accelerator slots went to aggregators, structured products, and creator-revenue tokenization. Colosseum's own RFP asks for "permissionless prediction markets where anyone can create and trade predictions without centralized oversight" and says every forecasting product must answer "how to price beliefs today and who decides the truth tomorrow."

**Why this is a "best use of Solana" story:** it composes five live Solana primitives (conditional vault, DBC, DAMM v2, Pyth equity feeds, xStocks) that do not co-exist on any other chain, and it rides the hottest Solana meta of September 2026.

---

## 10. Prior art and how you differ

| Project | What it does | Status | Your difference |
|---|---|---|---|
| **Bubblegum** (bgum.fun, by PNP) | "Every question gets a coin": token + bonding curve + a separate YES/NO market seeded 50/50; 300M of supply to the market | Live on Solana, TVL ~$173 | Their coin and market sit side by side. Yours makes the outcome token the coin's quote asset, so the coin *is* the position, odds move with coin flow, and fees pay out in the outcome token. Built on Meteora, not a proprietary curve |
| PumpMarket | Bets on whether a pump.fun coin graduates within an hour | Live Feb 2026 | Markets *about* coins, not coins paired to markets |
| Pumpcade | 60s–30min markets inside pump.fun livestreams; $1M from pump.fun | Beta | Validates pump.fun's interest; not a launchpad |
| Believe v2 "Human Sentiment Market" | Perpetual Believe/Doubt pairs on people, never resolve | Troubled; founder sued March 2026 | You use resolving markets with hard settlement |
| Zora Attention Markets on Solana | Trend tokens and creator-reward sub-tokens | Live since Feb 2026 | No oracle, no resolution, pure speculation |
| Polymarket × Kaito, Noise, Trendle | Markets and perps *on* attention | Live / pending | The inverse of your idea |
| Futardio / MetaDAO | Futarchy-governed coins and ICOs; the conditional vault you can reuse | Live; $44M committed | You reuse their primitive for external-event markets, not governance |
| StonkFun, pump.fun Custom Pairs, StockLaunch, Bags | Coins quoted in stocks and majors, holder rewards in the quote | Live | Same mechanics, different quote asset. Nobody offers outcome tokens as quote |
| Predict.fun × Four.meme (BNB) | Markets on launchpad metrics | Announced April 2026 | Not Solana, not paired |

---

## 11. Risks and how to answer them

- **Settlement manipulation.** A June 2026 paper (Dai, Jia, Yu, arXiv 2606.31675) documents order-flow spikes and reversals at settlement in Polymarket 5-minute BTC contracts; a January 2026 paper (Mongardini and Mei) finds 82.8% of high-return memecoins show artificial growth via thin-pool price inflation. **Never resolve a market on the coin's own price or pool.** Use external Pyth feeds, horizons of weeks or months, and a public dispute window.
- **Odds pollution.** Meme flow pushes the displayed probability. Show a de-noised probability and frame meme flow as the liquidity subsidy prediction markets need (Multicoin's "embedded manipulation cost" argument, Oct 2025).
- **Death at resolution.** Mode A coins on the losing side go to zero. Make this the headline feature, not a footnote, and offer Mode B for creators who do not want it.
- **Regulatory.** Event contracts are CFTC territory; 2026 saw the NY AG sue Kalshi, a Ninth Circuit ruling against preemption, and state bans on Polymarket. Keep demo markets to asset prices, geo-block the US, and note that permissionless market creation is exactly what Colosseum asked for but is legally contested.
- **Issuer powers on stock tokens.** xStocks can be paused or seized by the issuer; Ondo enforces a transfer hook. Disclose it.
- **Infrastructure churn.** DFlow's prediction-market docs vanished this month; Drift's BET died with the April exploit; Remora shut down in February. Depend on Meteora, Pyth, and MetaDAO's audited vault, all of which are stable.
- **Closed-loop rewards critique.** Rewards come from other traders' fees. Be explicit that fee yield is redistribution, and that the outcome token's terminal value is the only external value.

---

## 12. Unverified items to confirm before relying on them

- MoonPay's acquisition of DFlow (secondary sources only) and DFlow's current developer-docs location.
- World's outcome-token program and transfer restrictions (docs gated).
- Backpack Securities as an issuer and the "48 badged mints" figure.
- Whether one project can be submitted to both the Foundation hackathon and Colosseum.
- Exact Meteora DBC behavior when migrating a pool whose quote is an unknown mint (manual crank assumed).
- MetaDAO BUSL-1.1 terms for a commercial fork.

---

## Sources (curated; full lists available on request)

**Meta and launchpads:** datawallet.com/crypto/stonk-fun-explained · blocmates.com/articles/what-is-stonkfun-heres-how-it-works · docs.bitquery.io/docs/blockchain/Solana/stonkfun-api · bitquery.io/investigations/is-stonkfun-dumping-on-holders · theblock.co (Sept 6, 2026 STONK story) · crypto.news/raydium-launchlab-adds-support-for-any-token-pair-on-solana · coindesk.com (Sept 7, 2026 ZCAT story) · cryptobriefing.com/zcash-8m-zec-distributions-solana-zcat · thedefiant.io (pump.fun Custom Pairs) · cryptobriefing.com/pumpfun-holder-rewards-cashback-deprecated · github.com/pump-fun/pump-public-docs · theblock.co (Apr 2, 2026 Pumpcade) · solanacompass.com (StockLaunch) · docs.bags.fm/how-to-guides/launch-token-non-sol-quote.md · memeburn.com/pump-fun-copied-stonk-but-the-fees-work-differently

**Prediction-market infra:** github.com/metaDAOproject/programs (conditional_vault) · docs.metadao.fi · quicknode.com guide "kalshi-prediction-markets-with-dflow" · solana.com/news/dflow-prediction-markets-api · news.kalshi.com/p/kalshi-solana-tokenized-predictions · developers.jup.ag/docs/prediction/forecast · solanacompass.com (Jupiter Forecast) · bgum.fun/how-it-works · github.com/sparkfun-labs/pm-amm · docs.switchboard.xyz (prediction-market tutorial) · solanacompass.com (prediction-market monthly volume $43.7B) · dlapiper.com (Sept 2026 regulatory tracker) · cnbc.com (Sept 25, 2026 appeals ruling) · cdn.ca9.uscourts.gov (Aug 28, 2026 opinion)

**Tokenized stocks and oracles:** docs.xstocks.fi/developers · solana.com/news/case-study-xstocks · cryptobriefing.com/solana-dex-tokenized-stocks-volume · ondo.finance/blog/global-markets-live-on-solana · docs.robinhood.com/chain/stock-tokens · blog.arbitrum.io/robinhood-chain-mainnet · cryptobriefing.com/robinhood-ceo-tenev-solana-bridge-guide · docs.pyth.network/price-feeds/core/push-feeds/solana · github.com/pyth-network/pyth-crosschain/issues/4055 · chain.link/blog/chainlink-data-streams-us-equities-etfs

**Launchpad tech:** docs.meteora.ag/developer-guides/dbc · docs.meteora.ag/core-products/dbc/token-2022-support.md · github.com/MeteoraAg/dynamic-bonding-curve · docs.meteora.ag/core-products/damm-v2/what-is-damm-v2 · docs.raydium.io/products/launchlab · github.com/jito-foundation/distributor

**Hackathons and prior art:** colosseum.com/worldsfair · hackathons.solana.com/hackathons/perps-and-prediction-markets · blog.colosseum.com/perfecting-your-hackathon-submission · blog.colosseum.com/cypherpunk-hackathon-project-rfps-prediction-markets · blog.colosseum.com (Breakout, Cypherpunk, Frontier winners) · superteam.fun/earn/hackathon/crypto-worlds-fair · pumpmarket.fun · phemex.com (Believe v2) · coindesk.com (Zora on Solana, Feb 18, 2026) · multicoin.capital/2025/10/23/building-the-attention-economy · arxiv.org/abs/2606.31675 · arxiv.org/abs/2507.01963 · defiprime.com/futard-prediction-markets
