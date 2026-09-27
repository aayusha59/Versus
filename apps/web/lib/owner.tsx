"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { DEMO_OWNER } from "./data/demo";
import { isDemo } from "./data";

export type OwnerSource = "wallet" | "demo" | null;

interface OwnerState {
  /** Base58 public key of whoever is betting, or null when nobody is connected. */
  owner: string | null;
  source: OwnerSource;
  walletName: string | null;
  demoAvailable: boolean;
  connectDemo: () => void;
  disconnect: () => Promise<void>;
}

const OwnerContext = createContext<OwnerState | null>(null);
const DEMO_KEY = "duel:demo-corner";

export function OwnerProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, wallet, connected, disconnect: walletDisconnect } = useWallet();
  const [demo, setDemo] = useState(false);
  const demoAvailable = isDemo();

  useEffect(() => {
    if (!demoAvailable) return;
    try {
      setDemo(window.localStorage.getItem(DEMO_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, [demoAvailable]);

  const connectDemo = useCallback(() => {
    setDemo(true);
    try {
      window.localStorage.setItem(DEMO_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const disconnect = useCallback(async () => {
    setDemo(false);
    try {
      window.localStorage.removeItem(DEMO_KEY);
    } catch {
      /* storage unavailable */
    }
    if (connected) await walletDisconnect();
  }, [connected, walletDisconnect]);

  const value = useMemo<OwnerState>(() => {
    const walletKey = publicKey ? publicKey.toBase58() : null;
    const owner = walletKey ?? (demo && demoAvailable ? DEMO_OWNER : null);
    const source: OwnerSource = walletKey ? "wallet" : owner ? "demo" : null;
    return {
      owner,
      source,
      walletName: wallet?.adapter.name ?? null,
      demoAvailable,
      connectDemo,
      disconnect,
    };
  }, [publicKey, demo, demoAvailable, wallet, connectDemo, disconnect]);

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner(): OwnerState {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used inside OwnerProvider");
  return ctx;
}
