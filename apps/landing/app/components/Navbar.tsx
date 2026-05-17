"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { PillButton } from "./ui/PillButton";

const signInUrl = `${process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3003"}/auth/signin`;

export function Navbar() {
  const { scrollY } = useScroll();

  const backgroundColor = useTransform(
    scrollY,
    [0, 40],
    ["rgba(255, 255, 255, 0.4)", "rgba(255, 255, 255, 0.9)"]
  );

  const backdropFilter = useTransform(
    scrollY,
    [0, 40],
    ["blur(4px)", "blur(12px)"]
  );

  const boxShadow = useTransform(
    scrollY,
    [0, 40],
    ["0 0px 0px rgba(0,0,0,0)", "0 4px 6px -1px rgba(0, 0, 0, 0.1)"]
  );

  return (
    <motion.nav
      style={{ backgroundColor, backdropFilter, boxShadow }}
      className="rounded-full mt-5 md:mt-8 max-w-[720px] mx-auto px-6 py-3 sticky top-4 z-50 border border-border/50 flex justify-between items-center w-[calc(100%-40px)]"
    >
      <div className="font-serif text-body-lg font-bold text-primary">Retrace</div>
      <div className="hidden md:flex gap-6 items-center">
        <a className="text-primary font-bold border-b-2 border-secondary font-sans text-button tracking-wide pb-0.5" href="#">Manifesto</a>
        <a className="text-text-secondary hover:text-primary transition-colors font-sans text-button tracking-wide" href="#">Features</a>
        <a className="text-text-secondary hover:text-primary transition-colors font-sans text-button tracking-wide" href="#">Journal</a>
        <a className="text-text-secondary hover:text-primary transition-colors font-sans text-button tracking-wide" href="#">Pricing</a>
      </div>
      <PillButton className="px-6 py-2 shadow-none" href={signInUrl}>
        Get Early Access
      </PillButton>
    </motion.nav>
  );
}
