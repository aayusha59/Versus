import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { configuredCluster, getDeployment, rpcUrlFor } from "@/lib/data/deployment";

/**
 * POST /api/faucet { owner } -> { signature, airdrop? }
 *
 * Sends 1,000 mock USDC to `owner` and, on localnet, airdrops 1 SOL for fees (on devnet it tops
 * the wallet up from the faucet key when it is empty, because public airdrops are rate limited).
 * Refuses unless the configured deployment is localnet or devnet: there is no mock USDC on mainnet.
 *
 * The faucet key mints when it is the USDC mint authority (the localnet bootstrap operator) and
 * otherwise transfers from its own USDC balance. On devnet it must be a dedicated key, never the
 * operator (mint authority, resolver, crank): `pnpm --filter scripts faucet:setup` creates and
 * funds one. Limits: IP_MAX requests per IP per hour (per server instance), and wallets that
 * already hold USDC_AMOUNT or more are turned away.
 *
 * Server env: FAUCET_KEYPAIR (the JSON byte array itself, for hosts without a key file) or
 * FAUCET_KEYPAIR_PATH (JSON byte array; default ../../scripts/.keys/id.json from apps/web, the
 * localnet operator), NEXT_PUBLIC_DEPLOYMENT, NEXT_PUBLIC_RPC_URL,
 * FAUCET_RPC_URL (optional server-only RPC, e.g. a keyed provider the browser should not see).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USDC_AMOUNT = 1_000;
const DEVNET_TOPUP_SOL = 0.02;
const IP_MAX = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;

const hitsByIp = new Map<string, number[]>();

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "local";
}

/** Records the hit and returns false once the IP is over the limit for the window. */
function allowIp(ip: string, now = Date.now()): boolean {
  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= IP_MAX) {
    hitsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  hitsByIp.set(ip, recent);
  return true;
}

function keypairPath(): string {
  const p = process.env.FAUCET_KEYPAIR_PATH?.trim() || "../../scripts/.keys/id.json";
  return path.isAbsolute(p) || p.startsWith("\\\\") ? p : path.resolve(process.cwd(), p);
}

function loadFaucetKey(): Keypair {
  const inline = process.env.FAUCET_KEYPAIR?.trim();
  if (inline) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(inline) as number[]));
  const p = keypairPath();
  if (!fs.existsSync(p)) throw new Error(`Faucet key not found at ${p}. Run the bootstrap first or set FAUCET_KEYPAIR_PATH.`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")) as number[]));
}

async function tokenBalance(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    return BigInt((await connection.getTokenAccountBalance(ata, "confirmed")).value.amount);
  } catch {
    return 0n;
  }
}

export async function POST(req: Request) {
  const cluster = configuredCluster();
  if (!cluster) return NextResponse.json({ error: "Faucet is off: the app is in demo mode." }, { status: 403 });
  const dep = getDeployment(cluster);
  if (dep.cluster !== "localnet" && dep.cluster !== "devnet") {
    return NextResponse.json({ error: "Faucet refuses to run against mainnet." }, { status: 403 });
  }
  const usdc = dep.mints.USDC;
  if (!usdc) return NextResponse.json({ error: `No mock USDC in the ${cluster} deployment. Run the bootstrap.` }, { status: 500 });

  let owner: PublicKey;
  try {
    const body = (await req.json()) as { owner?: string };
    owner = new PublicKey(body.owner ?? "");
  } catch {
    return NextResponse.json({ error: "Send { owner: <base58 public key> }." }, { status: 400 });
  }

  if (dep.cluster !== "localnet" && !allowIp(clientIp(req))) {
    return NextResponse.json({ error: "Faucet limit reached for this network. Try again in an hour." }, { status: 429 });
  }

  let faucet: Keypair;
  try {
    faucet = loadFaucetKey();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  if (dep.cluster !== "localnet" && faucet.publicKey.toBase58() === dep.operator) {
    return NextResponse.json(
      { error: "Faucet is configured with the operator key. Run `pnpm --filter scripts faucet:setup` and set FAUCET_KEYPAIR to the key it creates." },
      { status: 500 },
    );
  }

  const connection = new Connection(process.env.FAUCET_RPC_URL?.trim() || rpcUrlFor(cluster), "confirmed");
  const mint = new PublicKey(usdc.mint);
  const raw = BigInt(USDC_AMOUNT) * 10n ** BigInt(usdc.decimals);
  const ata = getAssociatedTokenAddressSync(mint, owner, true);

  const held = await tokenBalance(connection, ata);
  if (held >= raw) {
    const whole = Number(held) / 10 ** usdc.decimals;
    return NextResponse.json(
      { error: `This wallet already has ${whole.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC. The faucet tops up wallets below ${USDC_AMOUNT.toLocaleString("en-US")}.` },
      { status: 429 },
    );
  }

  let airdrop: string | null = null;
  try {
    if (dep.cluster === "localnet") {
      const sig = await connection.requestAirdrop(owner, LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      airdrop = sig;
    } else if ((await connection.getBalance(owner)) < 0.01 * LAMPORTS_PER_SOL) {
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: owner, lamports: Math.round(DEVNET_TOPUP_SOL * LAMPORTS_PER_SOL) }),
      );
      airdrop = await sendAndConfirmTransaction(connection, tx, [faucet], { commitment: "confirmed" });
    }
  } catch (e) {
    // SOL is best effort; the USDC transfer below still tells the user what happened.
    airdrop = null;
    console.warn("[faucet] SOL top-up failed:", (e as Error).message);
  }

  try {
    const mintInfo = await getMint(connection, mint, "confirmed");
    const tx = new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, owner, mint));
    if (mintInfo.mintAuthority?.equals(faucet.publicKey)) {
      tx.add(createMintToInstruction(mint, ata, faucet.publicKey, raw));
    } else {
      const source = getAssociatedTokenAddressSync(mint, faucet.publicKey);
      if ((await tokenBalance(connection, source)) < raw) {
        return NextResponse.json({ error: "The faucet is out of USDC. Refill it with `pnpm --filter scripts faucet:setup`." }, { status: 503 });
      }
      tx.add(createTransferCheckedInstruction(source, mint, ata, faucet.publicKey, raw, usdc.decimals));
    }
    const signature = await sendAndConfirmTransaction(connection, tx, [faucet], { commitment: "confirmed" });
    return NextResponse.json({ signature, airdrop, amount: USDC_AMOUNT, cluster });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    const friendly = /ECONNREFUSED|fetch failed/i.test(msg) ? "The RPC did not answer. Is the validator running?" : `Faucet failed: ${msg.slice(0, 160)}`;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
