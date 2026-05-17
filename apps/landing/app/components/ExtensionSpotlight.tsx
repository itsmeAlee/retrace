"use client";

import { motion, useReducedMotion } from "motion/react";
import { PillButton } from "./ui/PillButton";

export function ExtensionSpotlight() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="bg-primary py-24 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 md:p-20 flex flex-col md:flex-row items-center gap-16 relative">
          <div className="w-full md:w-3/5 text-center md:text-left">
            <h2 className="text-heading font-semibold font-serif text-white mb-6">
              The context is <br/><span className="italic font-normal">the work.</span>
            </h2>
            <p className="text-on-primary-container font-sans text-subhead font-normal mb-10 max-w-lg mx-auto md:mx-0">
              Don't let another brilliant thought slip through the cracks of your browser tabs. Join 10,000+ deep workers.
            </p>
            <PillButton variant="white">
              Add to Chrome — It's Free
            </PillButton>
          </div>
          <div className="w-full md:w-2/5 relative">
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <div className="bg-white rounded-2xl py-4 px-6 shadow-2xl rotate-3 md:scale-110 relative z-10 origin-bottom-right w-full max-w-[23.75rem] h-auto mx-auto">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-serif text-body-lg font-semibold text-primary">Retrace</span>
                  <div className="w-6 h-6 rounded-full bg-border flex items-center justify-center">
                    <span className="text-base">✕</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-surface-container-low p-4 rounded-xl border border-border">
                    <p className="font-sans text-base text-primary font-bold tracking-wide mb-1">Currently Researching:</p>
                    <p className="font-sans text-base leading-[1.65] text-text-secondary">12 Open Tabs • 3 Snippets</p>
                  </div>
                  <button className="w-full bg-primary text-white py-4 rounded-xl font-medium font-sans text-button">Snapshot Context</button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
