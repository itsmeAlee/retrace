"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type AuthButtonProps = HTMLMotionProps<"button"> & {
  children: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  variant?: "primary" | "ghost";
};

export function AuthButton({ children, icon, isLoading = false, variant = "primary", className = "", ...props }: AuthButtonProps) {
  const reduce = useReducedMotion();
  const styles =
    variant === "primary"
      ? "bg-primary text-white hover:bg-primary-hover"
      : "border-[1.5px] border-border bg-surface text-text-primary hover:bg-bg";

  return (
    <motion.button
      whileHover={reduce || isLoading ? undefined : { scale: 1.02 }}
      whileTap={reduce || isLoading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 320, damping: 24 }}
      className={`flex h-auth-control w-full items-center justify-center gap-3 rounded-form text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-75 ${styles} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <span className="h-5 w-5 animate-spin rounded-pill border-2 border-white/40 border-t-white" /> : icon}
      {!isLoading && children}
    </motion.button>
  );
}
