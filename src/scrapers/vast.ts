import { canonicalizeGpuName } from "@/lib/gpu-canonical";
import type { GpuRow, Tier } from "@/lib/schema";

const ENDPOINT = "https://console.vast.ai/api/v0/bundles/";
const QUERY = JSON.stringify({
  order: [["dphtotal", "asc"]],
  type: "on-demand",
  limit: 500,
  rentable: { eq: true },
});

type VastOffer = {
  id: number;
  gpu_name?: string;
  num_gpus?: number;
  dph_base?: number; // total $/hr for the bundle
  gpu_ram?: number; // MB per GPU
  geolocation?: string | null;
  verification?: string; // "verified" | "deverified" | "unverified" | other
  bw_nvlink?: number;
};

export function parseVast(payload: { offers?: VastOffer[] }): GpuRow[] {
  const offers = payload?.offers ?? [];
  const fetched_at = new Date().toISOString();

  // group by (model, gpu_count, tier) → keep cheapest, count distinct offers
  const groups = new Map<
    string,
    { offers: VastOffer[]; tier: Tier; model: string }
  >();

  for (const o of offers) {
    if (!o.gpu_name || !o.num_gpus || !o.dph_base) continue;
    if (o.gpu_ram == null || o.gpu_ram <= 0) continue;
    const model = canonicalizeGpuName(o.gpu_name);
    const tier: Tier = o.verification === "verified" ? "verified" : "unverified";
    const key = `${model}|${o.num_gpus}|${tier}`;
    if (!groups.has(key)) groups.set(key, { offers: [], tier, model });
    groups.get(key)!.offers.push(o);
  }

  const rows: GpuRow[] = [];
  for (const [, { offers: groupOffers, tier, model }] of groups) {
    const cheapest = groupOffers.reduce((a, b) =>
      (a.dph_base ?? Infinity) <= (b.dph_base ?? Infinity) ? a : b,
    );
    const regions = [
      ...new Set(
        groupOffers
          .map((o) => o.geolocation)
          .filter((g): g is string => Boolean(g)),
      ),
    ];
    const vram_gb = Math.max(1, Math.round((cheapest.gpu_ram ?? 0) / 1024));
    const num_gpus = cheapest.num_gpus!;
    const dph = cheapest.dph_base!;

    rows.push({
      id: `vast:${model}:${tier}:${num_gpus}`,
      provider: "vast",
      tier,
      gpu_model: model,
      vram_gb,
      gpu_count: num_gpus,
      price_per_gpu_hour_usd: dph / num_gpus,
      price_per_instance_hour_usd: dph,
      available: true,
      offer_count: groupOffers.length,
      regions,
      metadata: {
        raw_provider_id: String(cheapest.id),
        nvlink: (cheapest.bw_nvlink ?? 0) > 0,
      },
      fetched_at,
    });
  }

  return rows;
}

export async function fetchVast(): Promise<GpuRow[]> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(QUERY)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Vast HTTP ${res.status}`);
  const json = await res.json();
  return parseVast(json);
}
