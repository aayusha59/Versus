import type { Market, RewardEpoch, Side } from "./types";
import { EN_DASH, oddsPair, ratio, token, utcDateTime, utcTime } from "./format";
import { TEMPLATE_META } from "./compose";

/** "Apple leads 54-46." / "Dead even at 50-50." / "Zcash wins. Closed 71-29." */
export function leadLine(m: Market): string {
  if (m.status.kind === "resolved") {
    const w = m.status.winner === "a" ? m.a : m.b;
    return `${w.label} wins. Closed ${oddsPair(m.status.closingOdds.a)}.`;
  }
  const a = Math.round(m.odds.a * 100);
  if (a === 50) return `Dead even at 50${EN_DASH}50.`;
  if (a > 50) return `${m.a.label} leads ${a}${EN_DASH}${100 - a}.`;
  return `${m.b.label} leads ${100 - a}${EN_DASH}${a}.`;
}

/** "Paid 3.1 AAPLx to 412 holders at 14:20 UTC." */
export function paidLine(e: RewardEpoch, m: Market): string {
  const f = e.side === "a" ? m.a : m.b;
  return `Paid ${token(e.amountPair, f.pairSymbol)} to ${e.holders} holders at ${utcTime(e.ts)}.`;
}

/** "Resolves Dec 31, 21:00 UTC from Pyth AAPL/USD and NVDA/USD." */
export function resolvesLine(m: Market): string {
  const when = utcDateTime(m.resolveTs);
  if (m.status.kind === "resolved") {
    const at = utcDateTime(m.status.resolvedTs);
    return m.status.manual
      ? `Settled ${at} by the resolver after the oracle went quiet.`
      : `Settled ${at} from Pyth ${m.a.feedName}${m.template.kind === "PriceAbove" ? "" : ` and ${m.b.feedName}`}.`;
  }
  if (m.template.kind === "PriceAbove") return `Resolves ${when} from Pyth ${m.a.feedName}.`;
  return `Resolves ${when} from Pyth ${m.a.feedName} and ${m.b.feedName}.`;
}

export function templateName(m: Market): string {
  return TEMPLATE_META[m.template.kind].name;
}

/** The plain-English rule printed under "How it resolves". */
export function ruleLine(m: Market): string {
  switch (m.template.kind) {
    case "CapCompare":
      return `Price times shares outstanding for each side at the bell. The bigger company wins; ${m.a.label} on a tie.`;
    case "RatioOutperform":
      return `The ${m.a.symbol}/${m.b.symbol} price ratio at the bell against ${ratio(m.template.startRatio)}, the ratio when the duel opened. Higher and ${m.a.label} wins.`;
    case "PriceAbove":
      return `${m.a.feedName} at the bell. Above the line and ${m.a.label} wins; at or under and the line holds.`;
  }
}

export function sideName(m: Market, side: Side): string {
  return side === "a" ? m.a.label : m.b.label;
}

export function pairSymbol(m: Market, side: Side): string {
  return side === "a" ? m.a.pairSymbol : m.b.pairSymbol;
}

/** "Pays AAPLx and NVDAx" style summary for board rows. */
export function paidInLine(m: Market): string {
  if (m.template.kind === "PriceAbove") return m.a.pairSymbol;
  return `${m.a.pairSymbol} ${"·"} ${m.b.pairSymbol}`;
}

export function feesOutLine(m: Market): string {
  if (m.template.kind === "PriceAbove") return token(m.rewardsPaidA, m.a.pairSymbol);
  return `${token(m.rewardsPaidA, m.a.pairSymbol)} ${"·"} ${token(m.rewardsPaidB, m.b.pairSymbol)}`;
}
