import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { clamp01 } from "@/lib/format";

/**
 * A 6px bar: ink from the left, vermilion from the right, meeting at the odds with a
 * 1px paper gap. Halves animate with scaleX, the gap with translateX; nothing resizes.
 */
export function OddsBar({
  a,
  aLabel,
  bLabel,
  className,
}: {
  a: number;
  aLabel: string;
  bLabel: string;
  className?: string;
}) {
  const p = clamp01(a);
  const pa = Math.round(p * 100);
  return (
    <div
      className={cx("oddsbar", className)}
      style={{ "--a": p, "--b": 1 - p } as CSSProperties}
      role="img"
      aria-label={`${aLabel} ${pa} percent, ${bLabel} ${100 - pa} percent`}
    >
      <div className="oddsbar-a" />
      <div className="oddsbar-b" />
      <div className="oddsbar-gap" />
    </div>
  );
}
