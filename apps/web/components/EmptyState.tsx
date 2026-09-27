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
    <div className={cx("card px-6 py-12 flex flex-col items-center text-center", className)}>
      <p className="serif text-xl max-w-[34ch] balance-text">{children}</p>
      {actionNode ? (
        <div className="mt-6">{actionNode}</div>
      ) : action ? (
        <div className="mt-6">
          {action.href ? (
            <LinkButton href={action.href} variant="bracket">
              {action.label}
            </LinkButton>
          ) : (
            <Button variant="bracket" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
