"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { useState } from "react";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "B200",
  "A100 80GB",
  "L40S",
  "RTX 4090",
];
// Enterprise = managed-cloud tariffs only (RunPod Secure, Vultr Standard).
// Marketplace tiers (Vast verified/unverified, RunPod community) are
// "long-tail" supply.
const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const COMMUNITY_TIERS = new Set(["community", "verified", "unverified"]);

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

export function Hero() {
  const { rows, fetchedAt } = useSnapshot();
  const [copied, setCopied] = useState(false);

  // Headline insight: find the GPU with the largest enterprise→community savings
  let bestSavings: { model: string; savingsPct: number; cheapest: number; enterprise: number } | null = null;
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

  const totalListings = rows.filter((r) => r.available).reduce(
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
    <section className="pt-20 md:pt-28 pb-12 md:pb-16">
      <h1 className="font-sans text-[44px] md:text-[60px] leading-[1.05] tracking-[-0.025em] text-foreground max-w-[18ch]">
        Open price feed for the GPU spot market.
      </h1>
      <p className="mt-5 text-[18px] md:text-[20px] text-muted-foreground max-w-[44ch] leading-snug">
        Live prices, availability, and the long tail of community compute —
        for agents and the humans they work for.
      </p>

      {/* Dynamic insight */}
      {bestSavings && (
        <div className="mt-8 inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 font-sans text-[15px] md:text-[16px] text-foreground">
          <span className="text-muted-foreground">Right now:</span>
          <span>
            save <span className="text-down font-medium">{bestSavings.savingsPct.toFixed(0)}%</span> on a
          </span>
          <span className="text-foreground">{bestSavings.model}</span>
          <span className="text-muted-foreground">
            (${bestSavings.cheapest.toFixed(2)} community vs ${bestSavings.enterprise.toFixed(2)} enterprise)
          </span>
        </div>
      )}

      {/* Agent access — primary CTA */}
      <div className="mt-10 max-w-[640px]">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono mb-2">
          Connect an agent
        </div>
        <div className="relative font-mono text-[13px] bg-muted/40 border border-border rounded-md px-4 py-3.5 group">
          <span className="text-muted-foreground select-none">$ </span>
          <span className="text-foreground select-all">{SNIPPET}</span>
          <button
            onClick={onCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded font-mono bg-background/60 border border-border"
            aria-label="copy"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground font-mono">
          <span>
            <span className="text-foreground/85">list_gpus</span>(filters)
          </span>
          <span>
            <span className="text-foreground/85">find_cheapest</span>(model,
            count, max_price)
          </span>
          <span>·</span>
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

      {/* Live status strip */}
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground font-mono">
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
          <span className="text-foreground/85">{providers}</span> providers
        </span>
        <span>
          <span className="text-foreground/85">
            {rows.filter((r) => r.available).length}
          </span>{" "}
          tracked SKUs
        </span>
      </div>
    </section>
  );
}
