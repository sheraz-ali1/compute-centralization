import { Wordmark } from "@/components/Wordmark";
import { SpotIndex } from "@/components/SpotIndex";
import { ActivityTicker } from "@/components/ActivityTicker";
import { DepthChart } from "@/components/DepthChart";
import { OrphanedLane } from "@/components/OrphanedLane";
import { AgentAccess } from "@/components/AgentAccess";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-8 h-16 flex items-center justify-between border-b border-border">
        <Wordmark />
        <nav className="font-mono text-[12px] text-muted-foreground flex gap-6">
          <a
            href="/api/snapshot.json"
            className="hover:text-foreground transition-colors"
          >
            snapshot
          </a>
          <a
            href="/llms.txt"
            className="hover:text-foreground transition-colors"
          >
            llms.txt
          </a>
          <a
            href="https://github.com/sheraz-ali1/compute-centralization"
            className="hover:text-foreground transition-colors"
          >
            github
          </a>
        </nav>
      </header>

      <main className="flex-1 px-8">
        <div className="mx-auto w-full max-w-5xl">
          <section className="pt-20 pb-16 md:pt-28 md:pb-20">
            <h1 className="font-sans text-[44px] md:text-[60px] leading-[1.05] tracking-[-0.025em] text-foreground max-w-[18ch]">
              Open price feed for the GPU spot market.
            </h1>
            <p className="mt-5 text-[18px] md:text-[20px] text-muted-foreground max-w-[40ch] leading-snug">
              Live prices, availability, and the long tail of community
              compute — for agents and the humans they work for.
            </p>
          </section>

          <div className="space-y-16 pb-20">
            <SpotIndex />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
              <DepthChart />
              <OrphanedLane />
            </div>
            <ActivityTicker />
            <AgentAccess />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
