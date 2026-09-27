"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentNetwork, currentRpcHost } from "@/lib/data";
import { cx } from "@/lib/cx";
import { Clock } from "./Clock";
import { Stamp } from "./Stamp";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/", label: "Board" },
  { href: "/new", label: "New duel" },
  { href: "/me", label: "My corners" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/d/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Left rail on desktop, top strip on mobile. Wordmark, nav, operator clock, network, wallet. */
export function Rail() {
  const pathname = usePathname() ?? "/";
  const network = currentNetwork();
  const rpc = network === "demo" ? null : currentRpcHost();
  const blurb =
    network === "demo"
      ? "Fixtures and a ticking simulator. Nothing touches a chain."
      : network === "localnet"
        ? "Local validator. Mock USDC from the faucet."
        : "Solana devnet. Mock USDC from the faucet.";

  return (
    <>
      <aside className="shell-rail hidden lg:flex flex-col pt-12 pb-8">
        <Link href="/" className="display narrow text-xl leading-none w-fit" aria-label="Versus, back to the board">
          Versus
        </Link>
        <p className="serif text-md text-ink-2 mt-2">Paired prediction duels.</p>

        <nav aria-label="Primary" className="mt-10 rule-ink hairline-rows">
          {NAV.map((n, i) => {
            const active = isActive(n.href, pathname);
            return (
              <Link key={n.href} href={n.href} className="nav-link" aria-current={active ? "page" : undefined}>
                <span className="nav-index tnum">0{i + 1}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-7">
          <Clock />
          <div>
            <span className="label">Network</span>
            <div className="mt-2">
              <Stamp tone="ink">{network}</Stamp>
            </div>
            {rpc ? (
              <p className="text-xs text-ink-2 tnum mt-2 break-all" aria-label={`RPC ${rpc}`}>
                {rpc}
              </p>
            ) : null}
            <p className="text-xs text-ink-2 mt-3 max-w-[24ch]">{blurb}</p>
          </div>
          <WalletButton block />
        </div>
      </aside>

      <header className="lg:hidden pt-4 pb-3 border-b border-ink flex items-center gap-3">
        <Link href="/" className="display narrow text-lg leading-none shrink-0" aria-label="Versus, back to the board">
          Versus
        </Link>
        <nav
          aria-label="Primary"
          className="flex gap-3 text-xs uppercase tracking-[0.06em] font-semibold min-w-0 ml-1"
        >
          {NAV.map((n) => {
            const active = isActive(n.href, pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "py-1 whitespace-nowrap",
                  active ? "text-ink underline underline-offset-4 decoration-2" : "text-ink-2",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto shrink-0">
          <WalletButton size="sm" short />
        </div>
      </header>
      <div className="lg:hidden flex items-center justify-between gap-3 py-1.5 border-b border-rule text-xs text-ink-2">
        <span className="uppercase tracking-[0.08em] min-w-0 truncate">
          {network}
          {rpc ? <span className="normal-case tracking-normal tnum"> {rpc}</span> : null}
        </span>
        <Clock label={false} className="shrink-0" />
      </div>
    </>
  );
}
