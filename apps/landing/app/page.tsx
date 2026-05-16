import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { SocialProofBar } from "./components/SocialProofBar";
import { ProblemSection } from "./components/ProblemSection";
import { SolutionReveal } from "./components/SolutionReveal";
import { HowItWorks } from "./components/HowItWorks";
import { FeatureSection } from "./components/FeatureSection";
import { Testimonials } from "./components/Testimonials";
import { ExtensionSpotlight } from "./components/ExtensionSpotlight";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";

import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Placeholder } from "./components/ui/Placeholder";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <SocialProofBar />
      <ProblemSection />
      <SolutionReveal />
      <HowItWorks />
      
      <section className="py-32 space-y-48">
        {/* Section C */}
        <FeatureSection
          title="Capture from anywhere."
          description="Our lightweight extension lives in your browser, ready to preserve your state. No more manual bookmarking or copy-pasting links into endless spreadsheets."
          contentBottom={
            <ul className="space-y-4">
              <li className="flex items-center gap-3 font-sans text-base"><CheckCircle2 className="text-secondary w-5 h-5" /> Instant Context Snapshot</li>
              <li className="flex items-center gap-3 font-sans text-base"><CheckCircle2 className="text-secondary w-5 h-5" /> One-click tagging</li>
              <li className="flex items-center gap-3 font-sans text-base"><CheckCircle2 className="text-secondary w-5 h-5" /> Auto-summarization</li>
            </ul>
          }
        >
          <div className="bg-white rounded-2xl border border-border p-2 shadow-2xl">
            <Placeholder label="Placeholder D (Extension UI Details)" aspectRatio="aspect-[4/3]" />
          </div>
        </FeatureSection>

        {/* Section D */}
        <FeatureSection
          reverse
          title="Your Sessions, Organized."
          description="The Web App gives you a bird's-eye view of your intellectual history. View, search, and revisit any research session you've ever captured."
          contentBottom={
            <div className="border-l-4 border-secondary pl-6 py-2 mt-8">
              <p className="font-serif text-xl italic text-primary">"It transformed the way I handle project handovers. The context is just there."</p>
            </div>
          }
        >
          <div className="bg-white rounded-2xl border border-border p-2 shadow-2xl">
            <Placeholder label="Placeholder E (Web App Sessions)" aspectRatio="aspect-[4/3]" />
          </div>
        </FeatureSection>

        {/* Section E */}
        <FeatureSection
          heroBadge="HERO FEATURE"
          title="AI-Powered Resume."
          description={
            <>
              Retrace doesn't just open links—it reminds you <i>why</i> you opened them. Our AI synthesizes your notes and the content of the tabs to give you a "Head-start Brief" every time you return.
            </>
          }
          contentBottom={
            <button className="flex items-center gap-2 text-primary font-bold font-sans text-sm tracking-wide group mt-8">
              Learn about AI Resume 
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          }
        >
          <div className="absolute inset-0 bg-secondary/20 blur-[100px] rounded-full"></div>
          <div className="bg-white rounded-2xl border border-secondary/30 p-8 shadow-2xl relative z-10">
            <div className="flex items-start gap-4 mb-6">
              <Sparkles className="text-secondary w-8 h-8" />
              <div>
                <h4 className="font-serif text-xl font-semibold text-primary mb-1">Session: Market Analysis</h4>
                <p className="font-sans text-xs font-bold text-text-secondary tracking-wider">Last active: 3 days ago</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-px bg-border w-full"></div>
              <p className="font-sans text-base text-primary italic">"You were comparing SaaS pricing models for enterprise tiers. You specifically noted the shift toward consumption-based billing..."</p>
              <div className="flex gap-2">
                <span className="bg-surface-container-low px-3 py-1 rounded-full text-[12px] font-bold font-sans text-text-primary">Research</span>
                <span className="bg-surface-container-low px-3 py-1 rounded-full text-[12px] font-bold font-sans text-text-primary">Q4 Goals</span>
              </div>
            </div>
          </div>
        </FeatureSection>
      </section>

      <Testimonials />
      <ExtensionSpotlight />
      <FinalCTA />
      <Footer />
    </main>
  );
}
