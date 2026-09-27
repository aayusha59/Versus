import { cx } from "@/lib/cx";

/** Two opposed marks plus the name in mono, the way the template pairs its logo and label. */
export function Wordmark({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 28 20" className="h-4 w-auto text-fg" aria-hidden="true">
        <path d="M1 1h6l7 12 7-12h6L17 19h-6L1 1z" fill="currentColor" />
      </svg>
      {iconOnly ? null : <span className="font-mono text-sm">VERSUS</span>}
    </span>
  );
}
