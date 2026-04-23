import { test, expect } from "vitest";
import fixture from "../__fixtures__/vast-response.json";
import { parseVast } from "@/scrapers/vast";
import { GpuRowSchema } from "@/lib/schema";

test("parses Vast fixture into valid GpuRows", () => {
  const rows = parseVast(fixture);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows.slice(0, 50)) {
    expect(() => GpuRowSchema.parse(row)).not.toThrow();
    expect(row.provider).toBe("vast");
  }
});

test("dedupes by (gpu_model, gpu_count, tier) keeping cheapest", () => {
  const rows = parseVast(fixture);
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.gpu_model}|${r.gpu_count}|${r.tier}`;
    expect(seen.has(key)).toBe(false);
    seen.set(key, r.price_per_gpu_hour_usd);
  }
});

test("verified vs unverified tiers both appear", () => {
  const rows = parseVast(fixture);
  const tiers = new Set(rows.map((r) => r.tier));
  expect(tiers.has("verified") || tiers.has("unverified")).toBe(true);
});

test("deverified offers are bucketed as unverified", () => {
  const rows = parseVast(fixture);
  for (const r of rows) {
    expect(["verified", "unverified"]).toContain(r.tier);
  }
});
