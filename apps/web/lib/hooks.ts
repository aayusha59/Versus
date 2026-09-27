"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "./data";
import type { CreateMarketParams, Side } from "./types";

export const keys = {
  markets: ["markets"] as const,
  market: (id: string) => ["market", id] as const,
  history: (id: string) => ["history", id] as const,
  ledger: (id: string) => ["ledger", id] as const,
  positions: (owner: string | null) => ["positions", owner] as const,
  position: (id: string, owner: string | null, side: Side | undefined) =>
    ["position", id, owner, side ?? "any"] as const,
  balance: (owner: string | null) => ["balance", owner] as const,
  previewBet: (id: string, side: Side, usdc: number) => ["preview-bet", id, side, usdc] as const,
  previewSell: (id: string, side: Side, size: number) => ["preview-sell", id, side, size] as const,
};

/** Subscribes the query cache to the adapter's change stream (the 4s odds tick in demo mode). */
export function useDataTicker() {
  const qc = useQueryClient();
  useEffect(() => {
    return getData().subscribe(() => {
      void qc.invalidateQueries();
    });
  }, [qc]);
}

export function useMarkets() {
  return useQuery({ queryKey: keys.markets, queryFn: () => getData().listMarkets() });
}

export function useMarket(id: string) {
  return useQuery({ queryKey: keys.market(id), queryFn: () => getData().getMarket(id) });
}

export function useOddsHistory(id: string) {
  return useQuery({ queryKey: keys.history(id), queryFn: () => getData().getOddsHistory(id) });
}

export function useLedger(id: string) {
  return useQuery({ queryKey: keys.ledger(id), queryFn: () => getData().getLedger(id) });
}

export function usePositions(owner: string | null) {
  return useQuery({
    queryKey: keys.positions(owner),
    queryFn: () => getData().listPositions(owner),
  });
}

export function usePosition(id: string, owner: string | null, side?: Side) {
  return useQuery({
    queryKey: keys.position(id, owner, side),
    queryFn: () => getData().getPosition(id, owner, side),
  });
}

export function useBalance(owner: string | null) {
  return useQuery({ queryKey: keys.balance(owner), queryFn: () => getData().getBalance(owner) });
}

export function usePreviewBet(id: string, side: Side, usdc: number, enabled: boolean) {
  return useQuery({
    queryKey: keys.previewBet(id, side, usdc),
    queryFn: () => getData().previewBet(id, side, usdc),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function usePreviewSell(id: string, side: Side, size: number, enabled: boolean) {
  return useQuery({
    queryKey: keys.previewSell(id, side, size),
    queryFn: () => getData().previewSell(id, side, size),
    enabled,
    placeholderData: (prev) => prev,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function usePlaceBet() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { id: string; side: Side; usdc: number; owner: string }) =>
      getData().placeBet(v.id, v.side, v.usdc, v.owner),
    onSettled: () => void invalidate(),
  });
}

export function useSell() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { id: string; side: Side; size: number; owner: string }) =>
      getData().sell(v.id, v.side, v.size, v.owner),
    onSettled: () => void invalidate(),
  });
}

export function useRedeem() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { id: string; owner: string }) => getData().redeem(v.id, v.owner),
    onSettled: () => void invalidate(),
  });
}

export function useFaucet() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (v: { owner: string }) => getData().faucet(v.owner),
    onSettled: () => void invalidate(),
  });
}

export function useCreateMarket() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ onProgress, ...params }: CreateMarketParams & { onProgress?: (text: string) => void }) =>
      getData().createMarket(params, onProgress),
    onSettled: () => void invalidate(),
  });
}

/** Unix ms that ticks; null before mount so server and client markup agree. */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Small localStorage-backed boolean, safe on the server and in private windows. */
export function useStoredFlag(key: string): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  useEffect(() => {
    try {
      setV(window.localStorage.getItem(key) === "1");
    } catch {
      /* storage unavailable */
    }
  }, [key]);
  const set = (next: boolean) => {
    setV(next);
    try {
      if (next) window.localStorage.setItem(key, "1");
      else window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  };
  return [v, set];
}
