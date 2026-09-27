import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Schematics for the How it works page. Plain inline SVG styled with the app tokens: hairline
 * strokes, side A green, side B red, Geist Mono labels. Below its minimum width a figure scrolls
 * sideways instead of shrinking its type.
 */

type Side = "a" | "b";

const NODE = {
  n: { rect: "fill-background stroke-line-2", title: "text-foreground" },
  a: { rect: "fill-[var(--a-tint)] stroke-side-a", title: "text-side-a" },
  b: { rect: "fill-[var(--b-tint)] stroke-side-b", title: "text-side-b" },
} as const;

const LINE_H = 13;

/** A rounded box with a title and optional mono sub-lines, all centred. */
function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  side,
  dashed,
  mono,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string | string[];
  side?: Side;
  dashed?: boolean;
  mono?: boolean;
}) {
  const k = NODE[side ?? "n"];
  const lines = sub === undefined ? [] : Array.isArray(sub) ? sub : [sub];
  const first = y + h / 2 - (lines.length * LINE_H) / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        strokeWidth={1}
        strokeDasharray={dashed ? "3 3" : undefined}
        className={k.rect}
      />
      <text
        x={x + w / 2}
        y={first}
        textAnchor="middle"
        dominantBaseline="middle"
        className={cx("fill-current", mono ? "font-mono text-[11px]" : "text-[12px] font-medium", k.title)}
      >
        {title}
      </text>
      {lines.map((l, i) => (
        <text
          key={`${i}-${l}`}
          x={x + w / 2}
          y={first + (i + 1) * LINE_H}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current font-mono text-[10px] text-fg-2"
        >
          {l}
        </text>
      ))}
    </g>
  );
}

/** A dashed outline grouping several nodes, titled top-left. */
function Region({ x, y, w, h, title }: { x: number; y: number; w: number; h: number; title: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} strokeWidth={1} strokeDasharray="4 3" className="fill-none stroke-line-2" />
      <text x={x + 12} y={y + 15} className="fill-current font-mono text-[10px] text-fg-3">
        {title}
      </text>
    </g>
  );
}

/** A hairline path with an arrowhead (`plain` for none, `both` for two). */
function Arrow({
  id,
  d,
  side,
  both,
  dashed,
  plain,
}: {
  id: string;
  d: string;
  side?: Side;
  both?: boolean;
  dashed?: boolean;
  plain?: boolean;
}) {
  const m = `url(#${id}-${side ?? "n"})`;
  return (
    <path
      d={d}
      strokeWidth={1}
      strokeDasharray={dashed ? "3 3" : undefined}
      markerEnd={plain ? undefined : m}
      markerStart={both ? m : undefined}
      className={cx("fill-none", side === "a" ? "stroke-side-a" : side === "b" ? "stroke-side-b" : "stroke-fg-3")}
    />
  );
}

function Label({
  x,
  y,
  anchor = "start",
  side,
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  side?: Side;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={cx("fill-current font-mono text-[10px]", side === "a" ? "text-side-a" : side === "b" ? "text-side-b" : "text-fg-2")}
    >
      {children}
    </text>
  );
}

