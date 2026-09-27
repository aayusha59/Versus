"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as Select from "@radix-ui/react-select";
import type { TemplateKind } from "@/lib/types";
import { ASSETS, KIND_LABEL, KIND_ORDER, getAsset, type Asset } from "@/lib/registry";
import { buildTemplate, composeQuestion } from "@/lib/compose";
import { useCreateMarket } from "@/lib/hooks";
import { useOwner } from "@/lib/owner";
import { utcShortDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Reveal } from "@/components/Reveal";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { StatusLine, IDLE, type Status } from "@/components/StatusLine";
import { WalletButton } from "@/components/WalletButton";

/**
 * Create a duel. One column: the question writes itself as you pick, then two names, the kind of
 * comparison, an end date and a stake, and one button. The fee is fixed at 1% unless changed.
 *
 * "Price above" is not offered here: the chain adapter does not route it yet.
 */

type Kind = Exclude<TemplateKind, "PriceAbove">;

const KIND_COPY: Record<Kind, { name: string; explain: string }> = {
  CapCompare: {
    name: "Bigger company",
    explain: "Compares market value, price times shares, on the end date. Prices come from Pyth.",
  },
  RatioOutperform: {
    name: "Better performance",
    explain: "Compares how far each price moved between today and the end date. Prices come from Pyth.",
  },
};

/** Duels end at 21:00 UTC, an hour after the US close. */
const END_HOUR_UTC = 21;
const DEFAULT_END = Date.UTC(2026, 11, 31, END_HOUR_UTC, 0);
const DEFAULT_FEE_BPS = 100;
const MIN_FEE_BPS = 10;
const MAX_FEE_BPS = 300;
const HOUR = 3_600_000;

function dateInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseDateInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], END_HOUR_UTC, 0);
}

