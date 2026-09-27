"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import type { Market, Position } from "@/lib/types";
import { useLedger, useMarket, useNow, useOddsHistory, usePositions, useRedeem } from "@/lib/hooks";
import { useOwner } from "@/lib/owner";
import {
  amount,
  compactCount,
  compactUsd,
  oddsPair,
  resolvesIn,
  shortKey,
  signedPct,
  token,
  usd,
  utcDateTime,
  MIDDOT,
} from "@/lib/format";
import { leadLine, resolvesLine, ruleLine, templateName } from "@/lib/copy";
import { cx } from "@/lib/cx";
import { Reveal } from "@/components/Reveal";
import { MarketMatchup, matchupParts } from "@/components/Matchup";
import { Stamp, StatusStamp } from "@/components/Stamp";
import { ToteBoard } from "@/components/ToteBoard";
import { BetPanel } from "@/components/BetPanel";
import { TaleOfTheTape } from "@/components/TaleOfTheTape";
import { Chart } from "@/components/Chart";
import { Ledger } from "@/components/Ledger";
import { SectionHead } from "@/components/Rule";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { StatusLine, IDLE, type Status } from "@/components/StatusLine";
import { WalletButton } from "@/components/WalletButton";

function SettledPanel({ market, mine, owner }: { market: Market; mine: Position[]; owner: string | null }) {
  const redeem = useRedeem();
  const [status, setStatus] = useState<Status>(IDLE);
  if (market.status.kind !== "resolved") return null;
  const st = market.status;
  const w = st.winner === "a" ? market.a : market.b;
  const l = st.winner === "a" ? market.b : market.a;
  const pos = mine.find((p) => p.side === st.winner && p.redeemableUsdc > 0);

  const doRedeem = async () => {
    if (!owner || !pos) return;
    setStatus({ state: "pending", text: `Redeeming ${amount(pos.size)} ${w.label}. Confirming.` });
    try {
      const r = await redeem.mutateAsync({ id: market.id, owner });
      setStatus({ state: "ok", text: `Redeemed ${usd(pos.size)} to your wallet.`, sig: r.signature });
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "The chain did not answer." });
    }
  };

  return (
    <div>
      <Stamp tone={st.winner === "a" ? "ink" : "vermilion"}>{w.label} wins</Stamp>
      <p className="serif text-lg mt-4 max-w-[34ch]">
        Closed {oddsPair(st.closingOdds.a)}. {w.label} printed {usd(st.priceA)} against {l.label} at {usd(st.priceB)}{" "}
        at the bell.
      </p>
      <dl className="dl mt-5">
        <dt>Settled</dt>
        <dd className="tnum">{utcDateTime(st.resolvedTs)}</dd>
        <dt>Redeemed</dt>
        <dd className="tnum">
          {compactUsd(market.totalRedeemed)} of {compactUsd(market.totalMinted)}
        </dd>
      </dl>
      <div className="mt-6">
        {!owner ? (
          <div className="flex flex-wrap items-center gap-3">
            <WalletButton variant="outline" />
            <span className="text-sm text-ink-2">to redeem a winning side.</span>
          </div>
        ) : pos ? (
          <>
            <Button variant="primary" size="lg" block side={st.winner} onClick={doRedeem} disabled={redeem.isPending}>
              Redeem {amount(pos.size)} {w.label} for {usd(pos.size)}
            </Button>
            <StatusLine status={status} network={market.network} className="mt-3" />
          </>
        ) : (
          <>
            <p className="serif text-lg text-ink-2">You hold no {w.label}. Nothing to redeem here.</p>
            <StatusLine status={status} network={market.network} className="mt-3" />
          </>
        )}
      </div>
    </div>
  );
}

