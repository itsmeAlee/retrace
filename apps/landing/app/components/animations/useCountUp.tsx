"use client";

import { useEffect, useState } from "react";

/**
 * Animates a number from 0 → target over `duration` ms with easeOut cubic.
 * Returns the current integer value. Only runs when `isInView` is true.
 */
export function useCountUp(target: number, duration: number, isInView: boolean): number {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    let rafId: number;

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      setCurrent(Math.round(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isInView, target, duration]);

  return current;
}
