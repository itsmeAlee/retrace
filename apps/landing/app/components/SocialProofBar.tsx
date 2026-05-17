"use client";

import { useRef, useEffect, useState } from "react";
import { useInView, motion, useReducedMotion } from "motion/react";
import { useCountUp } from "./animations/useCountUp";
import { MarqueeTicker } from "./animations/MarqueeTicker";

interface StatProps {
  value: number;
  suffix: string;
  label: string;
}

function Stat({ value, suffix, label }: StatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const shouldReduceMotion = useReducedMotion();
  const count = useCountUp(value, shouldReduceMotion ? 1 : 1800, isInView);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1 px-6">
      <div className="flex items-baseline gap-0.5">
        <span className="font-serif text-heading font-bold text-primary">
          {count}
        </span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.4, delay: 1.6 }}
          className="font-serif text-body-lg font-bold text-secondary"
        >
          {suffix}
        </motion.span>
      </div>
      <span className="font-sans text-label font-medium uppercase text-text-secondary">
        {label}
      </span>
    </div>
  );
}

export function SocialProofBar() {
  return (
    <div className="bg-border/20 py-6 border-y border-border/30 overflow-hidden">
      <MarqueeTicker baseSpeed={32} className="mb-4">
        <div className="flex items-center gap-12 px-4">
          <span className="font-sans text-label font-medium uppercase text-text-secondary whitespace-nowrap">
            Trusted by researchers, builders, and deep workers
          </span>
          <span className="text-border">•</span>
          <span className="font-sans text-label font-medium uppercase text-text-secondary whitespace-nowrap">
            Designed for the modern scholar
          </span>
          <span className="text-border">•</span>
          <span className="font-sans text-label font-medium uppercase text-text-secondary whitespace-nowrap">
            Your context, preserved
          </span>
          <span className="text-border">•</span>
        </div>
      </MarqueeTicker>
      <div className="flex justify-center gap-8 md:gap-16 mt-4">
        <Stat value={10} suffix="k+" label="Captures saved" />
        <Stat value={3} suffix=" min" label="Average session resume" />
        <Stat value={1} suffix="-click" label="Capture" />
      </div>
    </div>
  );
}
