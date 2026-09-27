import { cx } from "@/lib/cx";
import type { Market } from "@/lib/types";

/** "ink" is the neutral tag; "gain"/"a" print green, "vermilion"/"b" print red. */
export type StampTone = "ink" | "vermilion" | "gain" | "a" | "b";

const TONE: Record<StampTone, string> = {
  ink: "",
  vermilion: "tag-b",
  b: "tag-b",
  gain: "tag-gain",
  a: "tag-a",
};

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
    <span className={cx("tag", TONE[tone], className)} title={title}>
      {children}
    </span>
  );
}

/** LIVE with a pulsing dot while open, SETTLED once resolved. */
export function StatusStamp({ market, className }: { market: Market; className?: string }) {
  if (market.status.kind === "resolved") {
    return <Stamp className={className}>Settled</Stamp>;
  }
  return (
    <Stamp tone="gain" className={cx("tag-live", className)}>
      Live
    </Stamp>
  );
}
