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
    <Section label="ACTIVITY (LAST 5 MIN)">
      <ul className="font-mono text-[13px] space-y-1.5 max-h-[180px] overflow-hidden">
        {events.length === 0 && (
          <li className="text-muted-foreground">no recent activity</li>
        )}
        {events.slice(0, 12).map((e, i) => (
          <li key={i} className="flex gap-2 text-foreground/80">
            <span className="text-muted-foreground w-12">
              {new Date(e.ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="flex-1 truncate">
              {e.type === "added" && (
                <span>
                  <span className="text-down">●</span> {e.row?.gpu_model}{" "}
                  listed ${e.row?.price_per_gpu_hour_usd?.toFixed(2)}{" "}
                  {e.row?.regions?.[0] ?? ""}
                </span>
              )}
              {e.type === "removed" && (
                <span>
                  <span className="text-up">●</span> {e.row?.gpu_model}{" "}
                  sold-out / withdrawn
                </span>
              )}
              {e.type === "repriced" && (
                <span>
                  <span className="text-muted-foreground">●</span> {e.id}{" "}
                  reprice ${e.from?.toFixed(2)}→${e.to?.toFixed(2)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
