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
        setAge(
          typeof r?.last_snapshot_age_s === "number"
            ? r.last_snapshot_age_s
            : null,
        );
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
        <div className="md:text-right space-y-1.5">
          <div>Open · public benefit</div>
          <a
            href="https://x.com/sherazx11"
            target="_blank"
            rel="noopener"
            className="hover:text-foreground transition-colors"
          >
            x.com/sherazx11
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
