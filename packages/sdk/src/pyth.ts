import { HermesClient } from "@pythnetwork/hermes-client";
import {
  DEFAULT_RECEIVER_PROGRAM_ID,
  DEFAULT_WORMHOLE_PROGRAM_ID,
  PythSolanaReceiver,
  type InstructionWithEphemeralSigners,
} from "@pythnetwork/pyth-solana-receiver";
import { Connection, PublicKey, type Signer, type VersionedTransaction } from "@solana/web3.js";
import { normalizeFeedId } from "./feeds.js";
import { ASSETS, type AssetSymbol } from "./registry.js";
import type { AnchorWallet } from "./types.js";

/**
 * Hermes. Since the Pyth Core upgrade (26 Aug 2026) every Hermes price-update endpoint requires
 * `Authorization: Bearer <key>`; only `v2/price_feeds` is open. Keys come from the Pyth Terminal
 * (free trial). Set `PYTH_API_KEY` in the environment or pass `apiKey`.
 * `hermes.pyth.network` still works with a key; the upgraded host is the recommended one.
 */
export const HERMES_URL = "https://pyth.dourolabs.app/hermes";
export const HERMES_URL_LEGACY = "https://hermes.pyth.network";

/**
 * Live Pyth Solana Receiver (exists on mainnet and devnet, verified 2026-09-26).
 * The older id rec5EKMGg6sxjzZuHGWxVpUKpY6z1MDfvb7uzcYNqrn is NOT deployed on either cluster
 * any more; the on-chain program's owner check for PriceUpdateV2 must use this one.
 */
export const PYTH_RECEIVER_PROGRAM_ID: PublicKey = DEFAULT_RECEIVER_PROGRAM_ID;
export const PYTH_RECEIVER_PROGRAM_ID_LEGACY = new PublicKey("rec5EKMGg6sxjzZuHGWxVpUKpY6z1MDfvb7uzcYNqrn");
export const PYTH_WORMHOLE_PROGRAM_ID: PublicKey = DEFAULT_WORMHOLE_PROGRAM_ID;
/** Fixed treasury id so localnet clone lists are deterministic (the SDK picks a random one otherwise). */
export const PYTH_TREASURY_ID = 0;

/** Feed ids keyed by registry symbol (32-byte hex, no 0x). */
export const PYTH_FEEDS: Record<AssetSymbol, string> = Object.fromEntries(
  Object.values(ASSETS).map((a) => [a.symbol, a.pythFeedId]),
) as Record<AssetSymbol, string>;


export interface HermesOptions {
  hermesUrl?: string;
  apiKey?: string;
}

function resolveApiKey(opts?: HermesOptions): string | undefined {
  if (opts?.apiKey) return opts.apiKey;
  if (typeof process !== "undefined" && process.env?.PYTH_API_KEY) return process.env.PYTH_API_KEY;
  return undefined;
}

export function hermesClient(opts: HermesOptions = {}): HermesClient {
  const accessToken = resolveApiKey(opts);
  return new HermesClient(opts.hermesUrl ?? HERMES_URL, accessToken ? { accessToken } : {});
}

export interface PythPrice {
  feedId: string;
  /** Price as a JS number (price * 10^expo). */
  price: number;
  conf: number;
  expo: number;
  /** Raw integer price string from Hermes. */
  priceRaw: string;
  publishTime: number;
  /** Price scaled to 1e6, as the program stores it. */
  priceE6: bigint;
}

function explain401(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/401|unauthori/i.test(msg)) {
    throw new Error(
      "Hermes rejected the request (401). Hermes requires an API key since the Pyth Core upgrade; " +
        "set PYTH_API_KEY (free trial at the Pyth Terminal) or pass { apiKey }. Original: " +
        msg,
    );
  }
  throw e instanceof Error ? e : new Error(msg);
}

/**
 * Latest prices from Hermes for the given feed ids.
 * Equivalent to `GET {hermes}/v2/updates/price/latest?ids[]=...&parsed=true`.
 */
export async function getLatestPrices(feedIds: string[], opts: HermesOptions = {}): Promise<Record<string, PythPrice>> {
  const ids = feedIds.map(normalizeFeedId);
  const client = hermesClient(opts);
  let update;
  try {
    update = await client.getLatestPriceUpdates(ids, { encoding: "base64", parsed: true });
  } catch (e) {
    explain401(e);
  }
  const out: Record<string, PythPrice> = {};
  for (const p of update.parsed ?? []) {
    const id = normalizeFeedId(p.id);
    const expo = p.price.expo;
    const raw = BigInt(p.price.price);
    const price = Number(p.price.price) * 10 ** expo;
    const priceE6 = expo >= -6 ? raw * 10n ** BigInt(expo + 6) : raw / 10n ** BigInt(-expo - 6);
    out[id] = {
      feedId: id,
      price,
      conf: Number(p.price.conf) * 10 ** expo,
      expo,
      priceRaw: p.price.price,
      publishTime: p.price.publish_time,
      priceE6,
    };
  }
  for (const id of ids) {
    if (!out[id]) throw new Error(`Hermes returned no price for feed ${id}`);
  }
  return out;
}

