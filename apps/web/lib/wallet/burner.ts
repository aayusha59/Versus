import {
  BaseSignerWalletAdapter,
  WalletConnectionError,
  WalletNotConnectedError,
  WalletReadyState,
  type SupportedTransactionVersions,
  type TransactionOrVersionedTransaction,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";

/**
 * "Burner": a wallet-adapter signer that keeps a Keypair in this browser's localStorage and
 * signs locally, so localnet and devnet can be exercised with no extension. Offered by the
 * picker only when the deployment cluster is localnet or devnet; never on mainnet.
 */
export const BURNER_WALLET_NAME = "Burner" as WalletName<"Burner">;

/** localStorage key holding the secret key as a JSON byte array. Test funds only. */
export const BURNER_STORAGE_KEY = "versus:burner-wallet-secret-key";

const ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" fill="none" stroke="#2b2620" stroke-width="2"/><rect x="8" y="8" width="8" height="8" fill="#c9401f"/></svg>',
  );

function loadOrCreateKeypair(): Keypair {
  try {
    const raw = window.localStorage.getItem(BURNER_STORAGE_KEY);
    if (raw) {
      const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
    }
  } catch {
    /* corrupt or unavailable storage: fall through and mint a fresh key */
  }
  const kp = Keypair.generate();
  try {
    window.localStorage.setItem(BURNER_STORAGE_KEY, JSON.stringify(Array.from(kp.secretKey)));
  } catch {
    /* private window: the key lives for this tab only */
  }
  return kp;
}

export class BurnerWalletAdapter extends BaseSignerWalletAdapter {
  name = BURNER_WALLET_NAME;
  url = "https://github.com/solana-labs/wallet-adapter";
  icon = ICON;
  readonly supportedTransactionVersions: SupportedTransactionVersions = new Set(["legacy", 0]);

  private _keypair: Keypair | null = null;
  private _connecting = false;
  private readonly _readyState =
    typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.Loadable;

  get publicKey(): PublicKey | null {
    return this._keypair?.publicKey ?? null;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  async connect(): Promise<void> {
    if (this.connected || this._connecting) return;
    if (this._readyState !== WalletReadyState.Loadable) throw new WalletConnectionError("Burner needs a browser.");
    this._connecting = true;
    try {
      // Extensions emit `connect` only after a popup round trip, so wallet-adapter-react's
      // listener (attached in a parent effect, which React runs after child effects) is in
      // place by then. A local signer would emit synchronously and lose the event; yield first.
      await new Promise((r) => setTimeout(r, 0));
      this._keypair = loadOrCreateKeypair();
      this.emit("connect", this._keypair.publicKey);
    } catch (e) {
      const err = new WalletConnectionError((e as Error).message, e);
      this.emit("error", err);
      throw err;
    } finally {
      this._connecting = false;
    }
  }

  /** Forgets the key in memory only; the secret stays in localStorage so reconnecting restores it. */
  async disconnect(): Promise<void> {
    this._keypair = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends TransactionOrVersionedTransaction<this["supportedTransactionVersions"]>>(
    transaction: T,
  ): Promise<T> {
    const kp = this._keypair;
    if (!kp) throw new WalletNotConnectedError();
    if (transaction instanceof VersionedTransaction) transaction.sign([kp]);
    else transaction.partialSign(kp);
    return transaction;
  }
}

/** Wipe the stored key (used by nothing in the UI yet; handy from the console). */
export function forgetBurner(): void {
  try {
    window.localStorage.removeItem(BURNER_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
