import type { GpuRow } from "@/lib/schema";

export type SnapshotDiff = {
  added: GpuRow[];
  removed: GpuRow[];
  repriced: { id: string; from: number; to: number }[];
};

export function diffSnapshots(prev: GpuRow[], next: GpuRow[]): SnapshotDiff {
  const prevMap = new Map(prev.map((r) => [r.id, r]));
  const nextMap = new Map(next.map((r) => [r.id, r]));
  const added: GpuRow[] = [];
  const removed: GpuRow[] = [];
  const repriced: { id: string; from: number; to: number }[] = [];

  for (const [id, n] of nextMap) {
    const p = prevMap.get(id);
    if (!p) added.push(n);
    else if (p.price_per_gpu_hour_usd !== n.price_per_gpu_hour_usd)
      repriced.push({ id, from: p.price_per_gpu_hour_usd, to: n.price_per_gpu_hour_usd });
  }
  for (const [id, p] of prevMap) {
    if (!nextMap.has(id)) removed.push(p);
  }
  return { added, removed, repriced };
}

// The in-memory Cache singleton that used to live here is gone. It assumed
// one long-lived process (Railway) shared by the scraper and every request.
// On serverless each invocation is isolated, so current state lives in
// Postgres now — see src/lib/store.ts. Only this pure diff helper remains.
