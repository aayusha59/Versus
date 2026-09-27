import { cx } from "@/lib/cx";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "What am I actually buying?",
    a: "An outcome token for one side of the duel. If that side wins at the bell, each token redeems for one USDC. Both sides are minted together from one USDC, so every duel is fully collateralised.",
  },
  {
    q: "Where do the stock payouts come from?",
    a: "Trading fees. Each side trades in its own pool against a tokenised stock, and that pool collects its fee in the stock only. A crank claims the fees and pays them to everyone holding that side, pro rata, a few times a day.",
  },
  {
    q: "Who decides the winner?",
    a: "Pyth. After the resolution time anyone can call resolve with the posted price updates for both feeds. If a feed goes quiet past the grace period, the resolver settles manually with the printed prices.",
  },
  {
    q: "Can I sell before the bell?",
    a: "Yes. Sell back into the pool any time in one transaction. You keep every stock payout you already received.",
  },
  {
    q: "Which wallets work?",
    a: "Phantom, Solflare and Backpack. On devnet and localnet the picker also offers a Burner test wallet, and the faucet mints mock USDC so you can try a full round trip.",
  },
];

/** Native details/summary, one open at a time is not enforced so several can be read together. */
export function Faq({ className }: { className?: string }) {
  return (
    <div className={cx("faq", className)}>
      {ITEMS.map((it) => (
        <details key={it.q}>
          <summary>{it.q}</summary>
          <p className="faq-body">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
