# Prior art and market context

Ours in one sentence: the outcome token itself trades against a tokenized stock on a Meteora DAMM v2 pool with quote-only fees, so betting on a side pays that side's holders in that side's stock, and the question resolves from Pyth equity feeds on a fixed date.

## How we differ

| Project | What it does | Status, dated | How we differ |
|---|---|---|---|
| Bubblegum (bgum.fun, by PNP) | "Every question gets a coin": token, bonding curve, and a separate YES/NO market seeded 50/50, 300M of supply to the market | Live on Solana; TVL about $173 (Sept 26, 2026) | Their coin and market sit side by side. We have no separate coin: the outcome token is what trades, against a stock token, and fees pay holders in that stock. Meteora pools, not a proprietary curve |
| PumpMarket | Bets on whether a pump.fun coin graduates within an hour | Live Feb 2026 | Markets about coins. Ours are markets on assets that pay in those assets |
| Pumpcade | 60-second to 30-minute markets inside pump.fun livestreams; $1M pre-seed from pump.fun (Apr 2, 2026) | Beta | Minutes-long rounds settled inside a stream. Ours run for months and settle from external oracles |
| Believe v2 "Human Sentiment Market" | Perpetual Believe/Doubt pairs on people, never resolve | Troubled; founder sued March 2026 | Ours resolve with hard settlement and $1 redemption |
| Zora Attention Markets on Solana | Trend tokens and creator-reward sub-tokens | Live since Feb 2026 | No oracle, no resolution. We have both |
| Polymarket × Kaito, Noise, Trendle | Markets and perps on attention itself | Live / pending | The inverse. They price attention; we let attention price an asset question and pay in the asset |
| Futardio / MetaDAO | Futarchy-governed coins and ICOs; the conditional vault primitive | Live; $44M committed | We run external-event markets, not governance, with a minimal vault of our own and stock-token pools |
| StonkFun | Coins paired with anything (xStocks, ZEC, HYPE, pre-IPO); reward mode pays holders in the quote via a 1% or 3% transfer tax | Live; public since early Aug 2026; STONK launched July 23 | Same payout habit, different asset. We pair an outcome, not a memecoin. No transfer tax: the fee is a pool fee. The token has a terminal value on a known date |
| pump.fun Custom Pairs and Holder Rewards | 93 quote assets including xStocks (Sept 9, 2026); fees pro-rata to holders in the quote token several times an hour (Sept 12) | Live | Nobody offers an outcome token in the pair. We do, and resolution gives the trade an ending |
| StockLaunch (on Meteora) | Coins quoted in Backpack-issued stocks with time-weighted holder rewards | Live Sept 15 to 16, 2026 | Stocks as quote for memecoins. Ours is stocks as quote for outcome tokens, with Pyth resolution. Their time-weighted accumulator is our rewards upgrade path |
| Bags | Non-SOL quote launches into DAMM v2 (xStocks, Ondo) | Live | Same pool technology, no prediction layer |
| Predict.fun × Four.meme | Markets on launchpad metrics | Announced April 2026, BNB Chain | Not Solana, not paired |

Also noted: the Paradigm pm-AMM Solana port (`sparkfun-labs/pm-amm`, MIT, devnet) is a reference odds AMM with admin-only resolve. We use a constant-product pool against a stock token instead because the stock-token fee is the product.

## Market context, dated

**StonkFun.** Sept 6, 2026: $1.5M daily revenue, out-earning pump.fun that day. Sept 14: $1.47B cumulative volume, about $427M from tokenized-equity pairs, 42% of launches quoted in tokenized stocks, 10.5% in SOL. Sept 16 to 23: weekly revenue $8.13M against pump.fun's $7.99M. Team claim: more than $40M in rewards distributed to holders. Failure modes on record (Bitquery, Sept 22): $56.3M of taxed coins sold into pools Aug 23 to Sept 22, 160 coins lost more than half their supply to tax extraction, and only 1.3% of 1,346 reward coins reached $5M.

