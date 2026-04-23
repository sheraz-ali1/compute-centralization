import { Wordmark } from "@/components/Wordmark";
import { Hero } from "@/components/Hero";
import { SpotIndex } from "@/components/SpotIndex";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-8 h-16 flex items-center justify-between absolute inset-x-0 top-0 z-20">
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
        <div className="mx-auto w-full max-w-4xl">
          <Hero />
          <section
            id="live-market"
            className="border-t border-border pt-20 pb-28 scroll-mt-16"
          >
            <SpotIndex />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
