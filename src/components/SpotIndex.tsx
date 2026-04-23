"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";
import { useEffect, useState } from "react";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "A100 80GB",
  "L40S",
  "RTX 4090",
  "B200",
];

export function SpotIndex() {
  const { rows } = useSnapshot();
  const [deltas, setDeltas] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/index-deltas")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDeltas(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = HERO_GPUS.map((model) => {
    const matching = rows.filter(
      (r) => r.gpu_model === model && r.available,
    );
    const cheapest = matching.reduce<number | null>(
      (m, r) =>
        m === null ? r.price_per_gpu_hour_usd : Math.min(m, r.price_per_gpu_hour_usd),
      null,
    );
    const total = matching.reduce((s, r) => s + r.offer_count, 0);
    const delta = deltas[model] ?? null;
    return { model, price: cheapest, count: total, delta };
  });

  return (
    <Section label="GPU SPOT INDEX">
      <table className="w-full font-mono text-[13px] tabular">
        <tbody>
          {summary.map((s) => (
            <tr
              key={s.model}
              className="border-b border-border last:border-0"
            >
              <td className="py-1.5 text-foreground/80">{s.model}</td>
              <td className="py-1.5 text-right">
                {s.price !== null ? `$${s.price.toFixed(2)}` : "—"}
              </td>
              <td
                className={
                  "py-1.5 text-right " +
                  (s.delta !== null && s.delta < 0
                    ? "text-down"
                    : s.delta !== null && s.delta > 0
                      ? "text-up"
                      : "text-muted-foreground")
                }
              >
                {s.delta !== null
                  ? `${s.delta > 0 ? "↑" : s.delta < 0 ? "↓" : "→"}${Math.abs(s.delta).toFixed(1)}%`
                  : "—"}
              </td>
              <td className="py-1.5 text-right text-muted-foreground">
                {s.count} avail
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
