"use client";
import { useMemo, useState } from "react";
import { useSnapshot } from "@/lib/use-snapshot";
import { providerLabel } from "@/lib/provider-labels";
import type { GpuRow } from "@/lib/schema";

const GPU_ROWS = [
  "B200",
  "H200",
  "H100 SXM",
  "H100 PCIe",
  "A100 80GB",
  "L40S",
  "L40",
  "RTX 6000 Ada",
  "RTX A6000",
  "RTX 4090",
];

const MAX_PROVIDER_COLS = 14;

type Cell = {
  provider: string;
  gpu_model: string;
  cheapestPerGpuHourUsd: number;
  rows: GpuRow[];
};

export function ProviderHeatmap() {
  const { rows } = useSnapshot();
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const { providers, cells, rowStats } = useMemo(() => {
    // Pick top providers by # of available listings on the GPUs we care about
    const providerCounts = new Map<string, number>();
    for (const r of rows) {
      if (!r.available) continue;
      if (!GPU_ROWS.includes(r.gpu_model)) continue;
      providerCounts.set(
        r.provider,
        (providerCounts.get(r.provider) ?? 0) + 1,
      );
    }
    const providers = [...providerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PROVIDER_COLS)
      .map(([p]) => p);

    // Build cells
    const map = new Map<string, Cell>();
    for (const r of rows) {
      if (!r.available) continue;
      if (!GPU_ROWS.includes(r.gpu_model)) continue;
      if (!providers.includes(r.provider)) continue;
      const key = `${r.gpu_model}|${r.provider}`;
      const existing = map.get(key);
      if (
        !existing ||
        r.price_per_gpu_hour_usd < existing.cheapestPerGpuHourUsd
      ) {
        map.set(key, {
          provider: r.provider,
          gpu_model: r.gpu_model,
          cheapestPerGpuHourUsd: r.price_per_gpu_hour_usd,
          rows: [r],
        });
      } else {
        existing.rows.push(r);
      }
    }

    // Per-row min/max for color scaling
    const rowStats = new Map<string, { min: number; max: number }>();
    for (const gpu of GPU_ROWS) {
      const prices = providers
        .map((p) => map.get(`${gpu}|${p}`)?.cheapestPerGpuHourUsd)
        .filter((x): x is number => typeof x === "number");
      if (prices.length === 0) continue;
      rowStats.set(gpu, {
        min: Math.min(...prices),
        max: Math.max(...prices),
      });
    }

    return { providers, cells: map, rowStats };
  }, [rows]);

  function cellColor(price: number, gpu: string): string {
    const stats = rowStats.get(gpu);
    if (!stats) return "transparent";
    if (stats.min === stats.max) return "color-mix(in oklab, var(--brand) 16%, transparent)";
    // 0 = cheapest (full brand fill), 1 = most expensive (faint)
    const t = (price - stats.min) / (stats.max - stats.min);
    // Cheapest gets ~22% brand alpha; most expensive gets ~3%
    const alpha = Math.round((22 - t * 19) * 100) / 100;
    return `color-mix(in oklab, var(--brand) ${alpha}%, transparent)`;
  }

  function cellRing(price: number, gpu: string): boolean {
    const stats = rowStats.get(gpu);
    return !!stats && price === stats.min && stats.min !== stats.max;
  }

  return (
    <section>
      <div className="relative">
        {/* Right-edge fade indicates the table scrolls horizontally */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-20 rounded-r-xl"
          style={{
            background:
              "linear-gradient(to left, var(--background) 8%, transparent)",
          }}
        />
        <div className="overflow-x-auto rounded-xl border border-border bg-background">
          <table className="border-collapse text-[12.5px] tabular">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background px-5 h-12 text-left font-normal text-[11px] text-muted-foreground/75 border-b border-border min-w-[150px]">
                GPU
              </th>
              {providers.map((p) => (
                <th
                  key={p}
                  className="px-3 h-12 text-center font-normal text-[10.5px] text-muted-foreground/75 border-b border-border whitespace-nowrap min-w-[78px]"
                  title={providerLabel(p)}
                >
                  <div className="truncate">{providerLabel(p)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GPU_ROWS.map((gpu) => {
              const stats = rowStats.get(gpu);
              if (!stats) return null;
              return (
                <tr
                  key={gpu}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <th className="sticky left-0 z-10 bg-background px-5 py-4 text-left font-normal text-foreground border-r border-border/60 align-middle">
                    <div className="font-sans text-[13.5px]">{gpu}</div>
                    <div className="text-[10.5px] text-muted-foreground mt-1 tabular">
                      ${stats.min.toFixed(2)} – ${stats.max.toFixed(2)}
                    </div>
                  </th>
                  {providers.map((p) => {
                    const cell = cells.get(`${gpu}|${p}`);
                    const cellKey = `${gpu}|${p}`;
                    if (!cell) {
                      return (
                        <td
                          key={p}
                          className="px-3 py-4 text-center text-muted-foreground/25 border-r border-border/25 last:border-r-0 align-middle"
                        >
                          {/* empty cell */}
                        </td>
                      );
                    }
                    const isCheapest = cellRing(
                      cell.cheapestPerGpuHourUsd,
                      gpu,
                    );
                    return (
                      <td
                        key={p}
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className="relative px-3 py-4 text-center border-r border-border/25 last:border-r-0 cursor-default transition-colors align-middle"
                        style={{
                          background: cellColor(
                            cell.cheapestPerGpuHourUsd,
                            gpu,
                          ),
                        }}
                      >
                        <span
                          className={
                            isCheapest
                              ? "text-foreground font-medium"
                              : "text-foreground/85"
                          }
                        >
                          ${cell.cheapestPerGpuHourUsd.toFixed(2)}
                        </span>
                        {hoveredCell === cellKey && (
                          <div className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 w-[220px] rounded-md border border-border bg-background shadow-lg p-3 text-left">
                            <div className="text-[12px] text-foreground mb-1">
                              {providerLabel(cell.provider)} · {gpu}
                            </div>
                            <div className="text-[11px] text-muted-foreground space-y-0.5">
                              {cell.rows
                                .sort(
                                  (a, b) =>
                                    a.price_per_gpu_hour_usd -
                                    b.price_per_gpu_hour_usd,
                                )
                                .slice(0, 4)
                                .map((r) => (
                                  <div
                                    key={r.id}
                                    className="flex justify-between gap-3 tabular"
                                  >
                                    <span className="capitalize">
                                      {r.tier} ×{r.gpu_count}
                                    </span>
                                    <span>
                                      ${r.price_per_gpu_hour_usd.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground/70 leading-relaxed">
        Top {providers.length} providers by # of listings across the
        tracked SKUs. Cell value is the cheapest $/GPU/hr for that
        (GPU, provider) pair right now; the row range below each GPU
        label shows the spread across all providers.
      </p>
    </section>
  );
}
