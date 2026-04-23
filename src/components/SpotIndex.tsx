"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";
import { useEffect, useState } from "react";
import type { GpuRow } from "@/lib/schema";
import { Tooltip } from "@/components/ui/tooltip";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "B200",
  "A100 80GB",
  "L40S",
  "RTX 4090",
];

// Marketplace providers report per-host offer_count. Managed clouds always
// report 1 (it's a tariff, not an offer). Counting them together would
// misrepresent supply.
const MARKETPLACE_PROVIDERS = new Set(["vast"]);

function tierLabel(tier: string) {
  const map: Record<string, string> = {
    secure: "Secure",
    community: "Community",
    verified: "Verified",
    unverified: "Unverified",
    standard: "Standard",
  };
  return map[tier] ?? tier;
}

function providerLabel(provider: string) {
  const map: Record<string, string> = {
    runpod: "RunPod",
    vast: "Vast.ai",
    vultr: "Vultr",
  };
  return map[provider] ?? provider;
}

function cheapestRow(rows: GpuRow[]): GpuRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((a, b) =>
    a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
  );
}

export function SpotIndex() {
  const { rows } = useSnapshot();
  const [deltas, setDeltas] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/index-deltas")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDeltas(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = HERO_GPUS.map((model) => {
    const matching = rows.filter(
      (r) => r.gpu_model === model && r.available,
    );
    const cheapest = cheapestRow(matching);
    const marketplaceOffers = matching
      .filter((r) => MARKETPLACE_PROVIDERS.has(r.provider))
      .reduce((s, r) => s + r.offer_count, 0);
    const providers = new Set(matching.map((r) => r.provider));
    const delta = deltas[model] ?? null;
    return {
      model,
      cheapest,
      marketplaceOffers,
      providerCount: providers.size,
      delta,
      allRows: matching,
    };
  });

  return (
    <Section label="Spot index">
      <div className="divide-y divide-border">
        {summary.map((s) => (
          <div
            key={s.model}
            className="grid grid-cols-12 items-center py-4 gap-3"
          >
            <div className="col-span-3 font-sans text-[15px] text-foreground">
              {s.model}
            </div>
            <div className="col-span-3 font-mono tabular text-[22px] text-foreground leading-none">
              {s.cheapest ? (
                <Tooltip
                  content={
                    <div className="space-y-1 text-[12px] font-mono">
                      <div className="text-muted-foreground mb-1">
                        cheapest across providers
                      </div>
                      {[...s.allRows]
                        .sort(
                          (a, b) =>
                            a.price_per_gpu_hour_usd -
                            b.price_per_gpu_hour_usd,
                        )
                        .slice(0, 6)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex justify-between gap-4"
                          >
                            <span>
                              {providerLabel(r.provider)}{" "}
                              <span className="text-muted-foreground">
                                {tierLabel(r.tier)} ×{r.gpu_count}
                              </span>
                            </span>
                            <span>${r.price_per_gpu_hour_usd.toFixed(2)}</span>
                          </div>
                        ))}
                    </div>
                  }
                >
                  <span className="cursor-help">
                    <span className="text-muted-foreground text-[14px] mr-0.5">
                      $
                    </span>
                    {s.cheapest.price_per_gpu_hour_usd.toFixed(2)}
                    <span className="text-muted-foreground text-[12px] ml-1">
                      /h
                    </span>
                  </span>
                </Tooltip>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div
              className={
                "col-span-2 font-mono tabular text-[13px] " +
                (s.delta !== null && s.delta < 0
                  ? "text-down"
                  : s.delta !== null && s.delta > 0
                    ? "text-up"
                    : "text-muted-foreground")
              }
            >
              {s.delta !== null
                ? `${s.delta > 0 ? "+" : ""}${s.delta.toFixed(1)}%`
                : "—"}
            </div>
            <div className="col-span-4 text-right text-[13px] text-muted-foreground font-mono">
              {s.cheapest ? (
                <>
                  <span className="text-foreground/85">
                    {providerLabel(s.cheapest.provider)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {tierLabel(s.cheapest.tier)}
                  </span>
                  {s.marketplaceOffers > 0 && (
                    <>
                      <span className="text-muted-foreground/60 mx-1.5">·</span>
                      <span>
                        {s.marketplaceOffers} {s.marketplaceOffers === 1 ? "offer" : "offers"} on Vast
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">no data</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70 font-mono pt-2">
        Cheapest = lowest single-GPU $/hr across {summary.reduce((s, x) => Math.max(s, x.providerCount), 0)} providers ·
        Hover a price to see the source ladder · 24h Δ requires ≥24h of history
      </p>
    </Section>
  );
}
