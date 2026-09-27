"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { cx } from "@/lib/cx";

/** A dotted-underlined term with a paper tooltip. Behaviour from Radix, skin ours. */
export function Tip({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <span tabIndex={0} className={cx("term", className)}>
          {children}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tip" side="top" align="start" sideOffset={6} collisionPadding={12}>
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
