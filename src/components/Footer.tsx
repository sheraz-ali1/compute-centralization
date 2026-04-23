"use client";
import { useEffect, useState } from "react";

export function Footer() {
  const [age, setAge] = useState<number | null>(null);
  const [rows, setRows] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/health").then((r) => r.json());
        if (cancelled) return;
        setAge(typeof r?.last_snapshot_age_s === "number" ? r.last_snapshot_age_s : null);
        setRows(typeof r?.rows === "number" ? r.rows : null);
      } catch {
        if (!cancelled) {
          setAge(null);
          setRows(null);
        }
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
    <footer className="px-8 py-6 border-t border-border flex items-center justify-between text-[12px] text-muted-foreground font-mono">
      <span>
        Open · public benefit ·{" "}
        <a
          href="https://github.com/sheraz-ali1/compute-centralization"
          className="hover:text-foreground transition-colors"
        >
          github.com/sheraz-ali1/compute-centralization
        </a>
      </span>
      <span className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-down animate-pulse" />
        {rows !== null ? `${rows.toLocaleString()} listings · ` : ""}
        {age !== null ? `refreshed ${Math.round(age)}s ago` : "connecting…"}
      </span>
    </footer>
  );
}
