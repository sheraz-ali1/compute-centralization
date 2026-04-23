"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { providerLabel, tierLabel } from "@/lib/provider-labels";
import type { GpuRow } from "@/lib/schema";
import { useMemo } from "react";

type Scenario = {
  id: string;
  workload: string;
  spec: string;
  /** One-line plain-English rationale for the spec — why this much compute */
  rationale: string;
  /** Which tier we'd recommend for this workload */
  recommended: "cheapest" | "vetted" | "managed";
  gpu_model: string;
  gpu_count: number;
  hours: number;
};

// All specs verified against published model-training and inference
// references. Pretraining (50K+ GPU-hours for 7B) is intentionally not
// represented because it would dwarf every other scenario and isn't
// reachable on these providers anyway.
const SCENARIOS: Scenario[] = [
  {
    id: "lora-7b",
    workload: "LoRA fine-tune of a 7B model",
    spec: "1× H100 SXM × 8 hours",
    rationale:
      "Parameter-efficient training on a single GPU. Typical for a single experiment over 50–200k examples.",
    recommended: "cheapest",
    gpu_model: "H100 SXM",
    gpu_count: 1,
    hours: 8,
  },
  {
    id: "full-sft-7b",
    workload: "Full-parameter SFT on a 7B model",
    spec: "8× H100 SXM × 24 hours",
    rationale:
      "All weights updated, ~3 epochs over a 100k–1M-example dataset. Distributed across 8 GPUs at large effective batch size.",
    recommended: "vetted",
    gpu_model: "H100 SXM",
    gpu_count: 8,
    hours: 24,
  },
  {
    id: "inference-70b",
    workload: "Always-on inference for a 70B model",
    spec: "4× A100 80GB × 730h (one month)",
    rationale:
      "320 GB total VRAM hosts a 70B model in fp8 or 4-bit quantization with room for KV cache. Always-on means production traffic 24/7.",
    recommended: "managed",
    gpu_model: "A100 80GB",
    gpu_count: 4,
    hours: 730,
  },
  {
    id: "eval-b200",
    workload: "Evaluation suite on B200",
    spec: "1× B200 × 4 hours",
    rationale:
      "Full eval pass — MMLU, GSM8K, HumanEval, BBH — on the latest hardware. Single GPU, runs once per checkpoint.",
    recommended: "cheapest",
    gpu_model: "B200",
    gpu_count: 1,
    hours: 4,
  },
];

const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const VERIFIED_TIERS = new Set(["verified"]);
const COMMUNITY_TIERS = new Set(["community", "unverified"]);

type Pick = { row: GpuRow; total: number; perGpuHour: number };

function cheapestIn(
  rows: GpuRow[],
  predicate: (r: GpuRow) => boolean,
): GpuRow | null {
  const filtered = rows.filter(predicate);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) =>
    a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
  );
}

function fmtUSD(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  if (n >= 100) return `$${Math.round(n)}`;
  return `$${n.toFixed(2)}`;
}

export function AgentScenarios() {
  const { rows } = useSnapshot();

  const computed = useMemo(() => {
    return SCENARIOS.map((s) => {
      const matching = rows.filter(
        (r) =>
          r.gpu_model === s.gpu_model &&
          r.available &&
          r.gpu_count >= s.gpu_count,
      );
      const totalGpuHours = s.gpu_count * s.hours;
      const toPick = (row: GpuRow | null): Pick | null =>
        row
          ? {
              row,
              perGpuHour: row.price_per_gpu_hour_usd,
              total: row.price_per_gpu_hour_usd * totalGpuHours,
            }
          : null;
      const cheapest = toPick(cheapestIn(matching, () => true));
      const vetted = toPick(
        cheapestIn(matching, (r) => VERIFIED_TIERS.has(r.tier)),
      );
      const managed = toPick(
        cheapestIn(matching, (r) => ENTERPRISE_TIERS.has(r.tier)),
      );
      const community = toPick(
        cheapestIn(matching, (r) => COMMUNITY_TIERS.has(r.tier)),
      );
      const savings =
        cheapest && managed && managed.total > 0
          ? (1 - cheapest.total / managed.total) * 100
          : null;
      return {
        scenario: s,
        totalGpuHours,
        listings: matching.length,
        cheapest,
        vetted,
        managed,
        community,
        savings,
      };
    });
  }, [rows]);

  return (
    <section>
      <header className="mb-10">
        <h2 className="font-sans text-[24px] tracking-[-0.018em] text-foreground">
          What a workload costs, today.
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground max-w-[60ch] leading-snug">
          Concrete model-training and inference workloads, sized
          realistically, priced from current listings across the providers
          we track.
        </p>
      </header>

      <div className="space-y-6">
        {computed.map((c) => (
          <ScenarioCard key={c.scenario.id} {...c} />
        ))}
      </div>
    </section>
  );
}

