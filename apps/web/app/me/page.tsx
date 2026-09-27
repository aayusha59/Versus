"use client";

import { useState } from "react";
import Link from "next/link";
import type { Market, Position } from "@/lib/types";
import { useBalance, useMarkets, usePositions, useRedeem } from "@/lib/hooks";
import { useOwner } from "@/lib/owner";
import { amount, signedPct, token, usd, MIDDOT } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Reveal } from "@/components/Reveal";
import { MarketMatchup } from "@/components/Matchup";
import { Button, LinkButton } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { StatusLine, IDLE, type Status } from "@/components/StatusLine";
import { WalletButton } from "@/components/WalletButton";
import { Stamp } from "@/components/Stamp";

function CornerRow({ p, m, i, owner }: { p: Position; m: Market; i: number; owner: string }) {
  const redeem = useRedeem();
  const [status, setStatus] = useState<Status>(IDLE);
  const f = p.side === "a" ? m.a : m.b;
  const resolved = m.status.kind === "resolved";
  const won = m.status.kind === "resolved" && m.status.winner === p.side;
  const pnl = p.cost > 0 ? (p.value - p.cost) / p.cost : 0;

  const doRedeem = async () => {
    setStatus({ state: "pending", text: `Redeeming ${amount(p.size)} ${f.label}.` });
    try {
      const r = await redeem.mutateAsync({ id: m.id, owner });
      setStatus({ state: "ok", text: `Redeemed ${usd(p.size)}.`, sig: r.signature });
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "The chain did not answer." });
    }
  };

  return (
    <Reveal as="li" i={i} className="py-6 lg:grid lg:grid-cols-12 lg:gap-x-[var(--gap)] lg:items-start">
      <div className="lg:col-span-4">
        <div className="flex items-center gap-2 label">
          <span className={cx("font-semibold", p.side === "a" ? "text-side-a" : "text-side-b")}>{f.label} corner</span>
          <span aria-hidden="true">{MIDDOT}</span>
          <span className="tnum">No. {String(m.no).padStart(2, "0")}</span>
          {resolved ? (
            <Stamp tone={won ? "gain" : "ink"} className="ml-2">
              {won ? "Won" : "Lost"}
            </Stamp>
          ) : null}
        </div>
        <Link href={`/d/${m.id}`} className="block mt-2 w-fit">
          <MarketMatchup market={m} size="lg" as="h2" />
        </Link>
      </div>

      <dl className="dl lg:col-span-3 mt-4 lg:mt-0">
        <dt>Size</dt>
        <dd className="tnum whitespace-nowrap">
          {amount(p.size)} {f.label}
        </dd>
        <dt>Value</dt>
        <dd className="tnum whitespace-nowrap">
          {usd(p.value)}{" "}
          {!resolved ? (
            <span className={cx("text-xs", pnl >= 0 ? "text-gain" : "text-loss")}>{signedPct(pnl)}</span>
          ) : null}
        </dd>
      </dl>

      <dl className="dl lg:col-span-3 mt-3 lg:mt-0">
        <dt>Earned</dt>
        <dd className="tnum whitespace-nowrap">{token(p.earnedPair, f.pairSymbol)}</dd>
        <dt>{resolved ? "Claim" : "Accruing"}</dt>
        <dd className="tnum whitespace-nowrap">
          {resolved ? usd(p.redeemableUsdc) : token(p.claimablePair, f.pairSymbol)}
        </dd>
      </dl>

      <div className="lg:col-span-2 mt-4 lg:mt-0 flex flex-col gap-2 lg:items-end">
        {resolved ? (
          won && p.redeemableUsdc > 0 ? (
            <Button variant="primary" side={p.side} size="sm" onClick={doRedeem} disabled={redeem.isPending}>
              Redeem {usd(p.redeemableUsdc)}
            </Button>
          ) : (
            <span className="text-sm text-ink-3">Nothing to redeem</span>
          )
        ) : (
          <LinkButton href={`/d/${m.id}`} variant="outline" size="sm">
            Trade
          </LinkButton>
        )}
        <StatusLine status={status} network={m.network} className="text-xs lg:text-right" />
      </div>
    </Reveal>
  );
}

export default function MePage() {
  const { owner, demoAvailable, connectDemo } = useOwner();
  const positions = usePositions(owner);
  const markets = useMarkets();
  const balance = useBalance(owner);

  const header = (
    <Reveal as="header" i={0} className="pt-8 lg:pt-12">
      <h1 className="display text-2xl">My corners</h1>
    </Reveal>
  );

  if (!owner) {
    return (
      <>
        {header}
        <Reveal i={1}>
          <hr className="double mt-5" />
          <EmptyState
            actionNode={
              <div className="flex flex-wrap items-center gap-3">
                <WalletButton variant="outline" />
                {demoAvailable ? (
                  <Button variant="ghost" onClick={connectDemo}>
                    Use the demo corner
                  </Button>
                ) : null}
              </div>
            }
          >
            Connect a wallet to see your corners: every side you hold, what it has earned, and what you can redeem.
          </EmptyState>
        </Reveal>
      </>
    );
  }

  const rows = (positions.data ?? [])
    .map((p) => ({ p, m: markets.data?.find((m) => m.id === p.marketId) }))
    .filter((r): r is { p: Position; m: Market } => !!r.m)
    .sort((x, y) => {
      const xr = x.m.status.kind === "resolved" ? 1 : 0;
      const yr = y.m.status.kind === "resolved" ? 1 : 0;
      return xr - yr || x.m.no - y.m.no;
    });

  const duels = new Set(rows.map((r) => r.m.id)).size;
  const earned = new Map<string, number>();
  for (const { p, m } of rows) {
    const sym = p.side === "a" ? m.a.pairSymbol : m.b.pairSymbol;
    earned.set(sym, (earned.get(sym) ?? 0) + p.earnedPair);
  }
  const earnedLine =
    earned.size === 0
      ? "nothing yet"
      : [...earned.entries()].map(([sym, v]) => token(v, sym)).join(` ${MIDDOT} `);
  const redeemable = rows.reduce((s, r) => s + r.p.redeemableUsdc, 0);

  return (
    <>
      {header}
      <Reveal i={1}>
        <p className="serif text-xl mt-4 max-w-[40ch] balance-text">
          {rows.length === 1 ? "One corner" : `${rows.length} corners`} across{" "}
          {duels === 1 ? "one duel" : `${duels} duels`}. Earned {earnedLine}.
          {redeemable > 0 ? ` ${usd(redeemable)} waiting to be redeemed.` : ""}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm tnum">
          <span>
            <span className="text-ink-2">Balance</span> {amount(balance.data?.usdc ?? 0)} USDC
          </span>
          {Object.entries(balance.data?.pair ?? {}).map(([sym, v]) => (
            <span key={sym}>
              <span className="text-ink-2">Holding</span> {token(v, sym)}
            </span>
          ))}
        </div>
        <hr className="double mt-5" />
      </Reveal>

      {positions.isPending ? (
        <p className="pt-8 text-sm text-ink-2" role="status">
          Counting your corners.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState action={{ label: "Go to the board", href: "/" }}>
          No corners yet. Pick a duel on the board and back a side.
        </EmptyState>
      ) : (
        <ol className="hairline-rows">
          {rows.map((r, i) => (
            <CornerRow key={`${r.m.id}:${r.p.side}`} p={r.p} m={r.m} i={i + 2} owner={owner} />
          ))}
        </ol>
      )}
    </>
  );
}
