import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Faq } from "@/components/Faq";
import { Risks } from "@/components/Risks";
import { STEPS } from "@/lib/steps";

export const metadata = { title: "How it works" };

const MECHANISM = [
  {
    title: "Mint",
    body: "One USDC mints one YES and one NO token. Merge them back any time. The duel is always fully collateralised, so the winner can always redeem for a dollar.",
  },
  {
    title: "Trade",
    body: "YES trades in a Meteora pool against the left side's stock token, NO against the right side's. Each pool collects its fee in that stock only, and a crank pays it to the holders of that side.",
  },
  {
    title: "Resolve",
    body: "After the bell, anyone calls resolve with the posted Pyth price updates. Price times shares decides a cap duel; the price ratio decides an outperform duel; one price against a line decides the rest.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="max-w-2xl">
        <p className="font-mono text-sm uppercase text-muted-foreground">How it works</p>
        <h1 className="mt-2 text-4xl font-semibold lg:text-5xl text-balance">
          Back a side. Get paid in what it is made of.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground text-pretty">
          A duel is a head-to-head question with a date on it. Two sides, each backed one to one by USDC. Bet on
          Apple and every trade on that side pays you a fee in tokenised Apple stock. Bet on Nvidia, get paid in
          Nvidia. On the date, Pyth reads both prices and the winner redeems for a dollar a token.
        </p>
      </div>

      <ol className="mt-16 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s) => (
          <li key={s.n} className="card card-pad flex flex-col gap-3 min-h-[200px]">
            <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
            <h2 className="text-xl font-medium">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-24">
        <h2 className="text-3xl font-semibold">The mechanism</h2>
        <div className="mt-8 card grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {MECHANISM.map((m) => (
            <div key={m.title} className="p-6">
              <h3 className="text-xl font-medium">{m.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{m.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          One small Anchor program plus Meteora DAMM v2, Pyth and xStocks. Fees are collected in the stock token
          only, so the payout is never a promise, it is the fee itself.
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
