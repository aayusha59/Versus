/**
 * Shared helpers for synthetic Pyth `PriceUpdateV2` accounts.
 *
 * `gen.ts` writes them as solana-test-validator `--account` JSON files; `duel.ts`
 * derives the same pubkeys to call `resolve` against them.
 */
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";

/** Pyth Solana Receiver program (mainnet + devnet). */
export const PYTH_RECEIVER_PROGRAM_ID = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");

/** sha256("account:PriceUpdateV2")[..8] */
export const PRICE_UPDATE_V2_DISCRIMINATOR = Buffer.from([34, 241, 35, 99, 157, 126, 244, 205]);

export const FEED_AAPL = hexToBytes("49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688");
export const FEED_NVDA = hexToBytes("b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593");

export function hexToBytes(hex: string): number[] {
  return Array.from(Buffer.from(hex, "hex"));
}

export function fixtureKeypair(name: string): Keypair {
  const seed = createHash("sha256").update(`duel-pyth-fixture:${name}`).digest();
  return Keypair.fromSeed(seed);
}

export interface PriceUpdateFields {
  feedId: number[];
  price: bigint;
  conf: bigint;
  exponent: number;
  publishTime: bigint;
  emaPrice?: bigint;
  emaConf?: bigint;
  postedSlot?: bigint;
  /** number of signatures for a Partial verification level; omit for Full */
  partialSignatures?: number;
}

/** Borsh-encode a PriceUpdateV2 account (134 bytes, same as the receiver program allocates). */
export function encodePriceUpdateV2(f: PriceUpdateFields): Buffer {
  const buf = Buffer.alloc(134);
  let o = 0;
  PRICE_UPDATE_V2_DISCRIMINATOR.copy(buf, o);
  o += 8;
  o += 32; // write_authority = zeros
  if (f.partialSignatures !== undefined) {
    buf.writeUInt8(0, o++);
    buf.writeUInt8(f.partialSignatures, o++);
  } else {
    buf.writeUInt8(1, o++);
  }
  Buffer.from(f.feedId).copy(buf, o);
  o += 32;
  buf.writeBigInt64LE(f.price, o);
  o += 8;
  buf.writeBigUInt64LE(f.conf, o);
  o += 8;
  buf.writeInt32LE(f.exponent, o);
  o += 4;
  buf.writeBigInt64LE(f.publishTime, o);
  o += 8;
  buf.writeBigInt64LE(f.publishTime - 1n, o);
  o += 8;
  buf.writeBigInt64LE(f.emaPrice ?? f.price, o);
  o += 8;
  buf.writeBigUInt64LE(f.emaConf ?? f.conf, o);
  o += 8;
  buf.writeBigUInt64LE(f.postedSlot ?? 1n, o);
  return buf;
}

/** The scenarios gen.ts materializes. Prices: AAPL $250.12345 (expo -5), NVDA $180.50 (expo -8). */
export function scenarios(now: bigint) {
  return {
    aapl: { feedId: FEED_AAPL, price: 25_012_345n, conf: 1_000n, exponent: -5, publishTime: now },
    nvda: { feedId: FEED_NVDA, price: 18_050_000_000n, conf: 100_000n, exponent: -8, publishTime: now },
    aaplStale: { feedId: FEED_AAPL, price: 25_012_345n, conf: 1_000n, exponent: -5, publishTime: now - 7n * 3600n },
    aaplPartial: {
      feedId: FEED_AAPL,
      price: 25_012_345n,
      conf: 1_000n,
      exponent: -5,
      publishTime: now,
      partialSignatures: 3,
    },
  } satisfies Record<string, PriceUpdateFields>;
}

export type ScenarioName = keyof ReturnType<typeof scenarios>;

export const AAPL_PRICE_E6 = 250_123_450n;
export const NVDA_PRICE_E6 = 180_500_000n;
