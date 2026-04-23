import { z } from "zod";

// Direct-integration providers we own end-to-end (no markup, no aggregator).
export const DirectProviderSchema = z.enum(["runpod", "vast", "vultr"]);
// All providers, including those sourced via aggregators like getdeploying.
// Kept as a string to allow the long tail of cloud providers without an
// enum churn every time we add one.
export const ProviderSchema = z.string().min(1);
export const TierSchema = z.enum([
  "secure",
  "community",
  "verified",
  "unverified",
  "standard",
]);

export const GpuRowSchema = z.object({
  id: z.string(),
  provider: ProviderSchema,
  tier: TierSchema,
  gpu_model: z.string(),
  vram_gb: z.number().positive(),
  gpu_count: z.number().int().positive(),
  price_per_gpu_hour_usd: z.number().nonnegative(),
  price_per_instance_hour_usd: z.number().nonnegative(),
  available: z.boolean(),
  offer_count: z.number().int().nonnegative(),
  regions: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  fetched_at: z.iso.datetime(),
});

export type GpuRow = z.infer<typeof GpuRowSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Tier = z.infer<typeof TierSchema>;
