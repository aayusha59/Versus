import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface Holder {
  owner: PublicKey;
  tokenAccount: PublicKey;
  /** Raw token amount. */
  amount: bigint;
}

export interface SnapshotOptions {
  /** Owners to exclude (program vaults, Meteora pool vaults, the operator...). */
  exclude?: PublicKey[];
  /** Token accounts to exclude by address. */
  excludeAccounts?: PublicKey[];
  /** Token program of the mint. Defaults to SPL Token; pass TOKEN_2022_PROGRAM_ID for 2022 mints. */
  programId?: PublicKey;
  /** Drop balances strictly below this raw amount (default 1, i.e. drop zero). */
  minAmount?: bigint;
}

const TOKEN_ACCOUNT_SIZE = 165;

/**
 * Snapshot every holder of `mint` via `getProgramAccounts` (dataSize 165 + memcmp on mint for
 * SPL Token; memcmp only for Token-2022, whose accounts carry extensions and vary in size).
 * Zero balances and excluded owners/accounts are dropped.
 */
export async function snapshotHolders(
  connection: Connection,
  mint: PublicKey,
  opts: SnapshotOptions = {},
): Promise<Holder[]> {
  const programId = opts.programId ?? TOKEN_PROGRAM_ID;
  const isToken2022 = programId.equals(TOKEN_2022_PROGRAM_ID);
  const filters = isToken2022
    ? [{ memcmp: { offset: 0, bytes: mint.toBase58() } }]
    : [{ dataSize: TOKEN_ACCOUNT_SIZE }, { memcmp: { offset: 0, bytes: mint.toBase58() } }];

  const accounts = await connection.getProgramAccounts(programId, {
    commitment: "confirmed",
    filters,
    // Only the first 72 bytes (mint, owner, amount) are needed.
    dataSlice: { offset: 0, length: 72 },
  });

  const excludeOwners = new Set((opts.exclude ?? []).map((k) => k.toBase58()));
  const excludeAccounts = new Set((opts.excludeAccounts ?? []).map((k) => k.toBase58()));
  const minAmount = opts.minAmount ?? 1n;

  const holders: Holder[] = [];
  for (const { pubkey, account } of accounts) {
    const data = account.data;
    if (data.length < 72) continue;
    const owner = new PublicKey(data.subarray(32, 64));
    const amount = data.readBigUInt64LE(64);
    if (amount < minAmount) continue;
    if (excludeOwners.has(owner.toBase58())) continue;
    if (excludeAccounts.has(pubkey.toBase58())) continue;
    holders.push({ owner, tokenAccount: pubkey, amount });
  }
  holders.sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));
  return holders;
}

export interface Payout {
  owner: PublicKey;
  tokenAccount: PublicKey;
  /** Raw reward-token amount to send. */
  amount: bigint;
  /** Holder's share of the snapshot (0..1). */
  share: number;
}

export interface ProRataOptions {
  /** Payouts worth less than this many USD are skipped and stay in the vault for the next epoch. */
  minHolderValueUsd?: number;
  /** USD price of one whole reward token (the pair token). Required if minHolderValueUsd > 0. */
  priceUsd?: number;
  /** Decimals of the reward token (default 6). */
  rewardDecimals?: number;
}

/**
 * Split `vaultBalance` (raw reward-token units) across holders in proportion to their balances.
 * Integer floor per recipient; dust and skipped payouts remain in the vault.
 */
export function computeProRata(
  vaultBalance: bigint,
  holders: Holder[],
  opts: ProRataOptions = {},
): { payouts: Payout[]; total: bigint; totalHeld: bigint; skipped: number } {
  const totalHeld = holders.reduce((s, h) => s + h.amount, 0n);
  if (vaultBalance <= 0n || totalHeld === 0n) {
    return { payouts: [], total: 0n, totalHeld, skipped: 0 };
  }
  const minUsd = opts.minHolderValueUsd ?? 0;
  const decimals = opts.rewardDecimals ?? 6;
  const priceUsd = opts.priceUsd ?? 0;
  if (minUsd > 0 && !(priceUsd > 0)) {
    throw new Error("computeProRata: priceUsd is required when minHolderValueUsd > 0");
  }
  const minRaw = minUsd > 0 ? BigInt(Math.ceil((minUsd / priceUsd) * 10 ** decimals)) : 0n;

  const payouts: Payout[] = [];
  let total = 0n;
  let skipped = 0;
  for (const h of holders) {
    const amount = (vaultBalance * h.amount) / totalHeld;
    if (amount <= 0n || amount < minRaw) {
      skipped++;
      continue;
    }
    payouts.push({
      owner: h.owner,
      tokenAccount: h.tokenAccount,
      amount,
      share: Number(h.amount) / Number(totalHeld),
    });
    total += amount;
  }
  return { payouts, total, totalHeld, skipped };
}

/** Split recipients into chunks of `size` (the program accepts at most 12 per `distribute`). */
export function chunk<T>(items: T[], size = MAX_RECIPIENTS_PER_DISTRIBUTE): T[][] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const MAX_RECIPIENTS_PER_DISTRIBUTE = 12;

/** Alias kept for PLAN section 3 naming. */
export const chunkDistribute = chunk;

/** Human summary of an epoch for the crank's ledger line. */
export function formatLedgerLine(params: {
  market: string;
  side: string;
  epoch: number;
  total: bigint;
  count: number;
  symbol: string;
  decimals?: number;
}): string {
  const d = params.decimals ?? 6;
  const whole = Number(params.total) / 10 ** d;
  return `[epoch ${params.epoch}] ${params.market.slice(0, 8)} ${params.side.toUpperCase().padEnd(3)} paid ${whole.toFixed(6)} ${params.symbol} to ${params.count} holder${params.count === 1 ? "" : "s"}`;
}
