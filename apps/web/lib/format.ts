/**
 * Number and time formatting. Everything is en-US and UTC so server and client agree.
 * Numerals are rendered in tabular figures by the global stylesheet.
 */

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdWholeFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numFmt = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

const n0 = numFmt(0, 0);
const n2 = numFmt(2, 2);
const n4 = numFmt(0, 4);

export const EN_DASH = "\u2013";
export const MIDDOT = "\u00b7";
export const ELLIPSIS = "\u2026";
export const MINUS = "\u2212";

/** "$291.20"; whole dollars above 10k: "$109,420" */
export function usd(v: number, opts: { whole?: boolean } = {}): string {
  if (opts.whole || Math.abs(v) >= 10_000) return usdWholeFmt.format(v);
  return usdFmt.format(v);
}

/** "$4.30T", "$47.1B", "$820M" */
export function compactUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (abs >= 1e12) return `${sign}$${trim(abs / 1e12, 2)}T`;
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9, abs >= 1e11 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6, 0)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3, 1)}K`;
  return usd(v);
}

/** "14.78B", "3.22B", "310M" */
export function compactCount(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${trim(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${trim(abs / 1e6, 0)}M`;
  if (abs >= 1e3) return `${trim(abs / 1e3, 1)}K`;
  return n0.format(v);
}

function trim(v: number, digits: number): string {
  return numFmt(0, digits).format(v);
}

/** "3.10 AAPLx"; small amounts keep up to 4 decimals: "0.0034 AAPLx" */
export function token(v: number, symbol: string, opts: { dp?: number } = {}): string {
  const dp = opts.dp;
  let s: string;
  if (dp !== undefined) s = numFmt(dp, dp).format(v);
  else if (v !== 0 && Math.abs(v) < 0.01) s = n4.format(v);
  else s = n2.format(v);
  return `${s} ${symbol}`;
}

/** "1,000.00" */
export function amount(v: number, dp = 2): string {
  return numFmt(dp, dp).format(v);
}

/** 0.54 -> "54" (tote numerals) */
export function oddsNum(p: number): string {
  return String(Math.round(clamp01(p) * 100)).padStart(2, "0");
}

/** 0.54 -> "54-46" with an en dash */
export function oddsPair(a: number): string {
  const x = Math.round(clamp01(a) * 100);
  return `${x}${EN_DASH}${100 - x}`;
}

/** Start ratios: "27.76" at or above 1, three significant digits below it: "0.00306". */
export function ratio(v: number): string {
  if (v >= 1) return n2.format(v);
  const s = v.toPrecision(3);
  return s.includes("e") ? v.toFixed(6) : s.replace(/(.d*?[1-9])0+$/, "$1").replace(/.0+$/, "");
}

/** 0.54 -> "54%" */
export function pct(p: number, dp = 0): string {
  return `${numFmt(dp, dp).format(p * 100)}%`;
}

/** +0.062 -> "+6.2%", -0.031 -> "-3.1%" (typographic minus) */
export function signedPct(p: number, dp = 1): string {
  const s = numFmt(dp, dp).format(Math.abs(p) * 100);
  return p < 0 ? `${MINUS}${s}%` : `+${s}%`;
}

/** 100 -> "1.00%", 30 -> "0.30%" */
export function bpsPct(bps: number): string {
  return `${n2.format(bps / 100)}%`;
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "14:20 UTC" */
export function utcTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "14:20:04 UTC" */
export function utcClock(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** "Dec 31, 21:00 UTC" */
export function utcDateTime(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "Dec 31, 2026" */
export function utcDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Sep 26" */
export function utcShortDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Sep 26 - 14:20 UTC" with a middle dot */
export function utcStamp(ts: number): string {
  return `${utcShortDate(ts)} ${MIDDOT} ${utcTime(ts)}`;
}

/** "2026-12-31T21:00" for datetime-local inputs, in UTC. */
export function utcInputValue(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function parseUtcInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** "96d 4h", "4h 12m", "12m", "settling" (past) */
export function resolvesIn(resolveTs: number, now: number): string {
  const ms = resolveTs - now;
  if (ms <= 0) return "settling";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}

/** "5Kz3...9QwT" with an ellipsis */
export function shortSig(sig: string, head = 4, tail = 4): string {
  if (sig.length <= head + tail + 1) return sig;
  return `${sig.slice(0, head)}${ELLIPSIS}${sig.slice(-tail)}`;
}

export function shortKey(key: string): string {
  return shortSig(key, 4, 4);
}

/** Explorer link. Localnet points the explorer at the local RPC through `customUrl`. */
export function explorerTx(sig: string, network: "demo" | "devnet" | "localnet" = "devnet"): string {
  if (network === "localnet") {
    const rpc = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8999";
    return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(rpc)}`;
  }
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

/** Two-letter side label for ledgers: "A" / "B" is meaningless to a reader, so use the fighter. */
export function sideLabel<T extends { a: { label: string }; b: { label: string } }>(m: T, side: "a" | "b"): string {
  return side === "a" ? m.a.label : m.b.label;
}
