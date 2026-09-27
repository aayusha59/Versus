"use client";

import { useEffect, useMemo, useState } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as Tabs from "@radix-ui/react-tabs";
import type { Market, Side } from "@/lib/types";
import { useOwner } from "@/lib/owner";
import { useBalance, useFaucet, usePlaceBet, usePosition, usePreviewBet, usePreviewSell, useSell, useStoredFlag } from "@/lib/hooks";
import { amount, bpsPct, oddsPair, token, usd, EN_DASH } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "./Button";
import { StatusLine, IDLE, type Status } from "./StatusLine";
import { WalletButton } from "./WalletButton";
import { Tip } from "./Tip";

type Mode = "buy" | "sell";

function ReceiptRow({ label, value, tip }: { label: string; value: React.ReactNode; tip?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-ink-2">{tip ? <Tip text={tip}>{label}</Tip> : label}</span>
      <span className="text-sm font-medium tnum text-right">{value}</span>
    </div>
  );
}

/**
 * Corners (ToggleGroup), a big amount input, a three-line receipt, a side-inked submit,
 * and an inline status line. Wallet gate and first-bet disclosure are inline too.
 */
export function BetPanel({ market }: { market: Market }) {
  const { owner, demoAvailable, connectDemo } = useOwner();
  const [mode, setMode] = useState<Mode>("buy");
  const [side, setSide] = useState<Side>("a");

  // "Back Nvidia" on the board links here with ?side=b.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("side");
      if (q === "a" || q === "b") setSide(q);
    } catch {
      /* no window */
    }
  }, []);
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<Status>(IDLE);
  const [faucetStatus, setFaucetStatus] = useState<Status>(IDLE);
  const [disclosed, setDisclosed] = useStoredFlag("duel:disclosed");
  const [ack, setAck] = useState(false);

  const value = Number.parseFloat(raw);
  const n = Number.isFinite(value) && value > 0 ? value : 0;
  const fighter = side === "a" ? market.a : market.b;
  const priceAbove = market.template.kind === "PriceAbove";
  const sideName = priceAbove && side === "b" ? "Under" : fighter.label;
  const aName = market.a.label;
  const bName = priceAbove ? "Under" : market.b.label;

  const { data: balance } = useBalance(owner);
  const { data: position } = usePosition(market.id, owner, side);
  const held = position?.size ?? 0;

  const buyPreview = usePreviewBet(market.id, side, n, mode === "buy" && n > 0);
  const sellPreview = usePreviewSell(market.id, side, n, mode === "sell" && n > 0);
  const bet = usePlaceBet();
  const sell = useSell();
  const faucet = useFaucet();

  useEffect(() => {
    setStatus(IDLE);
  }, [mode, side]);

  const busy = bet.isPending || sell.isPending;
  const insufficient = mode === "buy" ? !!balance && n > balance.usdc + 1e-9 : n > held + 1e-9;
  const canSubmit = !!owner && n > 0 && !busy && !insufficient && (disclosed || ack);

  const oddsAfter = useMemo(() => {
    const p = mode === "buy" ? buyPreview.data?.oddsAfter : sellPreview.data?.oddsAfter;
    return p ?? market.odds;
  }, [mode, buyPreview.data, sellPreview.data, market.odds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner) return;
    if (!(disclosed || ack)) {
      setStatus({ state: "error", text: "Tick the disclosure to place a first bet." });
      return;
    }
    if (mode === "buy") {
      setStatus({ state: "pending", text: `Betting ${usd(n)} on ${sideName}. Confirming.` });
    } else {
      setStatus({ state: "pending", text: `Selling ${amount(n)} ${sideName}. Confirming.` });
    }
    try {
      const r =
        mode === "buy"
          ? await bet.mutateAsync({ id: market.id, side, usdc: n, owner })
          : await sell.mutateAsync({ id: market.id, side, size: n, owner });
      if (!disclosed) setDisclosed(true);
      const pa = Math.round(oddsAfter.a * 100);
      const leader = pa >= 50 ? aName : bName;
      const line = pa >= 50 ? oddsPair(oddsAfter.a) : oddsPair(oddsAfter.b);
      setStatus({
        state: "ok",
        text: pa === 50 ? `Confirmed. Dead even at ${line}.` : `Confirmed. ${leader} leads ${line}.`,
        sig: r.signature,
      });
      setRaw("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The chain did not answer. Try again.";
      setStatus({ state: "error", text: msg });
    }
  };

  const tapFaucet = async () => {
    if (!owner) return;
    setFaucetStatus({ state: "pending", text: "Minting 1,000 mock USDC." });
    try {
      const r = await faucet.mutateAsync({ owner });
      setFaucetStatus({ state: "ok", text: "1,000 USDC landed.", sig: r.signature });
    } catch (err) {
      setFaucetStatus({ state: "error", text: err instanceof Error ? err.message : "Faucet is dry." });
    }
  };

  const quick =
    mode === "buy"
      ? [
          { label: "10", v: 10 },
          { label: "50", v: 50 },
          { label: "100", v: 100 },
          { label: "Max", v: balance ? Math.floor(balance.usdc * 100) / 100 : 0 },
        ]
      : [
          { label: "25%", v: held * 0.25 },
          { label: "50%", v: held * 0.5 },
          { label: "All", v: held },
        ];

  const receipt =
    mode === "buy" ? (
      <>
        <ReceiptRow
          label="You receive"
          value={buyPreview.data && n > 0 ? `${amount(buyPreview.data.outcomeOut)} ${sideName}` : EN_DASH}
          tip={`Outcome tokens for ${sideName}. Each one redeems for 1 USDC if ${sideName} wins.`}
        />
        <ReceiptRow
          label="Fee (paid to holders)"
          value={buyPreview.data && n > 0 ? token(buyPreview.data.feeInPair, fighter.pairSymbol) : EN_DASH}
          tip={`${bpsPct(market.feeBpsHolders)} of every trade, collected in ${fighter.pairSymbol} and paid to ${sideName} holders a few times a day.`}
        />
        <ReceiptRow
          label="Odds after"
          value={
            buyPreview.data && n > 0
              ? `${aName} ${oddsPair(buyPreview.data.oddsAfter.a)}${
                  buyPreview.data.priceImpactBps >= 50
                    ? ` ${"·"} ${bpsPct(buyPreview.data.priceImpactBps)} impact`
                    : ""
                }`
              : `${aName} ${oddsPair(market.odds.a)}`
          }
        />
      </>
    ) : (
      <>
        <ReceiptRow
          label="You receive"
          value={sellPreview.data && n > 0 ? usd(sellPreview.data.usdcOut) : EN_DASH}
          tip="Sold into the pool for the pair token, then back to USDC in one transaction."
        />
        <ReceiptRow
          label="Fee (paid to holders)"
          value={sellPreview.data && n > 0 ? token(sellPreview.data.feeInPair, fighter.pairSymbol) : EN_DASH}
        />
        <ReceiptRow
          label="Odds after"
          value={
            sellPreview.data && n > 0
              ? `${aName} ${oddsPair(sellPreview.data.oddsAfter.a)}`
              : `${aName} ${oddsPair(market.odds.a)}`
          }
        />
      </>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Place a bet">
      <Tabs.Root value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <Tabs.List className="tabs-list" aria-label="Buy or sell">
          <Tabs.Trigger value="buy" className="tab">
            Bet
          </Tabs.Trigger>
          <Tabs.Trigger value="sell" className="tab">
            Sell
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <ToggleGroup.Root
        type="single"
        value={side}
        onValueChange={(v) => {
          if (v) setSide(v as Side);
        }}
        className="corners"
        aria-label="Pick a corner"
      >
        <ToggleGroup.Item value="a" className="corner corner-a">
          <span className="corner-flag" aria-hidden="true" />
          {aName}
        </ToggleGroup.Item>
        <ToggleGroup.Item value="b" className="corner corner-b">
          <span className="corner-flag" aria-hidden="true" />
          {bName}
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="bet-amount" className="label">
            {mode === "buy" ? "Amount" : `Sell ${sideName}`}
          </label>
          <span className="text-xs text-ink-2 tnum">
            {!owner
              ? "Not connected"
              : mode === "buy"
                ? balance
                  ? `Balance ${amount(balance.usdc)} USDC`
                  : "Balance loading"
                : `You hold ${amount(held)} ${sideName}`}
          </span>
        </div>
        <div className="relative">
          <input
            id="bet-amount"
            className="field-input amount-input pr-16"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            aria-describedby="bet-amount-unit"
            aria-invalid={insufficient || undefined}
          />
          <span
            id="bet-amount-unit"
            className="absolute right-0 bottom-3 label text-ink-2 pointer-events-none"
            aria-label={mode === "buy" ? "US dollars" : sideName}
          >
            {mode === "buy" ? "USDC" : sideName}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1 -ml-1">
            {quick.map((q) => (
              <Button
                key={q.label}
                variant="ghost"
                size="sm"
                onClick={() => setRaw(q.v > 0 ? String(Math.round(q.v * 100) / 100) : "")}
                disabled={q.v <= 0}
              >
                {q.label}
              </Button>
            ))}
          </div>
          {insufficient ? (
            <span className="field-error" role="alert">
              {mode === "buy"
                ? `Not enough USDC. You have ${amount(balance?.usdc ?? 0)}.`
                : `You hold ${amount(held)} ${sideName}.`}
            </span>
          ) : null}
        </div>
      </div>

      <div className="hairline-rows rule-ink">{receipt}</div>

      {owner ? (
        <>
          {!disclosed ? (
            <label className="flex items-start gap-2.5 text-xs text-ink-2 cursor-pointer">
              <input type="checkbox" className="check" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                I am not in a restricted jurisdiction, and I understand outcome tokens can go to zero. Shown once.
              </span>
            </label>
          ) : null}
          <Button type="submit" variant="primary" size="lg" block side={side} disabled={!canSubmit}>
            {mode === "buy" ? `Bet ${sideName}` : `Sell ${sideName}`}
          </Button>
          <StatusLine status={status} network={market.network} />
          {market.network === "demo" || market.network === "devnet" || market.network === "localnet" ? (
            <div className="flex items-baseline justify-between gap-4 -mt-2">
              <Button variant="ghost" size="sm" onClick={tapFaucet} disabled={faucet.isPending}>
                Faucet: 1,000 mock USDC
              </Button>
              <StatusLine status={faucetStatus} network={market.network} className="text-xs" />
            </div>
          ) : null}
        </>
      ) : (
        <div className="rule-ink pt-4">
          <p className="text-sm text-ink-2">Connect a wallet to bet. The preview above is live either way.</p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <WalletButton variant="outline" />
            {demoAvailable ? (
              <Button variant="ghost" onClick={connectDemo}>
                Use the demo corner
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <p className={cx("text-xs text-ink-2", owner && "-mt-2")}>
        Routed USDC to {fighter.pairSymbol} to {sideName} in one signature. Fee {bpsPct(market.feeBpsHolders)} to holders.
      </p>
    </form>
  );
}
