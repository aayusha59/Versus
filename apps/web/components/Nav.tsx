"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { WalletButton } from "./WalletButton";
import { Wordmark } from "./Wordmark";

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

/** The template's fixed header: wordmark left, nav in the middle, the wallet where "Host an Event" was. */
export const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false);
  const pathname = usePathname() ?? "/";
  return (
    <header>
      <nav data-state={menuState && "active"} className="bg-background/50 fixed z-20 w-full border-b backdrop-blur-3xl">
        <div className="mx-auto max-w-6xl px-6 transition-all duration-300">
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
            <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center" onClick={() => setMenuState(false)}>
                <Wordmark iconOnly className="[&_svg]:h-5" />
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? "Close Menu" : "Open Menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>
            </div>

            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-14 text-sm">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href, pathname) ? "page" : undefined}
                      className={cn(
                        "hover:text-foreground block duration-150",
                        isActive(item.href, pathname) ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuState(false)}
                        className="text-muted-foreground hover:text-foreground block duration-150"
                      >
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <WalletButton variant="primary" size="sm" className="w-full lg:w-auto" />
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};
