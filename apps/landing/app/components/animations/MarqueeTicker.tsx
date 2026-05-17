"use client";

import { useRef, useEffect, useState } from "react";
import { useScroll, useVelocity, useSpring, useTransform, useAnimationFrame, useMotionValue } from "motion/react";
import { motion, useReducedMotion } from "motion/react";

interface MarqueeTickerProps {
  children: React.ReactNode;
  baseSpeed?: number;
  className?: string;
}

/**
 * Infinite horizontal marquee — scroll-velocity reactive.
 * Scrolling fast speeds up the ticker, slow/stopped → normal speed.
 * Pauses on hover. Masked edges for fade.
 */
export function MarqueeTicker({ children, baseSpeed = 28, className }: MarqueeTickerProps) {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [-1000, 0, 1000], [2.5, 1, 0.4]);

  const baseX = useMotionValue(0);
  const translateX = useTransform(baseX, (v) => `${v}%`);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useAnimationFrame((_, delta) => {
    if (isPaused || shouldReduceMotion || !isMounted) return;
    const factor = velocityFactor.get();
    const pixelsPerSecond = (100 / baseSpeed) * factor;
    const movement = pixelsPerSecond * (delta / 1000);

    let newX = baseX.get() - movement;
    if (newX <= -33.33) newX += 33.33;
    baseX.set(newX);
  });

  if (!isMounted) {
    return (
      <div className={className}>
        <div className="flex whitespace-nowrap gap-8">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={className}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 80px, black calc(100% - 80px), transparent)",
        overflow: "hidden",
      }}
    >
      <motion.div
        className="flex whitespace-nowrap gap-8"
        style={{ x: translateX }}
      >
        {/* Triplicate for seamless loop */}
        {children}
        {children}
        {children}
      </motion.div>
    </div>
  );
}
