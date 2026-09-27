"use client";

import { useState } from "react";
import Link from "next/link";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useMarkets, useNow } from "@/lib/hooks";
import type { Market } from "@/lib/types";
import { ASSET_BY_SYMBOL } from "@/lib/registry";
import { DuelCard } from "@/components/DuelCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

type Filter = "all" | "stocks" | "crypto" | "settled";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "settled", label: "Settled" },
];

function isCrypto(m: Market): boolean {
  const a = ASSET_BY_SYMBOL[m.a.symbol]?.kind;
  const b = ASSET_BY_SYMBOL[m.b.symbol]?.kind;
  return a === "crypto" || b === "crypto";
}

export default function BoardPage() {
  const { data: markets, isPending, error } = useMarkets();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<Filter>("all");

  const all = (markets ?? []).slice().sort((x, y) => x.no - y.no);
  const live = all.filter((m) => m.status.kind === "open");
  const shown =
    filter === "settled"
      ? all.filter((m) => m.status.kind === "resolved")
      : filter === "all"
        ? live
        : live.filter((m) => (filter === "crypto" ? isCrypto(m) : !isCrypto(m)));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-sm uppercase text-muted-foreground">Live duels</p>
          <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">Pick a side</h1>
        </div>
        <ToggleGroup.Root
          type="single"
          value={filter}
          onValueChange={(v) => {
            if (v) setFilter(v as Filter);
          }}
          className="pills"
          aria-label="Filter duels"
        >
          {FILTERS.map((f) => (
            <ToggleGroup.Item key={f.value} value={f.value} className="pill">
              {f.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>

      {error ? (
        <p className="mt-10 text-sm text-side-b" role="alert">
          The board did not load: {error.message}
        </p>
      ) : isPending ? (
        <p className="mt-10 text-sm text-muted-foreground" role="status">
          Setting the board.
        </p>
      ) : shown.length === 0 ? (
        <EmptyState className="mt-10" action={{ label: "Create a duel", href: "/new" }}>
          {filter === "settled"
            ? "Nothing has settled yet. Every duel ends up here once the bell rings."
            : filter === "all"
              ? "No duels yet. Create the first one from a template."
              : `No ${filter} duels are live right now. Open one from a template.`}
        </EmptyState>
      ) : (
        <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((m, i) => (
            <DuelCard key={m.id} m={m} now={now} i={i} />
          ))}
        </ol>
      )}

      <div className="mt-16 rounded-3xl border px-6 py-12 text-center">
        <h2 className="text-2xl font-semibold">Have a matchup in mind?</h2>
        <p className="mt-2 text-muted-foreground">Open a duel from a template. Anyone can.</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/new">Create a duel</Link>
        </Button>
      </div>
    </>
  );
}
