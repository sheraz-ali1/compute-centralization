"use client";
import { useMemo, useState } from "react";
import { useSnapshot } from "@/lib/use-snapshot";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

const HERO = ["H100 SXM", "A100 80GB", "B200", "L40S", "RTX 4090"];

// Build the per-GPU price/depth curve. Each step is "at price ≤ X,
// cumulative GPUs available across all listings".
function buildDepth(
  rows: Array<{
    price_per_gpu_hour_usd: number;
    gpu_count: number;
    offer_count: number;
  }>,
) {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort(
    (a, b) => a.price_per_gpu_hour_usd - b.price_per_gpu_hour_usd,
  );
  const points: { price: number; cum: number }[] = [];
  let cum = 0;
  for (const r of sorted) {
    cum += r.gpu_count * r.offer_count;
    points.push({
      price: Number(r.price_per_gpu_hour_usd.toFixed(3)),
      cum,
    });
  }
  return points;
}

export function ComputeOrderBook() {
  const { rows } = useSnapshot();
  const [model, setModel] = useState<string>("H100 SXM");

  const data = useMemo(() => {
    const matching = rows.filter(
      (r) => r.gpu_model === model && r.available,
    );
    return buildDepth(matching);
  }, [rows, model]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const total = data[data.length - 1].cum;
    const cheapest = data[0].price;
    const expensive = data[data.length - 1].price;
    const median = data[Math.floor(data.length / 2)].price;
    return { total, cheapest, expensive, median };
  }, [data]);

  // Cap visible price domain to filter the long tail of overpriced reservations
  const xMax = useMemo(() => {
    if (data.length === 0) return 10;
    // Take the 90th percentile by index, padded
    const p90 = data[Math.floor(data.length * 0.9)]?.price ?? data[data.length - 1].price;
    return Math.max(1, Math.ceil(p90 * 1.1 * 10) / 10);
  }, [data]);

  const visible = useMemo(
    () => data.filter((d) => d.price <= xMax),
    [data, xMax],
  );

  return (
    <section>
      <header className="mb-8 flex flex-col md:flex-row md:items-baseline md:justify-between gap-3">
        <div>
          <h2 className="font-sans text-[24px] tracking-[-0.018em] text-foreground">
            The compute order book.
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-[58ch] leading-snug">
            For each GPU, every available listing across the market sorted
            cheapest to most expensive. The curve is cumulative supply at
            price ≤ X. The shape of the curve is the shape of the market.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {HERO.map((g) => (
            <button
              key={g}
              onClick={() => setModel(g)}
              className={
                "px-3 py-1.5 rounded-md text-[12.5px] transition-colors " +
                (g === model
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]")
              }
            >
              {g}
            </button>
          ))}
        </div>
      </header>

      {data.length === 0 ? (
        <div className="rounded-xl border border-border bg-background py-20 text-center text-muted-foreground text-[14px]">
          no listings for {model}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mb-6">
            <Stat
              label="Cheapest available"
              value={`$${stats!.cheapest.toFixed(2)}`}
              sub="/gpu/hr"
            />
            <Stat
              label="Median offer"
              value={`$${stats!.median.toFixed(2)}`}
              sub="/gpu/hr"
            />
            <Stat
              label="Most expensive"
              value={`$${stats!.expensive.toFixed(2)}`}
              sub="/gpu/hr"
            />
            <Stat
              label="Total supply"
              value={stats!.total.toLocaleString()}
              sub="GPUs available"
            />
          </div>

          <div className="h-[260px] -ml-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={visible}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="depthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--brand)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--brand)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="price"
                  type="number"
                  domain={[0, xMax]}
                  ticks={[
                    0,
                    xMax * 0.25,
                    xMax * 0.5,
                    xMax * 0.75,
                    xMax,
                  ].map((n) => Number(n.toFixed(2)))}
                  tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.2 }}
                  contentStyle={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "8px 10px",
                  }}
                  labelFormatter={(v) =>
                    `at $${Number(v).toFixed(2)}/gpu/hr or less`
                  }
                  formatter={(v) => [
                    `${Number(v).toLocaleString()} GPUs`,
                    "available",
                  ]}
                />
                <ReferenceLine
                  x={stats!.median}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                  label={{
                    value: "median",
                    position: "top",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="cum"
                  stroke="var(--brand)"
                  strokeWidth={1.6}
                  fill="url(#depthFill)"
                  isAnimationActive
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-4 text-[11.5px] text-muted-foreground/75 leading-relaxed">
            Steps right when supply is sparse, levels off when many
            listings cluster around a price. A near-vertical curve on the
            left = a deep, competitive market. A long flat tail = price
            outliers, often expiring credits or under-subscribed
            enterprise tariffs.
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground/80 mb-1">{label}</div>
      <div className="font-sans tabular text-[20px] text-foreground tracking-[-0.015em] leading-none">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
