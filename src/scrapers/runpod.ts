import { canonicalizeGpuName } from "@/lib/gpu-canonical";
import type { GpuRow } from "@/lib/schema";

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
    const model = canonicalizeGpuName(g.displayName);
    const baseRegions: string[] = [];

    if (g.secureCloud && g.securePrice && g.securePrice > 0) {
      rows.push({
        id: `runpod:${model}:secure:1`,
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
    if (g.communityCloud && g.communityPrice && g.communityPrice > 0) {
      rows.push({
        id: `runpod:${model}:community:1`,
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
