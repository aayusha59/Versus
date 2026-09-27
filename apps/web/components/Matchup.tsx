import { createElement } from "react";
import { cx } from "@/lib/cx";
import type { Market, Side } from "@/lib/types";
import { usd } from "@/lib/format";

interface MatchupProps {
  a: string;
  b: string;
  /** "vs" by default; "above" for PriceAbove duels. */
  joiner?: string;
  size?: "lg" | "xl" | "2xl";
  /** Strike the loser once settled. */
  winner?: Side | null;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
}

const SIZE = { lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" } as const;

/** The fight-poster headline: left fighter in ink, right in vermilion, "vs" in serif italic. */
export function Matchup({ a, b, joiner = "vs", size = "xl", winner = null, as = "p", className }: MatchupProps) {
  return createElement(
    as,
    { className: cx("display balance-text", SIZE[size], className) },
    <span className={cx("text-side-a", winner === "b" && "struck")}>{a}</span>,
    <span className="vs">{joiner}</span>,
    <span className={cx("text-side-b", winner === "a" && "struck")}>{b}</span>,
  );
}

/** Headline parts for a market; PriceAbove prints "APPLE above $300". */
export function matchupParts(m: Market): { a: string; b: string; joiner: string } {
  if (m.template.kind === "PriceAbove") {
    return { a: m.a.label, b: usd(m.template.threshold), joiner: "above" };
  }
  return { a: m.a.label, b: m.b.label, joiner: "vs" };
}

export function MarketMatchup({
  market,
  size,
  as,
  className,
}: {
  market: Market;
  size?: MatchupProps["size"];
  as?: MatchupProps["as"];
  className?: string;
}) {
  const parts = matchupParts(market);
  const winner = market.status.kind === "resolved" ? market.status.winner : null;
  return <Matchup {...parts} size={size} as={as} winner={winner} className={className} />;
}
