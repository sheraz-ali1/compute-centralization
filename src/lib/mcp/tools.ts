import { z } from "zod";
import { cache } from "@/lib/cache";
import { sql } from "@/lib/db";
import type { GpuRow } from "@/lib/schema";

// Hard caps on string lengths and array sizes to prevent abuse. None of
// these are real-world limiting for legitimate agent use.
const STR = z.string().max(256);
const STR_ARR = z.array(STR).max(50);

export const listGpusInput = z.object({
  gpu_model: STR.optional(),
  provider: STR_ARR.optional(),
  tier: STR_ARR.optional(),
  max_price_per_gpu_hour: z.number().nonnegative().max(10000).optional(),
  min_vram_gb: z.number().nonnegative().max(10000).optional(),
  available_only: z.boolean().default(true),
  region: STR.optional(),
  limit: z.number().int().positive().max(500).default(100),
});

export function listGpus(input: z.infer<typeof listGpusInput>): GpuRow[] {
  // Always operate on a copy of cache rows. The cache singleton is
  // shared across all requests; .sort() in place would reorder it for
  // every other concurrent caller.
  let rows = cache.getRows().slice();
  if (input.gpu_model) {
    const q = input.gpu_model.toLowerCase();
    rows = rows.filter((r) => r.gpu_model.toLowerCase().includes(q));
  }
  if (input.provider?.length)
    rows = rows.filter((r) => input.provider!.includes(r.provider));
  if (input.tier?.length)
    rows = rows.filter((r) => input.tier!.includes(r.tier));
  if (input.max_price_per_gpu_hour !== undefined)
    rows = rows.filter(
      (r) => r.price_per_gpu_hour_usd <= input.max_price_per_gpu_hour!,
    );
  if (input.min_vram_gb !== undefined)
    rows = rows.filter((r) => r.vram_gb >= input.min_vram_gb!);
  if (input.available_only) rows = rows.filter((r) => r.available);
  if (input.region) {
    const q = input.region.toLowerCase();
    rows = rows.filter((r) =>
      r.regions.some((g) => g.toLowerCase().includes(q)),
    );
  }
  return rows
    .sort((a, b) => a.price_per_gpu_hour_usd - b.price_per_gpu_hour_usd)
    .slice(0, input.limit);
}

export const findCheapestInput = z.object({
  gpu_model: STR,
  gpu_count: z.number().int().positive().max(64).default(1),
  min_vram_gb: z.number().nonnegative().max(10000).optional(),
  tier: STR_ARR.optional(),
  region: STR.optional(),
});

export async function findCheapest(input: z.infer<typeof findCheapestInput>) {
  // The candidate set: all rows matching the user's full filter,
  // restricted to the requested gpu_count exactly.
  const matches = listGpus({
    gpu_model: input.gpu_model,
    tier: input.tier,
    min_vram_gb: input.min_vram_gb,
    region: input.region,
    available_only: true,
    limit: 500,
  }).filter((r) => r.gpu_count === input.gpu_count);

  if (matches.length === 0)
    return { cheapest: null, alternatives: [], market_context: null };

  const cheapest = matches[0];
  const alternatives = matches.slice(1, 6);

  // Market context applies the SAME filters as the candidate query so
  // the median/total are about the slice the caller is shopping in,
  // not the whole market. (Previously this used an unfiltered query
  // which produced misleading context for tier/region-constrained
  // requests.)
  const slice = listGpus({
    gpu_model: input.gpu_model,
    tier: input.tier,
    min_vram_gb: input.min_vram_gb,
    region: input.region,
    available_only: true,
    limit: 500,
  });
  const prices = slice
    .map((r) => r.price_per_gpu_hour_usd)
    .sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  const total = slice.reduce((sum, r) => sum + r.offer_count, 0);

  // 24h-ago lookup. Resolve the canonical model from the cheapest row
  // (so a substring search like "H100" still queries history under the
  // resolved canonical name). Wrap in try/catch so an empty/missing
  // gpu_prices table — common on a fresh deploy — doesn't take down
  // the entire tool call.
  let cheapest_24h_ago: number | null = null;
  try {
    const ago = await sql<{ cheapest_price_per_gpu_hour_usd: number }[]>`
      select cheapest_price_per_gpu_hour_usd from gpu_prices
      where gpu_model = ${cheapest.gpu_model}
        and fetched_at <= now() - interval '24 hours'
      order by fetched_at desc limit 1`;
    cheapest_24h_ago = ago[0]?.cheapest_price_per_gpu_hour_usd ?? null;
  } catch (e) {
    console.warn("find_cheapest: gpu_prices lookup failed", e);
  }

  return {
    cheapest,
    alternatives,
    market_context: {
      median_price_per_gpu_hour_usd: median,
      total_available_count: total,
      cheapest_24h_ago,
    },
  };
}
