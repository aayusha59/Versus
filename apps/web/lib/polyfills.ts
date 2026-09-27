/**
 * Browser polyfills for the Solana stack. web3.js and Anchor import the `buffer` package
 * themselves, but a few code paths (bn.js `toArrayLike(Buffer)`, spl-token layouts) reach for
 * the global. Imported first by the chain adapter and the providers so it runs before them.
 */
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (typeof g.Buffer === "undefined") g.Buffer = Buffer;

export {};
