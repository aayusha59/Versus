import { AnchorProvider, EventParser, Program, type Idl, type Provider } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type ConfirmOptions,
  type TransactionInstruction,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import BN from "bn.js";
import idlJson from "../idl/duel.json";
import type { Duel } from "../idl/duel.js";
import { getMintInfo } from "./pools.js";
import { feedIdBytes, feedIdFromBytes } from "./feeds.js";
import type { AnchorWallet, Deployment, Market, MarketStatus, RewardEpoch, RewardRecipient, Side, Template } from "./types.js";

/**
 * Anchor client for the `duel` program (Anchor 0.32, IDL at packages/sdk/idl/duel.json).
 * Every instruction has an `xIx` builder (returns instructions; safe with a browser wallet)
 * and an `x` method that signs and sends with the client's wallet.
 */

export const DUEL_PROGRAM_ID = new PublicKey(idlJson.address);

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export type DuelProgram = Program<Duel>;

export interface CreateMarketParams {
  nonce?: bigint | number | BN;
  question: string;
  sideALabel: string;
  sideBLabel: string;
  collateralMint: PublicKey;
  pairAMint: PublicKey;
  pairBMint: PublicKey;
  templatte: Template;
  /** Unix seconds. */
  resolveTs: number;
  graceSecs: number;
  resolver?: PublicKey;
  crank?: PublicKey;
  feeBpsHolders?: number;
  feeBpsCreator?: number;
  feeBpsPlatform?: number;
  /** Defaults to the wallet. */
  creator?: PublicKey;
}

type SideArg = { yes: Record<string, never> } | { no: Record<string, never> };
export function sideArg(side: Side): SideArg {
  return side === "yes" ? { yes: {} } : { no: {} };
}
export function sideFromArg(v: unknown): Side {
  return v && typeof v === "object" && "no" in (v as object) ? "no" : "yes";
}

