"use client";

import { motion, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/app/lib/utils";
import { useTiltGlow } from "./animations/useTiltGlow";

interface FeatureSectionProps {
  title: React.ReactNode;
  description: React.ReactNode;
  children: React.ReactNode;
  contentBottom?: React.ReactNode;
  heroBadge?: string;
}

function TiltableMedia({ children }: { children: React.ReactNode }) {
  const { rotateX, rotateY, glowX, glowY, onMouseMove, onMouseLeave, ref, isEnabled } = useTiltGlow();

  const glowGradient = useTransform(
    glowX,
    (x) => {
      const y = glowY.get();
      return `radial-gradient(180px circle at ${x}% ${y}%, rgba(26, 60, 52, 0.12), transparent)`;
    }
  );

  return (
    <div style={{ perspective: "1000px" }}>
      <motion.div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={isEnabled ? { rotateX, rotateY, willChange: "transform" } : {}}
        className="relative"
      >
        {isEnabled && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none z-20"
            style={{ background: glowGradient }}
          />
        )}
        {children}
      </motion.div>
    </div>
  );
}

export function FeatureSection({ title, description, children, contentBottom, heroBadge }: FeatureSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-16 flex flex-col items-center gap-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
        className="w-full max-w-2xl"
      >
        {heroBadge && (
          <div className="inline-block bg-secondary/10 px-4 py-1 rounded-full text-secondary font-sans text-label font-medium uppercase mb-6">
            {heroBadge}
          </div>
        )}
        <h2 className="text-heading font-semibold font-serif text-primary mb-6">
          {title}
        </h2>
        <div className="font-sans text-body-lg font-normal text-text-secondary mb-8">
          {description}
        </div>
        {contentBottom}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={shouldReduceMotion ? { duration: 0.2 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const, delay: 0.1 }}
        className="w-full max-w-3xl relative"
      >
        <TiltableMedia>
          {children}
        </TiltableMedia>
      </motion.div>
    </div>
  );
}
