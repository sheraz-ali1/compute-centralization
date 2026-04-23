import { canonicalizeGpuName } from "@/lib/gpu-canonical";
import { perGpuVram } from "@/lib/gpu-vram";
import type { GpuRow } from "@/lib/schema";

// GPU model slugs to fetch from getdeploying.com. The slugs map to URLs
// like https://getdeploying.com/gpus/<slug>. Each page embeds a JSON
// listing array we can parse out.
const GPU_SLUGS: { slug: string; canonical: string }[] = [
  { slug: "nvidia-h100", canonical: "H100 SXM" },
  { slug: "nvidia-h200", canonical: "H200" },
  { slug: "nvidia-b200", canonical: "B200" },
  { slug: "nvidia-a100", canonical: "A100 80GB" },
  { slug: "nvidia-l40s", canonical: "L40S" },
  { slug: "nvidia-rtx-4090", canonical: "RTX 4090" },
];

// Skip listings from providers we already integrate with directly — we
// have richer data (multi-tier, per-offer) for these and don't want to
// double-count.
const DIRECT_PROVIDER_SLUGS = new Set(["runpod", "vast-ai", "vultr"]);

type GdListing = {
  id: number;
  name: string;
  gpu_count: number;
  billing_type: string; // "ON_DEMAND" | "RESERVATION" | etc.
  availability: string; // "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN"
  provider: { slug: string; name: string; short_name?: string };
  gpu: { short_name: string };
  data_vram?: string;
  data_price_per_gpu?: string;
  data_price?: string;
  source_url?: string;
};

/**
 * Walk the HTML extracting the JSON listing objects embedded inline.
 * getdeploying.com server-renders these as raw JSON in the response body.
 */
export function parseGetdeploying(
  html: string,
  canonicalGpu: string,
): GpuRow[] {
  const positions: number[] = [];
  const re = /"data_price_per_gpu"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) positions.push(m.index);

  const fetched_at = new Date().toISOString();
  const rows: GpuRow[] = [];
  const seen = new Set<string>();

  for (const pos of positions) {
    // Walk back to find the nearest `{"id":` then forward, balancing braces.
    const back = html.slice(Math.max(0, pos - 4000), pos);
    const lastIdx = back.lastIndexOf('{"id":');
    if (lastIdx === -1) continue;
    const start = pos - back.length + lastIdx;

    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = start; i < Math.min(html.length, start + 8000); i++) {
      const c = html[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) continue;

    let listing: GdListing;
    try {
      listing = JSON.parse(html.slice(start, end));
    } catch {
      continue;
    }

    const provSlug = listing.provider?.slug;
    if (!provSlug || DIRECT_PROVIDER_SLUGS.has(provSlug)) continue;

    const pricePerGpu = parseFloat(listing.data_price_per_gpu ?? "0");
    if (!Number.isFinite(pricePerGpu) || pricePerGpu <= 0) continue;

    const gpuCount = listing.gpu_count > 0 ? listing.gpu_count : 1;
    const vramRaw = parseInt(listing.data_vram ?? "0", 10);
    const vramGb = vramRaw > 0 ? vramRaw : (perGpuVram(canonicalGpu) ?? 80);
    const billing = listing.billing_type ?? "ON_DEMAND";
    // Only on-demand for v1. Reservations have term commitments, different
    // value prop. Skip them so we're comparing apples-to-apples.
    if (billing !== "ON_DEMAND") continue;

    const available = listing.availability !== "UNAVAILABLE";

    const id = `${provSlug}:${canonicalGpu}:standard:${gpuCount}`;
    if (seen.has(id)) continue;
    seen.add(id);

    rows.push({
      id,
      provider: provSlug,
      tier: "standard",
      gpu_model: canonicalGpu,
      vram_gb: vramGb,
      gpu_count: gpuCount,
      price_per_gpu_hour_usd: pricePerGpu,
      price_per_instance_hour_usd: pricePerGpu * gpuCount,
      available,
      offer_count: 1,
      regions: [],
      metadata: {
        raw_provider_id: String(listing.id),
        provider_name: listing.provider.name,
        listing_name: listing.name,
        source: "getdeploying",
        source_url: listing.source_url ?? "",
      },
      fetched_at,
    });
  }

  // Dedup by id keeping cheapest (some pages list the same provider/SKU
  // twice with slight name variants).
  const dedup = new Map<string, GpuRow>();
  for (const r of rows) {
    const existing = dedup.get(r.id);
    if (
      !existing ||
      r.price_per_gpu_hour_usd < existing.price_per_gpu_hour_usd
    ) {
      dedup.set(r.id, r);
    }
  }
  return [...dedup.values()];
}

async function fetchPage(slug: string, canonical: string): Promise<GpuRow[]> {
  const url = `https://getdeploying.com/gpus/${slug}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "ComputeGrid (open MCP price feed; +https://github.com/sheraz-ali1/compute-centralization)",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`getdeploying ${slug} HTTP ${res.status}`);
  const html = await res.text();
  return parseGetdeploying(html, canonical);
}

export async function fetchGetdeploying(): Promise<GpuRow[]> {
  const all: GpuRow[] = [];
  // Sequential to be a polite scraper neighbor (small delay between pages).
  for (const { slug, canonical } of GPU_SLUGS) {
    try {
      const rows = await fetchPage(slug, canonical);
      all.push(...rows);
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.warn(`getdeploying ${slug} failed:`, e);
    }
  }
  return all;
}