function SidePicker({
  side,
  value,
  exclude,
  onChange,
}: {
  side: "a" | "b";
  value: string;
  exclude: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="select-trigger" aria-label={side === "a" ? "First side" : "Second side"}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className={cx("h-2 w-2 flex-none rounded-full", side === "a" ? "bg-side-a" : "bg-side-b")} />
          <span className="truncate">
            <Select.Value />
          </span>
        </span>
        <span aria-hidden="true" className="text-xs text-ink-2">
          {"▾"}
        </span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={4}>
          <Select.Viewport className="select-viewport">
            {KIND_ORDER.map((kind) => (
              <Select.Group key={kind}>
                <Select.Label className="select-group-label">{KIND_LABEL[kind]}</Select.Label>
                {ASSETS.filter((a) => a.kind === kind).map((a) => (
                  <Select.Item key={a.symbol} value={a.symbol} className="select-item" disabled={a.symbol === exclude}>
                    <Select.ItemText>{a.label}</Select.ItemText>
                    <span className="text-xs text-ink-2 tnum">{a.symbol}</span>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

/** The question as it will read on the card, with each side in its colour. */
function QuestionLine({ kind, a, b, resolveTs }: { kind: Kind; a: Asset; b: Asset; resolveTs: number | null }) {
  const when = resolveTs ? utcShortDate(resolveTs) : "the end date";
  const A = <span className="text-side-a">{a.label}</span>;
  const B = <span className="text-side-b">{b.label}</span>;
  return (
    <p className="display mt-6 text-2xl sm:text-3xl" aria-live="polite">
      {kind === "CapCompare" ? (
        <>
          Will {A} be worth more than {B} on {when}?
        </>
      ) : (
        <>
          Will {A} outperform {B} from here to {when}?
        </>
      )}
    </p>
  );
}

export default function NewDuelPage() {
  const router = useRouter();
  const { owner, demoAvailable, connectDemo } = useOwner();
  const create = useCreateMarket();

  const [kind, setKind] = useState<Kind>("CapCompare");
  const [aSym, setASym] = useState("AAPL");
  const [bSym, setBSym] = useState("NVDA");
  const [date, setDate] = useState(dateInputValue(DEFAULT_END));
  const [stake, setStake] = useState("500");
  const [feeText, setFeeText] = useState(String(DEFAULT_FEE_BPS / 100));
  const [showFee, setShowFee] = useState(false);
  const [status, setStatus] = useState<Status>(IDLE);

  const a = getAsset(aSym);
  const b = getAsset(bSym);
  const resolveTs = parseDateInput(date);
  const stakeN = Number.parseFloat(stake) || 0;
  const feePct = Number.parseFloat(feeText);
  const feeBps = Number.isFinite(feePct) ? Math.round(feePct * 100) : NaN;
  const feeLabel = Number.isFinite(feeBps) ? `${(feeBps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%` : "The fee";

  // "Bigger company" needs share counts on both sides; crypto has none.
  const capOk = !!(a.shares && b.shares);
  useEffect(() => {
    if (!capOk && kind === "CapCompare") setKind("RatioOutperform");
  }, [capOk, kind]);

  // Picking the other side's name swaps the two, so the same name can never face itself.
  const pickA = (v: string) => {
    if (v === bSym) setBSym(aSym);
    setASym(v);
  };
  const pickB = (v: string) => {
    if (v === aSym) setASym(bSym);
    setBSym(v);
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!resolveTs) e.date = "Pick a date.";
    else if (resolveTs < Date.now() + HOUR) e.date = "Pick a later date.";
    if (!(stakeN >= 10)) e.stake = "At least 10 USDC.";
    if (!(feeBps >= MIN_FEE_BPS && feeBps <= MAX_FEE_BPS)) e.fee = "Between 0.1% and 3%.";
    return e;
  }, [resolveTs, stakeN, feeBps]);

  const valid = Object.keys(errors).length === 0 && a.symbol !== b.symbol;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || !valid || !resolveTs) return;
    setStatus({ state: "pending", text: "Creating the duel." });
    try {
      const r = await create.mutateAsync({
        template: buildTemplate(kind, a, b, 0),
        question: composeQuestion(kind, a, b, resolveTs, 0),
        a: { symbol: a.symbol, label: a.label },
        b: { symbol: b.symbol, label: b.label },
        resolveTs,
        seedUsdc: stakeN,
        feeBps,
        creator: owner,
        onProgress: (text) => setStatus({ state: "pending", text }),
      });
      setStatus({ state: "ok", text: "Created. Opening it now.", sig: r.signature });
      setTimeout(() => router.push(`/d/${r.id}`), 500);
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "The chain did not answer." });
    }
  };

  return (
    <Reveal className="mx-auto max-w-lg">
      <header>
        <p className="font-mono text-sm uppercase text-muted-foreground">Create</p>
        <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">New duel</h1>
        <QuestionLine kind={kind} a={a} b={b} resolveTs={resolveTs} />
      </header>

      <form onSubmit={submit} className="mt-10 flex flex-col gap-8" noValidate>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <SidePicker side="a" value={aSym} exclude={bSym} onChange={pickA} />
          <span className="text-sm text-fg-3" aria-hidden="true">
            vs
          </span>
          <SidePicker side="b" value={bSym} exclude={aSym} onChange={pickB} />
        </div>

        <div className="flex flex-col gap-3">
          <ToggleGroup.Root
            type="single"
            value={kind}
            onValueChange={(v) => {
              if (v) setKind(v as Kind);
            }}
            className="pills"
            aria-label="What decides the winner"
          >
            {(Object.keys(KIND_COPY) as Kind[]).map((k) => (
              <ToggleGroup.Item
                key={k}
                value={k}
                className="pill focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-40"
                disabled={k === "CapCompare" && !capOk}
              >
                {KIND_COPY[k].name}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          <p className="text-sm text-muted-foreground max-w-[52ch]">
            {KIND_COPY[kind].explain}
            {!capOk ? " Bigger company needs two stocks." : ""}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="end" label="Ends" hint="21:00 UTC" error={errors.date}>
            <Input
              id="end"
              type="date"
              value={date}
              min={dateInputValue(Date.now() + HOUR)}
              onChange={(e) => setDate(e.target.value)}
              invalid={!!errors.date}
              className="tnum"
            />
          </Field>
          <Field id="stake" label="Your stake" hint="USDC" error={errors.stake}>
            <Input
              id="stake"
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))}
              invalid={!!errors.stake}
              className="tnum"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          {owner ? (
            <>
              <Button type="submit" variant="primary" size="lg" block disabled={!valid || create.isPending}>
                Create duel
              </Button>
              <StatusLine status={status} />
            </>
          ) : (
            <>
              <WalletButton variant="primary" size="lg" block />
              {demoAvailable ? (
                <Button variant="ghost" onClick={connectDemo}>
                  Use the demo wallet
                </Button>
              ) : null}
            </>
          )}

          {showFee ? (
            <Field id="fee" label="Fee to holders" hint="% of each trade" error={errors.fee} className="mt-2 w-64">
              <Input
                id="fee"
                inputMode="decimal"
                value={feeText}
                onChange={(e) => setFeeText(e.target.value.replace(/[^0-9.]/g, ""))}
                invalid={!!errors.fee}
                className="tnum"
              />
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your stake seeds both sides equally and stays in the pools as their starting liquidity; the
              platform holds the pool positions so it can pay out their fees. {feeLabel} of every trade goes to
              holders of that side.{" "}
              <button type="button" className="link text-fg-2 hover:text-fg" onClick={() => setShowFee(true)}>
                Change
              </button>
            </p>
          )}
        </div>
      </form>
    </Reveal>
  );
}
