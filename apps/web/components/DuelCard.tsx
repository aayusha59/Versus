"use client";

import Link from "next/link";
import type { Market } from "@/lib/types";
import { resolvesIn, token, utcDate, utcShortDate } from "@/lib/format";
import { leadLine, templateName } from "@/lib/copy";
import { Reveal } from "./Reveal";
import { OddsBar } from "./OddsBar";
import { MarketMatchup } from "./Matchup";
import { StatusStamp } from "./Stamp";
import { LinkButton } from "./Button";

/** One duel on the board: tags, matchup, question, odds, two "Back" buttons, a stats footer. */
export function DuelCard({ m, now, i = 0 }: { m: Market; now: number | null; i?: number }) {
  const resolved = m.status.kind === "resolved";
  const a = m.status.kind === "resolved" ? m.status.closingOdds.a : m.odds.a;
  const pa = Math.round(a * 100);
  const priceAbove = m.template.kind === "PriceAbove";
  const bName = priceAbove ? "Under" : m.b.label;
  const when =
    m.status.kind === "resolved"
      ? utcDate(m.status.resolvedTs)
      : now && m.resolveTs > now
        ? `in ${resolvesIn(m.resolveTs, now)}`
        : utcShortDate(m.resolveTs);

  return (
    <Reveal as="li" i={i} className="card card-hover flex flex-col">
      <div className="card-pad flex flex-col gap-4 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="tag">{templateName(m)}</span>
            <StatusStamp market={m} />
          </div>
          <span className="text-xs text-fg-3 tnum whitespace-nowrap">No. {String(m.no).padStart(2, "0")}</span>
        </div>

        <Link href={`/d/${m.id}`} className="block group">
          <MarketMatchup market={m} size="xl" as="h2" className="group-hover:underline underline-offset-4 decoration-1 decoration-fg-3" />
          <p className="text-sm text-fg-2 mt-2 max-w-[40ch]">{m.question}</p>
        </Link>

        <div className="mt-auto pt-2">
          <div className="flex items-baseline justify-between gap-3 text-xs mb-2 tnum">
            <span className="text-side-a font-medium truncate">
              {m.a.label} {pa}%
            </span>
            <span className="text-side-b font-medium truncate text-right">
              {bName} {100 - pa}%
            </span>
          </div>
          <OddsBar a={a} aLabel={m.a.label} bLabel={bName} />
        </div>

        {resolved ? (
          <p className="text-sm text-fg-2">{leadLine(m)}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <LinkButton href={`/d/${m.id}?side=a`} variant="outline" side="a" size="sm">
              Back {m.a.label}
            </LinkButton>
            <LinkButton href={`/d/${m.id}?side=b`} variant="outline" side="b" size="sm">
              Back {bName}
            </LinkButton>
          </div>
        )}
      </div>

      <div className="border-t border-line px-5 py-3 flex items-baseline justify-between gap-3 text-xs text-fg-2 tnum">
        <span className="whitespace-nowrap">
          {resolved ? "Settled" : "Resolves"} <span className="text-fg">{when}</span>
        </span>
        <span className="truncate text-right" title="Fees paid out to holders so far">
          <span className="text-side-a">{token(m.rewardsPaidA, m.a.pairSymbol)}</span>
          {!priceAbove ? (
            <>
              {" "}
              <span className="text-side-b">{token(m.rewardsPaidB, m.b.pairSymbol)}</span>
            </>
          ) : null}{" "}
          paid
        </span>
      </div>
    </Reveal>
  );
}
