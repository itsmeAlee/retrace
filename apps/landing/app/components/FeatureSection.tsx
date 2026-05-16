"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/app/lib/utils";

interface FeatureSectionProps {
  title: React.ReactNode;
  description: React.ReactNode;
  reverse?: boolean;
  children: React.ReactNode;
  contentBottom?: React.ReactNode;
  heroBadge?: string;
}

export function FeatureSection({ title, description, reverse, children, contentBottom, heroBadge }: FeatureSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={cn("max-w-[1200px] mx-auto px-5 md:px-16 flex flex-col items-center gap-20", reverse ? "md:flex-row-reverse" : "md:flex-row")}>
      <motion.div 
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
        className="w-full md:w-1/2"
      >
        {heroBadge && (
          <div className="inline-block bg-secondary/10 px-4 py-1 rounded-full text-secondary font-sans text-xs font-bold tracking-wider mb-6">
            {heroBadge}
          </div>
        )}
        <h2 className="text-3xl md:text-4xl font-semibold font-serif text-primary mb-6">
          {title}
        </h2>
        <div className="font-sans text-lg text-text-secondary mb-8">
          {description}
        </div>
        {contentBottom}
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const, delay: 0.1 }}
        className="w-full md:w-1/2 relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
