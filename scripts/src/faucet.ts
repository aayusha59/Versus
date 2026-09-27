/**
 * Mint mock USDC to a wallet (devnet/localnet only; the operator is the mint authority).
 *
 *   pnpm --filter scripts faucet -- <wallet> [amount=1000] [--mint AAPL]
 *
 * `faucet()` is exported for the web app's devnet route handler.
 */
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { loadDeployment, type Deployment } from "@duel/sdk";
import { CLUSTER, RPC_URL, die, explorerTx, flagString, getConnection, loadKeypair, parseArgs } from "./env.js";

export async function faucet(params: {
  connection: Connection;
  /** Mint authority (the bootstrap operator). */
  authority: Keypair;
  deployment: Deployment;
  to: PublicKey;
  /** Whole tokens (default 1000). */
  amount?: number;
  /** Registry symbol (default USDC). */
  symbol?: string;
}): Promise<{ signature: string; ata: PublicKey; raw: bigint }> {
  const sym = params.symbol ?? "USDC";
  const m = params.deployment.mints[sym];
  if (!m) throw new Error(`no mock mint for ${sym} in the ${params.deployment.cluster} deployment`);
  const mint = new PublicKey(m.mint);
  const raw = BigInt(Math.round((params.amount ?? 1000) * 10 ** m.decimals));
  const ata = getAssociatedTokenAddressSync(mint, params.to, true);
  const tx = new Transaction()
    .add(createAssociatedTokenAccountIdempotentInstruction(params.authority.publicKey, ata, params.to, mint))
    .add(createMintToInstruction(mint, ata, params.authority.publicKey, raw));
  const signature = await sendAndConfirmTransaction(params.connection, tx, [params.authority], { commitment: "confirmed" });
  return { signature, ata, raw };
}

async function main() {
  const args = parseArgs();
  const to = args.positional[0] ?? die("usage: faucet <wallet> [amount] [--mint SYMBOL]");
  const amount = args.positional[1] ? Number(args.positional[1]) : 1000;
  if (!Number.isFinite(amount) || amount <= 0) die("amount must be a positive number");
  if (CLUSTER === "mainnet") die("faucet is for devnet/localnet only");
  const symbol = flagString(args, "mint") ?? "USDC";

  const connection = getConnection();
  const authority = loadKeypair();
  const deployment = await loadDeployment(CLUSTER);
  const { signature, ata } = await faucet({ connection, authority, deployment, to: new PublicKey(to), amount, symbol });
  console.log(`cluster=${CLUSTER} rpc=${RPC_URL}`);
  console.log(`minted ${amount} ${symbol} to ${to} (ata ${ata.toBase58()})  ${explorerTx(signature)}`);
}

const isMain = process.argv[1] && /faucet\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
