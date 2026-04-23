"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";

const ENTERPRISE_TIERS = new Set(["secure", "verified", "standard"]);
const ORPHAN_TIERS = new Set(["community", "unverified"]);
const HERO_GPUS = ["H100 SXM", "A100 80GB", "RTX 4090", "L40S"];

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function OrphanedLane() {
  const { rows } = useSnapshot();
  const items = HERO_GPUS.map((model) => {
    const enterprise = rows.filter(
      (r) =>
        r.gpu_model === model && ENTERPRISE_TIERS.has(r.tier) && r.available,
    );
    const orphan = rows.filter(
      (r) => r.gpu_model === model && ORPHAN_TIERS.has(r.tier) && r.available,
    );
    if (enterprise.length === 0 || orphan.length === 0) return null;
    const entMedian = median(enterprise.map((r) => r.price_per_gpu_hour_usd));
    const orphanCheap = orphan.reduce(
      (m, r) => Math.min(m, r.price_per_gpu_hour_usd),
      Infinity,
    );
    if (orphanCheap > entMedian * 0.6) return null;
    const orphanCount = orphan.reduce((s, r) => s + r.offer_count, 0);
    const orphanAvg =
      orphan.reduce((s, r) => s + r.price_per_gpu_hour_usd, 0) / orphan.length;
    return { model, orphanCount, orphanAvg, entMedian };
  }).filter(Boolean) as {
    model: string;
    orphanCount: number;
    orphanAvg: number;
    entMedian: number;
  }[];

  return (
    <Section label="ORPHANED LANE">
      <p className="text-[12px] text-muted-foreground mb-3">
        Listings ≥ 40% below the enterprise-tier median for the same GPU.
      </p>
      <ul className="font-mono text-[13px] space-y-1.5">
        {items.length === 0 && (
          <li className="text-muted-foreground">no orphans detected</li>
        )}
        {items.map((i) => (
          <li key={i.model} className="flex gap-3 text-foreground/80">
            <span className="w-12 text-down">{i.orphanCount}</span>
            <span className="w-24">{i.model}</span>
            <span>at avg ${i.orphanAvg.toFixed(2)}</span>
            <span className="text-muted-foreground">
              vs. enterprise ${i.entMedian.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
