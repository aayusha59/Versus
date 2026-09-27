import type { Connection, Signer, Transaction, PublicKey } from "@solana/web3.js";
import type {
  BetPreview,
  CreateMarketParams,
  Market,
  Network,
  Position,
  RewardEpoch,
  SellPreview,
  Side,
  TxResult,
} from "../types";

/**
 * The slice of wallet-adapter's `WalletContextState` the chain adapter needs to sign and send.
 * `sendTransaction` partial-signs with `signers` (pool NFT keypairs) before the wallet signs.
 */
export interface WalletSigner {
  publicKey: PublicKey | null;
  sendTransaction(
    tx: Transaction,
    connection: Connection,
    options?: { signers?: Signer[]; skipPreflight?: boolean; preflightCommitment?: "processed" | "confirmed" | "finalized" },
  ): Promise<string>;
}

export interface OddsPoint {
  /** Unix ms */
  t: number;
  /** Left-side odds, 0..1 */
  a: number;
}

export interface Balance {
  usdc: number;
  /** Pair-token balances by symbol, e.g. { AAPLx: 1.84 } */
  pair: Record<string, number>;
}

/**
 * The web app talks to this interface only. `demo.ts` implements it with fixtures
 * and a ticking odds simulator; `chain.ts` wraps `@versus/sdk` over a localnet or devnet deployment.
 */
export interface DuelData {
  readonly network: Network;
  listMarkets(): Promise<Market[]>;
  getMarket(id: string): Promise<Market | null>;
  getOddsHistory(id: string): Promise<OddsPoint[]>;
  getLedger(id: string): Promise<RewardEpoch[]>;
  getPosition(id: string, owner: string | null, side?: Side): Promise<Position | null>;
  listPositions(owner: string | null): Promise<Position[]>;
  getBalance(owner: string | null): Promise<Balance>;
  previewBet(id: string, side: Side, usdc: number): Promise<BetPreview>;
  previewSell(id: string, side: Side, size: number): Promise<SellPreview>;
  placeBet(id: string, side: Side, usdc: number, owner: string): Promise<TxResult>;
  sell(id: string, side: Side, size: number, owner: string): Promise<TxResult>;
  /** `onProgress` receives one short sentence per wallet-signed step (chain mode sends six). */
  createMarket(params: CreateMarketParams, onProgress?: (text: string) => void): Promise<{ id: string; signature: string }>;
  redeem(id: string, owner: string): Promise<TxResult>;
  faucet(owner: string): Promise<TxResult>;
  /** Fires whenever odds, ledger or positions change. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Chain adapters sign with the connected wallet; the providers bind it here. Demo ignores it. */
  bindWallet?(wallet: WalletSigner | null): void;
}

export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}
