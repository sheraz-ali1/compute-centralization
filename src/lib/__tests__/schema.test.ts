import { test, expect } from "vitest";
import { GpuRowSchema } from "@/lib/schema";

test("valid GpuRow parses", () => {
  const row = {
    id: "runpod:H100 SXM:secure:1",
    provider: "runpod",
    tier: "secure",
    gpu_model: "H100 SXM",
    vram_gb: 80,
    gpu_count: 1,
    price_per_gpu_hour_usd: 2.49,
    price_per_instance_hour_usd: 2.49,
    available: true,
    offer_count: 1,
    regions: ["US-CA"],
    metadata: { raw_provider_id: "NVIDIA H100 80GB HBM3" },
    fetched_at: new Date().toISOString(),
  };
  expect(() => GpuRowSchema.parse(row)).not.toThrow();
});

test("invalid provider rejected", () => {
  const bad = { provider: "not-a-provider" };
  expect(() => GpuRowSchema.parse(bad)).toThrow();
});
