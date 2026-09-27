import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Faq } from "@/components/Faq";
import { OddsBar } from "@/components/OddsBar";
import { Risks } from "@/components/Risks";
import { BetRoute, CrankPipeline, MintSet, ResolveFlow, SystemMap } from "@/components/HowDiagrams";

export const metadata = {
  title: "How it works",
  description: "The duel program, the Meteora pools, the Pyth settlement and the fee rewards, step by step.",
};

/** An on-chain name inside body copy. */
function K({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.85em] text-foreground">{children}</code>;
}

/** One numbered stage of a duel: prose on the left, a schematic on the right. */
function Step({
  n,
  title,
  children,
  figure,
  caption,
}: {
  n: string;
  title: string;
  children: ReactNode;
  figure?: ReactNode;
  caption?: string;
}) {
  return (
    <section className="mt-24 grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <p className="font-mono text-sm text-muted-foreground">{n}</p>
        <h2 className="mt-2 text-2xl font-medium">{title}</h2>
        <div className="mt-4 space-y-4 text-muted-foreground text-pretty">{children}</div>
      </div>
      {figure ? (
        <figure className="card card-pad self-start lg:col-span-7">
          {figure}
          {caption ? <figcaption className="mt-4 font-mono text-xs text-muted-foreground">{caption}</figcaption> : null}
        </figure>
      ) : null}
    </section>
  );
}

const ODDS_FORMULA = [
  "yes_raw = P(YES in AAPLx) × P(AAPLx in USD)",
  "no_raw  = P(NO in NVDAx)  × P(NVDAx in USD)",
  "odds    = yes_raw / (yes_raw + no_raw)",
].join("\n");

const TEMPLATES = [
  {
    name: "Cap compare",
    rule: "price_a × shares_a > price_b × shares_b",
    body: "Shares outstanding are stored in the market when it is created and printed on the duel page.",
  },
  {
    name: "Outperform",
    rule: "price_a / price_b > start_ratio",
    body: "The start ratio is the price ratio recorded the moment the duel opened.",
  },
  {
    name: "Price above",
    rule: "price > threshold",
    body: "One feed against a fixed line. Only the left corner needs a price.",
  },
];

const INSTRUCTIONS: Array<[name: string, who: string, what: string]> = [
  ["create_market", "anyone", "Creates the market PDA, the YES and NO mints, the collateral vault and both reward vaults."],
  ["set_pools", "creator, once", "Records the two Meteora pool addresses on the market."],
  ["mint_set", "anyone", "Takes USDC in, mints the same amount of YES and NO."],
  ["merge_set", "anyone", "Burns a YES and a NO per USDC returned."],
  ["resolve", "anyone, after resolve_ts", "Reads the Pyth accounts, stores the winner and both prices."],
  ["resolve_manual", "resolver, after the grace period", "Stores the winner and prices supplied by the resolver."],
  ["redeem", "anyone, once resolved", "Burns winning tokens, pays one USDC each from the vault."],
  ["deposit_rewards", "anyone", "Moves stock tokens into one side's reward vault."],
  ["distribute", "crank", "Pays up to 12 holders from a reward vault and emits RewardsPaid."],
];

const MARKET_FIELDS: Array<[label: string, value: string]> = [
  ["identity", "creator, nonce, the question, both side labels"],
  ["tokens", "YES and NO mints, the collateral vault, one reward vault per side"],
  ["rule", "the template with its Pyth feed ids, resolve_ts, grace_secs"],
  ["keys", "the resolver and the crank"],
  ["state", "Open, or Resolved with the winner and both prices; the pool addresses; counters for the tale of the tape"],
];

