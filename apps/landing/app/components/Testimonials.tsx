import { AnimatedCard, CardTitle, CardDescription } from "./ui/AnimatedCard";

export function Testimonials() {
  return (
    <section className="bg-surface-container-low py-32">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16">
        <h2 className="text-heading font-semibold font-serif text-primary text-center mb-16">Loved by scholars and builders.</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <AnimatedCard delay={0} className="p-8 text-left bg-white">
            <p className="font-sans text-base leading-[1.65] font-normal text-text-secondary mb-8 italic">"Retrace is the first tool that actually respects the complexity of my research workflow. It's invisible when I work and indispensable when I return."</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-dim/50 border border-border flex items-center justify-center">
                <span className="font-serif text-primary font-bold">SC</span>
              </div>
              <div>
                <h4 className="font-sans text-base text-primary font-bold tracking-wide">Sarah Chen</h4>
                <p className="font-sans text-base text-text-secondary font-bold tracking-wider">PhD Researcher, Stanford</p>
              </div>
            </div>
          </AnimatedCard>
          <AnimatedCard delay={0.1} className="p-8 text-left bg-white">
            <p className="font-sans text-base leading-[1.65] font-normal text-text-secondary mb-8 italic">"Finally, a way to handle my 50-tab habit. It has significantly reduced my 'startup cost' for deep work sessions."</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-dim/50 border border-border flex items-center justify-center">
                <span className="font-serif text-primary font-bold">MT</span>
              </div>
              <div>
                <h4 className="font-sans text-base text-primary font-bold tracking-wide">Marcus Thorne</h4>
                <p className="font-sans text-base text-text-secondary font-bold tracking-wider">Lead Engineer, Velo</p>
              </div>
            </div>
          </AnimatedCard>
          <AnimatedCard delay={0.2} className="p-8 text-left bg-white">
            <p className="font-sans text-base leading-[1.65] font-normal text-text-secondary mb-8 italic">"The AI Resume feature feels like having a personal assistant who has read every tab I ever opened. It's pure magic."</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-surface-dim/50 border border-border flex items-center justify-center">
                <span className="font-serif text-primary font-bold">DO</span>
              </div>
              <div>
                <h4 className="font-sans text-base text-primary font-bold tracking-wide">David Okoro</h4>
                <p className="font-sans text-base text-text-secondary font-bold tracking-wider">Design Strategist</p>
              </div>
            </div>
          </AnimatedCard>
        </div>
      </div>
    </section>
  );
}
