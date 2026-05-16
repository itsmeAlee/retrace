import { AnimatedCard, CardTitle, CardDescription } from "./ui/AnimatedCard";

export function HowItWorks() {
  return (
    <section className="max-w-[1200px] mx-auto px-5 md:px-16 py-32">
      <h2 className="text-3xl md:text-4xl font-semibold font-serif text-primary text-center mb-20">Three steps. Zero friction.</h2>
      <div className="grid md:grid-cols-3 gap-12 relative">
        <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-border -z-10"></div>
        <AnimatedCard delay={0} className="p-12 relative text-left">
          <span className="absolute -top-10 -left-4 text-[120px] font-bold font-serif text-secondary/10 pointer-events-none">1</span>
          <CardTitle>Capture</CardTitle>
          <CardDescription>Click one button. Retrace snapshots every open tab, note, and thought in your current context.</CardDescription>
        </AnimatedCard>
        <AnimatedCard delay={0.15} className="p-12 relative text-left">
          <span className="absolute -top-10 -left-4 text-[120px] font-bold font-serif text-secondary/10 pointer-events-none">2</span>
          <CardTitle>Collect</CardTitle>
          <CardDescription>Organize snapshots into Journals. Add editorial notes and tags to build your personal library.</CardDescription>
        </AnimatedCard>
        <AnimatedCard delay={0.3} className="p-12 relative text-left">
          <span className="absolute -top-10 -left-4 text-[120px] font-bold font-serif text-secondary/10 pointer-events-none">3</span>
          <CardTitle>Resume</CardTitle>
          <CardDescription>One click restores your entire environment. Every tab, exactly where you left it. Ready for deep work.</CardDescription>
        </AnimatedCard>
      </div>
    </section>
  );
}
