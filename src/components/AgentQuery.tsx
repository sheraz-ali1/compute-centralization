"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSnapshot } from "@/lib/use-snapshot";
import { providerLabel, tierLabel } from "@/lib/provider-labels";
import type { GpuRow } from "@/lib/schema";

const ROTATION = ["H100 SXM", "A100 80GB", "B200", "L40S", "RTX 4090"];
const ENTERPRISE_TIERS = new Set(["secure", "standard"]);
const COMMUNITY_TIERS = new Set(["community", "verified", "unverified"]);
const ROTATE_MS = 4500;

function cheapestOf(rows: GpuRow[]): GpuRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((a, b) =>
    a.price_per_gpu_hour_usd <= b.price_per_gpu_hour_usd ? a : b,
  );
}

export function AgentQuery() {
  const { rows, fetchedAt } = useSnapshot();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => (i + 1) % ROTATION.length),
      ROTATE_MS,
    );
    return () => clearInterval(t);
  }, []);

  const model = ROTATION[idx];
  const result = useMemo(() => {
    const matching = rows.filter((r) => r.gpu_model === model && r.available);
    const cheapest = cheapestOf(matching);
    const enterprise = cheapestOf(
      matching.filter((r) => ENTERPRISE_TIERS.has(r.tier)),
    );
    const total = matching.length;
    const marketplaceListings = matching
      .filter((r) => COMMUNITY_TIERS.has(r.tier))
      .reduce((s, r) => s + r.offer_count, 0);
    const savings =
      cheapest && enterprise && enterprise.price_per_gpu_hour_usd > 0
        ? (1 -
            cheapest.price_per_gpu_hour_usd /
              enterprise.price_per_gpu_hour_usd) *
          100
        : null;
    return { cheapest, enterprise, total, marketplaceListings, savings };
  }, [rows, model]);

  const ageS = fetchedAt
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000),
      )
    : null;

  return (
    <div className="rounded-xl border border-border bg-background/70 backdrop-blur-sm overflow-hidden">
      {/* Header — function call + age */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <div className="font-mono text-[12.5px] text-foreground/85 truncate min-w-0">
          <span className="text-muted-foreground">find_cheapest</span>
          <span className="text-foreground/60">(</span>
          <span className="text-foreground/60">{`{ `}</span>
          <span className="text-muted-foreground">gpu_model</span>
          <span className="text-foreground/60">: </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={model}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="text-down inline-block"
            >
              &quot;{model}&quot;
            </motion.span>
          </AnimatePresence>
          <span className="text-foreground/60"> {`}`}</span>
          <span className="text-foreground/60">)</span>
        </div>
        <div className="shrink-0 ml-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-down animate-pulse" />
          {ageS !== null ? `${ageS}s` : "syncing"}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={model + (result.cheapest?.id ?? "x")}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="px-6 pt-6 pb-7"
        >
          {result.cheapest ? (
            <>
              {/* Headline price + savings */}
              <div className="flex items-baseline gap-3">
                <div className="flex items-baseline">
                  <span className="font-sans text-[18px] text-muted-foreground mr-0.5 leading-none translate-y-[-2px]">
                    $
                  </span>
                  <span className="font-sans text-[44px] leading-none text-foreground tracking-[-0.025em] tabular">
                    {result.cheapest.price_per_gpu_hour_usd.toFixed(2)}
                  </span>
                  <span className="font-sans text-[14px] text-muted-foreground ml-1.5 leading-none">
                    /hr
                  </span>
                </div>
                {result.savings !== null && result.savings > 5 && (
                  <span className="font-sans tabular text-[14px] text-down">
                    −{result.savings.toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Field grid */}
              <div className="mt-7 grid grid-cols-3 gap-x-5 text-[13px]">
                <Field label="Source">
                  <div className="text-foreground">
                    {providerLabel(result.cheapest.provider)}
                  </div>
                  <div className="text-muted-foreground">
                    {tierLabel(result.cheapest.tier)}
                  </div>
                </Field>
                <Field label="Cloud price">
                  {result.enterprise ? (
                    <>
                      <div className="text-foreground tabular">
                        ${result.enterprise.price_per_gpu_hour_usd.toFixed(2)}
                        <span className="text-muted-foreground">/hr</span>
                      </div>
                      <div className="text-muted-foreground">
                        {providerLabel(result.enterprise.provider)}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Field>
                <Field label="Market">
                  <div className="text-foreground tabular">
                    {result.total} listings
                  </div>
                  {result.marketplaceListings > 0 && (
                    <div className="text-muted-foreground">
                      {result.marketplaceListings} on Vast
                    </div>
                  )}
                </Field>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-[13px] py-6">
              no listings for {model}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border/60 text-[12px] text-muted-foreground/70">
        <div>Live MCP response</div>
        <div className="flex items-center gap-1.5">
          {ROTATION.map((m, i) => (
            <span
              key={m}
              className={
                "size-1 rounded-full transition-colors " +
                (i === idx ? "bg-foreground/65" : "bg-foreground/15")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-muted-foreground/75">{label}</div>
      <div className="leading-snug">{children}</div>
    </div>
  );
}
