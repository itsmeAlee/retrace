"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "../Icon";

export function NewSessionCard({ onClick }: { onClick?: () => void }) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      className="flex min-h-session-card flex-col items-center justify-center rounded-card border-[1.5px] border-dashed border-border bg-transparent p-5 text-center text-text-muted transition-colors hover:border-border-hover hover:bg-surface/50"
      onClick={onClick}
      transition={{ duration: 0.2, ease: "easeOut" }}
      type="button"
      whileHover={reduce ? undefined : { y: -2 }}
    >
      <Icon className="h-8 w-8 text-border-hover" name="post-add" />
      <span className="mt-3 text-sm">New Session</span>
    </motion.button>
  );
}
