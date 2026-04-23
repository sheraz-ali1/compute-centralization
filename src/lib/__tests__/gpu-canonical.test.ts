import { test, expect } from "vitest";
import { canonicalizeGpuName } from "@/lib/gpu-canonical";

test.each([
  ["NVIDIA H100 80GB HBM3", "H100 SXM"],
  ["H100 SXM5", "H100 SXM"],
  ["H100 PCIe", "H100 PCIe"],
  ["A100 80GB", "A100 80GB"],
  ["A100-SXM4-80GB", "A100 80GB"],
  ["RTX 4090", "RTX 4090"],
  ["NVIDIA GeForce RTX 4090", "RTX 4090"],
  ["L40S", "L40S"],
  ["B200", "B200"],
])("canonicalizes %s → %s", (input, expected) => {
  expect(canonicalizeGpuName(input)).toBe(expected);
});

test("unknown model passes through trimmed", () => {
  expect(canonicalizeGpuName("  Some New GPU  ")).toBe("Some New GPU");
});
