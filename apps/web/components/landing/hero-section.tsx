"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { transitionVariants } from "@/lib/utils";
import { SolanaMark } from "@/components/SolanaLogo";

const groupVariants = {
  container: {
    visible: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.75,
      },
    },
  },
  ...transitionVariants,
};

/** Centred hero, PolyYield style: one headline, two buttons, "powered by" and the Solana logo. */
export default function HeroSection() {
  return (
    <main id="main" className="overflow-x-hidden">
      <section className="relative min-h-dvh flex items-center">
        <div className="w-full py-24 lg:py-32">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
            <TextEffect
              preset="fade-in-blur"
              speedSegment={0.3}
              as="h1"
              className="text-5xl font-semibold md:text-6xl lg:text-7xl lg:whitespace-nowrap"
            >
              Back a side. Get paid.
            </TextEffect>
            <AnimatedGroup
              variants={groupVariants}
              className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row"
            >
              <Button asChild size="lg" className="px-5 text-base">
                <Link href="/board">
                  <span className="text-nowrap">Explore the board</span>
                </Link>
              </Button>
              <Button
                key={2}
                asChild
                size="lg"
                variant="ghost"
                className="px-5 text-base bg-black/30 backdrop-blur-sm hover:bg-black/40"
              >
                <Link href="/how-it-works">
                  <span className="text-nowrap">How it works</span>
                </Link>
              </Button>
            </AnimatedGroup>
            <AnimatedGroup variants={groupVariants} className="mt-16 flex flex-col items-center gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Powered by
              </p>
              <span className="inline-flex items-center gap-3" aria-label="Solana">
                <SolanaMark className="h-7 w-auto" />
                <span className="text-foreground text-2xl font-semibold uppercase tracking-[0.12em] leading-none">
                  Solana
                </span>
              </span>
            </AnimatedGroup>
          </div>
        </div>
      </section>
    </main>
  );
}
