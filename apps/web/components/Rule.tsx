import { cx } from "@/lib/cx";

/** Broadsheet rules. "double" breaks sections; "hair" separates sub-sections; "ink" is a strong single. */
export function Rule({ kind = "hair", className }: { kind?: "double" | "hair" | "ink"; className?: string }) {
  const k = kind === "double" ? "double" : kind === "ink" ? "rule-ink" : "rule";
  return <hr className={cx(k, className)} />;
}

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
    <div className={cx("mb-5", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="label">{children}</h2>
        {aside ? <div className="text-xs text-ink-2">{aside}</div> : null}
      </div>
      <hr className="double mt-2" />
    </div>
  );
}
