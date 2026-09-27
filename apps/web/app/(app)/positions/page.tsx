"use client";

import { useState } from "react";
import Link from "next/link";
import type { Market, Position } from "@/lib/types";
import { useBalance, useMarkets, usePositions, useRedeem } from "@/lib/hooks";
import { useOwner } from "@/lib/owner";
import { amount, signedPct, token, usd } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Reveal } from "@/components/Reveal";
import { MarketMatchup } from "@/components/Matchup";
import { Button, LinkButton } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { StatusLine, IDLE, type Status } from "@/components/StatusLine";
import { WalletButton } from "@/components/WalletButton";
import { Stamp, StatusStamp } from "@/components/Stamp";

function PositionCard({ p, m, i, owner }: { p: Position; m: Market; i: number; owner: string }) {
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
    <Reveal as="li" i={i} className="card card-pad flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-6">
      <div className="lg:col-span-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Stamp tone={p.side}>{f.label} side</Stamp>
          <StatusStamp market={m} />
          {resolved ? <Stamp tone={won ? "gain" : "ink"}>{won ? "Won" : "Lost"}</Stamp> : null}
        </div>
        <Link href={`/d/${m.id}`} className="block mt-3 w-fit hover:underline underline-offset-4 decoration-1 decoration-fg-3">
          <MarketMatchup market={m} size="lg" as="h2" />
        </Link>
      </div>

      <dl className="dl lg:col-span-2">
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

      <dl className="dl lg:col-span-3">
        <dt>Earned</dt>
        <dd className="tnum whitespace-nowrap">{token(p.earnedPair, f.pairSymbol)}</dd>
        <dt>{resolved ? "Claim" : "Accruing"}</dt>
        <dd className="tnum whitespace-nowrap">
          {resolved ? usd(p.redeemableUsdc) : token(p.claimablePair, f.pairSymbol)}
        </dd>
      </dl>

      <div className="lg:col-span-2 flex flex-col gap-2 lg:items-end">
        {resolved ? (
          won && p.redeemableUsdc > 0 ? (
            <Button variant="primary" side={p.side} size="sm" onClick={doRedeem} disabled={redeem.isPending}>
              Redeem {usd(p.redeemableUsdc)}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Nothing to redeem</span>
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tnum">{value}</p>
    </div>
  );
}

export default function PositionsPage() {
  const { owner, demoAvailable, connectDemo } = useOwner();
  const positions = usePositions(owner);
  const markets = useMarkets();
  const balance = useBalance(owner);

  const header = (
    <div>
      <p className="font-mono text-sm uppercase text-muted-foreground">Your corners</p>
      <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">Positions</h1>
    </div>
  );

  if (!owner) {
    return (
      <>
        {header}
        <EmptyState
          className="mt-10"
          actionNode={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <WalletButton variant="primary" />
              {demoAvailable ? (
                <Button variant="ghost" onClick={connectDemo}>
                  Use the demo wallet
                </Button>
              ) : null}
            </div>
          }
        >
          Connect a wallet to see every side you hold, what it has earned, and what you can redeem.
        </EmptyState>
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

  const earned = new Map<string, number>();
  for (const { p, m } of rows) {
    const sym = p.side === "a" ? m.a.pairSymbol : m.b.pairSymbol;
    earned.set(sym, (earned.get(sym) ?? 0) + p.earnedPair);
  }
  const redeemable = rows.reduce((s, r) => s + r.p.redeemableUsdc, 0);
  const value = rows.reduce((s, r) => s + r.p.value, 0);

  return (
    <>
      {header}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Balance" value={`${amount(balance.data?.usdc ?? 0)} USDC`} />
        <Stat label="Positions" value={`${rows.length} across ${new Set(rows.map((r) => r.m.id)).size} duels`} />
        <Stat label="Value" value={usd(value)} />
        <Stat
          label="Earned"
          value={
            earned.size === 0 ? (
              <span className="text-muted-foreground">nothing yet</span>
            ) : (
              <span className="flex flex-col text-lg leading-tight">
                {[...earned.entries()].map(([sym, v]) => (
                  <span key={sym}>{token(v, sym)}</span>
                ))}
              </span>
            )
          }
        />
      </div>
      {redeemable > 0 ? (
        <p className="mt-4 text-sm text-side-a">{usd(redeemable)} is waiting to be redeemed.</p>
      ) : null}

      {positions.isPending ? (
        <p className="mt-10 text-sm text-muted-foreground" role="status">
          Counting your positions.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState className="mt-10" action={{ label: "Go to the board", href: "/board" }}>
          No positions yet. Pick a duel on the board and back a side.
        </EmptyState>
      ) : (
        <ol className="mt-8 flex flex-col gap-3">
          {rows.map((r, i) => (
            <PositionCard key={`${r.m.id}:${r.p.side}`} p={r.p} m={r.m} i={i} owner={owner} />
          ))}
        </ol>
      )}
    </>
  );
}
