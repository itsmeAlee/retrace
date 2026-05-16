"use client";

import { motion, useReducedMotion } from "motion/react";
import { PillButton } from "./ui/PillButton";
import { Placeholder } from "./ui/Placeholder";

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  const titleWords = "Never lose your work context again.".split(" ");

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const child = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }
    }
  };

  return (
    <header className="max-w-[1200px] mx-auto px-5 md:px-16 pt-24 pb-32 text-center md:text-left flex flex-col md:flex-row items-center gap-16 overflow-hidden">
      <motion.div 
        className="w-full md:w-1/2"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        <h1 className="text-[36px] md:text-[64px] leading-[1.1] font-bold font-serif tracking-tight text-primary mb-6 flex flex-wrap gap-x-3 gap-y-2 justify-center md:justify-start">
          {titleWords.map((word, idx) => (
            <motion.span key={idx} variants={child}>
              {idx >= 3 ? <span className="italic font-normal">{word}</span> : word}
            </motion.span>
          ))}
        </h1>
        <motion.p variants={child} className="font-sans text-lg text-text-secondary mb-10 max-w-lg mx-auto md:mx-0">
          Capture what matters while you browse. Resume exactly where you left off. The digital ink for the deep worker.
        </motion.p>
        <motion.div variants={child} className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
          <PillButton variant="primary">Add to Chrome — It's Free</PillButton>
          <PillButton variant="outline">How it works</PillButton>
        </motion.div>
      </motion.div>
      <div className="w-full md:w-1/2 relative">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" as const }}
          className="relative z-10"
        >
          <motion.div
            animate={shouldReduceMotion ? {} : { y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="bg-white rounded-xl shadow-2xl border border-border p-2"
          >
            <Placeholder label="Placeholder A (Workspace Mockup)" aspectRatio="aspect-[4/3]" />
          </motion.div>
          <div className="absolute -inset-4 bg-secondary/10 blur-3xl -z-10 rounded-full"></div>
        </motion.div>
      </div>
    </header>
  );
}