const ADDRESSES: Array<[label: string, value: string]> = [
  ["duel program", "AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25"],
  ["Meteora DAMM v2", "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"],
  ["Pyth receiver", "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"],
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="max-w-2xl">
        <p className="font-mono text-sm uppercase text-muted-foreground">How it works</p>
        <h1 className="mt-2 text-4xl font-semibold lg:text-5xl text-balance">One program, three protocols.</h1>
        <p className="mt-6 text-lg text-muted-foreground text-pretty">
          Versus is a single Anchor program on Solana called <K>duel</K>. It mints outcome tokens, holds the USDC that
          backs them, pays out fee rewards and settles from Pyth prices. Trading happens in Meteora DAMM v2 pools, and the
          stock tokens are xStocks. This page follows one duel, Apple vs Nvidia, through every instruction.
        </p>
      </div>

      <figure className="card card-pad mt-12">
        <SystemMap />
        <figcaption className="mt-4 font-mono text-xs text-muted-foreground">
          Dashed outlines are programs. Solid boxes are accounts: your wallet, the vaults and the pools. Labels name the
          instruction or swap that moves tokens along each line.
        </figcaption>
      </figure>

      <Step
        n="01"
        title="Mint a set"
        figure={<MintSet />}
        caption="A full set is one YES plus one NO. The USDC behind it sits in the vault until a winner redeems."
      >
        <p>
          <K>mint_set(amount)</K> moves <K>amount</K> USDC from your wallet into the market&apos;s collateral vault and
          mints <K>amount</K> YES and <K>amount</K> NO back to you. <K>merge_set</K> is the reverse: burn one of each,
          get the USDC back. Both work at any time before the bell.
        </p>
        <p>
          The market account is a program-derived address. It is the mint authority for YES and NO and the only signer
          for the vault, so no key can move collateral without a burn.
        </p>
        <p>
          YES supply equals NO supply equals the USDC in the vault, minus what winners have redeemed. A full set is
          always worth exactly one USDC, and that is what pins the odds to real dollars.
        </p>
      </Step>

      <Step
        n="02"
        title="Trade through the stock"
        figure={<BetRoute />}
        caption="Backing Apple with USDC. Selling runs the same two swaps in reverse and pays the same fee in AAPLx."
      >
        <p>
          Each side has its own Meteora DAMM v2 pool. YES trades against AAPLx and NO against NVDAx. The outcome token is
          token A, the stock is token B, and the pool runs in quote-only fee mode, so every swap in either direction pays
          its fee in the stock.
        </p>
        <p>
          A bet is one transaction with two swaps. USDC buys AAPLx in the USDC/AAPLx pool, then that AAPLx buys YES in
          the YES/AAPLx pool. The second swap&apos;s input is the first swap&apos;s minimum output, so the transaction
          never fails for lack of balance.
        </p>
        <p>
          Collateral never enters a pool. The pools hold only outcome tokens and stock. The liquidity that opens a duel
          is a minted set: the YES half seeds one pool and the NO half seeds the other, both at even odds.
        </p>
      </Step>

      <Step
        n="03"
        title="Read the odds"
        figure={
          <div>
            <pre className="overflow-x-auto font-mono text-sm leading-7 text-foreground">{ODDS_FORMULA}</pre>
            <div className="mt-6 border-t border-line pt-5">
              <p className="font-mono text-xs text-muted-foreground">
                Example: yes_raw 0.55, no_raw 0.47, raw sum 1.02
              </p>
              <div className="mt-3 flex items-center justify-between text-sm font-medium tnum">
                <span className="text-side-a">Apple 54</span>
                <span className="text-side-b">Nvidia 46</span>
              </div>
              <OddsBar a={0.539} aLabel="Apple" bLabel="Nvidia" className="mt-2" />
            </div>
          </div>
        }
        caption="The board scales the two dollar prices to add up to one. The raw sum is shown beside it."
      >
        <p>
          There is no order book and no probability oracle. The odds come from the two pool prices. One YES costs some
          AAPLx, and AAPLx has a dollar price, so one YES has a dollar price. The same holds for NO.
        </p>
        <p>
          A set always redeems for exactly one USDC. If YES plus NO trades above a dollar, anyone can mint a set and sell
          both halves for a profit. Below a dollar, buy both and merge. That trade pulls the odds back to real prices,
          and the raw sum on the board shows how far they have drifted.
        </p>
      </Step>

      <Step
        n="04"
        title="Fees become rewards"
        figure={<CrankPipeline />}
        caption="One epoch for the Apple side. The same loop runs for the Nvidia side in NVDAx."
      >
        <p>
          Fees never leave the stock. A crank runs a few times a day and, for each duel and side, claims what the pool
          earned, deposits it into that side&apos;s reward vault with <K>deposit_rewards</K>, snapshots every holder of
          the outcome token, and pays them in proportion to their balance with <K>distribute</K>.
        </p>
        <p>
          The program enforces two things on <K>distribute</K>: the signer must be the market&apos;s crank key, and the
          amounts cannot exceed the vault. Each call pays at most 12 holders and emits a <K>RewardsPaid</K> event. The
          ledger on every duel page is built from those events. Payouts under a cent and rounding dust stay in the vault
          for the next epoch.
        </p>
        <p>
          Pool accounts and the market&apos;s own vaults are left out of the snapshot, so fees are never paid back into a
          pool. Losing the duel does not claw back stock you were already paid.
        </p>
      </Step>

      <Step
        n="05"
        title="Settle from Pyth"
        figure={<ResolveFlow />}
        caption="The permissionless path on top, the resolver fallback below. Only the first one runs on a normal day."
      >
        <p>
          After <K>resolve_ts</K>, anyone can call <K>resolve</K>. The caller first posts the latest Pyth price for each
          feed on chain; the Pyth receiver program verifies the signatures and writes a <K>PriceUpdateV2</K> account.{" "}
          <K>resolve</K> reads those accounts and checks each one: owned by the Pyth receiver, fully verified, the feed
          id stored in the market, and published within the last six hours, a window that covers the previous equity
          close.
        </p>
        <p>
          Feeds carry different exponents, so the program scales both prices to a common exponent in 128-bit integer
          math before comparing. The pool price is never an input. Then the duel&apos;s template picks the winner. Every
          comparison is strict: the left corner must be strictly greater to win.
        </p>
        <p>
          If a feed has not ticked inside the window, the market waits. Once <K>resolve_ts + grace_secs</K> has passed,
          the resolver key can call <K>resolve_manual</K> with the printed prices. The grace period is stored on the
          market, so everyone can see the window before it opens.
        </p>
      </Step>

      <div className="mt-8 card grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        {TEMPLATES.map((t) => (
          <div key={t.name} className="p-6">
            <h3 className="text-lg font-medium">{t.name}</h3>
            <p className="mt-3 font-mono text-sm text-foreground">{t.rule}</p>
            <p className="mt-3 text-sm text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>

      <Step n="06" title="Redeem">
        <p>
          <K>redeem(amount)</K> burns <K>amount</K> of the winning token and sends <K>amount</K> USDC from the collateral
          vault. The losing token is worth zero. Any AAPLx or NVDAx you were paid along the way is yours to keep,
          whichever side won.
        </p>
      </Step>

      <section className="mt-24">
        <h2 className="text-3xl font-semibold">The program</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
          Nine instructions. Everything the program does is mint, burn, transfer and read a Pyth account. The AMM, the
          oracle and the stock issuer are not ours, which keeps the surface small and the outcome tokens plain SPL mints
          that any wallet or aggregator can route into.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left font-mono text-xs text-muted-foreground">
                <th className="py-2 pr-6 font-medium">Instruction</th>
                <th className="py-2 pr-6 font-medium">Signer</th>
                <th className="py-2 font-medium">Effect</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUCTIONS.map(([name, who, what]) => (
                <tr key={name} className="border-b border-line align-top">
                  <td className="py-3 pr-6 font-mono whitespace-nowrap text-foreground">{name}</td>
                  <td className="py-3 pr-6 text-muted-foreground">{who}</td>
                  <td className="py-3 text-muted-foreground">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <h3 className="text-lg font-medium">What the market account stores</h3>
            <dl className="dl mt-4">
              {MARKET_FIELDS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>{k}</dt>
                  <dd className="text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="text-lg font-medium">Addresses</h3>
            <dl className="dl mt-4">
              {ADDRESSES.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>{k}</dt>
                  <dd className="break-all font-mono text-xs leading-5 text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Meteora and the Pyth receiver use the same address on devnet and mainnet.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-24 max-w-3xl">
        <h2 className="text-3xl font-semibold">On devnet</h2>
        <p className="mt-4 text-muted-foreground text-pretty">
          On devnet, USDC, AAPLx and NVDAx are mock mints with six decimals, minted by the operator wallet. The bootstrap
          creates the USDC/AAPLx and USDC/NVDAx pools at the current Pyth prices, opens three duels, mints a set for each
          and seeds the YES and NO pools at even odds with a 100 basis point quote-only fee.
        </p>
        <p className="mt-4 text-muted-foreground text-pretty">
          The wallet picker offers a Burner wallet and the faucet mints 1,000 mock USDC, so a full round trip takes a few
          minutes: bet, sell, crank, resolve, redeem. The asset registry maps every mock mint to its mainnet xStocks mint,
          and the program needs no change to run against the real ones.
        </p>
      </section>

      <section id="risks" className="mt-24 max-w-3xl scroll-mt-24">
        <h2 className="text-3xl font-semibold">Risks</h2>
        <Risks className="mt-6" />
      </section>

      <section className="mt-24 max-w-3xl">
        <h2 className="text-3xl font-semibold">Questions</h2>
        <Faq className="mt-6" />
      </section>

      <div className="mt-24 rounded-3xl border px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold">Ready when you are.</h2>
        <p className="mt-2 text-muted-foreground">The board is live. Pick a side and the odds move with you.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/board">Open the board</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/new">Create a duel</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
