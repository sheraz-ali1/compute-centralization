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

type CacheEvent = {
  type: "added" | "removed" | "repriced";
  row?: GpuRow;
  id?: string;
  from?: number;
  to?: number;
  ts: string;
};

// In-memory singleton cache. Lives for the lifetime of the Node process.
class Cache {
  private rows: GpuRow[] = [];
  private lastFetched: string | null = null;
  private events: CacheEvent[] = [];

  set(rows: GpuRow[], diff: SnapshotDiff) {
    this.rows = rows;
    this.lastFetched = new Date().toISOString();
    const ts = this.lastFetched;
    for (const r of diff.added) this.events.unshift({ type: "added", row: r, ts });
    for (const r of diff.removed) this.events.unshift({ type: "removed", row: r, ts });
    for (const e of diff.repriced)
      this.events.unshift({ type: "repriced", id: e.id, from: e.from, to: e.to, ts });
    this.events = this.events.slice(0, 100);
  }
  getRows() {
    return this.rows;
  }
  getLastFetched() {
    return this.lastFetched;
  }
  getEvents(n = 20) {
    return this.events.slice(0, n);
  }
}

// Pin singleton on globalThis so it survives across module instances
// (Next dev mode / Turbopack may otherwise compile this module twice).
const g = globalThis as unknown as { __computegridCache?: Cache };
export const cache = g.__computegridCache ?? (g.__computegridCache = new Cache());
