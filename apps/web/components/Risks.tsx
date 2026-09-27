import { cx } from "@/lib/cx";

export const RISKS: { title: string; body: string }[] = [
  {
    title: "Not available everywhere",
    body: "Versus is not offered to persons in the United States or in any other restricted jurisdiction. Do not use it where prediction markets or tokenised stocks are not permitted.",
  },
  {
    title: "Outcome tokens can go to zero",
    body: "The losing side redeems for nothing at the bell. Only put in what you can lose in full.",
  },
  {
    title: "Rewards are other traders' fees",
    body: "Stock payouts are a redistribution of trading fees, not yield or interest. They depend on volume and can be small or nothing.",
  },
  {
    title: "Stock tokens have an issuer",
    body: "xStocks can be paused, frozen or seized by their issuer, including inside the pools and reward vaults. Collateral is USDC, so the one-dollar redemption is not affected.",
  },
  {
    title: "Resolution has a fallback",
    body: "Pyth prices decide each duel. If a feed is stale past the grace period, the resolver settles manually with the published prices.",
  },
  {
    title: "Not advice",
    body: "Nothing here is legal, tax or investment advice. Devnet and localnet use mock tokens with no value.",
  },
];

export function Risks({ className }: { className?: string }) {
  return (
    <ul className={cx("card grid divide-y", className)}>
      {RISKS.map((r) => (
        <li key={r.title} className="p-6">
          <h3 className="text-base font-medium">{r.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}
