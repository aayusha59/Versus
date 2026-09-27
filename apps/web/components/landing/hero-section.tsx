"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { transitionVariants } from "@/lib/utils";
import { SolanaMark } from "@/components/SolanaLogo";

function PartnerWordmark({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground text-xl font-semibold tracking-tight whitespace-nowrap">{children}</span>;
}

export default function HeroSection() {
  return (
    <main id="main" className="overflow-x-hidden">
      <section className="relative min-h-dvh flex items-center">
        <div className="w-full py-24 lg:py-32 lg:grid lg:grid-cols-2 lg:grid-rows-1 grid-cols-1 grid-rows-1">
          <div className="relative mx-auto flex max-w-xl flex-col px-6 lg:block">
            <div className="mx-auto max-w-2xl text-center lg:ml-0 lg:text-left">
              <TextEffect
                preset="fade-in-blur"
                speedSegment={0.3}
                as="h1"
                className="max-w-2xl text-balance text-5xl font-semibold md:text-6xl xl:text-7xl"
              >
                Back a side.
              </TextEffect>
              <TextEffect
                preset="fade-in-blur"
                speedSegment={0.3}
                as="h1"
                className="max-w-2xl text-balance text-5xl font-semibold md:text-6xl xl:text-7xl"
              >
                Get paid.
              </TextEffect>
              <TextEffect
                per="line"
                preset="fade-in-blur"
                speedSegment={0.3}
                delay={0.5}
                as="p"
                className="mt-8 max-w-2xl text-pretty text-lg text-muted-foreground bg-black p-1 rounded-md"
              >
                Apple or Nvidia. Bitcoin or Ethereum. Every duel is a head-to-head question with a date on it. Back a
                side, and every trade pays you a fee in that side&apos;s own stock token.
              </TextEffect>
              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                        delayChildren: 0.75,
                      },
                    },
                  },
                  ...transitionVariants,
                }}
                className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start"
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
            </div>
          </div>
        </div>
      </section>
      <section className="bg-background pb-16 md:pb-32">
        <AnimatedGroup
          variants={{
            container: {
              visible: {
                transition: {
                  staggerChildren: 0.05,
                  delayChildren: 0.75,
                },
              },
            },
            ...transitionVariants,
          }}
          className="group relative m-auto max-w-6xl px-6"
        >
          <div className="flex flex-col items-center md:flex-row">
            <div className="md:max-w-44 md:border-r md:pr-6">
              <p className="text-end text-sm font-mono uppercase">Powered by</p>
            </div>
            <div className="relative py-6 md:w-[calc(100%-11rem)]">
              <InfiniteSlider speedOnHover={20} speed={40} gap={112}>
                <div className="flex items-center gap-3" aria-label="Solana">
                  <SolanaMark className="h-6 w-auto" />
                  <PartnerWordmark>Solana</PartnerWordmark>
                </div>
                <div className="flex items-center" aria-label="Pyth">
                  <PartnerWordmark>Pyth</PartnerWordmark>
                </div>
                <div className="flex items-center" aria-label="Meteora">
                  <PartnerWordmark>Meteora</PartnerWordmark>
                </div>
                <div className="flex items-center" aria-label="xStocks">
                  <PartnerWordmark>xStocks</PartnerWordmark>
                </div>
              </InfiniteSlider>
              <div className="bg-linear-to-r from-background absolute inset-y-0 left-0 w-20"></div>
              <div className="bg-linear-to-l from-background absolute inset-y-0 right-0 w-20"></div>
              <ProgressiveBlur
                className="pointer-events-none absolute left-0 top-0 h-full w-20"
                direction="left"
                blurIntensity={1}
              />
              <ProgressiveBlur
                className="pointer-events-none absolute right-0 top-0 h-full w-20"
                direction="right"
                blurIntensity={1}
              />
            </div>
          </div>
        </AnimatedGroup>
      </section>
    </main>
  );
}
