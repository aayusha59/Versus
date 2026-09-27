"use client";

import { TextEffect } from "@/components/motion-primitives/text-effect";
import React from "react";
import { transitionVariants } from "@/lib/utils";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import { STEPS } from "@/lib/steps";

export default function Agenda({ title = "How it works" }: { title?: string }) {
  return (
    <section id="how-it-works" className="scroll-py-16 py-16 md:scroll-py-32 md:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-y-12 px-2 lg:grid-cols-[1fr_auto]">
          <div className="text-center lg:text-left">
            <TextEffect
              triggerOnView
              preset="fade-in-blur"
              speedSegment={0.3}
              as="h2"
              className="mb-4 text-3xl font-semibold md:text-4xl"
            >
              {title}
            </TextEffect>
          </div>

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
            className="divide-y divide-dashed sm:mx-auto sm:max-w-lg lg:mx-0"
          >
            {STEPS.map((s, i) => (
              <div key={s.n} className={i === 0 ? "pb-6" : "py-6"}>
                <div className="font-medium space-x-2">
                  <span className="text-muted-foreground font-mono ">{s.n}</span>
                  <span>{s.title}</span>
                </div>
                <p className="text-muted-foreground mt-4">{s.body}</p>
              </div>
            ))}
          </AnimatedGroup>
        </div>
      </div>
    </section>
  );
}
