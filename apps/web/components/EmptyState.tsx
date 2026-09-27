import { Button, LinkButton } from "./Button";
import { cx } from "@/lib/cx";

interface EmptyStateProps {
  /** One sentence that teaches the next action. */
  children: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  /** A custom control in place of `action`, e.g. the wallet button. */
  actionNode?: React.ReactNode;
  className?: string;
}

export function EmptyState({ children, action, actionNode, className }: EmptyStateProps) {
  return (
    <div className={cx("py-10", className)}>
      <p className="serif text-xl max-w-[34ch] balance-text">{children}</p>
      {actionNode ? (
        <div className="mt-5">{actionNode}</div>
      ) : action ? (
        <div className="mt-5">
          {action.href ? (
            <LinkButton href={action.href} variant="outline">
              {action.label}
            </LinkButton>
          ) : (
            <Button variant="outline" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
