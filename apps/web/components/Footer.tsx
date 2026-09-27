"use client";

import Link from "next/link";
import React from "react";
import { currentNetwork, currentRpcHost } from "@/lib/data";
import { SolanaMark } from "./SolanaLogo";
import { Wordmark } from "./Wordmark";

const links = [
  { title: "Home", href: "/" },
  { title: "Board", href: "/board" },
  { title: "Create", href: "/new" },
  { title: "Positions", href: "/positions" },
  { title: "How it works", href: "/how-it-works" },
];

export default function FooterSection() {
  const network = currentNetwork();
  const rpc = network === "demo" ? null : currentRpcHost();
  return (
    <footer className="py-16 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Link href="/" aria-label="go home" className="mx-auto block size-fit">
          <Wordmark iconOnly className="[&_svg]:h-6" />
        </Link>

        <div className="my-8 flex flex-wrap justify-center gap-6 text-sm">
          {links.map((link, index) => (
            <Link key={index} href={link.href} className="text-muted-foreground hover:text-primary block duration-150">
              <span>{link.title}</span>
            </Link>
          ))}
        </div>
        <span className="text-muted-foreground block text-center text-sm font-mono">
          Settled by Pyth, pooled on Meteora, paid in xStocks &bull; Powered by{" "}
          <span className="text-foreground inline-flex items-center gap-1.5 align-baseline">
            <SolanaMark className="h-3 w-auto" />
            Solana
          </span>
          .
        </span>
        <span className="text-muted-foreground/60 block text-center text-xs font-mono mt-3 uppercase tracking-[0.1em]">
          {network}
          {rpc ? <span className="normal-case tracking-normal"> {rpc}</span> : null}
        </span>
      </div>
    </footer>
  );
}
