/**
 * Writes synthetic Pyth PriceUpdateV2 accounts into tests/fixtures/accounts/*.json in the
 * solana-test-validator `--account <PUBKEY> <FILE>` format. Run `pnpm fixtures` right
 * before starting the validator (wsl/validator.sh picks the files up) so publish_time is
 * within the program's 6 hour freshness window.
 */
import * as fs from "fs";
import * as path from "path";
import { PYTH_RECEIVER_PROGRAM_ID, encodePriceUpdateV2, fixtureKeypair, scenarios } from "./pyth";

const outDir = path.join(__dirname, "accounts");
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith(".json")) fs.unlinkSync(path.join(outDir, f));
}

const now = BigInt(Math.floor(Date.now() / 1000));
const all = scenarios(now);
for (const [name, fields] of Object.entries(all)) {
  const pubkey = fixtureKeypair(name).publicKey.toBase58();
  const data = encodePriceUpdateV2(fields);
  const account = {
    pubkey,
    account: {
      lamports: 1_825_200,
      data: [data.toString("base64"), "base64"],
      owner: PYTH_RECEIVER_PROGRAM_ID.toBase58(),
      executable: false,
      rentEpoch: 0,
      space: data.length,
    },
  };
  const file = path.join(outDir, `pyth-${name}.json`);
  fs.writeFileSync(file, JSON.stringify(account, null, 2));
  console.log(`${name.padEnd(12)} ${pubkey}  publish_time=${fields.publishTime}  -> ${path.relative(process.cwd(), file)}`);
}
console.log(`\nvalidator args:\n  ${Object.keys(all)
  .map((n) => `--account ${fixtureKeypair(n).publicKey.toBase58()} tests/fixtures/accounts/pyth-${n}.json`)
  .join(" \\\n  ")}`);
