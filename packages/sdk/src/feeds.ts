/**
 * Pyth feed-id helpers. Kept free of Node and `Buffer` so the browser entry can use them.
 */

export function normalizeFeedId(id: string): string {
  return id.replace(/^0x/i, "").toLowerCase();
}

/** Feed id as the 32-byte array the on-chain template stores. */
export function feedIdBytes(id: string): number[] {
  const hex = normalizeFeedId(id);
  if (hex.length !== 64 || /[^0-9a-f]/.test(hex)) throw new Error(`feed id must be 32 bytes hex, got ${id}`);
  const out: number[] = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

export function feedIdFromBytes(bytes: number[] | Uint8Array): string {
  let s = "";
  for (const b of bytes) s += (b & 0xff).toString(16).padStart(2, "0");
  return s;
}
