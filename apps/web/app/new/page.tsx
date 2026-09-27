"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import type { TemplateKind } from "@/lib/types";
import { ASSETS, KIND_LABEL, KIND_ORDER, getAsset } from "@/lib/registry";
import { TEMPLATE_META, buildTemplate, composeQuestion, composeResolves } from "@/lib/compose";
import { useCreateMarket, useMarkets } from "@/lib/hooks";
import { useOwner } from "@/lib/owner";
import { amount, bpsPct, parseUtcInput, usd, utcInputValue, MIDDOT, EN_DASH } from "@/lib/format";
import { Reveal } from "@/components/Reveal";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";
import { Matchup } from "@/components/Matchup";
import { ToteBoard } from "@/components/ToteBoard";
import { StatusLine, IDLE, type Status } from "@/components/StatusLine";
import { WalletButton } from "@/components/WalletButton";

const KINDS: TemplateKind[] = ["CapCompare", "RatioOutperform", "PriceAbove"];
const FEE_TICKS = [10, 50, 100, 200, 300];

function AssetSelect({
  id,
  label,
  hint,
  value,
  onChange,
  exclude,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  exclude?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger id={id} className="select-trigger">
          <Select.Value />
          <span aria-hidden="true" className="text-ink-3 text-xs">
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
                      <span className="text-xs text-ink-2 tnum">
                        {a.symbol} {MIDDOT} pays {a.pairSymbol}
                      </span>
                    </Select.Item>
                  ))}
                </Select.Group>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </Field>
  );
}

