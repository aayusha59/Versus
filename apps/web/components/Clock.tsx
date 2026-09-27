"use client";

import { useNow } from "@/lib/hooks";
import { utcClock } from "@/lib/format";
import { cx } from "@/lib/cx";

/** The operator clock. Always UTC; renders dashes until mounted so SSR markup matches. */
export function Clock({ className, label = true }: { className?: string; label?: boolean }) {
  const now = useNow(1000);
  const text = now ? utcClock(now) : "--:--:-- UTC";
  return (
    <div className={cx("flex flex-col", className)}>
      {label ? <span className="label">Operator clock</span> : null}
      <time
        dateTime={now ? new Date(now).toISOString() : undefined}
        className="text-sm font-medium tnum"
        aria-label={now ? `${text.replace(" UTC", "")} coordinated universal time` : "clock loading"}
      >
        {text}
      </time>
    </div>
  );
}
