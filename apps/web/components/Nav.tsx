"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/board", label: "Board" },
  { href: "/new", label: "Create" },
  { href: "/positions", label: "Positions" },
  { href: "/how-it-works", label: "How it works" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/board") return pathname === "/board" || pathname.startsWith("/d/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const LINK = "font-mono uppercase transition-colors duration-150 ease-out hover:text-foreground";

/**
 * PolyYield's header without the wordmark: transparent over the hero, mono uppercase links
 * centred on the viewport, the wallet as plain text on the right. Once the page scrolls the
 * bar tightens and blurs to black.
 */
export const HeroHeader = () => {
  const [scrolled, setScrolled] = React.useState(false);
  const pathname = usePathname() ?? "/";

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed top-0 left-0 z-50 w-full pt-8 transition-all duration-300 md:pt-14",
        scrolled && "border-b border-border/50 bg-black/80 pt-4 backdrop-blur-xl md:pt-6",
      )}
    >
      <header className="container mx-auto flex h-16 items-center justify-end px-4 md:px-8 xl:px-12">
        <nav className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center gap-x-10 max-lg:hidden">
          {NAV.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(LINK, "inline-block", active ? "text-foreground" : "text-foreground/60")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="max-lg:hidden">
          <WalletButton variant="text" size="sm" />
        </div>
        <MobileMenu pathname={pathname} />
      </header>
    </div>
  );
};

/** PolyYield's mobile menu: a full-width sheet under the header with the links stacked. */
function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog.Root modal={false} open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="p-2 text-foreground transition-colors lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <div data-overlay="true" className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          onInteractOutside={(e) => {
            if (e.target instanceof HTMLElement && e.target.dataset.overlay !== "true") e.preventDefault();
          }}
          className="pointer-events-none fixed inset-0 z-40 flex flex-col pt-28 pb-[calc(2rem+env(safe-area-inset-bottom))] md:pt-40"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          {/* The sheet itself lets taps through to the overlay (which closes the menu); only the
              link stack and the wallet footer catch them. */}
          <nav className="container mx-auto flex flex-1 flex-col px-4 md:px-8">
            <div className="pointer-events-auto flex flex-col gap-y-6">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    LINK,
                    "block py-3 text-xl",
                    isActive(item.href, pathname) ? "text-foreground" : "text-foreground/60",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="pointer-events-auto mt-auto border-t border-border/50 pt-6">
              <WalletButton variant="text" size="lg" block />
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
