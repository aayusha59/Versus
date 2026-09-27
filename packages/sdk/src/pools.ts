import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  CpAmm,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
  SwapMode,
  deriveCustomizablePoolAddress,
  derivePositionAddress,
  derivePositionNftAccount,
  getBaseFeeParams,
  getTokenProgram,
  getUnClaimLpFee,
  type PoolState,
  type PositionState,
} from "@meteora-ag/cp-amm-sdk";
import { TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Meteora DAMM v2 ("cp-amm") helpers. Program cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG on
 * mainnet and devnet. Built on @meteora-ag/cp-amm-sdk 1.4.x:
 *   - createCustomPool          permissionless pool with our own fee config (no config account needed)
 *   - getQuote2 / swap          quotes and swap instructions
 *   - claimPositionFee          LP fee claim
 *   - getPositionsByUser        positions owned by a wallet
 *
 * Fee mode: `CollectFeeMode.OnlyB === 1` collects the trading fee in token B only, whichever
 * direction the trade goes. We always put the outcome token (YES/NO) as token A and the pair
 * token (AAPLx...) as token B so fees accrue in the stock. (0 = BothToken, 2 = Compounding.)
 */
export const CP_AMM_PROGRAM_ID = new PublicKey("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
export const QUOTE_ONLY_FEE_MODE = CollectFeeMode.OnlyB;
export const DEFAULT_POOL_FEE_BPS = 100;

export type { PoolState, PositionState };

const cpAmmCache = new WeakMap<Connection, CpAmm>();
export function getCpAmm(connection: Connection): CpAmm {
  let c = cpAmmCache.get(connection);
  if (!c) {
    c = new CpAmm(connection);
    cpAmmCache.set(connection, c);
  }
  return c;
}

export function toBN(v: bigint | number | BN | string): BN {
  if (BN.isBN(v)) return v;
  return new BN(v.toString());
}

/* ------------------------------------------------------------------ mints */

const mintCache = new Map<string, { decimals: number; programId: PublicKey }>();

/** Decimals and token program of a mint (cached; tries SPL Token then Token-2022). */
export async function getMintInfo(connection: Connection, mint: PublicKey): Promise<{ decimals: number; programId: PublicKey }> {
  const key = mint.toBase58();
  const hit = mintCache.get(key);
  if (hit) return hit;
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`mint ${key} not found`);
  const programId = info.owner;
  const m = await getMint(connection, mint, "confirmed", programId);
  const out = { decimals: m.decimals, programId };
  mintCache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ pool address / state */

/** Customizable pools are keyed by the unordered mint pair: one pool per pair. */
export function poolAddressFor(tokenA: PublicKey, tokenB: PublicKey): PublicKey {
  return deriveCustomizablePoolAddress(tokenA, tokenB);
}

export async function poolExists(connection: Connection, pool: PublicKey): Promise<boolean> {
  return getCpAmm(connection).isPoolExist(pool);
}

export async function getPoolState(connection: Connection, pool: PublicKey): Promise<PoolState> {
  return getCpAmm(connection).fetchPoolState(pool);
}

export async function getPoolStates(connection: Connection, pools: PublicKey[]): Promise<PoolState[]> {
  const states = await getPoolStatesBatch(connection, pools);
  states.forEach((s, i) => {
    if (!s) throw new Error(`pool ${pools[i].toBase58()} not found`);
  });
  return states as PoolState[];
}

/** One `getMultipleAccountsInfo` round trip for any number of pools; `null` where a pool is missing. */
export async function getPoolStatesBatch(connection: Connection, pools: PublicKey[]): Promise<(PoolState | null)[]> {
  if (pools.length === 0) return [];
  const cp = getCpAmm(connection);
  const rows = await cp._program.account.pool.fetchMultiple(pools, "confirmed");
  return rows.map((r) => (r as PoolState | null) ?? null);
}

/**
 * Flat base fee of a pool in bps (cliff fee numerator over the 1e9 denominator). Fee version 0
 * decodes `baseFee.cliffFeeNumerator`; version 1 packs the scheduler into `baseFee.baseFeeInfo.data`
 * (32 bytes) whose first little-endian u64 is the cliff fee numerator.
 */
export function poolFeeBps(pool: PoolState): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = (pool as any).poolFees?.baseFee;
  let numerator = 0;
  if (base?.cliffFeeNumerator) {
    numerator = Number(base.cliffFeeNumerator.toString());
  } else if (base?.baseFeeInfo?.data) {
    const bytes: number[] = Array.from(base.baseFeeInfo.data as ArrayLike<number>);
    for (let i = 7; i >= 0; i--) numerator = numerator * 256 + (bytes[i] ?? 0);
  }
  return Math.round((numerator * 10_000) / 1_000_000_000);
}

/** Cumulative LP fees the pool has collected, per token (raw units). */
export function poolLpFees(pool: PoolState): { a: bigint; b: bigint } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (pool as any).metrics ?? {};
  return { a: BigInt(m.totalLpAFee?.toString() ?? "0"), b: BigInt(m.totalLpBFee?.toString() ?? "0") };
}

