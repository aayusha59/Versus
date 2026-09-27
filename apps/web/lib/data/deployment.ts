import localnetJson from "@versus/sdk/deployments/localnet.json";
import devnetJson from "@versus/sdk/deployments/devnet.json";
import { parseDeployment, type Deployment } from "@versus/sdk/browser";

/**
 * Which deployment the app is pointed at. `NEXT_PUBLIC_DEPLOYMENT` names a cluster
 * ("localnet" or "devnet"); a path to the JSON file is accepted too and reduced to its stem.
 * Both deployment files are imported statically so they bundle; `packages/sdk/deployments/*.json`
 * is written by `scripts/src/bootstrap.ts`.
 */
export type ChainCluster = "localnet" | "devnet";

export function configuredCluster(): ChainCluster | null {
  const raw = (process.env.NEXT_PUBLIC_DEPLOYMENT ?? "").trim();
  if (!raw) return null;
  const stem = raw.replace(/\\/g, "/").split("/").pop()!.replace(/\.json$/i, "").toLowerCase();
  if (stem === "localnet" || stem === "devnet") return stem;
  return null;
}

export function getDeployment(cluster: ChainCluster): Deployment {
  return parseDeployment(cluster === "localnet" ? localnetJson : devnetJson);
}

/** RPC endpoint: the env override, else the URL the deployment was bootstrapped against. */
export function rpcUrlFor(cluster: ChainCluster | null): string {
  const env = (process.env.NEXT_PUBLIC_RPC_URL ?? "").trim();
  if (env) return env;
  if (cluster) return getDeployment(cluster).rpcUrl;
  return "https://api.devnet.solana.com";
}

/** "127.0.0.1:8999" for the rail stamp. */
export function rpcHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host || url;
  } catch {
    return url;
  }
}
