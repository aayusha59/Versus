"use client";

import Link from "next/link";
import { useMarkets, useNow } from "@/lib/hooks";
import type { Market } from "@/lib/types";
import { resolvesIn, token, utcDate, utcDateTime, MIDDOT } from "@/lib/format";
import { leadLine, templateName } from "@/lib/copy";
import { Reveal } from "@/components/Reveal";
import { Clock } from "@/components/Clock";
import { OddsBar } from "@/components/OddsBar";
import { MarketMatchup } from "@/components/Matchup";
import { StatusStamp } from "@/components/Stamp";
import { SectionHead } from "@/components/Rule";
import { EmptyState } from "@/components/EmptyState";

function BoardRow({ m, i, now }: { m: Market; i: number; now: number | null }) {
  const resolved = m.status.kind === "resolved";
  const a = m.status.kind === "resolved" ? m.status.closingOdds.a : m.odds.a;
  const pa = Math.round(a * 100);
  const priceAbove = m.template.kind === "PriceAbove";
  const bName = priceAbove ? "Under" : m.b.label;

  return (
    <Reveal as="li" i={i}>
      <Link
        href={`/d/${m.id}`}
        className="row-hover block py-6 -mx-3 px-3 lg:grid lg:grid-cols-12 lg:gap-x-[var(--gap)] lg:items-start"
        aria-label={`${m.a.label} versus ${bName}, ${m.a.label} ${pa} percent`}
      >
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2 label">
            <span className="tnum">No. {String(m.no).padStart(2, "0")}</span>
            <span aria-hidden="true">{MIDDOT}</span>
            <span>{templateName(m)}</span>
          </div>
          <MarketMatchup market={m} size="xl" as="h2" className="mt-2" />
          <p className="serif text-md text-ink-2 mt-2 max-w-[40ch]">{m.question}</p>
        </div>

        <div className="lg:col-span-4 mt-5 lg:mt-1">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-side-a tnum w-[2ch]" aria-hidden="true">
              {pa}
            </span>
            <OddsBar a={a} aLabel={m.a.label} bLabel={bName} className="flex-1" />
            <span className="text-lg font-bold text-side-b tnum w-[2ch] text-right" aria-hidden="true">
              {100 - pa}
            </span>
          </div>
          <p className="text-sm mt-2">{leadLine(m)}</p>
        </div>

        <div className="lg:col-span-3 mt-5 lg:mt-0 flex items-start justify-between gap-4 lg:flex-col lg:items-stretch">
          <dl className="dl lg:mt-3">
            <dt>{resolved ? "Settled" : "Resolves"}</dt>
            <dd className="tnum whitespace-nowrap">
              {m.status.kind === "resolved"
                ? utcDate(m.status.resolvedTs)
                : now
                  ? m.resolveTs <= now
                    ? resolvesIn(m.resolveTs, now)
                    : `in ${resolvesIn(m.resolveTs, now)}`
                  : utcDateTime(m.resolveTs)}
            </dd>
            <dt>Paid in</dt>
            <dd>
              <span className="block whitespace-nowrap">{m.a.pairSymbol}</span>
              {!priceAbove ? <span className="block whitespace-nowrap">{m.b.pairSymbol}</span> : null}
            </dd>
            <dt>Fees out</dt>
            <dd className="tnum">
              <span className="block whitespace-nowrap">{token(m.rewardsPaidA, m.a.pairSymbol)}</span>
              {!priceAbove ? (
                <span className="block whitespace-nowrap">{token(m.rewardsPaidB, m.b.pairSymbol)}</span>
              ) : null}
            </dd>
          </dl>
          <div className="lg:order-first lg:self-end">
            <StatusStamp market={m} />
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

export default function BoardPage() {
  const { data: markets, isPending, error } = useMarkets();
  const now = useNow(30_000);

  if (error) {
    return (
      <p className="pt-12 text-sm text-vermilion" role="alert">
        The board did not load: {error.message}
      </p>
    );
  }
  if (isPending || !markets) {
    return (
      <p className="pt-12 text-sm text-ink-2" role="status">
        Setting the board.
      </p>
    );
  }

  const live = markets.filter((m) => m.status.kind === "open").sort((x, y) => x.no - y.no);
  const settled = markets
    .filter((m) => m.status.kind === "resolved")
    .sort(
      (x, y) =>
        (y.status.kind === "resolved" ? y.status.resolvedTs : 0) -
        (x.status.kind === "resolved" ? x.status.resolvedTs : 0),
    );

  return (
    <>
      <Reveal as="header" i={0} className="pt-8 lg:pt-12">
        <div className="flex items-end justify-between gap-6">
          <h1 className="serif text-xl leading-[1.15] max-w-[24ch] balance-text">Bet on Apple. Get paid in Apple.</h1>
          <div className="hidden sm:block">
            <Clock label={false} />
          </div>
        </div>
        <p className="text-sm text-ink-2 mt-3 max-w-[58ch]">
          Head-to-head questions settled by Pyth. Each side trades against its own stock token, and the trading fees go
          to the people holding that side.
        </p>
        <hr className="double mt-5" />
      </Reveal>

      {live.length === 0 && settled.length === 0 ? (
        <EmptyState action={{ label: "New duel", href: "/new" }}>
          No duels yet. Create the first one from a template.
        </EmptyState>
      ) : null}

      {live.length > 0 ? (
        <section aria-label="Live duels">
          <Reveal
            i={1}
            className="hidden lg:grid lg:grid-cols-12 lg:gap-x-[var(--gap)] label py-2 border-b border-rule"
          >
            <span className="col-span-5">Matchup</span>
            <span className="col-span-4">Odds</span>
            <span className="col-span-3">Card</span>
          </Reveal>
          <ol className="hairline-rows">
            {live.map((m, i) => (
              <BoardRow key={m.id} m={m} i={i + 2} now={now} />
            ))}
          </ol>
        </section>
      ) : settled.length > 0 ? (
        <EmptyState action={{ label: "New duel", href: "/new" }}>
          Nothing live right now. Open a duel from a template and the board fills.
        </EmptyState>
      ) : null}

      {settled.length > 0 ? (
        <section className="section-gap" aria-label="Settled duels">
          <Reveal i={live.length + 2}>
            <SectionHead aside={`${settled.length} settled`}>Settled</SectionHead>
          </Reveal>
          <ol className="hairline-rows -mt-5">
            {settled.map((m, i) => (
              <BoardRow key={m.id} m={m} i={live.length + 3 + i} now={now} />
            ))}
          </ol>
        </section>
      ) : null}

      <Reveal i={live.length + settled.length + 4} className="mt-16">
        <hr className="rule-ink" />
        <p className="serif text-lg mt-4">
          Have a matchup in mind?{" "}
          <Link href="/new" className="link">
            Open a duel
          </Link>{" "}
          from a template. Anyone can.
        </p>
      </Reveal>
    </>
  );
}
