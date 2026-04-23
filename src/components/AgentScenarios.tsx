"use client";
import { useSnapshot } from "@/lib/use-snapshot";
import { providerLabel, tierLabel } from "@/lib/provider-labels";
import type { GpuRow } from "@/lib/schema";
import { useMemo } from "react";

type Scenario = {
  id: string;
  workload: string;
  spec: string;
  gpu_model: string;
  gpu_count: number;
  hours: number;
  hoursLabel: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "train-7b",
    workload: "Train a 7B model",
    spec: "8× H100 SXM for 24 hours",
    gpu_model: "H100 SXM",
    gpu_count: 8,
    hours: 24,
    hoursLabel: "24h",
  },
  {
    id: "inference-pool",
    workload: "Run an inference pool",
    spec: "4× A100 80GB, always-on (730h)",
    gpu_model: "A100 80GB",
    gpu_count: 4,
    hours: 730,
    hoursLabel: "730h / mo",
  },
  {
    id: "rl-tune",
    workload: "RL fine-tune",
    spec: "1× H100 SXM for 12 hours",
    gpu_model: "H100 SXM",
    gpu_count: 1,
    hours: 12,
    hoursLabel: "12h",
  },
  {
    id: "b200-bench",
    workload: "Bench on B200",
    spec: "1× B200 for 4 hours",
    gpu_model: "B200",
    gpu_count: 1,
    hours: 4,
    hoursLabel: "4h",
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
  if (n >= 10) return `$${n.toFixed(2)}`;
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
      <header className="flex items-baseline justify-between mb-10">
        <div>
          <h2 className="font-sans text-[24px] tracking-[-0.018em] text-foreground">
            What a workload costs, today.
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-[58ch] leading-snug">
            Every dollar below is the live cheapest across the providers
            we track, computed from current listings. Pick a tier, see what
            it would cost to run.
          </p>
        </div>
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

  return (
    <article className="border border-border rounded-xl px-7 py-6 bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 mb-6 pb-5 border-b border-border/60">
        <div>
          <div className="font-sans text-[17px] text-foreground tracking-[-0.012em]">
            {scenario.workload}
          </div>
          <div className="text-[13px] text-muted-foreground mt-1">
            {scenario.spec}
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground tabular shrink-0">
          {totalGpuHours.toLocaleString()} GPU-hours · {listings} listings
          tracked
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
            tone="primary"
          />
          <Column
            label="Vetted"
            sub="verified host, no SLA"
            pick={vetted ?? community}
            tone="default"
            fallbackNote={
              vetted ? null : community ? "(community tier)" : null
            }
          />
          <Column
            label="Managed"
            sub="SLA + support"
            pick={managed}
            tone="default"
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
