"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/app/lib/utils";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedCard({ children, className, delay = 0 }: AnimatedCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: { 
      opacity: 0, 
      y: shouldReduceMotion ? 0 : 20, 
      scale: shouldReduceMotion ? 1 : 0.92 
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay }
    },
    hover: {
      scale: shouldReduceMotion ? 1 : 1.04,
      transition: { duration: 0.22, ease: "easeOut" as const }
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      whileHover={shouldReduceMotion ? {} : "hover"}
      className={cn(
        "group bg-surface rounded-2xl border border-border transition-shadow hover:shadow-xl overflow-hidden",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.h3
      variants={{
        hover: { y: shouldReduceMotion ? 0 : -4, transition: { duration: 0.22, ease: "easeOut" as const } }
      }}
      className={cn("font-serif text-xl md:text-2xl font-semibold mb-4 text-primary", className)}
    >
      {children}
    </motion.h3>
  );
};

export const CardDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <motion.p
      variants={{
        hidden: { opacity: 0.7 },
        visible: { opacity: 0.7 },
        hover: { opacity: 1, transition: { duration: 0.22, ease: "easeOut" as const } }
      }}
      className={cn("font-sans text-base text-text-secondary", className)}
    >
      {children}
    </motion.p>
  );
};

export const CardImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="overflow-hidden">
      <motion.img
        src={src}
        alt={alt}
        variants={{
          hover: { scale: shouldReduceMotion ? 1 : 1.06, transition: { duration: 0.22, ease: "easeOut" as const } }
        }}
        className={cn("w-full h-auto object-cover", className)}
      />
    </div>
  );
};
