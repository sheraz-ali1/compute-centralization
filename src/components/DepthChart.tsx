"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const PRICE_BUCKETS = [
  1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 8.0, 10.0,
];
const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "A100 80GB",
  "L40S",
  "RTX 4090",
  "B200",
];

export function DepthChart() {
  const { rows } = useSnapshot();
  const [model, setModel] = useState("H100 SXM");

  const data = useMemo(() => {
    const matching = rows.filter(
      (r) => r.gpu_model === model && r.available,
    );
    return PRICE_BUCKETS.map((p) => ({
      price: `≤$${p.toFixed(2)}`,
      gpus: matching
        .filter((r) => r.price_per_gpu_hour_usd <= p)
        .reduce((s, r) => s + r.gpu_count * r.offer_count, 0),
    }));
  }, [rows, model]);

  const total = useMemo(
    () =>
      rows
        .filter((r) => r.gpu_model === model && r.available)
        .reduce((s, r) => s + r.gpu_count * r.offer_count, 0),
    [rows, model],
  );

  return (
    <Section
      label={
        <span className="flex items-center justify-between gap-2">
          <span>DEPTH — {model}</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-transparent border border-border rounded px-1.5 py-0.5 text-[11px] font-mono uppercase tracking-wider text-foreground/80 cursor-pointer normal-case"
          >
            {HERO_GPUS.map((g) => (
              <option key={g} value={g} className="bg-background">
                {g}
              </option>
            ))}
          </select>
        </span>
      }
    >
      <div className="h-[140px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
          >
            <XAxis
              dataKey="price"
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="gpus" fill="var(--down)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[12px] font-mono text-muted-foreground mt-2">
        {total} total available
      </div>
    </Section>
  );
}
