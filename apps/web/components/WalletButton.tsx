"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useOwner } from "@/lib/owner";
import { shortKey } from "@/lib/format";
import { cx } from "@/lib/cx";
import { BURNER_WALLET_NAME } from "@/lib/wallet/burner";
import { Button } from "./Button";

const KNOWN = [
  { name: "Phantom", url: "https://phantom.app/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];

function describe(e: unknown, name: string): string {
  const err = e as { name?: string; message?: string } | undefined;
  if (err?.name === "WalletNotReadyError") return `${name} is not installed.`;
  if (err?.name === "WalletConnectionError" || /reject|denied|cancel/i.test(err?.message ?? "")) {
    return `${name} declined. Unlock it and try again.`;
  }
  return err?.message ? `${name}: ${err.message}` : `${name} did not answer.`;
}

interface WalletButtonProps {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  short?: boolean;
  className?: string;
}

/**
 * Our own wallet button and picker. Behaviour from wallet-adapter and Radix Dialog; the
 * picker lists Phantom, Solflare and Backpack as hairline rows, plus the burner test wallet
 * on localnet/devnet and the demo corner when the app runs on fixtures.
 */
export function WalletButton({ variant = "outline", size = "md", block, short, className }: WalletButtonProps) {
  const { wallets, select, connect, wallet, publicKey, connecting } = useWallet();
  const { owner, source, walletName, demoAvailable, connectDemo, disconnect } = useOwner();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending || !wallet || wallet.adapter.name !== pending) return;
    let cancelled = false;
    connect()
      .then(() => {
        if (!cancelled) setPending(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPending(null);
        setError(describe(e, pending));
      });
    return () => {
      cancelled = true;
    };
  }, [pending, wallet, connect]);

  useEffect(() => {
    if (publicKey) setOpen(false);
  }, [publicKey]);

  const ready = (name: string) => {
    const w = wallets.find((x) => x.adapter.name === name);
    if (!w) return null;
    return w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable;
  };

  const pick = (name: string) => {
    setError(null);
    setPending(name);
    select(name as never);
  };

  // Registered by the providers only when the deployment cluster is localnet or devnet.
  const burnerAvailable = wallets.some((w) => w.adapter.name === BURNER_WALLET_NAME);
  const burnerBusy = pending === BURNER_WALLET_NAME || (connecting && wallet?.adapter.name === BURNER_WALLET_NAME);

  const label = owner
    ? source === "demo"
      ? "Demo wallet"
      : shortKey(owner)
    : short
      ? "Connect Wallet"
      : "Connect wallet";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant={owner ? "outline" : variant} size={size} block={block} className={className}>
          {owner ? <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-side-a" /> : null}
          <span className={cx(owner && "font-mono text-xs")}>{label}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet" aria-describedby={undefined}>
          {owner ? (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <Dialog.Title className="text-lg font-semibold">Your wallet</Dialog.Title>
                <Dialog.Close className="btn btn-ghost btn-sm">Close</Dialog.Close>
              </div>
              <hr className="double mt-4" />
              <dl className="dl mt-4">
                <dt>Wallet</dt>
                <dd>{source === "demo" ? "Demo wallet (no extension)" : walletName}</dd>
                <dt>Address</dt>
                <dd className="break-all text-sm">{owner}</dd>
              </dl>
              <div className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    void disconnect();
                    setOpen(false);
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <Dialog.Title className="text-lg font-semibold">Connect a wallet</Dialog.Title>
                <Dialog.Close className="btn btn-ghost btn-sm">Close</Dialog.Close>
              </div>
              <Dialog.Description className="text-sm text-ink-2 mt-1">
                One signature per bet. Payouts land in the same wallet.
              </Dialog.Description>
              <hr className="double mt-4" />
              <ul className="hairline-rows">
                {KNOWN.map((k) => {
                  const r = ready(k.name);
                  const busy = pending === k.name || (connecting && wallet?.adapter.name === k.name);
                  return (
                    <li key={k.name}>
                      {r ? (
                        <button
                          type="button"
                          className="row-hover flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
                          onClick={() => pick(k.name)}
                          disabled={busy}
                        >
                          <span className="font-semibold">{k.name}</span>
                          <span className={cx("text-xs", busy ? "text-ink-2 pulse" : "text-gain")}>
                            {busy ? "Waiting for approval" : "Detected"}
                          </span>
                        </button>
                      ) : (
                        <a
                          href={k.url}
                          target="_blank"
                          rel="noreferrer"
                          className="row-hover flex w-full items-baseline justify-between gap-4 py-3.5"
                        >
                          <span className="font-semibold text-ink-2">{k.name}</span>
                          <span className="text-xs text-ink-2">Not installed. Get it</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
              {burnerAvailable ? (
                <>
                  <hr className="rule-ink" />
                  <button
                    type="button"
                    className="row-hover flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
                    onClick={() => pick(BURNER_WALLET_NAME)}
                    disabled={burnerBusy}
                  >
                    <span className="font-semibold whitespace-nowrap">Burner (test wallet)</span>
                    <span className={cx("text-xs text-ink-2 text-right", burnerBusy && "pulse")}>
                      {burnerBusy ? "Loading the key." : "Keys live in this browser. Test funds only."}
                    </span>
                  </button>
                </>
              ) : null}
              {demoAvailable ? (
                <>
                  <hr className="rule-ink" />
                  <button
                    type="button"
                    className="row-hover flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
                    onClick={() => {
                      connectDemo();
                      setOpen(false);
                    }}
                  >
                    <span className="font-semibold">Demo wallet</span>
                    <span className="text-xs text-ink-2">1,000 mock USDC, no extension</span>
                  </button>
                </>
              ) : null}
              <hr className="rule" />
              {error ? (
                <p className="field-error mt-3" role="alert">
                  {error}
                </p>
              ) : (
                <p className="text-xs text-ink-2 mt-3">Phantom, Solflare and Backpack on Solana.</p>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
