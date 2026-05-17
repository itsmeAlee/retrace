"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

interface ClipRevealProps {
  children: React.ReactNode;
  className?: string;
  italicFrom?: number;
}

export function ClipReveal({ children, className, italicFrom }: ClipRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const words = String(children).trim().split(" ");

  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(hover: none)").matches);
  }, []);

  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : isTouchDevice ? 0.05 : 0.08,
      },
    },
  };

  const wordVariant = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { y: "105%" },
    visible: {
      opacity: 1,
      y: "0%",
      transition: shouldReduceMotion
        ? { duration: 0.2 }
        : { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <motion.span
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {words.map((word, index) => {
        const isItalic = italicFrom !== undefined ? index >= italicFrom : false;

        return (
          <span
            key={`${word}-${index}`}
            style={{ overflow: "hidden", display: "inline-block" }}
          >
            <motion.span
              variants={wordVariant}
              style={{ display: "inline-block", willChange: shouldReduceMotion ? "opacity" : "transform" }}
              className={isItalic ? "italic font-normal" : ""}
            >
              {word}
            </motion.span>
          </span>
        );
      })}
    </motion.span>
  );
}
