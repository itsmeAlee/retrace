"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion, MotionValue } from "motion/react";
import { Placeholder } from "./ui/Placeholder";

const Word = ({ word, progress, range, isItalic }: { word: string, progress: MotionValue<number>, range: [number, number], isItalic: boolean }) => {
  const shouldReduceMotion = useReducedMotion();
  const opacity = useTransform(progress, range, [0.2, 1]);
  return (
    <motion.span 
      style={shouldReduceMotion ? {} : { opacity }}
      className={isItalic ? "italic font-normal" : ""}
    >
      {word}
    </motion.span>
  );
};

export function SolutionReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"]
  });

  const words = "A second memory for your digital journey.".split(" ");

  return (
    <section ref={containerRef} className="bg-primary text-white py-32 overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16 text-center">
        <p className="font-sans text-sm font-medium tracking-widest uppercase mb-8 text-on-primary-container">Introducing Retrace</p>
        <h2 className="text-[36px] md:text-[64px] leading-[1.1] font-bold font-serif mb-20 flex flex-wrap justify-center gap-x-3 gap-y-2">
          {words.map((word, i) => {
            const start = i / words.length;
            const end = start + (1 / words.length);
            const isItalic = i >= 4;
            return (
              <Word 
                key={i} 
                word={word} 
                progress={scrollYProgress} 
                range={[start, end]} 
                isItalic={isItalic} 
              />
            );
          })}
        </h2>
        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 shadow-2xl">
              <Placeholder label="Placeholder B (Extension overlay)" aspectRatio="aspect-[4/3]" className="bg-white/10" />
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 shadow-2xl mt-12 md:mt-0">
              <Placeholder label="Placeholder C (Dashboard Grid)" aspectRatio="aspect-[4/3]" className="bg-white/10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
