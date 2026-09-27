import { cx } from "@/lib/cx";
import { explorerTx, shortSig } from "@/lib/format";
import type { Network } from "@/lib/types";

export type StatusState = "idle" | "pending" | "ok" | "error";

export interface Status {
  state: StatusState;
  text?: string;
  sig?: string;
}

export const IDLE: Status = { state: "idle" };

/**
 * Inline status under an action. Replaces toasts: a marker square, a sentence, and the
 * signature when there is one. aria-live so screen readers hear the confirmation.
 */
export function StatusLine({
  status,
  network = "demo",
  className,
}: {
  status: Status;
  network?: Network;
  className?: string;
}) {
  const { state, text, sig } = status;
  const marker =
    state === "pending"
      ? "bg-ink-3 pulse"
      : state === "ok"
        ? "bg-gain"
        : state === "error"
          ? "bg-vermilion"
          : "bg-transparent";
  return (
    <p
      role="status"
      aria-live="polite"
      className={cx("flex items-start gap-2 text-sm min-h-[1.5em]", state === "idle" && "invisible", className)}
    >
      <span aria-hidden="true" className={cx("mt-[0.45em] h-2 w-2 flex-none", marker)} />
      <span className={cx(state === "error" ? "text-vermilion" : "text-ink")}>
        {text}
        {sig ? (
          <>
            {" "}
            {network !== "demo" ? (
              <a className="link" href={explorerTx(sig, network)} target="_blank" rel="noreferrer">
                {shortSig(sig)}
              </a>
            ) : (
              <span className="text-ink-2" title={sig}>
                {shortSig(sig)}
              </span>
            )}
          </>
        ) : null}
      </span>
    </p>
  );
}