function ScenarioCard({
  scenario,
  totalGpuHours,
  listings,
  cheapest,
  vetted,
  managed,
  community,
  savings,
}: {
  scenario: Scenario;
  totalGpuHours: number;
  listings: number;
  cheapest: Pick | null;
  vetted: Pick | null;
  managed: Pick | null;
  community: Pick | null;
  savings: number | null;
}) {
  const noData = !cheapest && !managed;
  const recBadge = {
    cheapest: { text: "Cheapest is fine", tone: "default" },
    vetted: { text: "Use a vetted host", tone: "default" },
    managed: { text: "Managed only", tone: "warn" },
  }[scenario.recommended];

  return (
    <article className="border border-border rounded-xl px-7 py-6 bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5 pb-5 border-b border-border/60">
        <div className="min-w-0">
          <div className="font-sans text-[17px] text-foreground tracking-[-0.012em]">
            {scenario.workload}
          </div>
          <div className="text-[13px] text-muted-foreground mt-1 tabular">
            {scenario.spec}
          </div>
          <div className="text-[12px] text-muted-foreground/80 mt-2 leading-snug max-w-[68ch]">
            {scenario.rationale}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5">
          <span
            className={
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] " +
              (recBadge.tone === "warn"
                ? "bg-up/10 text-up"
                : "bg-foreground/[0.06] text-foreground/85")
            }
          >
            {recBadge.text}
          </span>
          <div className="text-[11.5px] text-muted-foreground tabular">
            {totalGpuHours.toLocaleString()} GPU-hours · {listings} listings
          </div>
        </div>
      </div>

      {noData ? (
        <div className="text-muted-foreground text-[13px] py-2">
          no matching listings right now
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
          <Column
            label="Cheapest"
            sub="best-effort, may churn"
            pick={cheapest}
            tone={scenario.recommended === "cheapest" ? "primary" : "default"}
          />
          <Column
            label="Vetted"
            sub="verified host, no SLA"
            pick={vetted ?? community}
            tone={scenario.recommended === "vetted" ? "primary" : "default"}
            fallbackNote={
              vetted ? null : community ? "(community tier)" : null
            }
          />
          <Column
            label="Managed"
            sub="SLA + support"
            pick={managed}
            tone={scenario.recommended === "managed" ? "primary" : "default"}
          />
        </div>
      )}

      {savings !== null && cheapest && managed && (
        <div className="mt-6 pt-5 border-t border-border/60 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 text-[13px]">
          <div className="text-muted-foreground">
            Going to <span className="text-foreground">cheapest</span> instead
            of <span className="text-foreground">managed</span> saves{" "}
            <span className="text-down tabular">
              {fmtUSD(managed.total - cheapest.total)}
            </span>{" "}
            on this run.
          </div>
          <div className="text-down tabular">
            −{savings.toFixed(0)}% total
          </div>
        </div>
      )}
    </article>
  );
}

function Column({
  label,
  sub,
  pick,
  tone,
  fallbackNote,
}: {
  label: string;
  sub: string;
  pick: Pick | null;
  tone: "primary" | "default";
  fallbackNote?: string | null;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[12px] text-muted-foreground/85">{label}</span>
        <span className="text-[10.5px] text-muted-foreground/65">{sub}</span>
      </div>
      {pick ? (
        <>
          <div
            className={
              "font-sans tabular leading-none mb-1.5 " +
              (tone === "primary"
                ? "text-[28px] text-foreground tracking-[-0.022em]"
                : "text-[22px] text-foreground/85 tracking-[-0.018em]")
            }
          >
            {fmtUSD(pick.total)}
          </div>
          <div className="text-[12px] text-muted-foreground tabular">
            ${pick.perGpuHour.toFixed(2)}/gpu/hr
          </div>
          <div className="text-[12px] text-muted-foreground mt-1.5">
            <span className="text-foreground/85">
              {providerLabel(pick.row.provider)}
            </span>{" "}
            {tierLabel(pick.row.tier)}
            {fallbackNote && (
              <span className="text-muted-foreground/70"> {fallbackNote}</span>
            )}
          </div>
        </>
      ) : (
        <div className="text-[14px] text-muted-foreground">—</div>
      )}
    </div>
  );
}
