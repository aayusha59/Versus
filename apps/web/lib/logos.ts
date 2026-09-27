import type { Asset } from "./registry";

/**
 * Where a fighter's logo comes from. `/api/logo/[symbol]` walks this list server-side and
 * returns the first image that answers, so the browser only ever sees one same-origin URL.
 *
 * Equities, ETFs and commodities: Parqet first, because its tiles are full-bleed brand squares
 * that crop cleanly into a circle, then Financial Modeling Prep, then the company favicon
 * through DuckDuckGo. Crypto: Parqet again, then CoinCap, then the spothq icon pack on jsDelivr.
 * All keyless.
 */
export function logoSources(asset: Asset): string[] {
  const sym = encodeURIComponent(asset.symbol);
  if (asset.kind === "crypto") {
    const slug = asset.symbol.toLowerCase();
    return [
      `https://assets.parqet.com/logos/crypto/${sym}?format=png`,
      `https://assets.coincap.io/assets/icons/${encodeURIComponent(slug)}@2x.png`,
      `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${encodeURIComponent(slug)}.png`,
    ];
  }
  return [
    `https://assets.parqet.com/logos/symbol/${sym}?format=png`,
    `https://images.financialmodelingprep.com/symbol/${sym}.png`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(asset.domain)}.ico`,
  ];
}

/** Bump when the source order changes, so browsers drop the day-long cached image. */
const LOGO_VERSION = 2;

/** Same-origin URL the `<img>` tags use. */
export function logoUrl(symbol: string): string {
  return `/api/logo/${encodeURIComponent(symbol)}?v=${LOGO_VERSION}`;
}

/**
 * Two characters for the tile while the image loads or when no source answers:
 * "Apple" -> "AP", "S&P 500" -> "S5", "$" -> "$".
 */
export function monogram(label: string): string {
  const words = label.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean);
  if (words.length === 0) return label.trim().slice(0, 2).toUpperCase();
  const s = words.length >= 2 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return s.toUpperCase();
}
