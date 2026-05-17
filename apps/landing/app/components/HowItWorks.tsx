"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { ClipReveal } from "./animations/ClipReveal";
import { SvgPathDraw } from "./animations/SvgPathDraw";

const steps = [
  {
    number: "1",
    title: "Capture",
    description: "Click one button. Retrace snapshots every open tab, note, and thought in your current context.",
  },
  {
    number: "2",
    title: "Collect",
    description: "Organize snapshots into Journals. Add editorial notes and tags to build your personal library.",
  },
  {
    number: "3",
    title: "Resume",
    description: "One click restores your entire environment. Every tab, exactly where you left it. Ready for deep work.",
  },
];

export function HowItWorks() {
  return (
    <section className="max-w-[1200px] mx-auto px-5 md:px-16 py-32">
      <h2>
        <ClipReveal className="text-heading font-semibold font-serif text-primary text-center mb-20 flex flex-wrap gap-x-2 justify-center">
          Three steps. Zero friction.
        </ClipReveal>
      </h2>
      <div className="relative">
        <SvgPathDraw />
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <StepCard key={step.number} card={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ card, index }: { card: (typeof steps)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div className="relative pl-6 md:pl-0 border-l-2 md:border-l-0 border-border">
      <motion.div
        ref={ref}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.94 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : undefined}
        whileHover={
          shouldReduceMotion
            ? {}
            : { scale: 1.03, y: -4, transition: { type: "spring", stiffness: 300, damping: 22 } }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0.2 }
            : { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay: index * 0.12 }
        }
        className="group bg-surface rounded-2xl border border-border p-12 relative overflow-hidden transition-shadow hover:shadow-xl"
      >
        <span className="absolute -top-10 -left-4 text-[7.5rem] font-bold font-serif text-secondary/10 pointer-events-none">
          {card.number}
        </span>
        <h3 className="font-serif text-body-lg font-semibold mb-4 text-primary">{card.title}</h3>
        <p className="font-sans text-base leading-[1.65] font-normal text-text-secondary max-w-md opacity-70 transition-opacity group-hover:opacity-100">
          {card.description}
        </p>
      </motion.div>
    </div>
  );
}
