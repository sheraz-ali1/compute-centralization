import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "A100 80GB",
  "L40S",
  "RTX 4090",
  "B200",
];

// In-memory TTL cache. The deltas only change meaningfully when new
// gpu_prices rollups land (every ~120s), and the underlying DB query is
// per-model = 6 queries per request. Memoizing at 60s dramatically cuts
// DB load from a public unauth endpoint.
const TTL_MS = 60_000;
type CacheEntry = { ts: number; data: Record<string, number | null> };
const g = globalThis as unknown as { __computegridDeltaCache?: CacheEntry };

async function compute(): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  // Single query per model but we can union them. For now keep the
  // simple per-model structure — the TTL cache is the load reducer.
  for (const model of HERO_GPUS) {
    try {
      const rows = await sql<
        { now: number | null; ago: number | null }[]
      >`
        with now_p as (
          select min(cheapest_price_per_gpu_hour_usd) as p
          from gpu_prices
          where gpu_model = ${model}
            and fetched_at >= now() - interval '5 minutes'
        ),
        ago_p as (
          select min(cheapest_price_per_gpu_hour_usd) as p
          from gpu_prices
          where gpu_model = ${model}
            and fetched_at <= now() - interval '24 hours'
            and fetched_at >= now() - interval '25 hours'
        )
        select (select p from now_p)::float as now,
               (select p from ago_p)::float as ago
      `;
      const r = rows[0];
      out[model] =
        r?.ago && r?.now ? ((r.now - r.ago) / r.ago) * 100 : null;
    } catch (e) {
      console.error(`index-deltas ${model}:`, e);
      out[model] = null;
    }
  }
  return out;
}

export async function GET() {
  const now = Date.now();
  const entry = g.__computegridDeltaCache;
  if (entry && now - entry.ts < TTL_MS) {
    return NextResponse.json(entry.data, {
      headers: {
        "cache-control": `public, max-age=${Math.floor((TTL_MS - (now - entry.ts)) / 1000)}`,
        ...PUBLIC_CORS_HEADERS,
      },
    });
  }
  const data = await compute();
  g.__computegridDeltaCache = { ts: now, data };
  return NextResponse.json(data, {
    headers: {
      "cache-control": `public, max-age=${TTL_MS / 1000}`,
      ...PUBLIC_CORS_HEADERS,
    },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
