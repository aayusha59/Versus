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

const SIZE = { lg: "text-2xl", xl: "text-3xl", "2xl": "text-5xl lg:text-6xl" } as const;

/** The matchup headline: left fighter in green, right in red, "vs" small and muted. */
export function Matchup({ a, b, joiner = "vs", size = "xl", winner = null, as = "p", className }: MatchupProps) {
  return createElement(
    as,
    { className: cx("display", SIZE[size], className) },
    <span className={cx("text-side-a", winner === "b" && "struck")}>{a}</span>,
    <span className="vs">{joiner}</span>,
    <span className={cx("text-side-b", winner === "a" && "struck")}>{b}</span>,
  );
}

/** Headline parts for a market; PriceAbove prints "Apple above $300". */
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
