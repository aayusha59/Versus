"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cx } from "@/lib/cx";
import type { Odds, Side } from "@/lib/types";
import { amount, oddsNum, utcClock } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Split-flap digit                                                    */
/* ------------------------------------------------------------------ */

function Flap({ digit, index }: { digit: string; index: number }) {
  const [cur, setCur] = useState(digit);
  const [prev, setPrev] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    if (digit === cur) return;
    setPrev(cur);
    setCur(digit);
    setFlipping(true);
    setGen((g) => g + 1);
  }, [digit, cur]);

  return (
    <span className="flap" style={{ "--d": `${index * 30}ms` } as CSSProperties}>
      {prev !== null ? (
        <span key={`out-${gen}`} className="flap-face flap-out" onAnimationEnd={() => setPrev(null)}>
          {prev}
        </span>
      ) : null}
      <span
        key={`in-${gen}`}
        className={cx("flap-face", flipping && "flap-in")}
        onAnimationEnd={() => setFlipping(false)}
      >
        {cur}
      </span>
    </span>
  );
}

export function Flaps({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <span className={cx("flaps", className)} role="img" aria-label={label}>
      {value.split("").map((d, i) => (
        <Flap key={i} digit={d} index={i} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

interface ToteBoardProps {
  aLabel: string;
  bLabel: string;
  odds: Odds;
  /** Line under the numerals: "Apple leads 54-46." */
  subline: string;
  winner?: Side | null;
  updatedAt?: number;
  size?: "board" | "compact";
  className?: string;
}

/**
 * Two big numerals in a card, green left and red right, side names small above, a thin
 * centre rule, and a sports-page line under. Digits are split-flap cells.
 */
export function ToteBoard({
  aLabel,
  bLabel,
  odds,
  subline,
  winner = null,
  updatedAt,
  size = "board",
  className,
}: ToteBoardProps) {
  const pa = Math.round(odds.a * 100);
  const a = oddsNum(odds.a);
  const b = oddsNum(odds.b);
  const settled = winner !== null;
  const numeral = cx("tnum font-medium leading-none", size === "board" ? "text-board" : "text-2xl");

  return (
    <div className={cx("card select-none", className)}>
      <div className="grid grid-cols-[1fr_1px_1fr] items-stretch pt-6 pb-4 px-3">
        <div className={cx("text-center px-2", settled && winner === "b" && "opacity-40")}>
          <div className="label text-side-a truncate">{aLabel}</div>
          <div className={cx(numeral, "text-side-a mt-3")}>
            <Flaps value={a} label={`${aLabel} ${pa} percent`} />
          </div>
        </div>
        <div className="bg-line-2 my-2" aria-hidden="true" />
        <div className={cx("text-center px-2", settled && winner === "a" && "opacity-40")}>
          <div className="label text-side-b truncate">{bLabel}</div>
          <div className={cx(numeral, "text-side-b mt-3")}>
            <Flaps value={b} label={`${bLabel} ${100 - pa} percent`} />
          </div>
        </div>
      </div>
      <p className="text-center text-sm font-medium px-4 pb-4">{subline}</p>
      <div className="flex items-baseline justify-between gap-4 px-4 py-3 border-t border-line label text-fg-3">
        <span aria-label={`implied total ${amount(odds.impliedSum * 100, 1)} percent`}>
          Implied {amount(odds.impliedSum * 100, 1)}
        </span>
        {updatedAt ? (
          <span suppressHydrationWarning>{settled ? "Final" : `Set ${utcClock(updatedAt)}`}</span>
        ) : (
          <span>{settled ? "Final" : "Opening line"}</span>
        )}
      </div>
    </div>
  );
}
