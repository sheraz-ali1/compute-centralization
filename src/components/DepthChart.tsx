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
  Cell,
} from "recharts";

const PRICE_BUCKETS = [
  0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.5, 10.0,
];
const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "B200",
  "A100 80GB",
  "L40S",
  "RTX 4090",
];

export function DepthChart() {
  const { rows } = useSnapshot();
  const [model, setModel] = useState("H100 SXM");

  const matching = useMemo(
    () => rows.filter((r) => r.gpu_model === model && r.available),
    [rows, model],
  );

  const data = useMemo(() => {
    return PRICE_BUCKETS.map((p, i) => {
      const cum = matching
        .filter((r) => r.price_per_gpu_hour_usd <= p)
        .reduce((s, r) => s + r.gpu_count * r.offer_count, 0);
      const prevCum =
        i === 0
          ? 0
          : matching
              .filter((r) => r.price_per_gpu_hour_usd <= PRICE_BUCKETS[i - 1])
              .reduce((s, r) => s + r.gpu_count * r.offer_count, 0);
      return { price: `$${p.toFixed(2)}`, cum, delta: cum - prevCum };
    });
  }, [matching]);

  const total = matching.reduce(
    (s, r) => s + r.gpu_count * r.offer_count,
    0,
  );

  const maxBucket = data.reduce((m, d) => Math.max(m, d.cum), 0);

  return (
    <Section
      label="Market depth"
      action={
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-transparent border border-border rounded-md px-2 py-1 text-[12px] font-mono text-foreground hover:border-foreground/40 transition-colors cursor-pointer focus:outline-none focus:border-foreground/60"
        >
          {HERO_GPUS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      }
    >
      {total === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-muted-foreground text-[14px]">
          no available {model} listings
        </div>
      ) : (
        <>
          <div className="h-[160px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                barCategoryGap="20%"
              >
                <XAxis
                  dataKey="price"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                  formatter={(v) => [`${Number(v ?? 0)} GPUs`, "available ≤"]}
                />
                <Bar
                  dataKey="cum"
                  radius={[3, 3, 0, 0]}
                >
                  {data.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.cum === maxBucket
                          ? "var(--brand)"
                          : "var(--brand)"
                      }
                      fillOpacity={
                        maxBucket > 0 ? 0.35 + (d.cum / maxBucket) * 0.55 : 0.5
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="font-mono tabular text-[12px] text-muted-foreground">
            <span className="text-foreground">{total.toLocaleString()}</span>{" "}
            total {model} GPUs available across {matching.length} listings
          </div>
        </>
      )}
    </Section>
  );
}
