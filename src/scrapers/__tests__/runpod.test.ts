import { test, expect } from "vitest";
import fixture from "../__fixtures__/runpod-response.json";
import { parseRunpod } from "@/scrapers/runpod";
import { GpuRowSchema } from "@/lib/schema";

test("parses RunPod fixture into valid GpuRows", () => {
  const rows = parseRunpod(fixture);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(() => GpuRowSchema.parse(row)).not.toThrow();
    expect(row.provider).toBe("runpod");
  }
});

test("emits secure and community tiers separately", () => {
  const rows = parseRunpod(fixture);
  const tiers = new Set(rows.map((r) => r.tier));
  expect(tiers.has("secure")).toBe(true);
  expect(tiers.has("community")).toBe(true);
});

test("price_per_gpu_hour_usd is positive for available rows", () => {
  const rows = parseRunpod(fixture).filter((r) => r.available);
  for (const row of rows) {
    expect(row.price_per_gpu_hour_usd).toBeGreaterThan(0);
  }
});
