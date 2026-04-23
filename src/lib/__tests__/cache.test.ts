import { test, expect } from "vitest";
import { diffSnapshots } from "@/lib/cache";
import type { GpuRow } from "@/lib/schema";

const row = (id: string, price: number): GpuRow => ({
  id,
  provider: "runpod",
  tier: "secure",
  gpu_model: "H100 SXM",
  vram_gb: 80,
  gpu_count: 1,
  price_per_gpu_hour_usd: price,
  price_per_instance_hour_usd: price,
  available: true,
  offer_count: 1,
  regions: [],
  metadata: {},
  fetched_at: new Date().toISOString(),
});

test("added rows detected", () => {
  const d = diffSnapshots([], [row("a", 1)]);
  expect(d.added.length).toBe(1);
  expect(d.removed.length).toBe(0);
});

test("removed rows detected", () => {
  const d = diffSnapshots([row("a", 1)], []);
  expect(d.removed.length).toBe(1);
});

test("repriced detected", () => {
  const d = diffSnapshots([row("a", 1.5)], [row("a", 1.2)]);
  expect(d.repriced).toEqual([{ id: "a", from: 1.5, to: 1.2 }]);
  expect(d.added.length).toBe(0);
  expect(d.removed.length).toBe(0);
});

test("identical snapshots produce empty diff", () => {
  const d = diffSnapshots([row("a", 1)], [row("a", 1)]);
  expect(d.added.length + d.removed.length + d.repriced.length).toBe(0);
});
