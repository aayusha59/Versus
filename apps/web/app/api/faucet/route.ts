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
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { configuredCluster, getDeployment, rpcUrlFor } from "@/lib/data/deployment";

/**
 * POST /api/faucet { owner } -> { signature, airdrop? }
 *
 * Mints 1,000 mock USDC to `owner` with the bootstrap operator key (the mint authority) and,
 * on localnet, airdrops 1 SOL for fees (on devnet it tops the wallet up from the operator when
 * it is empty, because public airdrops are rate limited). Refuses unless the configured
 * deployment is localnet or devnet: there is no mock USDC on mainnet.
 *
 * Server env: FAUCET_KEYPAIR (the JSON byte array itself, for hosts without a key file) or
 * FAUCET_KEYPAIR_PATH (JSON byte array; default ../../scripts/.keys/id.json from
 * apps/web, i.e. the key `scripts/bootstrap` generated), NEXT_PUBLIC_DEPLOYMENT, NEXT_PUBLIC_RPC_URL,
 * FAUCET_RPC_URL (optional server-only RPC, e.g. a keyed provider the browser should not see).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USDC_AMOUNT = 1_000;
const DEVNET_TOPUP_SOL = 0.02;

function keypairPath(): string {
  const p = process.env.FAUCET_KEYPAIR_PATH?.trim() || "../../scripts/.keys/id.json";
  return path.isAbsolute(p) || p.startsWith("\\\\") ? p : path.resolve(process.cwd(), p);
}

function loadOperator(): Keypair {
  const inline = process.env.FAUCET_KEYPAIR?.trim();
  if (inline) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(inline) as number[]));
  const p = keypairPath();
  if (!fs.existsSync(p)) throw new Error(`Faucet key not found at ${p}. Run the bootstrap first or set FAUCET_KEYPAIR_PATH.`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")) as number[]));
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

  let operator: Keypair;
  try {
    operator = loadOperator();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const connection = new Connection(process.env.FAUCET_RPC_URL?.trim() || rpcUrlFor(cluster), "confirmed");
  let airdrop: string | null = null;
  try {
    if (dep.cluster === "localnet") {
      const sig = await connection.requestAirdrop(owner, LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      airdrop = sig;
    } else if ((await connection.getBalance(owner)) < 0.01 * LAMPORTS_PER_SOL) {
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: operator.publicKey, toPubkey: owner, lamports: Math.round(DEVNET_TOPUP_SOL * LAMPORTS_PER_SOL) }),
      );
      airdrop = await sendAndConfirmTransaction(connection, tx, [operator], { commitment: "confirmed" });
    }
  } catch (e) {
    // SOL is best effort; the USDC mint below still tells the user what happened.
    airdrop = null;
    console.warn("[faucet] SOL top-up failed:", (e as Error).message);
  }

  try {
    const mint = new PublicKey(usdc.mint);
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    const raw = BigInt(USDC_AMOUNT) * 10n ** BigInt(usdc.decimals);
    const tx = new Transaction()
      .add(createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, ata, owner, mint))
      .add(createMintToInstruction(mint, ata, operator.publicKey, raw));
    const signature = await sendAndConfirmTransaction(connection, tx, [operator], { commitment: "confirmed" });
    return NextResponse.json({ signature, airdrop, amount: USDC_AMOUNT, cluster });
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    const friendly = /ECONNREFUSED|fetch failed/i.test(msg) ? "The RPC did not answer. Is the validator running?" : `Faucet failed: ${msg.slice(0, 160)}`;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
