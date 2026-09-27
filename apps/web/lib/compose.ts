import type { Template, TemplateKind } from "./types";
import type { Asset } from "./registry";
import { usd, utcDateTime, utcShortDate } from "./format";

export const TEMPLATE_META: Record<
  TemplateKind,
  { name: string; short: string; explainer: string; needsB: boolean }
> = {
  CapCompare: {
    name: "Cap compare",
    short: "A worth more than B",
    explainer: "Price times shares outstanding, read from Pyth at the bell. Bigger company wins.",
    needsB: true,
  },
  RatioOutperform: {
    name: "Outperform",
    short: "A beats B from here",
    explainer: "The A/B price ratio at resolution against the ratio the day the duel opened.",
    needsB: true,
  },
  PriceAbove: {
    name: "Price above",
    short: "A above a line",
    explainer: "One asset, one price. Above the line at the bell and the left corner wins.",
    needsB: false,
  },
};

export function buildTemplate(
  kind: TemplateKind,
  a: Asset,
  b: Asset | null,
  threshold: number,
): Template {
  switch (kind) {
    case "CapCompare":
      if (!b) throw new Error("Cap compare needs a right corner.");
      return {
        kind,
        feedA: a.feedId,
        feedB: b.feedId,
        sharesA: a.shares ?? 0,
        sharesB: b.shares ?? 0,
      };
    case "RatioOutperform":
      if (!b) throw new Error("Outperform needs a right corner.");
      return { kind, feedA: a.feedId, feedB: b.feedId, startRatio: a.refPrice / b.refPrice };
    case "PriceAbove":
      return { kind, feed: a.feedId, threshold };
  }
}

/** Full-sentence question for the duel page, set in Instrument Serif. */
export function composeQuestion(
  kind: TemplateKind,
  a: Asset,
  b: Asset | null,
  resolveTs: number,
  threshold: number,
): string {
  const when = utcShortDate(resolveTs);
  switch (kind) {
    case "CapCompare":
      return `Will ${a.label} be worth more than ${b?.label ?? "?"} on ${when}?`;
    case "RatioOutperform":
      return `Will ${a.label} outperform ${b?.label ?? "?"} from here to ${when}?`;
    case "PriceAbove":
      return `Will ${a.label} trade above ${usd(threshold)} on ${when}?`;
  }
}

/** Right-corner label for PriceAbove duels: the line itself. */
export function priceAboveRight(threshold: number): string {
  return `Under ${usd(threshold)}`;
}

/** "Resolves Dec 31, 21:00 UTC from Pyth AAPL/USD and NVDA/USD." */
export function composeResolves(template: Template, aFeed: string, bFeed: string | null, resolveTs: number): string {
  const when = utcDateTime(resolveTs);
  if (template.kind === "PriceAbove") return `Resolves ${when} from Pyth ${aFeed}.`;
  return `Resolves ${when} from Pyth ${aFeed} and ${bFeed ?? "?"}.`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
