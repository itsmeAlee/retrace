"use client";

import { motion, useReducedMotion } from "motion/react";

export function FinalCTA() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="py-32 text-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
        className="max-w-3xl mx-auto px-5"
      >
        <h2 className="text-[36px] md:text-[64px] leading-[1.1] font-bold font-serif text-primary mb-8">
          Your work deserves a <br/><span className="italic font-normal">better memory.</span>
        </h2>
        <p className="font-sans text-lg text-text-secondary mb-12">
          Start your journey toward intentional productivity today. No credit card required.
        </p>
        <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input 
            className="flex-1 px-6 py-4 rounded-full border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base font-sans bg-white" 
            placeholder="Enter your email" 
            type="email"
            required
          />
          <button 
            className="bg-primary text-white px-8 py-4 rounded-full font-sans text-sm font-medium tracking-wide hover:scale-105 transition-transform" 
            type="submit"
          >
            Get Started
          </button>
        </form>
      </motion.div>
    </section>
  );
}
