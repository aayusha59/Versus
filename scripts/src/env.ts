import { Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { config as dotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clusterFromRpcUrl, type Cluster } from "@versus/sdk";

const here = path.dirname(fileURLToPath(import.meta.url)); // scripts/src
export const SCRIPTS_DIR = path.resolve(here, "..");
export const REPO_DIR = path.resolve(SCRIPTS_DIR, "..");

// scripts/.env first, then repo root .env, then cwd (.env in the cwd wins nothing already set).
dotenv({ path: path.join(SCRIPTS_DIR, ".env") });
dotenv({ path: path.join(REPO_DIR, ".env") });
dotenv();

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
export const KEYPAIR_PATH = process.env.KEYPAIR_PATH ?? "./.keys/id.json";
export const CLUSTER: Cluster = (process.env.CLUSTER as Cluster | undefined) ?? clusterFromRpcUrl(RPC_URL);
export const PROGRAM_ID_OVERRIDE = process.env.PROGRAM_ID ? new PublicKey(process.env.PROGRAM_ID) : undefined;

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export function resolveKeypairPath(p: string = KEYPAIR_PATH): string {
  if (p.startsWith("~")) p = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", p.slice(1));
  return path.isAbsolute(p) || p.startsWith("\\\\") ? p : path.resolve(SCRIPTS_DIR, p);
}

/** Load the operator keypair. On localnet a missing file is generated so bootstrap just works. */
export function loadKeypair(p: string = KEYPAIR_PATH): Keypair {
  const abs = resolveKeypairPath(p);
  if (!fs.existsSync(abs)) {
    if (CLUSTER !== "localnet") {
      throw new Error(`Keypair not found at ${abs}. Set KEYPAIR_PATH or run: solana-keygen new -o ${abs}`);
    }
    const kp = Keypair.generate();
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(Array.from(kp.secretKey)));
    console.log(`Generated localnet keypair ${kp.publicKey.toBase58()} at ${abs}`);
    return kp;
  }
  const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function walletFor(kp: Keypair): Wallet {
  return new Wallet(kp);
}

export interface Args {
  flags: Record<string, string | true>;
  positional: string[];
}

/** `--flag value`, `--flag=value`, `--bool`, positionals. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // pnpm forwards a literal "--" when invoked as `pnpm --filter scripts x -- --flag`; ignore it.
    if (a === "--") continue;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

export function flagString(args: Args, name: string): string | undefined {
  const v = args.flags[name];
  return typeof v === "string" ? v : undefined;
}

export function flagNumber(args: Args, name: string, dflt: number): number {
  const v = flagString(args, name);
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}

/** Airdrop on localnet/devnet when the balance is below `minSol`. Devnet airdrops are rate limited. */
export async function ensureSol(connection: Connection, pubkey: PublicKey, minSol = 2): Promise<number> {
  const bal = (await connection.getBalance(pubkey)) / LAMPORTS_PER_SOL;
  if (bal >= minSol || CLUSTER === "mainnet") return bal;
  const want = CLUSTER === "localnet" ? Math.max(10, minSol) : Math.min(2, minSol);
  try {
    const sig = await connection.requestAirdrop(pubkey, Math.ceil(want * LAMPORTS_PER_SOL));
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    console.log(`Airdropped ${want} SOL to ${pubkey.toBase58()}`);
  } catch (e) {
    console.warn(`Airdrop failed (${(e as Error).message}); balance is ${bal.toFixed(3)} SOL. Fund ${pubkey.toBase58()} manually (https://faucet.solana.com).`);
  }
  return (await connection.getBalance(pubkey)) / LAMPORTS_PER_SOL;
}

export function fmt(raw: bigint | number | string | { toString(): string }, decimals = 6, digits = 6): string {
  const n = Number(raw.toString()) / 10 ** decimals;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function short(pk: PublicKey | string): string {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return `${s.slice(0, 4)}..${s.slice(-4)}`;
}

export function explorerTx(sig: string): string {
  const c = CLUSTER === "localnet" ? `custom&customUrl=${encodeURIComponent(RPC_URL)}` : CLUSTER;
  return `https://explorer.solana.com/tx/${sig}?cluster=${c}`;
}

export function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}
