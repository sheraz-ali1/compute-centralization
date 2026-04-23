"use client";
import { useEffect, useState } from "react";

export function Footer() {
  const [age, setAge] = useState<string>("…");

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/health").then((r) => r.json());
        if (cancelled) return;
        const a = r?.last_snapshot_age_s;
        setAge(typeof a === "number" ? `${Math.round(a)}s ago` : "—");
      } catch {
        if (!cancelled) setAge("—");
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
    <footer className="h-10 px-6 border-t border-border flex items-center justify-between font-mono text-[12px] text-muted-foreground">
      <span>
        open · public benefit ·
        github.com/sheraz-ali1/compute-centralization
      </span>
      <span>refreshed {age}</span>
    </footer>
  );
}
