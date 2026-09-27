"use client";

import { useState } from "react";
import type { Market, RewardEpoch } from "@/lib/types";
import { explorerTx, shortSig, token, utcStamp } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "./Button";

interface LedgerProps {
  market: Market;
  epochs: RewardEpoch[];
  /** Rows shown before "Show all". */
  limit?: number;
}

function TxCell({ sig, network }: { sig: string; network: Market["network"] }) {
  if (network !== "demo") {
    return (
      <a className="link" href={explorerTx(sig, network)} target="_blank" rel="noreferrer">
        {shortSig(sig)}
      </a>
    );
  }
  return (
    <span className="text-ink-2" title="Demo signature">
      {shortSig(sig)}
    </span>
  );
}

/** Dense payout table on desktop; two-column definition lists on small screens. */
export function Ledger({ market, epochs, limit = 8 }: LedgerProps) {
  const [all, setAll] = useState(false);
  const rows = all ? epochs : epochs.slice(0, limit);
  const more = epochs.length - rows.length;

  if (epochs.length === 0) {
    return (
      <p className="serif text-lg text-ink-2">
        Nothing paid yet. The crank pays holders a few times a day once fees come in.
      </p>
    );
  }

  return (
    <div>
      <table className="ledger hidden md:table">
        <thead>
          <tr>
            <th scope="col">Time (UTC)</th>
            <th scope="col">Side</th>
            <th scope="col" className="num">
              Paid
            </th>
            <th scope="col" className="num">
              Holders
            </th>
            <th scope="col" className="num">
              Tx
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const f = e.side === "a" ? market.a : market.b;
            return (
              <tr key={e.signature}>
                <td className="tnum">{utcStamp(e.ts)}</td>
                <td className={cx("font-semibold", e.side === "a" ? "text-side-a" : "text-side-b")}>{f.label}</td>
                <td className="num tnum" aria-label={`${e.amountPair} ${f.pairSymbol}`}>
                  {token(e.amountPair, f.pairSymbol)}
                </td>
                <td className="num tnum">{e.holders}</td>
                <td className="num">
                  <TxCell sig={e.signature} network={market.network} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="md:hidden hairline-rows">
        {rows.map((e) => {
          const f = e.side === "a" ? market.a : market.b;
          return (
            <li key={e.signature} className="py-3">
              <dl className="dl">
                <dt>Time</dt>
                <dd className="tnum">{utcStamp(e.ts)}</dd>
                <dt>Side</dt>
                <dd className={cx("font-semibold", e.side === "a" ? "text-side-a" : "text-side-b")}>{f.label}</dd>
                <dt>Paid</dt>
                <dd className="tnum">{token(e.amountPair, f.pairSymbol)}</dd>
                <dt>Holders</dt>
                <dd className="tnum">{e.holders}</dd>
                <dt>Tx</dt>
                <dd>
                  <TxCell sig={e.signature} network={market.network} />
                </dd>
              </dl>
            </li>
          );
        })}
      </ul>

      {more > 0 || all ? (
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${epochs.length}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
