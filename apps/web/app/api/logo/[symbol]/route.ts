import { NextResponse } from "next/server";
import { ASSET_BY_SYMBOL } from "@/lib/registry";
import { logoSources } from "@/lib/logos";

/**
 * GET /api/logo/AAPL -> the fighter's logo as an image, or 404 when no source has one.
 *
 * Tries each source in `logoSources` order. Upstream fetches sit in Next's data cache for a day,
 * and the response carries a long public cache header, so a logo is fetched once per symbol per
 * day per server, not once per card. Nothing here is on the betting path: the tile falls back to a
 * monogram when this 404s, so a dead upstream costs the page a picture and nothing else.
 */

const ONE_DAY = 86_400;
const UPSTREAM_TIMEOUT_MS = 6_000;
/** Some sources answer 200 with a tiny transparent placeholder; treat those as misses. */
const MIN_BYTES = 200;

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const asset = ASSET_BY_SYMBOL[symbol.toUpperCase()];
  if (!asset) return miss(404);

  for (const url of logoSources(asset)) {
    try {
      const res = await fetch(url, {
        headers: { accept: "image/*", "user-agent": "Mozilla/5.0 (compatible; Versus/0.1)" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        next: { revalidate: ONE_DAY },
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) continue;
      const body = await res.arrayBuffer();
      if (body.byteLength < MIN_BYTES) continue;
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": type,
          "cache-control": `public, max-age=${ONE_DAY}, s-maxage=${7 * ONE_DAY}, stale-while-revalidate=${7 * ONE_DAY}`,
          "x-logo-source": new URL(url).hostname,
        },
      });
    } catch {
      // Timeout or network error: try the next source.
    }
  }
  return miss(404);
}

function miss(status: number) {
  return new NextResponse(null, { status, headers: { "cache-control": "public, max-age=3600" } });
}
