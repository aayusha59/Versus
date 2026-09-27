import type { Cluster, DeployedMarket, Deployment } from "./types.js";

/**
 * Deployment files live in `packages/sdk/deployments/<cluster>.json` and are written by
 * `scripts/src/bootstrap.ts`. Browser code imports the JSON directly
 * (`import dep from "@versus/sdk/deployments/localnet.json"`) and runs it through `parseDeployment`;
 * Node code calls `loadDeployment(cluster)` from `deployments-node.ts`. This module has no Node
 * imports so it is part of the `@versus/sdk/browser` entry.
 */

export function clusterFromRpcUrl(url: string): Cluster {
  const u = url.toLowerCase();
  if (u.includes("devnet")) return "devnet";
  if (u.includes("mainnet")) return "mainnet";
  if (u.includes("127.0.0.1") || u.includes("localhost") || u.includes("0.0.0.0")) return "localnet";
  // Custom RPC providers are almost always mainnet; devnet URLs carry the word in practice.
  return "mainnet";
}

export function emptyDeployment(params: {
  cluster: Cluster;
  rpcUrl: string;
  programId: string;
  operator: string;
  feeBps?: number;
}): Deployment {
  const now = new Date().toISOString();
  return {
    cluster: params.cluster,
    rpcUrl: params.rpcUrl,
    programId: params.programId,
    operator: params.operator,
    createdAt: now,
    updatedAt: now,
    poolConfig: { feeBps: params.feeBps ?? 100, collectFeeMode: 1 },
    mints: {},
    pairPools: {},
    markets: [],
  };
}

/** Validate an untyped JSON object into a `Deployment` (throws with a useful message). */
export function parseDeployment(raw: unknown): Deployment {
  if (!raw || typeof raw !== "object") throw new Error("deployment: not an object");
  const d = raw as Partial<Deployment>;
  for (const k of ["cluster", "programId", "operator", "mints", "pairPools", "markets", "poolConfig"] as const) {
    if (d[k] === undefined) throw new Error(`deployment: missing field "${k}"`);
  }
  if (!Array.isArray(d.markets)) throw new Error("deployment: markets must be an array");
  return d as Deployment;
}

/** Find a market by address, or by case-insensitive label match ("apple", "Apple vs Nvidia"). */
export function findMarket(dep: Deployment, key: string): DeployedMarket | undefined {
  const k = key.toLowerCase();
  return (
    dep.markets.find((m) => m.address === key) ??
    dep.markets.find(
      (m) =>
        m.sideALabel.toLowerCase() === k ||
        `${m.sideALabel} vs ${m.sideBLabel}`.toLowerCase() === k ||
        m.question.toLowerCase().includes(k),
    )
  );
}
