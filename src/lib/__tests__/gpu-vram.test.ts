import { test, expect } from "vitest";
import { perGpuVram, inferGpuCount } from "@/lib/gpu-vram";

test("per-GPU VRAM lookup", () => {
  expect(perGpuVram("H100 SXM")).toBe(80);
  expect(perGpuVram("A100 40GB")).toBe(40);
  expect(perGpuVram("RTX 4090")).toBe(24);
});

test("infer GPU count from total VRAM", () => {
  expect(inferGpuCount("H100 SXM", 80)).toBe(1);
  expect(inferGpuCount("H100 SXM", 640)).toBe(8);
  expect(inferGpuCount("A100 40GB", 160)).toBe(4);
});

test("unknown model returns 1 (safe default)", () => {
  expect(inferGpuCount("Mystery GPU", 99)).toBe(1);
});
