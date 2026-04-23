import { test, expect } from "vitest";
import fixture from "../__fixtures__/vultr-response.json";
import { parseVultr } from "@/scrapers/vultr";
import { GpuRowSchema } from "@/lib/schema";

test("parses Vultr fixture into valid GpuRows", () => {
  const rows = parseVultr(fixture);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(() => GpuRowSchema.parse(row)).not.toThrow();
    expect(row.provider).toBe("vultr");
    expect(row.tier).toBe("standard");
  }
});

test("plans with no locations marked unavailable", () => {
  const rows = parseVultr(fixture);
  for (const row of rows) {
    if (row.regions.length === 0) expect(row.available).toBe(false);
    else expect(row.available).toBe(true);
  }
});

test("row IDs are unique within a snapshot", () => {
  const rows = parseVultr(fixture);
  const ids = new Set(rows.map((r) => r.id));
  expect(ids.size).toBe(rows.length);
});
