import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { OddsBar } from "@/components/OddsBar";
import { SolanaLogo, SolanaMark } from "@/components/SolanaLogo";
import { BetRoute, CrankPipeline, MintSet, ResolveFlow, SystemMap } from "@/components/HowDiagrams";

export const metadata = {
  title: "How it works",
  description: "One Anchor program on Solana, composed with Meteora DAMM v2, Pyth and xStocks.",
};

/** An on-chain name inside body copy. */
function K({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.85em] text-foreground">{children}</code>;
}

/** One numbered stage of a duel: a line or two of copy, the schematic underneath. */
function Step({ n, title, children, figure }: { n: string; title: string; children: ReactNode; figure?: ReactNode }) {
  return (
    <section className="mt-14">
      <p className="font-mono text-xs text-muted-foreground">{n}</p>
      <h2 className="mt-1.5 text-lg font-medium">{title}</h2>
      <p className="prose-step mx-auto mt-2 max-w-xl text-muted-foreground text-pretty">{children}</p>
      {figure ? <figure className="card card-pad mt-6">{figure}</figure> : null}
    </section>
  );
}

const WHY_SOLANA: Array<{ label: string; title: string; body: string }> = [
  {
    label: "Atomic",
    title: "One transaction, two swaps",
    body: "A bet is two Meteora swaps in one Solana transaction. Both fill or nothing moves.",
  },
  {
    label: "Fees",
    title: "Fractions of a cent",
    body: "Cheap enough to pay every holder their share of the fees, pro rata, a few times a day.",
  },
  {
    label: "Speed",
    title: "400 ms blocks",
    body: "A swap confirms in about a second and the odds on the board move with it.",
  },
  {
    label: "Tokens",
    title: "Plain SPL tokens",
    body: "YES, NO and xStocks show in any wallet and route through any Solana aggregator.",
  },
];

const ODDS_FORMULA = [
  "yes_raw = P(YES in AAPLx) × P(AAPLx in USD)",
  "no_raw  = P(NO in NVDAx)  × P(NVDAx in USD)",
  "odds    = yes_raw / (yes_raw + no_raw)",
].join("\n");

const TEMPLATES: Array<[name: string, rule: string]> = [
  ["Cap compare", "price_a × shares_a > price_b × shares_b"],
  ["Outperform", "price_a / price_b > start_ratio"],
  ["Price above", "price > threshold"],
];

const INSTRUCTIONS: Array<[name: string, who: string, what: string]> = [
  ["create_market", "anyone", "Market PDA, YES and NO mints, collateral vault, two reward vaults."],
  ["set_pools", "creator, once", "Records the two Meteora pool addresses."],
  ["mint_set", "anyone", "USDC in, the same amount of YES and NO out."],
  ["merge_set", "anyone", "Burns a YES and a NO per USDC returned."],
  ["resolve", "anyone, after resolve_ts", "Reads the Pyth accounts, stores the winner."],
  ["resolve_manual", "resolver, after the grace period", "Stores the winner from printed prices."],
  ["redeem", "anyone, once resolved", "Burns winning tokens, pays one USDC each."],
  ["deposit_rewards", "anyone", "Moves stock tokens into a reward vault."],
  ["distribute", "crank", "Pays up to 12 holders, emits RewardsPaid."],
];

