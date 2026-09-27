"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { transitionVariants } from "@/lib/utils";

export default function CallToAction({
  title = "The board is live.",
  body = "Duels are open now. Pick a side and the odds move with you.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="py-16 mx-2">
      <div className="mx-auto max-w-5xl rounded-3xl border px-6 py-12 md:py-20 lg:py-32">
        <div className="text-center">
          <TextEffect
            triggerOnView
            preset="fade-in-blur"
            speedSegment={0.3}
            as="h2"
            className="text-balance text-4xl font-semibold lg:text-5xl"
          >
            {title}
          </TextEffect>
          <TextEffect
            triggerOnView
            preset="fade-in-blur"
            speedSegment={0.3}
            delay={0.3}
            as="p"
            className="mt-4 text-muted-foreground"
          >
            {body}
          </TextEffect>
          <AnimatedGroup
            triggerOnView
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
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <Button asChild size="lg">
              <Link href="/board">
                <span>Open the board</span>
              </Link>
            </Button>

            <Button asChild size="lg" variant="outline">
              <Link href="/new">
                <span>Create a duel</span>
              </Link>
            </Button>
          </AnimatedGroup>
        </div>
      </div>
    </section>
  );
}
