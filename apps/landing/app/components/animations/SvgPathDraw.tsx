"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

/**
 * SVG path draw-on animation.
 * A dashed line draws itself from left to right on scroll entry.
 * Hidden on mobile — vertical layout uses simple short segments.
 */
export function SvgPathDraw() {
  const ref = useRef<SVGSVGElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div className="hidden md:block absolute top-1/2 left-0 w-full -z-10 -translate-y-1/2 pointer-events-none">
      <svg
        ref={ref}
        viewBox="0 0 1000 4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-1"
        preserveAspectRatio="none"
      >
        <motion.line
          x1="0"
          y1="2"
          x2="1000"
          y2="2"
          stroke="#E4E2DC"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          initial={shouldReduceMotion ? { pathLength: 1, opacity: 0 } : { pathLength: 0, opacity: 0 }}
          animate={
            isInView
              ? { pathLength: 1, opacity: 1 }
              : shouldReduceMotion
                ? { pathLength: 1, opacity: 0 }
                : { pathLength: 0, opacity: 0 }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { duration: 1.0, ease: "easeOut" as const, delay: 0.4 }
          }
        />
      </svg>
    </div>
  );
}
