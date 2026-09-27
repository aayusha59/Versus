import { cx } from "@/lib/cx";
import type { Market } from "@/lib/types";

export type StampTone = "ink" | "vermilion" | "gain";

export function Stamp({
  tone = "ink",
  className,
  children,
  title,
}: {
  tone?: StampTone;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={cx("stamp", `stamp-${tone}`, className)} title={title}>
      {children}
    </span>
  );
}

/** One stamp per row: LIVE in vermilion while open, RESOLVED in ink once settled. */
export function StatusStamp({ market, className }: { market: Market; className?: string }) {
  if (market.status.kind === "resolved") {
    return (
      <Stamp tone="ink" className={className}>
        Resolved
      </Stamp>
    );
  }
  return (
    <Stamp tone="vermilion" className={className}>
      Live
    </Stamp>
  );
}
