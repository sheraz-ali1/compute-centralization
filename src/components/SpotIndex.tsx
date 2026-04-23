"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { useEffect, useState } from "react";
import type { GpuRow } from "@/lib/schema";
import { Tooltip } from "@/components/ui/tooltip";
import { providerLabel, tierLabel } from "@/lib/provider-labels";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "B200",
  "A100 80GB",
  "L40S",
  "RTX 4090",
];

// Enterprise = managed-cloud tariffs (RunPod Secure, Vultr/Lambda/AWS standard).
// Marketplace = peer-listed supply (Vast verified/unverified, RunPod Community).
const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const COMMUNITY_TIERS = new Set(["community", "verified", "unverified"]);

function median(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

type RowSummary = {
  model: string;
  cheapest: GpuRow | null;
  enterprise: GpuRow | null;
  median: number | null;
  savings: number | null;
  marketplaceOffers: number;
  delta: number | null;
  allRows: GpuRow[];
};

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

  const summary: RowSummary[] = HERO_GPUS.map((model) => {
    const matching = rows.filter(
      (r) => r.gpu_model === model && r.available,
    );
    // The Spreads tab compares MARKETPLACE vs MANAGED. Cheapest is the
    // best marketplace offer, not just the global minimum (which would
    // sometimes be a managed-cloud row and collapse the spread).
    const marketplaceRows = matching.filter((r) =>
      COMMUNITY_TIERS.has(r.tier),
    );
    const cheapest =
      marketplaceRows.length === 0
        ? matching.length === 0
          ? null
          : matching.reduce((a, b) =>
              a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
            )
        : marketplaceRows.reduce((a, b) =>
            a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
          );
    const enterpriseRows = matching.filter((r) =>
      ENTERPRISE_TIERS.has(r.tier),
    );
    const enterprise =
      enterpriseRows.length === 0
        ? null
        : enterpriseRows.reduce((a, b) =>
            a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
          );
    const med = median(matching.map((r) => r.price_per_gpu_hour_usd));
    const cheapestPrice = cheapest?.price_per_gpu_hour_usd ?? null;
    const enterprisePrice = enterprise?.price_per_gpu_hour_usd ?? null;
    const savings =
      cheapestPrice !== null && enterprisePrice !== null && enterprisePrice > 0
        ? (1 - cheapestPrice / enterprisePrice) * 100
        : null;
    const marketplaceOffers = matching
      .filter((r) => COMMUNITY_TIERS.has(r.tier))
      .reduce((s, r) => s + r.offer_count, 0);

    return {
      model,
      cheapest,
      enterprise,
      median: med,
      savings,
      marketplaceOffers,
      delta: deltas[model] ?? null,
      allRows: matching,
    };
  });

  return (
    <div>
      <div className="divide-y divide-border/70">
        {summary.map((s) => (
          <PriceRow key={s.model} s={s} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70 font-mono pt-5 leading-relaxed">
        Range = cheapest available offer → cheapest managed-cloud (RunPod Secure,
        Vultr, Lambda, AWS, etc.) for the same GPU. Hover the median dot for
        the full price ladder across all providers.
      </p>
    </div>
  );
}

function PriceRow({ s }: { s: RowSummary }) {
  const hasSpread = s.cheapest && s.enterprise && s.savings !== null;
  return (
    <div className="grid grid-cols-12 items-center py-6 gap-x-5 gap-y-2">
      {/* Model + supply */}
      <div className="col-span-3">
        <div className="font-sans text-[16px] text-foreground tracking-[-0.01em]">
          {s.model}
        </div>
        <div className="text-[11px] font-mono text-muted-foreground mt-1">
          {s.allRows.length === 0
            ? "no listings"
            : `${s.allRows.length} listings · ${new Set(s.allRows.map((r) => r.provider)).size} providers`}
        </div>
      </div>

      {/* Spread */}
      <div className="col-span-6">
        {hasSpread ? (
          <SpreadBar
            cheapest={s.cheapest!.price_per_gpu_hour_usd}
            median={s.median ?? s.cheapest!.price_per_gpu_hour_usd}
            enterprise={s.enterprise!.price_per_gpu_hour_usd}
            cheapestProvider={providerLabel(s.cheapest!.provider)}
            cheapestTier={tierLabel(s.cheapest!.tier)}
            enterpriseProvider={providerLabel(s.enterprise!.provider)}
            allRows={s.allRows}
          />
        ) : s.cheapest ? (
          <div className="font-mono tabular text-[15px] text-foreground">
            ${s.cheapest.price_per_gpu_hour_usd.toFixed(2)}
            <span className="text-muted-foreground text-[11px] ml-2">
              {providerLabel(s.cheapest.provider)} · single source
            </span>
          </div>
        ) : (
          <div className="text-muted-foreground text-[14px]">no data</div>
        )}
      </div>

      {/* Save */}
      <div className="col-span-2 text-right">
        <div
          className={
            "tabular text-[20px] leading-none h-[20px] flex items-baseline justify-end " +
            (s.savings === null
              ? "text-muted-foreground/40"
              : s.savings >= 1
                ? "text-down"
                : s.savings <= -1
                  ? "text-up"
                  : "text-muted-foreground")
          }
        >
          {s.savings === null
            ? ""
            : Math.abs(s.savings) < 1
              ? "0%"
              : `${s.savings > 0 ? "−" : "+"}${Math.abs(s.savings).toFixed(0)}%`}
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-2">
          vs managed
        </div>
      </div>

      {/* 24h delta */}
      <div className="col-span-1 text-right">
        <div
          className={
            "tabular text-[20px] leading-none h-[20px] flex items-baseline justify-end " +
            (s.delta === null
              ? "text-muted-foreground/40"
              : s.delta < 0
                ? "text-down"
                : s.delta > 0
                  ? "text-up"
                  : "text-muted-foreground")
          }
        >
          {s.delta === null
            ? ""
            : `${s.delta > 0 ? "+" : ""}${s.delta.toFixed(1)}%`}
        </div>
        <div className="text-[11px] text-muted-foreground/70 mt-2">24h</div>
      </div>
    </div>
  );
}

function SpreadBar({
  cheapest,
  median,
  enterprise,
  cheapestProvider,
  cheapestTier,
  enterpriseProvider,
  allRows,
}: {
  cheapest: number;
  median: number;
  enterprise: number;
  cheapestProvider: string;
  cheapestTier: string;
  enterpriseProvider: string;
  allRows: GpuRow[];
}) {
  const range = Math.max(enterprise - cheapest, 0.001);
  const medianPct = ((median - cheapest) / range) * 100;
  return (
    <div className="space-y-2">
      <Tooltip
        content={
          <div className="text-[11.5px] space-y-1 max-w-[300px]">
            <div className="text-muted-foreground mb-1">Price ladder</div>
            {[...allRows]
              .sort(
                (a, b) =>
                  a.price_per_gpu_hour_usd - b.price_per_gpu_hour_usd,
              )
              .slice(0, 10)
              .map((r) => (
                <div key={r.id} className="flex justify-between gap-4">
                  <span className="truncate">
                    {providerLabel(r.provider)}{" "}
                    <span className="text-muted-foreground">
                      {tierLabel(r.tier)} ×{r.gpu_count}
                    </span>
                  </span>
                  <span className="tabular">
                    ${r.price_per_gpu_hour_usd.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        }
      >
        <div className="relative h-[3px] cursor-help">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-foreground/8" />
          {/* Cheapest segment in brand color */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-down/35"
            style={{ width: `${Math.min(100, medianPct).toFixed(2)}%` }}
          />
        </div>
      </Tooltip>
      <div className="flex justify-between font-mono tabular text-[12px]">
        <div>
          <div className="text-foreground">${cheapest.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[160px]">
            {cheapestProvider} · {cheapestTier}
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">${enterprise.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[160px]">
            {enterpriseProvider} managed
          </div>
        </div>
      </div>
    </div>
  );
}