export function poolTokenPrograms(pool: PoolState): { tokenAProgram: PublicKey; tokenBProgram: PublicKey } {
  return { tokenAProgram: getTokenProgram(pool.tokenAFlag), tokenBProgram: getTokenProgram(pool.tokenBFlag) };
}

/* ------------------------------------------------------------------ create */

export interface CreatePairPoolParams {
  connection: Connection;
  /** Pays rent and seeds liquidity; receives the position NFT. */
  payer: PublicKey;
  /** Token A (base). For outcome pools this is YES or NO. */
  tokenA: PublicKey;
  /** Token B (quote). For outcome pools this is the pair token; fees accrue here. */
  tokenB: PublicKey;
  tokenADecimals: number;
  tokenBDecimals: number;
  /** Initial price of one token A in token B, natural units (e.g. 0.5 / 340.35 for YES per AAPLx). */
  priceInB: number;
  /** Raw amount of token A to seed. Token B amount is derived from the price. */
  tokenAAmount: bigint | BN;
  /** Flat base fee in bps (default 100 = 1%). */
  feeBps?: number;
  /** Default `CollectFeeMode.OnlyB` (1). */
  collectFeeMode?: CollectFeeMode;
  tokenAProgram?: PublicKey;
  tokenBProgram?: PublicKey;
  /** Permanently lock the seed liquidity (default false; the operator keeps the position to claim fees). */
  lockLiquidity?: boolean;
}

export interface CreatePairPoolResult {
  tx: Transaction;
  /** Signers besides the payer: the position NFT mint keypair. */
  signers: Keypair[];
  pool: PublicKey;
  position: PublicKey;
  positionNft: Keypair;
  positionNftAccount: PublicKey;
  tokenAAmount: BN;
  tokenBAmount: BN;
  initSqrtPrice: BN;
  liquidityDelta: BN;
}

/** Raw token-B amount matching `rawA` of token A at `priceInB`. */
export function quoteAmountForPrice(rawA: bigint | BN, priceInB: number, decA: number, decB: number): BN {
  const a = Number(toBN(rawA).toString());
  const b = a * priceInB * 10 ** (decB - decA);
  return new BN(Math.max(1, Math.floor(b)).toLocaleString("fullwide", { useGrouping: false }));
}

/**
 * Build the transaction that creates a permissionless customizable pool (`initializeCustomizablePool`)
 * for tokenA/tokenB with a flat base fee, no dynamic fee, immediate activation, full price range,
 * and (by default) quote-only fee collection.
 */
export async function createPairPool(p: CreatePairPoolParams): Promise<CreatePairPoolResult> {
  const cp = getCpAmm(p.connection);
  const collectFeeMode = p.collectFeeMode ?? QUOTE_ONLY_FEE_MODE;
  const feeBps = p.feeBps ?? DEFAULT_POOL_FEE_BPS;
  const tokenAAmount = toBN(p.tokenAAmount);
  const tokenBAmount = quoteAmountForPrice(tokenAAmount, p.priceInB, p.tokenADecimals, p.tokenBDecimals);

  const { initSqrtPrice, liquidityDelta } = cp.preparePoolCreationParams({
    tokenAAmount,
    tokenBAmount,
    minSqrtPrice: MIN_SQRT_PRICE,
    maxSqrtPrice: MAX_SQRT_PRICE,
    collectFeeMode,
  });

  // Flat fee: starting == ending with zero periods encodes a static FeeTimeScheduler.
  const baseFee = getBaseFeeParams({
    baseFeeMode: BaseFeeMode.FeeTimeSchedulerLinear,
    feeTimeSchedulerParam: { startingFeeBps: feeBps, endingFeeBps: feeBps, numberOfPeriod: 0, totalDuration: 0 },
  });

  const positionNft = Keypair.generate();
  const { tx, pool, position } = await cp.createCustomPool({
    payer: p.payer,
    creator: p.payer,
    positionNft: positionNft.publicKey,
    tokenAMint: p.tokenA,
    tokenBMint: p.tokenB,
    tokenAAmount,
    tokenBAmount,
    sqrtMinPrice: MIN_SQRT_PRICE,
    sqrtMaxPrice: MAX_SQRT_PRICE,
    initSqrtPrice,
    liquidityDelta,
    poolFees: { baseFee, compoundingFeeBps: 0, padding: 0, dynamicFee: null },
    hasAlphaVault: false,
    collectFeeMode,
    activationPoint: null,
    activationType: ActivationType.Timestamp,
    tokenAProgram: p.tokenAProgram ?? TOKEN_PROGRAM_ID,
    tokenBProgram: p.tokenBProgram ?? TOKEN_PROGRAM_ID,
    isLockLiquidity: p.lockLiquidity ?? false,
  });

  return {
    tx,
    signers: [positionNft],
    pool,
    position,
    positionNft,
    positionNftAccount: derivePositionNftAccount(positionNft.publicKey),
    tokenAAmount,
    tokenBAmount,
    initSqrtPrice,
    liquidityDelta,
  };
}

