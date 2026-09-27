"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { X } from "lucide-react";
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
  variant?: "primary" | "outline" | "ghost" | "text";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  className?: string;
}

/** The wallet's own logo from its adapter; a monogram tile stands in when no adapter is registered. */
function Icon({ src, name }: { src?: string; name: string }) {
  if (!src) {
    return (
      <span className="wallet-icon wallet-icon-mono" aria-hidden="true">
        {name[0]}
      </span>
    );
  }
  return (
    <span className="wallet-icon">
      {/* Adapter icons are data URIs, so next/image would only add a hop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </span>
  );
}

interface RowProps {
  icon?: string;
  name: string;
  status: ReactNode;
  /** "ready" prints the status in green; "off" dims a wallet that is not installed. */
  tone?: "ready" | "off";
  busy?: boolean;
  /** For a wallet that is not installed: the row opens its download page instead of connecting. */
  href?: string;
  onClick?: () => void;
}

function Row({ icon, name, status, tone, busy, href, onClick }: RowProps) {
  const body = (
    <>
      <Icon src={icon} name={name} />
      <span className="wallet-name">{name}</span>
      <span className={cx("wallet-status", tone === "ready" && !busy && "is-ready", busy && "pulse")}>
        {status}
      </span>
    </>
  );
  const className = cx("wallet-row", tone === "off" && "is-off");
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={busy}>
      {body}
    </button>
  );
}

/**
 * Our own wallet button and picker. Behaviour from wallet-adapter and Radix Dialog; the
 * picker is a centred sheet with one tall row per wallet (logo, name, state): Phantom,
 * Solflare and Backpack first, then the burner test wallet on localnet/devnet and the demo
 * wallet when the app runs on fixtures.
 */
export function WalletButton({ variant = "outline", size = "md", block, className }: WalletButtonProps) {
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

  const adapter = (name: string) => wallets.find((x) => x.adapter.name === name)?.adapter;

  const ready = (name: string) => {
    const a = adapter(name);
    if (!a) return null;
    return a.readyState === WalletReadyState.Installed || a.readyState === WalletReadyState.Loadable;
  };

  const pick = (name: string) => {
    setError(null);
    setPending(name);
    select(name as never);
  };

  // Registered by the providers only when the deployment cluster is localnet or devnet.
  const burnerAvailable = wallets.some((w) => w.adapter.name === BURNER_WALLET_NAME);
  const burnerBusy = pending === BURNER_WALLET_NAME || (connecting && wallet?.adapter.name === BURNER_WALLET_NAME);

  const label = owner ? (source === "demo" ? "Demo wallet" : shortKey(owner)) : "Connect wallet";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <Dialog.Trigger asChild>
        {/* Plain text stays plain once connected; every other variant turns into an outline. */}
        <Button variant={owner && variant !== "text" ? "outline" : variant} size={size} block={block} className={className}>
          {owner ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-side-a" /> : null}
          <span className={cx(owner && "font-mono")}>{label}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet" aria-describedby={undefined}>
          <Dialog.Close className="sheet-close" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </Dialog.Close>
          {owner ? (
            <>
              <div className="sheet-head">
                <Dialog.Title className="sheet-title">Your wallet</Dialog.Title>
              </div>
              <div className="sheet-body">
                <dl className="dl">
                  <dt>Wallet</dt>
                  <dd>{source === "demo" ? "Demo wallet (no extension)" : walletName}</dd>
                  <dt>Address</dt>
                  <dd className="break-all text-sm">{owner}</dd>
                </dl>
                <div className="mt-6">
                  <Button
                    variant="outline"
                    block
                    onClick={() => {
                      void disconnect();
                      setOpen(false);
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sheet-head">
                <Dialog.Title className="sheet-title">Connect a wallet</Dialog.Title>
              </div>
              <ul className="wallet-list">
                {KNOWN.map((k) => {
                  const busy = pending === k.name || (connecting && wallet?.adapter.name === k.name);
                  return (
                    <li key={k.name}>
                      {ready(k.name) ? (
                        <Row
                          icon={adapter(k.name)?.icon}
                          name={k.name}
                          tone="ready"
                          busy={busy}
                          status={busy ? "Waiting for approval" : "Detected"}
                          onClick={() => pick(k.name)}
                        />
                      ) : (
                        <Row icon={adapter(k.name)?.icon} name={k.name} tone="off" status="Not installed" href={k.url} />
                      )}
                    </li>
                  );
                })}
              </ul>
              {burnerAvailable || demoAvailable ? (
                <>
                  <hr className="wallet-split" />
                  <ul className="wallet-list">
                    {burnerAvailable ? (
                      <li>
                        <Row
                          icon={adapter(BURNER_WALLET_NAME)?.icon}
                          name="Burner"
                          busy={burnerBusy}
                          status={burnerBusy ? "Loading the key" : "Test keys in this browser"}
                          onClick={() => pick(BURNER_WALLET_NAME)}
                        />
                      </li>
                    ) : null}
                    {demoAvailable ? (
                      <li>
                        <Row
                          name="Demo wallet"
                          status="1,000 mock USDC"
                          onClick={() => {
                            connectDemo();
                            setOpen(false);
                          }}
                        />
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : null}
              {error ? (
                <p className="sheet-foot field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
