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
      <header className="h-14 px-6 border-b border-border flex items-center justify-between">
        <Wordmark />
        <nav className="font-mono text-[13px] text-muted-foreground flex gap-5">
          <a href="/api/snapshot.json" className="hover:text-foreground">
            snapshot
          </a>
          <a href="/llms.txt" className="hover:text-foreground">
            llms.txt
          </a>
          <a
            href="https://github.com/sheraz-ali1/compute-centralization"
            className="hover:text-foreground"
          >
            github
          </a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">
        <div className="mb-6">
          <h1 className="font-sans text-[28px] leading-tight tracking-tight">
            Open price feed for the GPU spot market.
          </h1>
          <p className="text-muted-foreground text-[16px] mt-1">
            For agents and the humans they work for.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpotIndex />
          <ActivityTicker />
          <DepthChart />
          <OrphanedLane />
          <div className="md:col-span-2">
            <AgentAccess />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
