import { Wordmark } from "@/components/Wordmark";
import { Hero } from "@/components/Hero";
import { MarketView } from "@/components/MarketView";
import { Footer } from "@/components/Footer";
import { AudienceToggle } from "@/components/AudienceToggle";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-8 h-16 flex items-center justify-between absolute inset-x-0 top-0 z-20">
        <Wordmark />
        <AudienceToggle />
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-8">
          <Hero />
        </div>
        <MarketView />
      </main>

      <Footer />
    </div>
  );
}
