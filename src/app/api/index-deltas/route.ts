import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERO_GPUS = [
  "H100 SXM",
  "H100 PCIe",
  "A100 80GB",
  "L40S",
  "RTX 4090",
  "B200",
];

export async function GET() {
  const out: Record<string, number | null> = {};
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
  return NextResponse.json(out);
}
