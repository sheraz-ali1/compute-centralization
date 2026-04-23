"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { useState } from "react";
import UnicornScene from "unicornstudio-react/next";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "B200",
  "A100 80GB",
  "L40S",
  "RTX 4090",
];
// Enterprise = managed-cloud tariffs only (RunPod Secure, Vultr Standard).
// Marketplace = peer-listed supply (Vast verified/unverified, RunPod Community).
const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const COMMUNITY_TIERS = new Set(["community", "verified", "unverified"]);

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

export function Hero() {
  const { rows, fetchedAt } = useSnapshot();
  const [copied, setCopied] = useState(false);

  let bestSavings: {
    model: string;
    savingsPct: number;
    cheapest: number;
    enterprise: number;
  } | null = null;
  for (const model of HERO_GPUS) {
    const matching = rows.filter((r) => r.gpu_model === model && r.available);
    const enterprise = matching.filter((r) => ENTERPRISE_TIERS.has(r.tier));
    const community = matching.filter((r) => COMMUNITY_TIERS.has(r.tier));
    if (enterprise.length === 0 || community.length === 0) continue;
    const cheapestC = Math.min(
      ...community.map((r) => r.price_per_gpu_hour_usd),
    );
    const cheapestE = Math.min(
      ...enterprise.map((r) => r.price_per_gpu_hour_usd),
    );
    if (cheapestE <= 0) continue;
    const savings = (1 - cheapestC / cheapestE) * 100;
    if (!bestSavings || savings > bestSavings.savingsPct) {
      bestSavings = {
        model,
        savingsPct: savings,
        cheapest: cheapestC,
        enterprise: cheapestE,
      };
    }
  }

  const totalListings = rows
    .filter((r) => r.available)
    .reduce(
      (s, r) => s + (COMMUNITY_TIERS.has(r.tier) ? r.offer_count : 1),
      0,
    );
  const providers = new Set(rows.map((r) => r.provider)).size;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="relative -mx-8 min-h-[78vh] md:min-h-[88vh] flex items-center overflow-hidden">
      {/* WebGL background — lazyLoad off so it loads above the fold */}
      <div className="absolute inset-0 z-0 bg-background">
        <UnicornScene
          projectId="GdecGeosI8jL1JDvzHgU"
          sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.9/dist/unicornStudio.umd.js"
          width="100%"
          height="100%"
          lazyLoad={false}
          production={false}
        />
      </div>

      {/* Left-side legibility gradient */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklab, var(--background) 88%, transparent) 0%, color-mix(in oklab, var(--background) 70%, transparent) 30%, transparent 60%)",
        }}
      />
      {/* Bottom fade-out into the data section */}
      <div
        className="absolute inset-x-0 bottom-0 h-32 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, var(--background) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-8 w-full">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-[640px]">
            <h1 className="font-sans text-[44px] md:text-[64px] leading-[1.04] tracking-[-0.025em] text-foreground">
              Open price feed for the GPU spot market.
            </h1>
            <p className="mt-5 text-[18px] md:text-[20px] text-foreground/70 max-w-[44ch] leading-snug">
              Live prices and availability across cloud and marketplace
              providers — for agents and the humans they work for.
            </p>

            {/* Dynamic insight */}
            {bestSavings && (
              <div className="mt-7 inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 font-sans text-[15px] md:text-[16px] text-foreground/90">
                <span className="text-foreground/50">Right now:</span>
                <span>
                  <span className="text-foreground">{bestSavings.model}</span>{" "}
                  on the marketplace is{" "}
                  <span className="text-down font-medium">
                    {bestSavings.savingsPct.toFixed(0)}% cheaper
                  </span>{" "}
                  than the managed-cloud price
                </span>
                <span className="text-foreground/50">
                  (${bestSavings.cheapest.toFixed(2)} vs $
                  {bestSavings.enterprise.toFixed(2)}/hr)
                </span>
              </div>
            )}

            {/* Agent access */}
            <div className="mt-9">
              <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/50 font-mono mb-2">
                Connect an agent
              </div>
              <div className="relative font-mono text-[13px] bg-background/65 backdrop-blur-sm border border-border rounded-md px-4 py-3.5">
                <span className="text-foreground/50 select-none">$ </span>
                <span className="text-foreground select-all">{SNIPPET}</span>
                <button
                  onClick={onCopy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-foreground/60 hover:text-foreground transition-colors px-2.5 py-1 rounded font-mono bg-background/80 border border-border"
                  aria-label="copy"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-foreground/55 font-mono">
                <span>
                  <span className="text-foreground/85">list_gpus</span>(filters)
                </span>
                <span>
                  <span className="text-foreground/85">find_cheapest</span>
                  (model, count, max_price)
                </span>
                <span className="text-foreground/30">·</span>
                <a
                  href="/api/snapshot.json"
                  className="hover:text-foreground transition-colors"
                >
                  /api/snapshot.json
                </a>
                <a
                  href="/llms.txt"
                  className="hover:text-foreground transition-colors"
                >
                  /llms.txt
                </a>
              </div>
            </div>

            {/* Live status */}
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-foreground/55 font-mono">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-down animate-pulse" />
                {fetchedAt ? "live" : "connecting…"}
              </span>
              <span>
                <span className="text-foreground/85">
                  {totalListings.toLocaleString()}
                </span>{" "}
                listings
              </span>
              <span>
                <span className="text-foreground/85">{providers}</span>{" "}
                providers
              </span>
              <span>
                <span className="text-foreground/85">
                  {rows.filter((r) => r.available).length}
                </span>{" "}
                tracked SKUs
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
