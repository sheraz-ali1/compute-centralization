"use client";
import { useEffect, useState } from "react";

export function Footer() {
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/health").then((r) => r.json());
        if (cancelled) return;
        // Health response nests cache fields under `cache` since the
        // pre-deploy refactor: { ok, cache: { ok, last_snapshot_age_s,
        // rows }, db: { ok, error } }.
        const a = r?.cache?.last_snapshot_age_s;
        setAge(typeof a === "number" ? a : null);
      } catch {
        if (!cancelled) setAge(null);
      }
    };
    tick();
    const i = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  return (
    <footer className="border-t border-border/60 px-8 py-8">
      <div className="mx-auto max-w-4xl flex flex-col md:flex-row md:items-start md:justify-between gap-4 text-[12px] text-muted-foreground">
        <div className="space-y-1.5">
          <div>
            <span className="text-foreground/85">Direct integrations:</span>{" "}
            RunPod · Vast.ai · Vultr ·{" "}
            {age !== null
              ? `refreshed ${Math.round(age)}s ago`
              : "connecting…"}
          </div>
          <div>
            <span className="text-foreground/85">Aggregator:</span> 30+
            additional providers (Lambda, CoreWeave, Paperspace, AWS, GCP,
            Azure, OVH, Scaleway, …) via{" "}
            <a
              href="https://getdeploying.com/gpus"
              target="_blank"
              rel="noopener"
              className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              getdeploying.com
            </a>
            , updated daily upstream
          </div>
        </div>
        <div className="md:text-right">
          <a
            href="https://x.com/sherazx11"
            target="_blank"
            rel="noopener"
            aria-label="Follow @sherazx11 on X"
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M18.244 2H21.5l-7.5 8.567L22.99 22h-6.79l-5.32-6.962L4.8 22H1.54l8.02-9.165L1.01 2h6.96l4.81 6.36L18.244 2zm-2.38 18h1.876L8.226 4H6.21l9.654 16z" />
            </svg>
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-4xl mt-6 pt-4 border-t border-border/40 text-[11px] text-muted-foreground/60 leading-relaxed">
        Prices and availability are sourced live from public provider APIs
        and aggregators. Provided as-is for informational purposes only,
        with no warranty of accuracy or fitness for any particular use.
        Verify with the source provider before committing spend. Not
        financial advice.
      </div>
    </footer>
  );
}
