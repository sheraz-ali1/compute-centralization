import { canonicalizeGpuName } from "@/lib/gpu-canonical";
import { inferGpuCount, perGpuVram } from "@/lib/gpu-vram";
import type { GpuRow } from "@/lib/schema";

const ENDPOINT = "https://api.vultr.com/v2/plans?type=vcg";

type VultrPlan = {
  id: string;
  gpu_type?: string;
  gpu_vram_gb?: number; // total VRAM across all GPUs in this plan
  hourly_cost?: number;
  locations?: string[];
};

export function parseVultr(payload: { plans?: VultrPlan[] }): GpuRow[] {
  const plans = payload?.plans ?? [];
  const fetched_at = new Date().toISOString();

  // Vultr offers fractional-GPU plans (e.g. 2GB / 4GB / 8GB slices of an
  // NVIDIA_A16) that all canonicalize to the same (model, gpu_count=1)
  // bucket. To keep GpuRow.id stable AND unique within a snapshot we
  // dedupe by id, keeping the cheapest per-GPU offer in each bucket.
  const byId = new Map<string, GpuRow>();

  for (const p of plans) {
    if (!p.gpu_type || p.hourly_cost == null || p.gpu_vram_gb == null) continue;
    const model = canonicalizeGpuName(p.gpu_type);
    const gpu_count = inferGpuCount(model, p.gpu_vram_gb);
    const vram_gb = perGpuVram(model) ?? p.gpu_vram_gb;
    const locations = p.locations ?? [];
    const id = `vultr:${model}:standard:${gpu_count}`;
    const row: GpuRow = {
      id,
      provider: "vultr",
      tier: "standard",
      gpu_model: model,
      vram_gb,
      gpu_count,
      price_per_gpu_hour_usd: p.hourly_cost / gpu_count,
      price_per_instance_hour_usd: p.hourly_cost,
      available: locations.length > 0,
      offer_count: 1,
      regions: locations,
      metadata: {
        raw_provider_id: p.id,
        vultr_total_vram_gb: p.gpu_vram_gb,
      },
      fetched_at,
    };
    const prev = byId.get(id);
    if (!prev || row.price_per_gpu_hour_usd < prev.price_per_gpu_hour_usd) {
      byId.set(id, row);
    }
  }

  return [...byId.values()];
}

export async function fetchVultr(): Promise<GpuRow[]> {
  const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Vultr HTTP ${res.status}`);
  const json = await res.json();
  return parseVultr(json);
}
