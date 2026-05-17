"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type ToastProps = {
  message: string;
};

export function Toast({ message }: ToastProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 rounded-pill bg-primary px-5 py-3 text-sm font-medium text-white shadow-card-hover"
          exit={{ opacity: 0, y: reduce ? 0 : 12 }}
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          transition={{ duration: reduce ? 0.15 : 0.25, ease: "easeOut" }}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
