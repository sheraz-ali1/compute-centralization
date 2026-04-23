"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";

const ENTERPRISE_TIERS = new Set(["secure", "verified", "standard"]);
const ORPHAN_TIERS = new Set(["community", "unverified"]);
const HERO_GPUS = ["H100 SXM", "A100 80GB", "RTX 4090", "L40S", "H100 PCIe"];

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
    const savings = (1 - orphanAvg / entMedian) * 100;
    return { model, orphanCount, orphanAvg, entMedian, savings };
  }).filter(Boolean) as {
    model: string;
    orphanCount: number;
    orphanAvg: number;
    entMedian: number;
    savings: number;
  }[];

  return (
    <Section label="Orphaned lane">
      <p className="text-[14px] text-muted-foreground max-w-[44ch]">
        Community listings ≥ 40% below the enterprise-tier median. The
        compute that doesn&apos;t show up on a sales rep&apos;s pricing sheet.
      </p>
      <div className="divide-y divide-border">
        {items.length === 0 && (
          <div className="text-muted-foreground py-3 text-[14px]">
            no orphans detected
          </div>
        )}
        {items.map((i) => (
          <div
            key={i.model}
            className="grid grid-cols-12 items-baseline py-3.5 gap-2"
          >
            <div className="col-span-1 font-mono tabular text-[20px] text-down">
              {i.orphanCount.toLocaleString()}
            </div>
            <div className="col-span-4 font-sans text-[14px] text-foreground/85">
              {i.model}
            </div>
            <div className="col-span-3 font-mono tabular text-[13px] text-foreground/85">
              ${i.orphanAvg.toFixed(2)}
              <span className="text-muted-foreground text-[11px]"> /h</span>
            </div>
            <div className="col-span-2 font-mono tabular text-[12px] text-muted-foreground">
              vs ${i.entMedian.toFixed(2)}
            </div>
            <div className="col-span-2 font-mono tabular text-[12px] text-down text-right">
              −{i.savings.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
