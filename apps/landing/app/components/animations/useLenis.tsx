"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Lenis smooth scroll provider.
 * Disables on touch/mobile devices — native scroll feels better there.
 * Syncs with Framer Motion's scroll tracking via requestAnimationFrame.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Skip on touch devices — native momentum scroll is better
    const isTouchDevice = window.matchMedia("(hover: none)").matches;
    if (isTouchDevice) return;

    const lenis = new Lenis({
      lerp: 0.06,
      duration: 1.2,
      easing: (t: number) => {
        // cubic-bezier(0.16, 1, 0.3, 1) approximation
        return 1 - Math.pow(1 - t, 4);
      },
      smoothWheel: true,
      anchors: {
        offset: -80,
      },
    });
    lenisRef.current = lenis;

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
