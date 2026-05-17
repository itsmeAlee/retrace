"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AuthRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        key={pathname}
        transition={{ duration: reduce ? 0.2 : 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
