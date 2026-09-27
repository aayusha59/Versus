import { parseDeployment } from "./deployments.js";
import type { Cluster, Deployment } from "./types.js";

/**
 * Node-only deployment file helpers (`packages/sdk/deployments/<cluster>.json`). Browser code
 * imports the JSON statically instead; see `deployments.ts` and the `@duel/sdk/browser` entry.
 */

async function nodeDeps() {
  const [fs, path, url] = await Promise.all([import("node:fs/promises"), import("node:path"), import("node:url")]);
  return { fs, path, url };
}

/** Absolute path of `packages/sdk/deployments/<cluster>.json`. */
export async function deploymentPath(cluster: Cluster): Promise<string> {
  const { path, url } = await nodeDeps();
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  // src/deployments-node.ts -> ../deployments ; dist/src/deployments-node.js -> ../../deployments
  const candidates = [path.resolve(here, "..", "deployments"), path.resolve(here, "..", "..", "deployments")];
  const { fs } = await nodeDeps();
  for (const c of candidates) {
    try {
      await fs.access(c);
      return path.join(c, `${cluster}.json`);
    } catch {
      /* try next */
    }
  }
  return path.join(candidates[0], `${cluster}.json`);
}

export async function loadDeployment(cluster: Cluster): Promise<Deployment> {
  const { fs } = await nodeDeps();
  const p = await deploymentPath(cluster);
  let text: string;
  try {
    text = await fs.readFile(p, "utf8");
  } catch {
    throw new Error(`No deployment for ${cluster} at ${p}. Run \`pnpm --filter scripts bootstrap\` first.`);
  }
  return parseDeployment(JSON.parse(text));
}

export async function loadDeploymentIfExists(cluster: Cluster): Promise<Deployment | null> {
  try {
    return await loadDeployment(cluster);
  } catch {
    return null;
  }
}

export async function saveDeployment(dep: Deployment): Promise<string> {
  const { fs, path } = await nodeDeps();
  const p = await deploymentPath(dep.cluster);
  await fs.mkdir(path.dirname(p), { recursive: true });
  dep.updatedAt = new Date().toISOString();
  await fs.writeFile(p, JSON.stringify(dep, null, 2) + "\n", "utf8");
  return p;
}
