"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { logoUrl, monogram } from "@/lib/logos";
import type { Market, Side } from "@/lib/types";

type Size = "sm" | "md" | "lg";
const PX: Record<Size, number> = { sm: 28, md: 40, lg: 56 };

/**
 * One fighter's logo: a round tile ringed in the side colour. The monogram shows at once; the
 * image from `/api/logo/[symbol]` fades over it when it lands and stays hidden if it never does.
 * Decorative: the fighter's name is always printed beside it.
 */
export function AssetLogo({
  symbol,
  label,
  side,
  size = "md",
  muted = false,
  className,
}: {
  /** Registry symbol; null renders the monogram only (the price line on a PriceAbove duel). */
  symbol: string | null;
  label: string;
  side?: Side;
  size?: Size;
  /** The loser after settlement. */
  muted?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "failed">(symbol ? "loading" : "failed");
  const img = useRef<HTMLImageElement>(null);

  // A cached image can finish before hydration, in which case onLoad never fires.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth > 0) setState("ok");
  }, []);

  const px = PX[size];
  return (
    <span
      className={cx("logo", side && `logo-${side}`, state === "ok" && "logo-loaded", muted && "logo-muted", className)}
      style={{ "--logo-size": `${px}px` } as CSSProperties}
      title={label}
      aria-hidden="true"
    >
      <span className="logo-mono">{monogram(label)}</span>
      {symbol && state !== "failed" ? (
        // Plain <img>: the route already caches and sizes nothing, so next/image would only add a hop.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={logoUrl(symbol)}
          alt=""
          width={px}
          height={px}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
        />
      ) : null}
    </span>
  );
}

/** Both corners as an overlapping pair, left in green, right in red, the loser dimmed once settled. */
export function FighterLogos({ market: m, size = "md", className }: { market: Market; size?: Size; className?: string }) {
  const priceAbove = m.template.kind === "PriceAbove";
  const winner = m.status.kind === "resolved" ? m.status.winner : null;
  return (
    <span className={cx("logo-pair", className)}>
      <AssetLogo symbol={m.a.symbol} label={m.a.label} side="a" size={size} muted={winner === "b"} />
      <AssetLogo
        symbol={priceAbove ? null : m.b.symbol}
        label={priceAbove ? "$" : m.b.label}
        side="b"
        size={size}
        muted={winner === "a"}
      />
    </span>
  );
}