/** One arrowhead per colour; `orient` lets the same marker sit at either end of a path. */
function Heads({ id }: { id: string }) {
  return (
    <defs>
      {(["n", "a", "b"] as const).map((k) => (
        <marker
          key={k}
          id={`${id}-${k}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className={k === "a" ? "fill-side-a" : k === "b" ? "fill-side-b" : "fill-fg-3"} />
        </marker>
      ))}
    </defs>
  );
}

function Figure({ viewBox, minWidth, label, children }: { viewBox: string; minWidth: number; label: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <svg viewBox={viewBox} role="img" aria-label={label} className="h-auto w-full" style={{ minWidth }}>
        {children}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ figures */

/** Every program and account a duel touches, and which instruction moves what between them. */
export function SystemMap() {
  const id = "sys";
  return (
    <Figure
      viewBox="0 0 640 414"
      minWidth={560}
      label="System map: your wallet, the duel program with its market account and vaults, the four Meteora pools, and the Pyth receiver."
    >
      <Heads id={id} />

      <Node x={440} y={20} w={180} h={54} title="Pyth receiver" sub="PriceUpdateV2 accounts" dashed />
      <Arrow id={id} d="M530 74 V120" />
      <Label x={538} y={101}>resolve</Label>

      <Region x={300} y={120} w={320} h={150} title="duel program" />
      <Node x={312} y={150} w={140} h={44} title="Market PDA" sub="mints YES and NO" />
      <Node x={462} y={150} w={148} h={44} title="Collateral vault" sub="USDC" />
      <Node x={312} y={206} w={140} h={44} title="Reward vault A" sub="AAPLx" side="a" />
      <Node x={462} y={206} w={148} h={44} title="Reward vault B" sub="NVDAx" side="b" />

      <Node x={20} y={150} w={140} h={100} title="Your wallet" sub={["USDC", "YES / NO", "AAPLx / NVDAx"]} />
      <Arrow id={id} d="M160 166 H300" both />
      <Label x={230} y={158} anchor="middle">mint_set, merge_set</Label>
      <Arrow id={id} d="M300 200 H160" />
      <Label x={230} y={192} anchor="middle">redeem</Label>
      <Arrow id={id} d="M312 234 H160" />
      <Label x={230} y={226} anchor="middle">distribute</Label>

      <Arrow id={id} d="M90 250 V320" both />
      <Label x={98} y={289}>swap</Label>

      <Region x={20} y={320} w={600} h={84} title="Meteora DAMM v2 pools" />
      <Node x={32} y={352} w={130} h={40} title="USDC / AAPLx" />
      <Node x={172} y={352} w={130} h={40} title="YES / AAPLx" side="a" />
      <Node x={330} y={352} w={130} h={40} title="USDC / NVDAx" />
      <Node x={470} y={352} w={130} h={40} title="NO / NVDAx" side="b" />

      <Arrow id={id} d="M237 352 V296 H382 V250" side="a" />
      <Label x={250} y={309} side="a">fees in AAPLx, claimed by the crank</Label>
      <Arrow id={id} d="M535 352 V250" side="b" />
      <Label x={543} y={300} side="b">fees in NVDAx</Label>
    </Figure>
  );
}

/** mint_set and merge_set: one USDC against one YES plus one NO. */
export function MintSet() {
  const id = "mint";
  return (
    <Figure
      viewBox="0 0 560 190"
      minWidth={480}
      label="Mint a set: one USDC goes into the collateral vault and one YES plus one NO come back. Merge reverses it."
    >
      <Heads id={id} />
      <Node x={40} y={40} w={120} h={54} title="1 USDC" />
      <Arrow id={id} d="M160 56 H300" />
      <Label x={230} y={48} anchor="middle">mint_set</Label>
      <Arrow id={id} d="M300 78 H160" />
      <Label x={230} y={92} anchor="middle">merge_set</Label>
      <Node x={300} y={40} w={90} h={54} title="1 YES" side="a" />
      <text x={405} y={67} textAnchor="middle" dominantBaseline="middle" className="fill-current text-[14px] text-fg-2">
        +
      </text>
      <Node x={420} y={40} w={90} h={54} title="1 NO" side="b" />
      <Label x={405} y={118} anchor="middle">one set, redeems for exactly 1 USDC</Label>
      <Arrow id={id} d="M100 94 V130" />
      <Label x={108} y={116}>held by the market PDA</Label>
      <Node x={40} y={130} w={120} h={50} title="Collateral vault" sub="USDC" />
    </Figure>
  );
}

/** The two-hop bet route on the Apple side, with the fee tap on the second pool. */
export function BetRoute() {
  const id = "bet";
  return (
    <Figure
      viewBox="0 0 600 200"
      minWidth={540}
      label="Bet route: USDC swaps to AAPLx in the USDC/AAPLx pool, then AAPLx swaps to YES in the YES/AAPLx pool, which keeps its fee in AAPLx for YES holders."
    >
      <Heads id={id} />
      <Label x={185} y={28} anchor="middle">swap 1</Label>
      <Label x={445} y={28} anchor="middle">swap 2</Label>
      <Node x={10} y={50} w={80} h={44} title="USDC" />
      <Arrow id={id} d="M90 72 H120" />
      <Node x={120} y={40} w={130} h={64} title="USDC / AAPLx" sub={["pool", "fee in USDC"]} />
      <Arrow id={id} d="M250 72 H280" />
      <Node x={280} y={50} w={70} h={44} title="AAPLx" />
      <Arrow id={id} d="M350 72 H380" />
      <Node x={380} y={40} w={130} h={64} title="YES / AAPLx" sub={["pool", "quote-only fee"]} side="a" />
      <Arrow id={id} d="M510 72 H540" side="a" />
      <Node x={540} y={50} w={50} h={44} title="YES" side="a" />
      <Arrow id={id} d="M445 104 V140" side="a" />
      <Node x={365} y={140} w={160} h={50} title="Fee, in AAPLx" sub="paid to YES holders" side="a" />
    </Figure>
  );
}

/** One crank epoch for a side: claim, deposit, snapshot, distribute, event. */
export function CrankPipeline() {
  const id = "crank";
  return (
    <Figure
      viewBox="0 0 620 120"
      minWidth={560}
      label="Crank pipeline: claim pool fees, deposit them into the reward vault, snapshot holders, distribute pro rata in chunks of twelve, emit a RewardsPaid event."
    >
      <Heads id={id} />
      <Node x={0} y={20} w={108} h={54} title="Claim fees" sub="pool fees, AAPLx" />
      <Arrow id={id} d="M108 47 H128" side="a" />
      <Node x={128} y={20} w={108} h={54} title="deposit_rewards" mono sub="reward vault A" />
      <Arrow id={id} d="M236 47 H256" side="a" />
      <Node x={256} y={20} w={108} h={54} title="Snapshot holders" sub="every YES account" />
      <Arrow id={id} d="M364 47 H384" />
      <Node x={384} y={20} w={108} h={54} title="distribute" mono sub={["pro rata", "12 per call"]} />
      <Arrow id={id} d="M492 47 H512" side="a" />
      <Node x={512} y={20} w={108} h={54} title="RewardsPaid" mono sub="event" />

      <Label x={54} y={100} anchor="middle">operator key</Label>
      <Label x={182} y={100} anchor="middle">into vault A</Label>
      <Label x={310} y={100} anchor="middle">not pools or vaults</Label>
      <Label x={438} y={100} anchor="middle">{"crank key, sum ≤ vault"}</Label>
      <Label x={566} y={100} anchor="middle">read by the ledger</Label>
    </Figure>
  );
}

/** Permissionless resolution from Pyth on top, the resolver fallback below. */
export function ResolveFlow() {
  const id = "res";
  return (
    <Figure
      viewBox="0 0 600 220"
      minWidth={540}
      label="Resolution: Hermes serves signed prices, the Pyth receiver writes PriceUpdateV2 accounts, resolve checks them and stores the winner. After the grace period the resolver key can call resolve_manual."
    >
      <Heads id={id} />
      <Node x={10} y={30} w={120} h={54} title="Pyth Hermes" sub="signed prices" />
      <Arrow id={id} d="M130 57 H160" />
      <Node x={160} y={30} w={130} h={54} title="Pyth receiver" sub="writes PriceUpdateV2" dashed />
      <Arrow id={id} d="M290 57 H320" />
      <Node x={320} y={30} w={120} h={54} title="resolve" mono sub={["anyone", "after resolve_ts"]} />
      <Arrow id={id} d="M440 57 H470" />
      <Node x={470} y={30} w={120} h={54} title="Resolved" sub={["winner", "prices, time"]} />

      <Arrow id={id} d="M380 84 V112" plain />
      <Node
        x={270}
        y={112}
        w={180}
        h={98}
        dashed
        title="resolve checks"
        sub={["owner is the Pyth receiver", "full verification", "feed id matches", "price age under 6 h"]}
      />

      <Arrow id={id} d="M530 156 V84" dashed />
      <Node x={470} y={156} w={120} h={54} title="resolve_manual" mono sub={["resolver key", "after the grace"]} />
    </Figure>
  );
}
