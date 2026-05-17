"use client";

import { useScroll, useTransform } from "motion/react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Scroll-driven subtle background color interpolation.
 * Imperceptible shifts that make the page feel alive.
 * Does NOT affect dark sections (Extension Spotlight).
 */
export function BackgroundShift({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 0.2, 0.5, 0.8, 1.0],
    ["#F7F6F3", "#F4F6F3", "#F7F6F3", "#F5F4F0", "#F7F6F3"]
  );

  if (shouldReduceMotion) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <motion.main
      className="min-h-screen"
      style={{ backgroundColor }}
    >
      {children}
    </motion.main>
  );
}
