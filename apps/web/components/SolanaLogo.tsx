import { cx } from "@/lib/cx";

/** The three-bar Solana mark, gradient from purple to green. */
export function SolanaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 398 312" className={cx("inline-block", className)} aria-hidden="true">
      <defs>
        <linearGradient id="sol-g" x1="360.9" y1="-37.5" x2="141.2" y2="383.3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3" />
          <stop offset="1" stopColor="#dc1fff" />
        </linearGradient>
      </defs>
      <path
        fill="url(#sol-g)"
        d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      />
      <path
        fill="url(#sol-g)"
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      />
      <path
        fill="url(#sol-g)"
        d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      />
    </svg>
  );
}

/** Mark plus wordmark, for the "powered by" row. */
export function SolanaLogo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)} aria-label="Solana">
      <SolanaMark className="h-5 w-auto" />
      <span className="font-semibold tracking-[0.18em] uppercase text-fg text-md leading-none">Solana</span>
    </span>
  );
}
