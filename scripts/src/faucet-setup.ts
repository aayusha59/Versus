/**
 * Create and fund a dedicated faucet key, so the web app's /api/faucet never holds the operator
 * key (which is also the mint authority, resolver, and crank).
 *
 *   pnpm --filter scripts faucet:setup [-- --sol 1 --usdc 100000 --out .keys/faucet-devnet.json]
 *
 * Tops the faucet key up from the operator to at least `--sol` SOL and `--usdc` mock USDC
 * (transfers, not mints: the faucet key gets no authority over the mint). Re-run to refill.
 * Then give the web server the key: FAUCET_KEYPAIR_PATH=<file> locally, or paste the file's JSON
 * array into FAUCET_KEYPAIR on the host.
 */
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { loadDeployment } from "@versus/sdk";
import { CLUSTER, RPC_URL, die, explorerTx, flagNumber, flagString, fmt, getConnection, loadKeypair, parseArgs, resolveKeypairPath } from "./env.js";

async function main() {
  const args = parseArgs();
  if (CLUSTER === "mainnet") die("faucet:setup is for devnet/localnet only");
  const wantSol = flagNumber(args, "sol", 1);
  const wantUsdc = flagNumber(args, "usdc", 100_000);
  const out = resolveKeypairPath(flagString(args, "out") ?? `./.keys/faucet-${CLUSTER}.json`);

  const connection = getConnection();
  const operator = loadKeypair();
  const dep = await loadDeployment(CLUSTER);
  const usdc = dep.mints.USDC ?? die(`no mock USDC in the ${CLUSTER} deployment; run the bootstrap first`);

  let faucet: Keypair;
  if (fs.existsSync(out)) {
    faucet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(out, "utf8")) as number[]));
  } else {
    faucet = Keypair.generate();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(Array.from(faucet.secretKey)));
    console.log(`generated ${out}`);
  }
  if (faucet.publicKey.equals(operator.publicKey)) die("the faucet key must not be the operator key");

  console.log(`cluster=${CLUSTER} rpc=${RPC_URL}`);
  console.log(`operator=${operator.publicKey.toBase58()} faucet=${faucet.publicKey.toBase58()} (${out})`);

  const solBal = await connection.getBalance(faucet.publicKey);
  const solTarget = Math.round(wantSol * LAMPORTS_PER_SOL);
  if (solBal < solTarget) {
    const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: operator.publicKey, toPubkey: faucet.publicKey, lamports: solTarget - solBal }));
    const sig = await sendAndConfirmTransaction(connection, tx, [operator], { commitment: "confirmed" });
    console.log(`sent ${((solTarget - solBal) / LAMPORTS_PER_SOL).toFixed(4)} SOL  ${explorerTx(sig)}`);
  }

  const mint = new PublicKey(usdc.mint);
  const from = getAssociatedTokenAddressSync(mint, operator.publicKey);
  const to = getAssociatedTokenAddressSync(mint, faucet.publicKey);
  const have = await tokenBalance(connection, to);
  const target = BigInt(Math.round(wantUsdc * 10 ** usdc.decimals));
  if (have < target) {
    const tx = new Transaction()
      .add(createAssociatedTokenAccountIdempotentInstruction(operator.publicKey, to, faucet.publicKey, mint))
      .add(createTransferCheckedInstruction(from, mint, to, operator.publicKey, target - have, usdc.decimals));
    const sig = await sendAndConfirmTransaction(connection, tx, [operator], { commitment: "confirmed" });
    console.log(`sent ${fmt(target - have, usdc.decimals)} USDC  ${explorerTx(sig)}`);
  }

  const [opSol, fSol, fUsdc] = await Promise.all([connection.getBalance(operator.publicKey), connection.getBalance(faucet.publicKey), tokenBalance(connection, to)]);
  console.log(`operator ${(opSol / LAMPORTS_PER_SOL).toFixed(3)} SOL | faucet ${(fSol / LAMPORTS_PER_SOL).toFixed(3)} SOL, ${fmt(fUsdc, usdc.decimals)} USDC`);
}

async function tokenBalance(connection: ReturnType<typeof getConnection>, ata: PublicKey): Promise<bigint> {
  try {
    return BigInt((await connection.getTokenAccountBalance(ata, "confirmed")).value.amount);
  } catch {
    return 0n;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
