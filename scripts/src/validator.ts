/**
 * Print the `solana-test-validator` command for a localnet that has Meteora DAMM v2 and the
 * Pyth receiver cloned from mainnet (PLAN section 8). Run it inside WSL (Agave 3.0.13).
 *
 *   pnpm --filter scripts validator                          # prints the command
 *   pnpm --filter scripts validator -- --run                 # runs it via `wsl -d Ubuntu`
 *   pnpm --filter scripts validator -- --run --rpc-port 8999 --ledger /tmp/duel-ledger
 *
 * The ledger defaults to a WSL-native path (/tmp) because a ledger on /mnt/c is very slow.
 * With a non-default --rpc-port the faucet/gossip/dynamic ports are shifted too, so a second
 * validator (e.g. `anchor test` on 8899) can run at the same time.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { CP_AMM_PROGRAM_ID, DUEL_PROGRAM_ID, pythLocalnetAccounts } from "@duel/sdk";
import { REPO_DIR, flagNumber, flagString, parseArgs } from "./env.js";

export interface ValidatorOptions {
  rpcPort?: number;
  ledger?: string;
  /** Path to duel.so; default programs/duel/target/deploy/duel.so if it exists. */
  programSo?: string | null;
  /** Shreds of history to keep (default 50M so transaction history survives the session). */
  limitLedgerSize?: number;
}

export function validatorArgs(o: ValidatorOptions = {}): string[] {
  const pyth = pythLocalnetAccounts();
  const rpcPort = o.rpcPort ?? 8899;
  const args = [
    "--reset",
    "--url",
    "https://api.mainnet-beta.solana.com",
    // Agave 3.0: --clone-upgradeable-program copies the program account and its programdata.
    "--clone-upgradeable-program",
    CP_AMM_PROGRAM_ID.toBase58(),
    ...pyth.programs.flatMap((p) => ["--clone-upgradeable-program", p.toBase58()]),
    // The validator's built-in Token-2022 fails cp-amm's position-NFT metadata realloc
    // ("Failed to reallocate account data"); mainnet's Token-2022 build works, so clone it too.
    "--clone-upgradeable-program",
    TOKEN_2022_PROGRAM_ID.toBase58(),
    // Receiver config + treasury and the Wormhole guardian sets; skipped if absent upstream.
    ...pyth.accounts.flatMap((a) => ["--maybe-clone", a.toBase58()]),
  ];
  // Load our program at genesis if it has been built (anchor build in WSL writes target/deploy/duel.so).
  const so = o.programSo === undefined ? path.join(REPO_DIR, "programs", "duel", "target", "deploy", "duel.so") : o.programSo;
  if (so && fs.existsSync(so)) {
    args.push("--bpf-program", DUEL_PROGRAM_ID.toBase58(), toWslPath(so));
  }
  if (rpcPort !== 8899) {
    args.push("--rpc-port", String(rpcPort));
    args.push("--faucet-port", String(rpcPort + 1001));
    args.push("--gossip-port", String(rpcPort + 1002));
    args.push("--dynamic-port-range", `${rpcPort + 1100}-${rpcPort + 1300}`);
  }
  // The test validator keeps only 10,000 shreds (a few minutes of slots) by default, after which
  // getSignaturesForAddress forgets everything: the web ledger and "earned" read RewardsPaid from
  // transaction history, so keep the whole session (~100 MB per idle hour).
  args.push("--limit-ledger-size", String(o.limitLedgerSize ?? 50_000_000));
  args.push("--ledger", o.ledger ?? "/tmp/duel-test-ledger");
  return args;
}

/** C:\Users\x\repo -> /mnt/c/Users/x/repo (already-POSIX paths pass through). */
export function toWslPath(p: string): string {
  if (p.startsWith("/")) return p;
  const abs = path.resolve(p).replace(/\\/g, "/");
  const m = /^([A-Za-z]):\/(.*)$/.exec(abs);
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2]}` : abs;
}

function main() {
  const args = parseArgs();
  const opts: ValidatorOptions = {
    rpcPort: flagNumber(args, "rpc-port", 8899),
    ledger: flagString(args, "ledger"),
    limitLedgerSize: flagNumber(args, "limit-ledger-size", 50_000_000),
  };
  const cmd = ["solana-test-validator", ...validatorArgs(opts)];
  const oneLine = cmd.join(" ");
  const pretty = cmd.reduce((acc, a, i) => (i === 0 ? a : a.startsWith("--") ? `${acc} \\\n  ${a}` : `${acc} ${a}`), "");
  if (args.flags.run === true) {
    console.log(`running in WSL: ${oneLine}\n`);
    const child = spawn("wsl", ["-d", "Ubuntu", "--", "bash", "-lc", oneLine], { stdio: "inherit" });
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }
  console.log("# Run inside WSL (Agave 3.0.13). --reset is required for the clones to take effect on an existing ledger.");
  console.log(pretty);
  console.log("\n# From PowerShell:");
  console.log(`wsl -d Ubuntu -- bash -lc '${oneLine}'`);
  console.log("\n# Then bootstrap (RPC_URL=http://127.0.0.1:" + (opts.rpcPort ?? 8899) + "):");
  console.log("#   pnpm --filter scripts bootstrap");
  console.log("# (If duel.so was not found above, deploy it: cd programs/duel && anchor deploy --provider.cluster localnet)");
}

const isMain = process.argv[1] && /validator\.(ts|js)$/.test(process.argv[1]);
if (isMain) main();
