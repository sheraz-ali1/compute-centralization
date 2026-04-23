import { canonicalizeGpuName, refineGpuModel } from "@/lib/gpu-canonical";
import type { GpuRow } from "@/lib/schema";

// Sanity bound — drop sentinel/contact-for-quote prices.
const MAX_REASONABLE_PRICE_PER_GPU_HOUR_USD = 200;

const ENDPOINT = "https://api.runpod.io/graphql";
const QUERY = `{ gpuTypes { id displayName memoryInGb securePrice communityPrice secureCloud communityCloud } }`;

type RunpodGpuType = {
  id: string;
  displayName: string;
  memoryInGb: number;
  securePrice: number | null;
  communityPrice: number | null;
  secureCloud: boolean;
  communityCloud: boolean;
};

export function parseRunpod(payload: {
  data?: { gpuTypes?: RunpodGpuType[] };
}): GpuRow[] {
  const gpus = payload?.data?.gpuTypes ?? [];
  const fetched_at = new Date().toISOString();
  const rows: GpuRow[] = [];

  for (const g of gpus) {
    if (!g?.displayName || !g?.memoryInGb) continue;
    const model = refineGpuModel(canonicalizeGpuName(g.displayName), {
      vramGb: g.memoryInGb,
      listingName: g.displayName,
    });
    // Disambiguate listings of the same canonical model that are
    // actually different SKUs (e.g. RunPod has both "H100 80GB HBM3"
    // and "H100 NVL 94GB" both reduce to "H100 SXM"; previously these
    // collided on id = "runpod:H100 SXM:community:1").
    const idSuffix = `${model}|${g.memoryInGb}|${g.id}`
      .replace(/\s+/g, "-")
      .toLowerCase();
    const baseRegions: string[] = [];

    if (
      g.secureCloud &&
      g.securePrice &&
      g.securePrice > 0 &&
      g.securePrice < MAX_REASONABLE_PRICE_PER_GPU_HOUR_USD
    ) {
      rows.push({
        id: `runpod:secure:${idSuffix}`,
        provider: "runpod",
        tier: "secure",
        gpu_model: model,
        vram_gb: g.memoryInGb,
        gpu_count: 1,
        price_per_gpu_hour_usd: g.securePrice,
        price_per_instance_hour_usd: g.securePrice,
        available: true,
        offer_count: 1,
        regions: baseRegions,
        metadata: { raw_provider_id: g.id, displayName: g.displayName },
        fetched_at,
      });
    }
    if (
      g.communityCloud &&
      g.communityPrice &&
      g.communityPrice > 0 &&
      g.communityPrice < MAX_REASONABLE_PRICE_PER_GPU_HOUR_USD
    ) {
      rows.push({
        id: `runpod:community:${idSuffix}`,
        provider: "runpod",
        tier: "community",
        gpu_model: model,
        vram_gb: g.memoryInGb,
        gpu_count: 1,
        price_per_gpu_hour_usd: g.communityPrice,
        price_per_instance_hour_usd: g.communityPrice,
        available: true,
        offer_count: 1,
        regions: baseRegions,
        metadata: { raw_provider_id: g.id, displayName: g.displayName },
        fetched_at,
      });
    }
  }

  return rows;
}

export async function fetchRunpod(): Promise<GpuRow[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RunPod HTTP ${res.status}`);
  const json = await res.json();
  return parseRunpod(json);
}
