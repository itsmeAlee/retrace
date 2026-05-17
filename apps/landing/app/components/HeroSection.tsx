"use client";

import { motion, useReducedMotion } from "motion/react";
import { PillButton } from "./ui/PillButton";
import { ClipReveal } from "./animations/ClipReveal";

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <header className="max-w-[1200px] mx-auto px-5 md:px-16 pt-24 pb-32 text-center flex flex-col items-center overflow-hidden">
      <motion.div className="w-full max-w-2xl">
        <h1>
          <ClipReveal
            italicFrom={3}
            className="text-display font-bold font-serif text-primary mb-6 flex flex-wrap gap-x-3 gap-y-2 justify-center"
          >
            Never lose your work context again.
          </ClipReveal>
        </h1>
        <p className="font-sans text-subhead font-normal text-text-secondary mb-10 max-w-lg mx-auto">
          Capture what matters while you browse. Resume exactly where you left off. The digital ink for the deep worker.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <PillButton variant="primary">Add to Chrome - It's Free</PillButton>
          <PillButton variant="outline">How it works</PillButton>
        </div>
      </motion.div>
    </header>
  );
}