**ZCAT.** Launched on StonkFun Aug 30, 2026, 3% transfer tax, ZEC/ZCAT Raydium CLMM pool. Sept 7: about $2.8M in ZEC across 470K+ payouts as ZEC crossed $1,200 (CoinDesk). Sept 16: about $8M in ZEC distributed (Crypto Briefing). Peak market cap about $170M to $183M; about $80M on Sept 26. 61% of supply has passed through the tax collector (Bitquery, Sept 22).

**pump.fun.** Custom Pairs, Sept 9, 2026: 93 quote assets, creator fee 0.05% to 1% paid in the quote asset, splittable to 10 recipients, 50% of revenue to PUMP buyback-and-burn. Holder Rewards, Sept 12: replaces Cashback; fees paid pro-rata to holders of at least $20 several times an hour in the quote token; $7.73M to 480K holders by Sept 26.

**Tokenized equities on Solana.** xStocks live since June 30, 2025, 60+ tickers, already badged as quote tokens in Meteora DBC and DAMM v2. About 95% of global tokenized-equity DEX volume is on Solana: $5.8B in Q2 2026. Ondo Global Markets live Jan 21, 2026 with 200+ stocks behind a transfer hook.

**Prediction markets.** Global notional $43.7B in June 2026. Solana-native protocols earned about $1.4M per month in protocol revenue in Q2 2026 (CoinShares). Kalshi on Solana did $28.6M in its first six weeks, Dec 2025 to Jan 2026.

**Timing.** The whole ecosystem converged on "quote in anything, pay holders in the quote" inside one month: Raydium LaunchLab any-quote (Sept 7), pump.fun Custom Pairs and Meteora DBC stock-token release v0.2.1 (Sept 9), Holder Rewards (Sept 12), StockLaunch (Sept 15 to 16). Prediction-market projects took top consumer places in three straight Colosseum hackathons: Trepa and Melee Markets at Breakout 2025; Capitola, Fora, Superfan at Cypherpunk 2025; Mentioned, Senthos, Memetic Machines at Frontier 2026.

## Sources

From `prediction-paired-launchpad-research.md` (compiled Sept 26, 2026):

- Prior art: bgum.fun/how-it-works · pumpmarket.fun · theblock.co (Apr 2, 2026 Pumpcade) · phemex.com (Believe v2) · coindesk.com (Zora on Solana, Feb 18, 2026) · defiprime.com/futard-prediction-markets · docs.metadao.fi · github.com/metaDAOproject/programs · solanacompass.com (StockLaunch) · docs.bags.fm/how-to-guides/launch-token-non-sol-quote.md · github.com/sparkfun-labs/pm-amm
- StonkFun and ZCAT: datawallet.com/crypto/stonk-fun-explained · blocmates.com/articles/what-is-stonkfun-heres-how-it-works · docs.bitquery.io/docs/blockchain/Solana/stonkfun-api · bitquery.io/investigations/is-stonkfun-dumping-on-holders · theblock.co (Sept 6, 2026 STONK story) · coindesk.com (Sept 7, 2026 ZCAT story) · cryptobriefing.com/zcash-8m-zec-distributions-solana-zcat · crypto.news/raydium-launchlab-adds-support-for-any-token-pair-on-solana
- pump.fun: thedefiant.io (Custom Pairs) · cryptobriefing.com/pumpfun-holder-rewards-cashback-deprecated · github.com/pump-fun/pump-public-docs · memeburn.com/pump-fun-copied-stonk-but-the-fees-work-differently
- Tokenized equities: docs.xstocks.fi/developers · solana.com/news/case-study-xstocks · cryptobriefing.com/solana-dex-tokenized-stocks-volume · ondo.finance/blog/global-markets-live-on-solana · docs.meteora.ag/core-products/dbc/token-2022-support.md
- Prediction volume: solanacompass.com (prediction-market monthly volume $43.7B) · news.kalshi.com/p/kalshi-solana-tokenized-predictions
- Hackathon winners: blog.colosseum.com (Breakout, Cypherpunk, Frontier winners)
