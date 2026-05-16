"use client";

import { HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import { cn } from "@/app/lib/utils";
import React from "react";

interface PillButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "outline" | "white";
  children: React.ReactNode;
}

export function PillButton({ variant = "primary", children, className, ...props }: PillButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  const baseStyles = "px-8 py-4 rounded-full font-sans text-sm font-medium tracking-wide transition-colors";
  
  const variants = {
    primary: "bg-primary text-white shadow-lg shadow-primary/10 hover:bg-primary/90",
    outline: "border border-border text-primary hover:bg-surface-container-low",
    white: "bg-white text-primary shadow-2xl hover:bg-white/90",
  };

  return (
    <motion.button
      whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
