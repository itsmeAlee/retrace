"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useMotionValue, useReducedMotion, useSpring, MotionValue } from "motion/react";

interface TiltGlowValues {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  glowX: MotionValue<number>;
  glowY: MotionValue<number>;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  ref: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
}

/**
 * 3D perspective tilt + edge glow on cursor hover.
 * Disabled on touch/mobile devices to save GPU.
 */
export function useTiltGlow(): TiltGlowValues {
  const ref = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(50);

  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(rawRotateX, springConfig);
  const rotateY = useSpring(rawRotateY, springConfig);

  useEffect(() => {
    setIsEnabled(!shouldReduceMotion && !window.matchMedia("(hover: none)").matches);
  }, [shouldReduceMotion]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isEnabled || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const normalizedX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const normalizedY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      rawRotateX.set(normalizedY * -8);
      rawRotateY.set(normalizedX * 8);
      glowX.set(((e.clientX - rect.left) / rect.width) * 100);
      glowY.set(((e.clientY - rect.top) / rect.height) * 100);
    },
    [isEnabled, rawRotateX, rawRotateY, glowX, glowY]
  );

  const onMouseLeave = useCallback(() => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    glowX.set(50);
    glowY.set(50);
  }, [rawRotateX, rawRotateY, glowX, glowY]);

  return { rotateX, rotateY, glowX, glowY, onMouseMove, onMouseLeave, ref, isEnabled };
}