/* ------------------------------------------------------------------ quote + swap */

export interface SwapQuote {
  pool: PublicKey;
  poolState: PoolState;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: BN;
  amountOut: BN;
  /** amountOut less slippage; use as `minimumAmountOut`. */
  minAmountOut: BN;
  /** Total trading fee (LP + protocol + referral), in `feeMint` units. */
  fee: BN;
  feeMint: PublicKey;
  priceImpactBps: number;
  /** Pool sqrt price after the swap (Q64). */
  nextSqrtPrice: BN;
}

async function currentPoint(connection: Connection, pool: PoolState): Promise<BN> {
  const slot = await connection.getSlot("confirmed");
  if (pool.activationType === ActivationType.Slot) return new BN(slot);
  const t = (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
  return new BN(t);
}

/**
 * Exact-in quote for swapping `amountIn` of `inputMint` on `pool`.
 * `slippageBps` protects the minimum out (default 100 = 1%).
 */
export async function quoteSwap(
  connection: Connection,
  pool: PublicKey | { address: PublicKey; state: PoolState },
  inputMint: PublicKey,
  amountIn: bigint | BN,
  slippageBps = 100,
): Promise<SwapQuote> {
  const cp = getCpAmm(connection);
  const address = pool instanceof PublicKey ? pool : pool.address;
  const state = pool instanceof PublicKey ? await cp.fetchPoolState(pool) : pool.state;
  const isAtoB = state.tokenAMint.equals(inputMint);
  if (!isAtoB && !state.tokenBMint.equals(inputMint)) {
    throw new Error(`mint ${inputMint.toBase58()} is not in pool ${address.toBase58()}`);
  }
  const outputMint = isAtoB ? state.tokenBMint : state.tokenAMint;
  if (state.liquidity.isZero()) {
    throw new Error(`pool ${address.toBase58()} has no liquidity; nothing to quote`);
  }
  const [a, b, point] = await Promise.all([
    getMintInfo(connection, state.tokenAMint),
    getMintInfo(connection, state.tokenBMint),
    currentPoint(connection, state),
  ]);
  const amount = toBN(amountIn);
  const q = cp.getQuote2({
    inputTokenMint: inputMint,
    slippage: slippageBps / 100,
    currentPoint: point,
    poolState: state,
    tokenADecimal: a.decimals,
    tokenBDecimal: b.decimals,
    hasReferral: false,
    swapMode: SwapMode.ExactIn,
    amountIn: amount,
  });
  const fee = q.claimingFee.add(q.compoundingFee).add(q.protocolFee).add(q.referralFee);
  const feeMint = state.collectFeeMode === CollectFeeMode.OnlyB ? state.tokenBMint : outputMint;
  const minAmountOut = q.minimumAmountOut ?? q.outputAmount.muln(10_000 - slippageBps).divn(10_000);
  return {
    pool: address,
    poolState: state,
    inputMint,
    outputMint,
    amountIn: amount,
    amountOut: q.outputAmount,
    minAmountOut,
    fee,
    feeMint,
    priceImpactBps: Math.round(Number(q.priceImpact.toString()) * 100),
    nextSqrtPrice: q.nextSqrtPrice,
  };
}

export interface BuildSwapIxParams {
  connection: Connection;
  payer: PublicKey;
  pool: PublicKey;
  poolState?: PoolState;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountIn: bigint | BN;
  minAmountOut: bigint | BN;
  /** Receives the output (default payer). */
  receiver?: PublicKey;
}

/** Swap instructions (includes idempotent ATA creation and SOL wrapping when relevant). */
export async function buildSwapIx(p: BuildSwapIxParams): Promise<TransactionInstruction[]> {
  const cp = getCpAmm(p.connection);
  const state = p.poolState ?? (await cp.fetchPoolState(p.pool));
  const { tokenAProgram, tokenBProgram } = poolTokenPrograms(state);
  const tx = await cp.swap({
    payer: p.payer,
    pool: p.pool,
    inputTokenMint: p.inputMint,
    outputTokenMint: p.outputMint,
    amountIn: toBN(p.amountIn),
    minimumAmountOut: toBN(p.minAmountOut),
    tokenAMint: state.tokenAMint,
    tokenBMint: state.tokenBMint,
    tokenAVault: state.tokenAVault,
    tokenBVault: state.tokenBVault,
    tokenAProgram,
    tokenBProgram,
    referralTokenAccount: null,
    receiver: p.receiver,
    poolState: state,
  });
  return tx.instructions;
}

/* ------------------------------------------------------------------ positions + fees */

export interface OwnedPosition {
  pool: PublicKey;
  position: PublicKey;
  positionNft: PublicKey;
  positionNftAccount: PublicKey;
  positionState: PositionState;
}

/** All DAMM v2 positions owned by `owner`, sorted by liquidity (desc). */
export async function listPositions(connection: Connection, owner: PublicKey): Promise<OwnedPosition[]> {
  const rows = await getCpAmm(connection).getPositionsByUser(owner);
  return rows.map((r) => ({
    pool: r.positionState.pool,
    position: r.position,
    positionNft: r.positionState.nftMint,
    positionNftAccount: r.positionNftAccount,
    positionState: r.positionState,
  }));
}

/** Positions of `owner` in one pool. */
export async function listPositionsInPool(connection: Connection, pool: PublicKey, owner: PublicKey): Promise<OwnedPosition[]> {
  const rows = await getCpAmm(connection).getUserPositionByPool(pool, owner);
  return rows.map((r) => ({
    pool,
    position: r.position,
    positionNft: r.positionState.nftMint,
    positionNftAccount: r.positionNftAccount,
    positionState: r.positionState,
  }));
}

export function positionAddressesForNft(positionNft: PublicKey): { position: PublicKey; positionNftAccount: PublicKey } {
  return { position: derivePositionAddress(positionNft), positionNftAccount: derivePositionNftAccount(positionNft) };
}

/** Unclaimed LP fees of a position. */
export function unclaimedFees(pool: PoolState, position: PositionState): { feeA: BN; feeB: BN } {
  const r = getUnClaimLpFee(pool, position);
  return { feeA: r.feeTokenA, feeB: r.feeTokenB };
}

export interface ClaimPositionFeeParams {
  connection: Connection;
  owner: PublicKey;
  pool: PublicKey;
  poolState?: PoolState;
  /** Either the position NFT mint, or the explicit position + NFT token account. */
  positionNft?: PublicKey;
  position?: PublicKey;
  positionNftAccount?: PublicKey;
  /** Receives the fees (default owner). */
  receiver?: PublicKey;
}

/** Transaction that claims a position's accumulated fees (owner signs). */
export async function claimPositionFee(p: ClaimPositionFeeParams): Promise<Transaction> {
  const cp = getCpAmm(p.connection);
  const state = p.poolState ?? (await cp.fetchPoolState(p.pool));
  let position = p.position;
  let positionNftAccount = p.positionNftAccount;
  if ((!position || !positionNftAccount) && p.positionNft) {
    ({ position, positionNftAccount } = positionAddressesForNft(p.positionNft));
  }
  if (!position || !positionNftAccount) throw new Error("claimPositionFee: pass positionNft or position + positionNftAccount");
  const { tokenAProgram, tokenBProgram } = poolTokenPrograms(state);
  return cp.claimPositionFee({
    owner: p.owner,
    pool: p.pool,
    position,
    positionNftAccount,
    tokenAMint: state.tokenAMint,
    tokenBMint: state.tokenBMint,
    tokenAVault: state.tokenAVault,
    tokenBVault: state.tokenBVault,
    tokenAProgram,
    tokenBProgram,
    receiver: p.receiver,
  });
}