/** Prices for registry symbols, keyed by symbol. */
export async function getLatestPricesBySymbol(
  symbols: AssetSymbol[],
  opts: HermesOptions = {},
): Promise<Record<AssetSymbol, PythPrice>> {
  const byId = await getLatestPrices(
    symbols.map((s) => PYTH_FEEDS[s]),
    opts,
  );
  return Object.fromEntries(symbols.map((s) => [s, byId[PYTH_FEEDS[s]]])) as Record<AssetSymbol, PythPrice>;
}

/** Base64 accumulator updates (VAAs) for posting on-chain. */
export async function getLatestVaas(feedIds: string[], opts: HermesOptions = {}): Promise<string[]> {
  const client = hermesClient(opts);
  try {
    const update = await client.getLatestPriceUpdates(feedIds.map(normalizeFeedId), { encoding: "base64", parsed: false });
    return update.binary.data;
  } catch (e) {
    explain401(e);
  }
}

export interface PostPriceUpdatesParams extends HermesOptions {
  connection: Connection;
  /** Pays for the ephemeral PriceUpdateV2 accounts and signs the post transactions. */
  wallet: AnchorWallet;
  feedIds: string[];
  receiverProgramId?: PublicKey;
  wormholeProgramId?: PublicKey;
  computeUnitPriceMicroLamports?: number;
  /** When false, build but do not send the post transactions (default true). */
  send?: boolean;
}

export interface PostedPriceUpdates {
  /** feedId (no 0x) -> PriceUpdateV2 account. */
  accounts: Record<string, PublicKey>;
  postTransactions: { tx: VersionedTransaction; signers: Signer[] }[];
  postSignatures: string[];
  /** Close the ephemeral accounts to recover rent; run after `resolve` has consumed them. */
  closeInstructions: InstructionWithEphemeralSigners[];
  cleanup: () => Promise<string[]>;
  receiver: PythSolanaReceiver;
}

/**
 * Post fully verified Pyth price updates as `PriceUpdateV2` accounts and return their addresses
 * plus cleanup instructions. Posting one feed takes 2-3 transactions (encoded VAA init/write/verify,
 * then post); they are sent and confirmed in order when `send` is true.
 */
export async function postPriceUpdates(params: PostPriceUpdatesParams): Promise<PostedPriceUpdates> {
  // The receiver types its wallet as Anchor's NodeWallet class; it only uses publicKey + sign*.
  const receiver = new PythSolanaReceiver({
    connection: params.connection,
    wallet: params.wallet as unknown as ConstructorParameters<typeof PythSolanaReceiver>[0]["wallet"],
    receiverProgramId: params.receiverProgramId ?? PYTH_RECEIVER_PROGRAM_ID,
    wormholeProgramId: params.wormholeProgramId ?? PYTH_WORMHOLE_PROGRAM_ID,
    treasuryId: PYTH_TREASURY_ID,
  });
  const vaas = await getLatestVaas(params.feedIds, params);
  const { postInstructions, priceFeedIdToPriceUpdateAccount, closeInstructions } =
    await receiver.buildPostPriceUpdateInstructions(vaas);

  const accounts: Record<string, PublicKey> = {};
  for (const [k, v] of Object.entries(priceFeedIdToPriceUpdateAccount)) accounts[normalizeFeedId(k)] = v;
  for (const id of params.feedIds.map(normalizeFeedId)) {
    if (!accounts[id]) throw new Error(`no price update account built for feed ${id}`);
  }

  const feeCfg = { computeUnitPriceMicroLamports: params.computeUnitPriceMicroLamports ?? 0 };
  const postTransactions = await receiver.batchIntoVersionedTransactions(postInstructions, feeCfg);
  let postSignatures: string[] = [];
  if (params.send !== false) {
    postSignatures = await receiver.provider.sendAll(postTransactions, { skipPreflight: false, commitment: "confirmed" });
  }
  const cleanup = async () => {
    const txs = await receiver.batchIntoVersionedTransactions(closeInstructions, feeCfg);
    return receiver.provider.sendAll(txs, { skipPreflight: true });
  };
  return { accounts, postTransactions, postSignatures, closeInstructions, cleanup, receiver };
}

/** PDAs the local validator needs cloned for on-chain posting (see scripts/src/validator.ts). */
export function pythLocalnetAccounts(receiverProgramId: PublicKey = PYTH_RECEIVER_PROGRAM_ID): {
  programs: PublicKey[];
  accounts: PublicKey[];
} {
  const wormhole = PYTH_WORMHOLE_PROGRAM_ID;
  const guardianSets = [0, 1].map((i) => {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(i, 0);
    return PublicKey.findProgramAddressSync([Buffer.from("GuardianSet"), b], wormhole)[0];
  });
  const config = PublicKey.findProgramAddressSync([Buffer.from("config")], receiverProgramId)[0];
  const treasury = PublicKey.findProgramAddressSync([Buffer.from("treasury"), Buffer.from([PYTH_TREASURY_ID])], receiverProgramId)[0];
  return { programs: [receiverProgramId, wormhole], accounts: [config, treasury, ...guardianSets] };
}
