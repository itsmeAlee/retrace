"use client";

import { motion, useReducedMotion } from "motion/react";
import { Placeholder } from "./ui/Placeholder";
import { ClipReveal } from "./animations/ClipReveal";

export function SolutionReveal() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="bg-primary text-white py-32 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16 text-center">
        <p className="font-sans text-label font-medium uppercase mb-8 text-on-primary-container">Introducing Retrace</p>
        <h2>
          <ClipReveal
            italicFrom={4}
            className="text-heading font-semibold font-serif mb-12 flex flex-wrap justify-center gap-x-3 gap-y-2 text-white"
          >
            A second memory for your digital journey.
          </ClipReveal>
        </h2>
        <p className="font-sans text-subhead font-normal text-on-primary-container mb-20 max-w-2xl mx-auto">
          Your browser extension captures context in one click. Your dashboard keeps it organized and searchable.
        </p>
        <div className="relative max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 shadow-2xl">
              <Placeholder label="Placeholder C (Dashboard Grid)" aspectRatio="aspect-video" className="max-w-[56.25rem] mx-auto bg-white/10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
