import type { Market } from "@/lib/types";
import { compactCount, compactUsd, signedPct, token, usd, EN_DASH } from "@/lib/format";

interface Row {
  metric: string;
  a: React.ReactNode;
  b: React.ReactNode;
  aLabel?: string;
  bLabel?: string;
}

/**
 * The boxing-poster tale of the tape: metric name centred in a narrow middle column,
 * left fighter right-aligned in ink, right fighter left-aligned in vermilion.
 */
export function TaleOfTheTape({ market: m }: { market: Market }) {
  const dash = EN_DASH;
  const priceAbove = m.template.kind === "PriceAbove";
  const rows: Row[] = [
    {
      metric: "Price",
      a: usd(m.a.price),
      b: priceAbove ? usd(m.template.kind === "PriceAbove" ? m.template.threshold : 0) : usd(m.b.price),
    },
    {
      metric: "Market cap",
      a: m.a.marketCap ? compactUsd(m.a.marketCap) : dash,
      b: m.b.marketCap ? compactUsd(m.b.marketCap) : dash,
    },
    {
      metric: "Shares out",
      a: m.a.sharesOutstanding ? compactCount(m.a.sharesOutstanding) : dash,
      b: m.b.sharesOutstanding && !priceAbove ? compactCount(m.b.sharesOutstanding) : dash,
    },
    {
      metric: "30-day",
      a: signedPct(m.a.change30d),
      b: priceAbove ? dash : signedPct(m.b.change30d),
    },
    {
      metric: "Paid in",
      a: m.a.pairSymbol,
      b: m.b.pairSymbol,
    },
    {
      metric: "Oracle",
      a: m.a.feedName,
      b: priceAbove ? "the line" : m.b.feedName,
    },
    {
      metric: "Holders",
      a: m.a.holders.toLocaleString("en-US"),
      b: m.b.holders.toLocaleString("en-US"),
    },
    {
      metric: "Fees paid out",
      a: token(m.rewardsPaidA, m.a.pairSymbol),
      b: token(m.rewardsPaidB, m.b.pairSymbol),
    },
  ];

  return (
    <table className="tape">
      <thead className="sr-only">
        <tr>
          <th scope="col">{m.a.label}</th>
          <th scope="col">Metric</th>
          <th scope="col">{m.b.label}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.metric}>
            <td className="tape-a tnum">{r.a}</td>
            <td className="tape-metric">{r.metric}</td>
            <td className="tape-b tnum">{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
