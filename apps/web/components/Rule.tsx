import { cx } from "@/lib/cx";

/** Hairlines. "double"/"ink" are the stronger line, "hair" the faint one. */
export function Rule({ kind = "hair", className }: { kind?: "double" | "hair" | "ink"; className?: string }) {
  const k = kind === "hair" ? "rule" : "rule-ink";
  return <hr className={cx(k, className)} />;
}

/** A section title with an optional right-hand aside, underlined once. */
export function SectionHead({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-4 flex items-baseline justify-between gap-4 pb-3 border-b border-line-2", className)}>
      <h2 className="label text-fg">{children}</h2>
      {aside ? <div className="text-xs text-fg-3 tnum">{aside}</div> : null}
    </div>
  );
}