export function templateArg(t: Template) {
  switch (t.kind) {
    case "capCompare":
      return { capCompare: { feedA: feedIdBytes(t.feedA), feedB: feedIdBytes(t.feedB), sharesA: new BN(t.sharesA.toString()), sharesB: new BN(t.sharesB.toString()) } };
    case "ratioOutperform":
      return { ratioOutperform: { feedA: feedIdBytes(t.feedA), feedB: feedIdBytes(t.feedB), startRatioE9: new BN(t.startRatioE9.toString()) } };
    case "priceAbove":
      return { priceAbove: { feed: feedIdBytes(t.feed), thresholdE6: new BN(t.thresholdE6.toString()) } };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function templateFromRaw(raw: any): Template {
  if (raw.capCompare) {
    const c = raw.capCompare;
    return { kind: "capCompare", feedA: feedIdFromBytes(c.feedA), feedB: feedIdFromBytes(c.feedB), sharesA: BigInt(c.sharesA.toString()), sharesB: BigInt(c.sharesB.toString()) };
  }
  if (raw.ratioOutperform) {
    const c = raw.ratioOutperform;
    return { kind: "ratioOutperform", feedA: feedIdFromBytes(c.feedA), feedB: feedIdFromBytes(c.feedB), startRatioE9: BigInt(c.startRatioE9.toString()) };
  }
  if (raw.priceAbove) {
    const c = raw.priceAbove;
    return { kind: "priceAbove", feed: feedIdFromBytes(c.feed), thresholdE6: BigInt(c.thresholdE6.toString()) };
  }
  throw new Error(`unknown template variant ${JSON.stringify(Object.keys(raw))}`);
}

export function statusFromRaw(raw: any): MarketStatus {
  if (raw.resolved) {
    const r = raw.resolved;
    return { kind: "resolved", winner: sideFromArg(r.winner), priceA: BigInt(r.priceA.toString()), priceB: BigInt(r.priceB.toString()), resolvedTs: Number(r.resolvedTs.toString()) };
  }
  return { kind: "open" };
}

export function decodeMarket(address: PublicKey, raw: any): Market {
  return {
    address,
    creator: raw.creator,
    nonce: BigInt(raw.nonce.toString()),
    bump: raw.bump,
    question: raw.question,
    sideALabel: raw.sideALabel,
    sideBLabel: raw.sideBLabel,
    collateralMint: raw.collateralMint,
    collateralVault: raw.collateralVault,
    yesMint: raw.yesMint,
    noMint: raw.noMint,
    pairAMint: raw.pairAMint,
    pairBMint: raw.pairBMint,
    rewardVaultA: raw.rewardVaultA,
    rewardVaultB: raw.rewardVaultB,
    template: templateFromRaw(raw.template),
    resolveTs: Number(raw.resolveTs.toString()),
    graceSecs: Number(raw.graceSecs.toString()),
    resolver: raw.resolver,
    crank: raw.crank,
    feeBpsHolders: raw.feeBpsHolders,
    feeBpsCreator: raw.feeBpsCreator,
    feeBpsPlatform: raw.feeBpsPlatform,
    status: statusFromRaw(raw.status),
    poolA: raw.poolA,
    poolB: raw.poolB,
    totalMinted: BigInt(raw.totalMinted.toString()),
    totalRedeemed: BigInt(raw.totalRedeemed.toString()),
    rewardsPaidA: BigInt(raw.rewardsPaidA.toString()),
    rewardsPaidB: BigInt(raw.rewardsPaidB.toString()),
    epochs: Number(raw.epochs),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface DuelClientOptions {
  programId?: PublicKey;
  /** Override the bundled IDL (e.g. one fetched on-chain). */
  idl?: Duel;
  confirmOptions?: ConfirmOptions;
}

export class DuelClient {
  readonly connection: Connection;
  readonly wallet?: AnchorWallet;
  readonly provider: Provider;
  readonly program: DuelProgram;
  readonly programId: PublicKey;
  readonly confirmOptions: ConfirmOptions;

  constructor(connection: Connection, wallet?: AnchorWallet, opts: DuelClientOptions = {}) {
    this.connection = connection;
    this.wallet = wallet;
    this.confirmOptions = opts.confirmOptions ?? { commitment: "confirmed" };
    this.provider = wallet ? new AnchorProvider(connection, wallet, this.confirmOptions) : { connection };
    // The JSON IDL is snake_case (as anchor writes it); Program camelCases it at construction.
    const idl: Idl = { ...((opts.idl ?? idlJson) as unknown as Idl) };
    if (opts.programId) idl.address = opts.programId.toBase58();
    this.programId = new PublicKey(idl.address);
    this.program = new Program<Duel>(idl as unknown as Duel, this.provider);
  }

  static fromDeployment(connection: Connection, deployment: Deployment, wallet?: AnchorWallet, opts: DuelClientOptions = {}): DuelClient {
    return new DuelClient(connection, wallet, { ...opts, programId: new PublicKey(deployment.programId) });
  }

  /* ------------------------------------------------------------ PDAs */

  // Seeds are built without the global `Buffer` so the browser bundle needs no polyfill here.
  marketPda(creator: PublicKey, nonce: bigint | number | BN): PublicKey {
    const n = Uint8Array.from(new BN(nonce.toString()).toArray("le", 8));
    return PublicKey.findProgramAddressSync([utf8("market"), creator.toBytes(), n], this.programId)[0];
  }

  outcomeMints(market: PublicKey): { yesMint: PublicKey; noMint: PublicKey } {
    return {
      yesMint: PublicKey.findProgramAddressSync([utf8("yes"), market.toBytes()], this.programId)[0],
      noMint: PublicKey.findProgramAddressSync([utf8("no"), market.toBytes()], this.programId)[0],
    };
  }

  /* ------------------------------------------------------------ reads */

  async fetchMarket(address: PublicKey): Promise<Market> {
    const raw = await this.program.account.market.fetch(address);
    return decodeMarket(address, raw);
  }

  async fetchMarketIfExists(address: PublicKey): Promise<Market | null> {
    const raw = await this.program.account.market.fetchNullable(address);
    return raw ? decodeMarket(address, raw) : null;
  }

  async fetchAllMarkets(): Promise<Market[]> {
    const rows = await this.program.account.market.all();
    return rows.map((r) => decodeMarket(r.publicKey, r.account));
  }

  /** Decode `RewardsPaid` events from the market's transaction history (newest first). */
  async fetchRewardEpochs(market: PublicKey, limit = 50): Promise<RewardEpoch[]> {
    const sigs = await this.connection.getSignaturesForAddress(market, { limit }, "confirmed");
    if (sigs.length === 0) return [];
    const parser = new EventParser(this.programId, this.program.coder);
    const txs = await this.connection.getTransactions(
      sigs.map((s) => s.signature),
      { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    );
    const out: RewardEpoch[] = [];
    txs.forEach((tx, i) => {
      const logs = tx?.meta?.logMessages;
      if (!tx || !logs || tx.meta?.err) return;
      for (const ev of parser.parseLogs(logs)) {
        if (ev.name !== "rewardsPaid" && ev.name !== "RewardsPaid") continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = ev.data as any;
        if (!new PublicKey(d.market).equals(market)) continue;
        out.push({
          market,
          side: sideFromArg(d.side),
          epoch: Number(d.epoch),
          total: BigInt(d.total.toString()),
          count: Number(d.count),
          signatures: [sigs[i].signature],
          ts: sigs[i].blockTime ?? 0,
          recipients: rewardRecipients(tx, market),
        });
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ instruction builders */

  private requireWallet(): PublicKey {
    if (!this.wallet) throw new Error("DuelClient: a wallet is required for this call");
    return this.wallet.publicKey;
  }

  async createMarketIx(p: CreateMarketParams): Promise<{ ix: TransactionInstruction; market: PublicKey; yesMint: PublicKey; noMint: PublicKey; nonce: BN }> {
    const creator = p.creator ?? this.requireWallet();
    const nonce = new BN((p.nonce ?? BigInt(Date.now())).toString());
    const market = this.marketPda(creator, nonce);
    const { yesMint, noMint } = this.outcomeMints(market);
    const [collateral, pairA, pairB] = await Promise.all([
      getMintInfo(this.connection, p.collateralMint),
      getMintInfo(this.connection, p.pairAMint),
      getMintInfo(this.connection, p.pairBMint),
    ]);
    const ix = await this.program.methods
      .createMarket({
        nonce,
        question: p.question,
        sideALabel: p.sideALabel,
        sideBLabel: p.sideBLabel,
        template: templateArg(p.template),
        resolveTs: new BN(p.resolveTs),
        graceSecs: new BN(p.graceSecs),
        resolver: p.resolver ?? creator,
        crank: p.crank ?? creator,
        feeBpsHolders: p.feeBpsHolders ?? 10_000,
        feeBpsCreator: p.feeBpsCreator ?? 0,
        feeBpsPlatform: p.feeBpsPlatform ?? 0,
      })
      .accountsPartial({
        creator,
        market,
        collateralMint: p.collateralMint,
        pairAMint: p.pairAMint,
        pairBMint: p.pairBMint,
        yesMint,
        noMint,
        collateralVault: getAssociatedTokenAddressSync(p.collateralMint, market, true, collateral.programId),
        rewardVaultA: getAssociatedTokenAddressSync(p.pairAMint, market, true, pairA.programId),
        rewardVaultB: getAssociatedTokenAddressSync(p.pairBMint, market, true, pairB.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: collateral.programId,
        pairATokenProgram: pairA.programId,
        pairBTokenProgram: pairB.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    return { ix, market, yesMint, noMint, nonce };
  }

  async setPoolsIx(market: PublicKey, poolA: PublicKey, poolB: PublicKey, creator?: PublicKey): Promise<TransactionInstruction> {
    return this.program.methods
      .setPools(poolA, poolB)
      .accountsPartial({ creator: creator ?? this.requireWallet(), market })
      .instruction();
  }

  private async setAccounts(market: Market, user: PublicKey) {
    const collateral = await getMintInfo(this.connection, market.collateralMint);
    return {
      user,
      market: market.address,
      collateralMint: market.collateralMint,
      collateralVault: market.collateralVault,
      userCollateral: getAssociatedTokenAddressSync(market.collateralMint, user, true, collateral.programId),
      yesMint: market.yesMint,
      noMint: market.noMint,
      userYes: getAssociatedTokenAddressSync(market.yesMint, user, true),
      userNo: getAssociatedTokenAddressSync(market.noMint, user, true),
      tokenProgram: TOKEN_PROGRAM_ID,
      collateralTokenProgram: collateral.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
  }

  /** Deposit `amount` collateral, receive `amount` YES and `amount` NO. */
  async mintSetIx(market: Market, amount: bigint | BN, user?: PublicKey): Promise<TransactionInstruction> {
    const accounts = await this.setAccounts(market, user ?? this.requireWallet());
    return this.program.methods.mintSet(new BN(amount.toString())).accountsPartial(accounts).instruction();
  }

  async mergeSetIx(market: Market, amount: bigint | BN, user?: PublicKey): Promise<TransactionInstruction> {
    const accounts = await this.setAccounts(market, user ?? this.requireWallet());
    return this.program.methods.mergeSet(new BN(amount.toString())).accountsPartial(accounts).instruction();
  }

  /** Burn `amount` winning tokens for `amount` collateral (market must be resolved). */
  async redeemIx(market: Market, amount: bigint | BN, user?: PublicKey): Promise<TransactionInstruction> {
    const u = user ?? this.requireWallet();
    if (market.status.kind !== "resolved") throw new Error("market is not resolved");
    const outcomeMint = market.status.winner === "yes" ? market.yesMint : market.noMint;
    const collateral = await getMintInfo(this.connection, market.collateralMint);
    return this.program.methods
      .redeem(new BN(amount.toString()))
      .accountsPartial({
        user: u,
        market: market.address,
        outcomeMint,
        userOutcome: getAssociatedTokenAddressSync(outcomeMint, u, true),
        collateralMint: market.collateralMint,
        collateralVault: market.collateralVault,
        userCollateral: getAssociatedTokenAddressSync(market.collateralMint, u, true, collateral.programId),
        tokenProgram: TOKEN_PROGRAM_ID,
        collateralTokenProgram: collateral.programId,
      })
      .instruction();
  }

  /** Permissionless resolve against posted Pyth `PriceUpdateV2` accounts (`priceUpdateB` null for PriceAbove). */
  async resolveIx(market: PublicKey, priceUpdateA: PublicKey, priceUpdateB: PublicKey | null): Promise<TransactionInstruction> {
    return this.program.methods
      .resolve()
      .accountsPartial({ market, priceUpdateA, priceUpdateB })
      .instruction();
  }

  /** Resolver-only fallback after `resolve_ts + grace_secs`. Prices are USD scaled by 1e6. */
  async resolveManualIx(market: PublicKey, winner: Side, priceAE6: bigint | BN, priceBE6: bigint | BN, resolver?: PublicKey): Promise<TransactionInstruction> {
    return this.program.methods
      .resolveManual(sideArg(winner), new BN(priceAE6.toString()), new BN(priceBE6.toString()))
      .accountsPartial({ resolver: resolver ?? this.requireWallet(), market })
      .instruction();
  }

  private sideVault(market: Market, side: Side) {
    return side === "yes"
      ? { pairMint: market.pairAMint, rewardVault: market.rewardVaultA }
      : { pairMint: market.pairBMint, rewardVault: market.rewardVaultB };
  }

  /** Anyone can deposit pair tokens into a side's reward vault. */
  async depositRewardsIx(market: Market, side: Side, amount: bigint | BN, depositor?: PublicKey): Promise<TransactionInstruction> {
    const d = depositor ?? this.requireWallet();
    const { pairMint, rewardVault } = this.sideVault(market, side);
    const pair = await getMintInfo(this.connection, pairMint);
    return this.program.methods
      .depositRewards(sideArg(side), new BN(amount.toString()))
      .accountsPartial({
        depositor: d,
        market: market.address,
        pairMint,
        rewardVault,
        depositorToken: getAssociatedTokenAddressSync(pairMint, d, true, pair.programId),
        pairTokenProgram: pair.programId,
      })
      .instruction();
  }

  /** Crank-only: pay `amounts[i]` from the side's reward vault to `recipients[i]` (token accounts), max 12. */
  async distributeIx(market: Market, side: Side, recipients: PublicKey[], amounts: (bigint | BN)[], crank?: PublicKey): Promise<TransactionInstruction> {
    if (recipients.length !== amounts.length) throw new Error("recipients/amounts length mismatch");
    if (recipients.length > 12) throw new Error("distribute: max 12 recipients per call");
    const { pairMint, rewardVault } = this.sideVault(market, side);
    const pair = await getMintInfo(this.connection, pairMint);
    return this.program.methods
      .distribute(
        sideArg(side),
        amounts.map((a) => new BN(a.toString())),
      )
      .accountsPartial({
        crank: crank ?? this.requireWallet(),
        market: market.address,
        pairMint,
        rewardVault,
        pairTokenProgram: pair.programId,
      })
      .remainingAccounts(recipients.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true })))
      .instruction();
  }

  /* ------------------------------------------------------------ send helpers */

  async send(ixs: TransactionInstruction | TransactionInstruction[], opts?: ConfirmOptions): Promise<string> {
    if (!this.wallet) throw new Error("DuelClient: a wallet is required to send");
    const provider = this.provider as AnchorProvider;
    const tx = new Transaction().add(...(Array.isArray(ixs) ? ixs : [ixs]));
    return provider.sendAndConfirm(tx, [], opts ?? this.confirmOptions);
  }

  async createMarket(p: CreateMarketParams): Promise<{ market: PublicKey; yesMint: PublicKey; noMint: PublicKey; nonce: bigint; tx: string }> {
    const { ix, market, yesMint, noMint, nonce } = await this.createMarketIx(p);
    const tx = await this.send(ix);
    return { market, yesMint, noMint, nonce: BigInt(nonce.toString()), tx };
  }

  async setPools(market: PublicKey, poolA: PublicKey, poolB: PublicKey): Promise<string> {
    return this.send(await this.setPoolsIx(market, poolA, poolB));
  }

  async mintSet(market: Market, amount: bigint | BN): Promise<string> {
    return this.send(await this.mintSetIx(market, amount));
  }

  async mergeSet(market: Market, amount: bigint | BN): Promise<string> {
    return this.send(await this.mergeSetIx(market, amount));
  }

  async redeem(market: Market, amount: bigint | BN): Promise<string> {
    return this.send(await this.redeemIx(market, amount));
  }

  async resolve(market: PublicKey, priceUpdateA: PublicKey, priceUpdateB: PublicKey | null): Promise<string> {
    return this.send(await this.resolveIx(market, priceUpdateA, priceUpdateB));
  }

  async resolveManual(market: PublicKey, winner: Side, priceAE6: bigint | BN, priceBE6: bigint | BN): Promise<string> {
    return this.send(await this.resolveManualIx(market, winner, priceAE6, priceBE6));
  }

  async depositRewards(market: Market, side: Side, amount: bigint | BN): Promise<string> {
    return this.send(await this.depositRewardsIx(market, side, amount));
  }

  async distribute(market: Market, side: Side, recipients: PublicKey[], amounts: (bigint | BN)[]): Promise<string> {
    return this.send(await this.distributeIx(market, side, recipients, amounts));
  }
}

/**
 * Recipients of a `distribute` transaction: every token account whose balance went up, except
 * accounts owned by the market PDA (the reward vault is the only account that goes down).
 */
export function rewardRecipients(tx: VersionedTransactionResponse, market: PublicKey): RewardRecipient[] {
  const meta = tx.meta;
  if (!meta?.postTokenBalances) return [];
  const keys = tx.transaction.message
    .getAccountKeys({ accountKeysFromLookups: meta.loadedAddresses ?? undefined })
    .keySegments()
    .flat();
  const pre = new Map<number, bigint>();
  for (const b of meta.preTokenBalances ?? []) pre.set(b.accountIndex, BigInt(b.uiTokenAmount.amount));
  const out: RewardRecipient[] = [];
  for (const b of meta.postTokenBalances) {
    if (!b.owner) continue;
    const owner = new PublicKey(b.owner);
    if (owner.equals(market)) continue;
    const delta = BigInt(b.uiTokenAmount.amount) - (pre.get(b.accountIndex) ?? 0n);
    if (delta <= 0n) continue;
    const tokenAccount = keys[b.accountIndex];
    if (!tokenAccount) continue;
    out.push({ owner, tokenAccount, amount: delta });
  }
  return out;
}

/** Decide the winner from prices (USD, plain numbers) the same way the program does. */
export function evaluateTemplate(t: Template, priceA: number, priceB: number): Side {
  switch (t.kind) {
    case "capCompare":
      return priceA * Number(t.sharesA) > priceB * Number(t.sharesB) ? "yes" : "no";
    case "ratioOutperform":
      return priceA / priceB > Number(t.startRatioE9) / 1e9 ? "yes" : "no";
    case "priceAbove":
      return priceA > Number(t.thresholdE6) / 1e6 ? "yes" : "no";
  }
}

/** Feed ids a template needs, in [a, b] order (b undefined for PriceAbove). */
export function templateFeeds(t: Template): [string, string | undefined] {
  return t.kind === "priceAbove" ? [t.feed, undefined] : [t.feedA, t.feedB];
}
