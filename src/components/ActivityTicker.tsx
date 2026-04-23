"use client";
import { Section } from "./Section";
import { useEffect, useState } from "react";
import type { GpuRow } from "@/lib/schema";

type Event = {
  type: "added" | "removed" | "repriced";
  row?: GpuRow;
  id?: string;
  from?: number;
  to?: number;
  ts: string;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ActivityTicker() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/events")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setEvents(d);
        })
        .catch(() => {});
    load();
    const es = new EventSource("/api/stream");
    const onDiff = () => load();
    es.addEventListener("diff", onDiff as EventListener);
    return () => {
      cancelled = true;
      es.removeEventListener("diff", onDiff as EventListener);
      es.close();
    };
  }, []);

  return (
    <Section label="Activity">
      <ul className="space-y-2.5">
        {events.length === 0 && (
          <li className="text-muted-foreground text-[14px]">
            no recent activity
          </li>
        )}
        {events.slice(0, 10).map((e, i) => (
          <li
            key={i}
            className="grid grid-cols-[44px_8px_1fr] items-baseline gap-3 text-[14px]"
          >
            <span className="font-mono tabular text-[12px] text-muted-foreground">
              {fmtTime(e.ts)}
            </span>
            <span
              className={
                "size-1.5 rounded-full self-center " +
                (e.type === "added"
                  ? "bg-down"
                  : e.type === "removed"
                    ? "bg-up"
                    : "bg-muted-foreground/40")
              }
            />
            <span className="font-sans text-foreground/85 truncate">
              {e.type === "added" && (
                <>
                  <span className="text-foreground">
                    {e.row?.gpu_model}
                  </span>{" "}
                  listed{" "}
                  <span className="font-mono tabular">
                    ${e.row?.price_per_gpu_hour_usd?.toFixed(2)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {e.row?.regions?.[0] ?? e.row?.provider}
                  </span>
                </>
              )}
              {e.type === "removed" && (
                <>
                  <span className="text-foreground">
                    {e.row?.gpu_model}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    no longer available
                  </span>
                </>
              )}
              {e.type === "repriced" && (
                <>
                  <span className="text-foreground">{e.id}</span>{" "}
                  <span className="text-muted-foreground">reprice</span>{" "}
                  <span className="font-mono tabular">
                    ${e.from?.toFixed(2)}→${e.to?.toFixed(2)}
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