function YourCorner({ market, mine, owner }: { market: Market; mine: Position[]; owner: string | null }) {
  if (!owner) return <p className="serif text-lg text-ink-2">Connect to see your corner.</p>;
  if (mine.length === 0) {
    return <p className="serif text-lg text-ink-2">No corner yet. Pick a side and the board moves with you.</p>;
  }
  const resolved = market.status.kind === "resolved";
  return (
    <ul className="hairline-rows">
      {mine.map((p) => {
        const f = p.side === "a" ? market.a : market.b;
        const pnl = p.cost > 0 ? (p.value - p.cost) / p.cost : 0;
        return (
          <li key={p.side} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className={cx("font-semibold", p.side === "a" ? "text-side-a" : "text-side-b")}>{f.label}</span>
              <span className="tnum text-sm">{amount(p.size)} held</span>
            </div>
            <dl className="dl mt-2">
              <dt>Cost</dt>
              <dd className="tnum">{usd(p.cost)}</dd>
              <dt>Value</dt>
              <dd className="tnum">
                {usd(p.value)}{" "}
                <span className={cx("text-xs", pnl >= 0 ? "text-gain" : "text-loss")}>{signedPct(pnl)}</span>
              </dd>
              <dt>Earned</dt>
              <dd className="tnum">{token(p.earnedPair, f.pairSymbol)}</dd>
              {!resolved ? (
                <>
                  <dt>Accruing</dt>
                  <dd className="tnum">{token(p.claimablePair, f.pairSymbol)}</dd>
                </>
              ) : (
                <>
                  <dt>Redeemable</dt>
                  <dd className="tnum">{usd(p.redeemableUsdc)}</dd>
                </>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function HowItResolves({ market: m }: { market: Market }) {
  const t = m.template;
  return (
    <dl className="dl gap-y-3">
      <dt>Template</dt>
      <dd>
        <span className="font-medium">{templateName(m)}.</span>{" "}
        <span className="serif text-md text-ink-2">{ruleLine(m)}</span>
      </dd>

      <dt>Feeds</dt>
      <dd className="flex flex-col gap-1">
        <span>
          Pyth {m.a.feedName} <span className="text-xs text-ink-2 break-all">{m.a.feedId}</span>
        </span>
        {t.kind !== "PriceAbove" ? (
          <span>
            Pyth {m.b.feedName} <span className="text-xs text-ink-2 break-all">{m.b.feedId}</span>
          </span>
        ) : null}
      </dd>

      {t.kind === "CapCompare" ? (
        <>
          <dt>Shares</dt>
          <dd className="tnum">
            {compactCount(t.sharesA)} {m.a.symbol} {MIDDOT} {compactCount(t.sharesB)} {m.b.symbol}, fixed at creation.
          </dd>
        </>
      ) : null}
      {t.kind === "RatioOutperform" ? (
        <>
          <dt>Start ratio</dt>
          <dd className="tnum">
            {t.startRatio.toFixed(2)} {m.a.symbol}/{m.b.symbol}, fixed at creation.
          </dd>
        </>
      ) : null}
      {t.kind === "PriceAbove" ? (
        <>
          <dt>Line</dt>
          <dd className="tnum">{usd(t.threshold)}</dd>
        </>
      ) : null}

      <dt>Time</dt>
      <dd>
        <span className="tnum">{utcDateTime(m.resolveTs)}.</span> Anyone can call resolve after the bell; the oracle
        print must be under 6h old.
      </dd>

      <dt>Fallback</dt>
      <dd>
        If Pyth is quiet for {Math.round(m.graceSecs / 3600)}h past the bell, the resolver{" "}
        <span className="text-ink-2">{shortKey(m.resolver)}</span> settles manually with the printed prices.
      </dd>

      <dt>Collateral</dt>
      <dd className="tnum">
        1 USDC per winning token. {compactUsd(m.totalMinted)} minted, {compactUsd(m.totalRedeemed)} redeemed.
      </dd>

      <dt>Fees</dt>
      <dd>
        {(m.feeBpsHolders / 100).toFixed(2)}% of every trade, collected in the pair token only and paid to that side
        by the crank.
      </dd>
    </dl>
  );
}

export default function DuelPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { data: market, isPending } = useMarket(id);
  const history = useOddsHistory(id);
  const ledger = useLedger(id);
  const { owner } = useOwner();
  const positions = usePositions(owner);
  const now = useNow(30_000);

  if (isPending) {
    return (
      <p className="pt-12 text-sm text-ink-2" role="status">
        Pulling the card.
      </p>
    );
  }
  if (!market) {
    return (
      <div className="pt-12">
        <EmptyState action={{ label: "Back to the board", href: "/" }}>
          No duel by that name. The board lists every live one.
        </EmptyState>
      </div>
    );
  }

  const resolved = market.status.kind === "resolved";
  const mine = (positions.data ?? []).filter((p) => p.marketId === market.id);
  const parts = matchupParts(market);
  const bName = parts.joiner === "above" ? "Under" : market.b.label;
  const boardOdds = market.status.kind === "resolved" ? market.status.closingOdds : market.odds;
  const winner = market.status.kind === "resolved" ? market.status.winner : null;

  return (
    <article className="pt-8 lg:pt-12 lg:grid lg:grid-cols-12 lg:gap-x-[var(--gap)]">
      <Reveal as="header" i={0} className="lg:col-span-7">
        <div className="flex items-center gap-2 label">
          <span className="tnum">No. {String(market.no).padStart(2, "0")}</span>
          <span aria-hidden="true">{MIDDOT}</span>
          <span>{templateName(market)}</span>
          <StatusStamp market={market} className="ml-2" />
        </div>
        <MarketMatchup market={market} size="2xl" as="h1" className="mt-4" />
        <p className="serif text-xl mt-6 max-w-[28ch] leading-[1.2] balance-text">{market.question}</p>
        <p className="text-sm text-ink-2 mt-4 max-w-[52ch]">
          {resolvesLine(market)}
          {!resolved && now ? ` ${resolvesIn(market.resolveTs, now)} to go.` : ""}
        </p>
      </Reveal>

      <Reveal i={1} className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 mt-10 lg:mt-0 board-hang">
        <ToteBoard
          aLabel={market.a.label}
          bLabel={bName}
          odds={boardOdds}
          subline={leadLine(market)}
          winner={winner}
          updatedAt={market.oddsUpdatedAt}
        />
        <div className="mt-8">
          {resolved ? <SettledPanel market={market} mine={mine} owner={owner} /> : <BetPanel market={market} />}
        </div>
        <section className="mt-12" aria-label="Your corner">
          <SectionHead>Your corner</SectionHead>
          <YourCorner market={market} mine={mine} owner={owner} />
        </section>
      </Reveal>

      <div className="lg:col-span-7 lg:row-start-2">
        <Reveal as="section" i={2} className="mt-12 lg:mt-14" aria-label="Tale of the tape">
          <SectionHead aside={`${(market.a.holders + market.b.holders).toLocaleString("en-US")} holders`}>
            Tale of the tape
          </SectionHead>
          <TaleOfTheTape market={market} />
        </Reveal>

        <Reveal as="section" i={3} className="mt-14 lg:mt-16" aria-label="Odds history">
          <SectionHead aside="30 days">Odds</SectionHead>
          {history.data ? <Chart points={history.data} aLabel={market.a.label} bLabel={bName} /> : null}
        </Reveal>

        <Reveal as="section" i={4} className="mt-14 lg:mt-16" aria-label="Payouts">
          <SectionHead aside={`${market.epochs} epochs`}>Paid out</SectionHead>
          <Ledger market={market} epochs={ledger.data ?? []} />
        </Reveal>

        <Reveal as="section" i={5} className="mt-16 lg:mt-20" aria-label="How it resolves">
          <SectionHead>How it resolves</SectionHead>
          <HowItResolves market={market} />
        </Reveal>
      </div>
    </article>
  );
}