const ADDRESSES: Array<[label: string, value: string]> = [
  ["duel program", "AN2TEyFH3zCsv5MENn2uo9LJx69J2EUC8iScAVeDbW25"],
  ["Meteora DAMM v2", "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"],
  ["Pyth receiver", "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"],
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className="tag">
        <SolanaMark className="h-2.5 w-auto" />
        Built on Solana
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
        One Solana program, three protocols.
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
        The <K>duel</K> program mints outcome tokens, holds the USDC behind them and settles from Pyth. Trading runs in
        Meteora DAMM v2 pools against xStocks.
      </p>

      <figure className="card card-pad mt-10">
        <SystemMap />
      </figure>

      <section className="mt-14">
        <h2 className="text-lg font-medium">Why Solana</h2>
        <div className="mt-5 grid gap-px overflow-hidden rounded-[calc(var(--radius)+2px)] border border-line bg-line sm:grid-cols-2">
          {WHY_SOLANA.map((w) => (
            <div key={w.label} className="bg-background px-5 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{w.label}</p>
              <h3 className="mt-1.5 text-base font-medium">{w.title}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground text-pretty">{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Step n="01" title="Mint a set" figure={<MintSet />}>
        <K>mint_set</K> takes one USDC into the vault and returns one YES plus one NO. <K>merge_set</K> reverses it. A
        set always redeems for exactly one USDC.
      </Step>

      <Step n="02" title="Trade through the stock" figure={<BetRoute />}>
        YES trades against AAPLx and NO against NVDAx in Meteora pools that keep their fee in the stock. A bet is one
        Solana transaction: USDC to AAPLx, AAPLx to YES.
      </Step>

      <Step
        n="03"
        title="Read the odds"
        figure={
          <div>
            <pre className="mx-auto w-fit text-left font-mono text-[13px] leading-6 text-foreground">{ODDS_FORMULA}</pre>
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between text-sm font-medium tnum">
                <span className="text-side-a">Apple 54</span>
                <span className="text-side-b">Nvidia 46</span>
              </div>
              <OddsBar a={0.539} aLabel="Apple" bLabel="Nvidia" className="mt-2" />
            </div>
          </div>
        }
      >
        No order book. Each side&apos;s dollar price is its pool price times the stock&apos;s Pyth price, and the board
        scales the two to add up to one. Drift past a cent and minting or merging a set pulls it back.
      </Step>

      <Step n="04" title="Fees become rewards" figure={<CrankPipeline />}>
        A crank claims each pool&apos;s fees, deposits them with <K>deposit_rewards</K> and pays every holder pro rata
        with <K>distribute</K>, 12 per call. Fees never leave the stock.
      </Step>

      <Step n="05" title="Settle from Pyth" figure={<ResolveFlow />}>
        After <K>resolve_ts</K> anyone posts the Pyth prices and calls <K>resolve</K>. The program checks the feed ids
        and a six-hour freshness window, then the template picks the winner. A quiet feed past the grace period falls
        back to the resolver.
      </Step>

      <div className="mt-4 card grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {TEMPLATES.map(([name, rule]) => (
          <div key={name} className="px-4 py-4">
            <h3 className="text-sm font-medium">{name}</h3>
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">{rule}</p>
          </div>
        ))}
      </div>

      <Step n="06" title="Redeem">
        <K>redeem</K> burns winning tokens for one USDC each. The losing token is worth zero. Any stock you were paid
        along the way stays yours.
      </Step>

      <section className="mt-14">
        <h2 className="text-lg font-medium">Nine instructions</h2>
        <p className="prose-step mx-auto mt-2 max-w-xl text-muted-foreground text-pretty">
          Everything the program does is mint, burn, transfer and read a Pyth account. The AMM, the oracle and the stock
          issuer are not ours.
        </p>
        <div className="mt-6 overflow-x-auto text-left">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[11px] text-muted-foreground">
                <th className="py-2 pr-6 font-medium">Instruction</th>
                <th className="py-2 pr-6 font-medium">Signer</th>
                <th className="py-2 font-medium">Effect</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUCTIONS.map(([name, who, what]) => (
                <tr key={name} className="border-b border-line align-top">
                  <td className="py-2.5 pr-6 font-mono text-[13px] whitespace-nowrap text-foreground">{name}</td>
                  <td className="py-2.5 pr-6 text-muted-foreground">{who}</td>
                  <td className="py-2.5 text-muted-foreground">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 card divide-y">
          {ADDRESSES.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{k}</span>
              <span className="break-all font-mono text-xs text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          On devnet, USDC, AAPLx and NVDAx are mock mints. The registry maps each to its mainnet xStocks mint and the
          program runs unchanged.
        </p>
      </section>

      <div className="mt-14 rounded-3xl border px-6 py-10">
        <h2 className="text-xl font-semibold">Ready when you are.</h2>
        <p className="mt-2 text-sm text-muted-foreground">The board is live. Pick a side and the odds move with you.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/board">Open the board</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/new">Create a duel</Link>
          </Button>
        </div>
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground/70">Powered by</span>
          <SolanaLogo className="h-5 w-auto text-foreground" />
        </div>
      </div>
    </div>
  );
}
