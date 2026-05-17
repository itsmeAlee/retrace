"use client";

import { HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import { cn } from "@/app/lib/utils";
import React, { useEffect, useState } from "react";

type PillButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "outline" | "white";
  children: React.ReactNode;
};

type PillLinkProps = HTMLMotionProps<"a"> & {
  href: string;
  variant?: "primary" | "outline" | "white";
  children: React.ReactNode;
};

export function PillButton({ variant = "primary", children, className, ...props }: PillButtonProps | PillLinkProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isHoverCapable, setIsHoverCapable] = useState(false);

  useEffect(() => {
    setIsHoverCapable(!window.matchMedia("(hover: none)").matches);
  }, []);

  const baseStyles = "group relative overflow-hidden px-8 py-4 rounded-full font-sans text-button font-medium tracking-wide transition-colors";
  
  const variants = {
    primary: "bg-primary text-white shadow-lg shadow-primary/10 hover:bg-primary/90",
    outline: "border border-border text-primary hover:bg-surface-container-low",
    white: "bg-white text-primary shadow-2xl hover:bg-white/90",
  };

  const content = (
    <>
      {isHoverCapable && !shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-white pointer-events-none"
          variants={{
            rest: { x: "-120%", opacity: 0 },
            hover: { x: "220%", opacity: 0.12 },
            tap: { x: "220%", opacity: 0.08 },
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2 [&>svg]:transition-transform group-hover:[&>svg]:translate-x-[3px] [&>svg]:duration-200">
        {children}
      </span>
    </>
  );

  const motionProps = {
    initial: "rest",
    whileHover: "hover",
    whileTap: "tap",
    variants: {
      rest: { scale: 1 },
      hover: shouldReduceMotion ? { opacity: 1 } : { scale: 1.03 },
      tap: shouldReduceMotion ? { opacity: 0.9 } : { scale: 0.97 },
    },
    transition: { type: "spring", stiffness: 400, damping: 25 },
    className: cn(baseStyles, variants[variant], className),
  } as const;

  if ("href" in props) {
    return (
      <motion.a {...motionProps} {...props}>
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button {...motionProps} {...props}>
      {content}
    </motion.button>
  );
}