export default function NewDuelPage() {
  const router = useRouter();
  const { owner, demoAvailable, connectDemo } = useOwner();
  const { data: markets } = useMarkets();
  const create = useCreateMarket();

  const [kind, setKind] = useState<TemplateKind>("CapCompare");
  const [aSym, setASym] = useState("AAPL");
  const [bSym, setBSym] = useState("NVDA");
  const [threshold, setThreshold] = useState("300");
  const [date, setDate] = useState(utcInputValue(Date.UTC(2026, 11, 31, 21, 0)));
  const [seed, setSeed] = useState("500");
  const [fee, setFee] = useState(100);
  const [status, setStatus] = useState<Status>(IDLE);

  const a = getAsset(aSym);
  const b = kind === "PriceAbove" ? null : getAsset(bSym);
  const thr = Number.parseFloat(threshold) || 0;
  const seedN = Number.parseFloat(seed) || 0;
  const resolveTs = parseUtcInput(date);
  const meta = TEMPLATE_META[kind];

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (b && b.symbol === a.symbol) e.b = "A fighter cannot duel itself.";
    if (kind === "CapCompare" && (!a.shares || (b && !b.shares))) {
      e.kind = "Cap compare needs share counts. Pick two stocks, or switch to Outperform.";
    }
    if (kind === "PriceAbove" && !(thr > 0)) e.threshold = "Set a line above zero.";
    if (!resolveTs) e.date = "Enter a date and time.";
    else if (resolveTs < Date.now() + 3_600_000) e.date = "The bell must be at least an hour out.";
    if (!(seedN >= 10)) e.seed = "Seed at least 10 USDC.";
    return e;
  }, [a, b, kind, thr, resolveTs, seedN]);

  const valid = Object.keys(errors).length === 0;
  const question = composeQuestion(kind, a, b, resolveTs ?? Date.now(), thr);
  const no = (markets?.length ?? 0) + 1;
  const headline =
    kind === "PriceAbove"
      ? { a: a.label, b: usd(thr), joiner: "above" }
      : { a: a.label, b: b?.label ?? "?", joiner: "vs" };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || !valid || !resolveTs) return;
    setStatus({
      state: "pending",
      text: `Opening ${headline.a} ${headline.joiner} ${headline.b}. Minting the set and seeding both pools.`,
    });
    try {
      const r = await create.mutateAsync({
        template: buildTemplate(kind, a, b, thr),
        question,
        a: { symbol: a.symbol, label: a.label },
        b: b ? { symbol: b.symbol, label: b.label } : null,
        resolveTs,
        seedUsdc: seedN,
        feeBps: fee,
        creator: owner,
        onProgress: (text) => setStatus({ state: "pending", text }),
      });
      setStatus({ state: "ok", text: "Opened. Taking you to the card.", sig: r.signature });
      setTimeout(() => router.push(`/d/${r.id}`), 500);
    } catch (err) {
      setStatus({ state: "error", text: err instanceof Error ? err.message : "The chain did not answer." });
    }
  };

  return (
    <div className="pt-8 lg:pt-12 lg:grid lg:grid-cols-12 lg:gap-x-[var(--gap)]">
      <Reveal as="header" i={0} className="lg:col-span-12">
        <h1 className="display text-2xl">Make a duel</h1>
        <p className="serif text-xl mt-4 max-w-[36ch] balance-text">
          Pick a template and two fighters. You seed both pools; the duel is live the moment it lands.
        </p>
        <hr className="double mt-5" />
      </Reveal>

      <form onSubmit={submit} className="lg:col-span-7 mt-8 flex flex-col gap-12" noValidate>
        <Reveal as="fieldset" i={1} className="flex flex-col gap-4">
          <legend className="label mb-4">Template</legend>
          <ToggleGroup.Root
            type="single"
            value={kind}
            onValueChange={(v) => {
              if (v) setKind(v as TemplateKind);
            }}
            className="templates"
            aria-label="Template"
          >
            {KINDS.map((k) => (
              <ToggleGroup.Item key={k} value={k} className="template">
                <span className="label">{TEMPLATE_META[k].name}</span>
                <span className="block font-semibold mt-1">{TEMPLATE_META[k].short}</span>
                <span className="block template-explainer">{TEMPLATE_META[k].explainer}</span>
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
          {errors.kind ? (
            <p className="field-error" role="alert">
              {errors.kind}
            </p>
          ) : null}
        </Reveal>

        <Reveal as="fieldset" i={2} className="rule-ink pt-6">
          <legend className="sr-only">Corners</legend>
          <div className="grid gap-8 sm:grid-cols-2">
            <AssetSelect id="corner-a" label="Left corner" hint="prints in ink" value={aSym} onChange={setASym} />
            {meta.needsB ? (
              <div className="flex flex-col gap-1.5">
                <AssetSelect
                  id="corner-b"
                  label="Right corner"
                  hint="prints in vermilion"
                  value={bSym}
                  onChange={setBSym}
                  exclude={aSym}
                />
                {errors.b ? (
                  <p className="field-error" role="alert">
                    {errors.b}
                  </p>
                ) : null}
              </div>
            ) : (
              <Field id="line" label="The line" hint="USD" error={errors.threshold}>
                <Input
                  id="line"
                  inputMode="decimal"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
                  invalid={!!errors.threshold}
                  className="tnum"
                />
              </Field>
            )}
          </div>
          <p className="serif text-md text-ink-2 mt-5 max-w-[48ch]">
            {kind === "PriceAbove"
              ? `${a.label} holders are paid in ${a.pairSymbol}. The under side is paid in USDC.`
              : `${a.label} holders are paid in ${a.pairSymbol}; ${b?.label} holders in ${b?.pairSymbol}. Bet on one, earn it.`}
          </p>
        </Reveal>

        <Reveal as="fieldset" i={3} className="rule-ink pt-6 grid gap-8 sm:grid-cols-2">
          <legend className="sr-only">The bell</legend>
          <Field id="bell" label="Resolves at" hint="UTC" error={errors.date}>
            <Input
              id="bell"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              invalid={!!errors.date}
              className="tnum"
            />
          </Field>
          <Field id="seed" label="Seed" hint="USDC, mints the first set" error={errors.seed}>
            <Input
              id="seed"
              inputMode="decimal"
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/[^0-9.]/g, ""))}
              invalid={!!errors.seed}
              className="tnum"
            />
          </Field>
        </Reveal>

        <Reveal as="fieldset" i={4} className="rule-ink pt-6">
          <legend className="sr-only">Fee</legend>
          <div className="flex items-baseline justify-between gap-4">
            <span className="label">Fee to holders</span>
            <span className="text-sm tnum">
              {fee} bps {MIDDOT} {bpsPct(fee)} of every trade
            </span>
          </div>
          <div className="mt-3">
            <Slider.Root
              className="rail-root"
              min={10}
              max={300}
              step={10}
              value={[fee]}
              onValueChange={([v]) => setFee(v)}
              aria-label="Fee in basis points"
            >
              <Slider.Track className="rail-track">
                <Slider.Range className="rail-range" />
              </Slider.Track>
              <Slider.Thumb className="rail-thumb" aria-valuetext={`${fee} basis points`} />
            </Slider.Root>
            <div className="rail-ticks" aria-hidden="true">
              {FEE_TICKS.map((t) => (
                <span key={t} className="rail-tick tnum" style={{ left: `${((t - 10) / 290) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="serif text-md text-ink-2 mt-4 max-w-[48ch]">
            Collected in the pair token only, so a bet on {a.label} pays {a.label} holders in {a.pairSymbol}.
          </p>
        </Reveal>

        <Reveal i={5} className="rule-ink pt-6 flex flex-col gap-4">
          {owner ? (
            <>
              <Button type="submit" variant="primary" size="lg" disabled={!valid || create.isPending}>
                Open the duel {EN_DASH} seed {amount(seedN, 0)} USDC
              </Button>
              <StatusLine status={status} />
            </>
          ) : (
            <>
              <p className="serif text-lg">Connect a wallet to open the duel. The preview is live either way.</p>
              <div className="flex flex-wrap items-center gap-3">
                <WalletButton variant="outline" />
                {demoAvailable ? (
                  <Button variant="ghost" onClick={connectDemo}>
                    Use the demo corner
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </Reveal>
      </form>

      <Reveal i={2} className="lg:col-span-5 mt-14 lg:mt-8 lg:sticky lg:top-8 self-start" aria-live="polite">
        <div className="flex items-center gap-2 label">
          <span>Preview</span>
          <span aria-hidden="true">{MIDDOT}</span>
          <span className="tnum">No. {String(no).padStart(2, "0")}</span>
          <span aria-hidden="true">{MIDDOT}</span>
          <span>{meta.name}</span>
        </div>
        <Matchup {...headline} size="2xl" as="p" className="mt-3" />
        <p className="serif text-lg mt-4 max-w-[30ch] balance-text">{question}</p>
        <p className="text-sm text-ink-2 mt-3 max-w-[48ch]">
          {resolveTs
            ? composeResolves(buildTemplate(kind === "CapCompare" && errors.kind ? "RatioOutperform" : kind, a, b, thr), a.feedName, b?.feedName ?? null, resolveTs)
            : "Set the bell to see the resolution line."}
        </p>
        <div className="mt-8">
          <ToteBoard
            aLabel={a.label}
            bLabel={kind === "PriceAbove" ? "Under" : (b?.label ?? "?")}
            odds={{ a: 0.5, b: 0.5, impliedSum: 1 }}
            subline={`Opens dead even at 50${EN_DASH}50.`}
          />
        </div>
      </Reveal>
    </div>
  );
}
