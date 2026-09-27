import type { DuelData } from "./adapter";
import type { Network } from "../types";
import { createDemoData } from "./demo";
import { createChainData } from "./chain";
import { configuredCluster, rpcHost, rpcUrlFor } from "./deployment";

export type { DuelData, OddsPoint, Balance, WalletSigner } from "./adapter";
export { DataError } from "./adapter";
export { configuredCluster } from "./deployment";

/**
 * Demo mode is on when NEXT_PUBLIC_DEMO=1 or when NEXT_PUBLIC_DEPLOYMENT names no cluster,
 * so a fresh checkout runs with zero network. Otherwise the chain adapter serves the
 * localnet or devnet deployment bundled from packages/sdk/deployments.
 */
export function isDemo(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO === "1") return true;
  return configuredCluster() === null;
}

export function currentNetwork(): Network {
  if (isDemo()) return "demo";
  return configuredCluster() ?? "demo";
}

/** RPC endpoint the chain adapter and the wallet adapter talk to (host only for display). */
export function currentRpcUrl(): string {
  return rpcUrlFor(configuredCluster());
}

export function currentRpcHost(): string {
  return rpcHost(currentRpcUrl());
}

let instance: DuelData | null = null;

export function getData(): DuelData {
  if (!instance) {
    const cluster = configuredCluster();
    instance = isDemo() || !cluster ? createDemoData() : createChainData(cluster);
  }
  return instance;
}
