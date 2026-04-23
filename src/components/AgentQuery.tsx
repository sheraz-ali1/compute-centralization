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
    <div className="rounded-lg border border-border bg-background/60 backdrop-blur-sm">
      {/* Header — the agent's call signature */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 font-mono text-[12.5px]">
        <div className="text-foreground/85">
          <span className="text-muted-foreground">find_cheapest</span>(
          <span className="text-foreground">{`{ gpu_model: `}</span>
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
          <span className="text-foreground"> {`}`}</span>
          <span className="text-muted-foreground">)</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground/80 font-sans">
          <span className="size-1.5 rounded-full bg-down animate-pulse" />
          {ageS !== null ? `${ageS}s ago` : "syncing"}
        </div>
      </div>

      {/* Body — formatted result */}
      <AnimatePresence mode="wait">
        <motion.div
          key={model + (result.cheapest?.id ?? "x")}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="px-5 py-5"
        >
          {result.cheapest ? (
            <>
              <div className="flex items-baseline gap-3">
                <div className="font-sans tabular text-[40px] leading-none text-foreground tracking-[-0.02em]">
                  <span className="text-muted-foreground text-[20px] mr-0.5">
                    $
                  </span>
                  {result.cheapest.price_per_gpu_hour_usd.toFixed(2)}
                  <span className="text-muted-foreground text-[14px] ml-1">
                    /hr
                  </span>
                </div>
                {result.savings !== null && result.savings > 5 && (
                  <div className="font-sans tabular text-[15px] text-down">
                    −{result.savings.toFixed(0)}%
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                <Field label="Source">
                  <span className="text-foreground">
                    {providerLabel(result.cheapest.provider)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {tierLabel(result.cheapest.tier)}
                  </span>
                </Field>
                <Field label="Cloud price">
                  {result.enterprise ? (
                    <>
                      <span className="text-foreground">
                        ${result.enterprise.price_per_gpu_hour_usd.toFixed(2)}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {providerLabel(result.enterprise.provider)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Field>
                <Field label="Market">
                  <span className="text-foreground">
                    {result.total} listings
                  </span>
                  {result.marketplaceListings > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      / {result.marketplaceListings} on Vast
                    </span>
                  )}
                </Field>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-[13px] py-2">
              no listings for {model}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 text-[12px] text-muted-foreground/70">
        <div>Live MCP response</div>
        <div className="flex items-center gap-1.5">
          {ROTATION.map((m, i) => (
            <span
              key={m}
              className={
                "size-1 rounded-full transition-colors " +
                (i === idx ? "bg-foreground/70" : "bg-foreground/15")
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
    <div>
      <div className="text-[11px] text-muted-foreground/80 mb-1">{label}</div>
      <div className="tabular text-foreground/90">{children}</div>
    </div>
  );
}
