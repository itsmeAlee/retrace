"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "../Icon";

const proofPoints = [
  "Capture context effortlessly as you browse.",
  "Resume sessions exactly where you left off.",
  "Never lose critical research strings again."
];

export function AuthLeftPanel() {
  const reduce = useReducedMotion();

  return (
    <aside className="relative hidden min-h-screen w-[55vw] min-w-auth-left-min overflow-hidden bg-primary p-16 text-white md:flex md:flex-col md:justify-between">
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="relative z-10 flex min-h-full flex-col justify-between"
        initial={{ opacity: 0, x: reduce ? 0 : -24 }}
        transition={{ duration: reduce ? 0.2 : 0.5, ease: "easeOut" }}
      >
        <div className="font-heading text-xl font-bold">Retrace</div>
        <div className="max-w-xl">
          <h1 className="font-heading text-display font-bold">Your work deserves a better memory.</h1>
          <ul className="mt-6 space-y-6">
            {proofPoints.map((point) => (
              <li className="flex items-center gap-4 text-lg text-white/75" key={point}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-white/10 text-white">
                  <Icon className="h-4 w-4" name="check" />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm italic text-white/50">Used by researchers, builders, and deep workers.</p>
      </motion.div>
      <div className="pointer-events-none absolute inset-0 opacity-10 [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:20px_20px]" />
    </aside>
  );
}
