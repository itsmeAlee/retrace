import { AnimatedCard, CardTitle, CardDescription } from "./ui/AnimatedCard";
import { AppWindow, StickyNote, Link2Off } from "lucide-react";

export function ProblemSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-5 md:px-16 py-32 text-center">
      <h2 className="text-heading font-semibold font-serif text-primary mb-16">
        Your work lives in 40 tabs.<br/>
        <span className="text-secondary">Your context lives nowhere.</span>
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        <AnimatedCard delay={0} className="p-10 text-left">
          <AppWindow className="w-10 h-10 text-primary mb-6" strokeWidth={1.5} />
          <CardTitle>Scattered Tabs</CardTitle>
          <CardDescription>Browser tabs aren't a filing system. They're a cognitive drain that fragments your focus.</CardDescription>
        </AnimatedCard>
        <AnimatedCard delay={0.1} className="p-10 text-left">
          <StickyNote className="w-10 h-10 text-primary mb-6" strokeWidth={1.5} />
          <CardTitle>Ghost Notes</CardTitle>
          <CardDescription>Post-its and random notes lack the original source. Knowledge is lost without its environment.</CardDescription>
        </AnimatedCard>
        <AnimatedCard delay={0.2} className="p-10 text-left">
          <Link2Off className="w-10 h-10 text-primary mb-6" strokeWidth={1.5} />
          <CardTitle>Broken Links</CardTitle>
          <CardDescription>Returning to a project means 20 minutes of hunting through history just to find where you were.</CardDescription>
        </AnimatedCard>
      </div>
    </section>
  );
}
