"use client";

import "@/lib/polyfills";
import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import type { Adapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import * as Tooltip from "@radix-ui/react-tooltip";
import { OwnerProvider } from "@/lib/owner";
import { useDataTicker } from "@/lib/hooks";
import { configuredCluster, currentRpcUrl, getData } from "@/lib/data";
import { BURNER_WALLET_NAME, BurnerWalletAdapter } from "@/lib/wallet/burner";

function Ticker() {
  useDataTicker();
  return null;
}

/** Hands the connected wallet to the data adapter so chain mode can sign and send. */
function WalletBridge() {
  const { publicKey, sendTransaction } = useWallet();
  useEffect(() => {
    getData().bindWallet?.(publicKey ? { publicKey, sendTransaction } : null);
  }, [publicKey, sendTransaction]);
  return null;
}

/** Only the burner reconnects on its own after a reload; extensions wait for a click. */
const autoConnect = async (adapter: Adapter) => adapter.name === BURNER_WALLET_NAME;

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = currentRpcUrl();
  // Phantom and Solflare register through their adapters; Backpack arrives via Wallet Standard
  // auto-detection inside WalletProvider, so the picker lists all three without a 36-wallet bundle.
  // The burner (a localStorage keypair) is offered only on localnet and devnet, never mainnet.
  const wallets = useMemo(() => {
    const cluster = configuredCluster();
    const list: Adapter[] = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
    if (cluster === "localnet" || cluster === "devnet") list.push(new BurnerWalletAdapter());
    return list;
  }, []);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // networkMode "always": the demo adapter is in-memory and must work with the
          // browser offline; React Query would otherwise pause every fetch when
          // navigator.onLine is false.
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 0, networkMode: "always" },
          mutations: { networkMode: "always" },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={autoConnect}>
          <OwnerProvider>
            <Tooltip.Provider delayDuration={180} skipDelayDuration={400}>
              <Ticker />
              <WalletBridge />
              {children}
            </Tooltip.Provider>
          </OwnerProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
