import { Wordmark } from "@/components/Wordmark";
import { Hero } from "@/components/Hero";
import { SpotIndex } from "@/components/SpotIndex";
import { ProviderHeatmap } from "@/components/ProviderHeatmap";
import { ComputeOrderBook } from "@/components/ComputeOrderBook";
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
        </div>
        <section
          id="live-market"
          className="border-t border-border pt-20 pb-24 scroll-mt-16 space-y-24"
        >
          <div className="mx-auto w-full max-w-4xl">
            <SpotIndex />
          </div>
          <div className="mx-auto w-full max-w-6xl">
            <ProviderHeatmap />
          </div>
          <div className="mx-auto w-full max-w-4xl">
            <ComputeOrderBook />
          </div>
          <div className="mx-auto w-full max-w-4xl">
            <AgentScenarios />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
