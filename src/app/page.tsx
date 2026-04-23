import { Wordmark } from "@/components/Wordmark";
import { Hero } from "@/components/Hero";
import { SpotIndex } from "@/components/SpotIndex";
import { AgentScenarios } from "@/components/AgentScenarios";
import { Footer } from "@/components/Footer";
import { AudienceToggle } from "@/components/AudienceToggle";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-8 h-16 flex items-center justify-between absolute inset-x-0 top-0 z-20">
        <Wordmark />
        <AudienceToggle />
      </header>

      <main className="flex-1 px-8">
        <div className="mx-auto w-full max-w-4xl">
          <Hero />
          <section
            id="live-market"
            className="border-t border-border pt-20 pb-24 scroll-mt-16 space-y-24"
          >
            <SpotIndex />
            <AgentScenarios />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
