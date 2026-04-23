import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Behind a proxy (Railway, Vercel, etc.) `req.url` is the upstream
  // localhost:8080 URL. Honor x-forwarded-host/proto so links resolve
  // to the public hostname.
  const headers = req.headers;
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  const forwardedProto = headers.get("x-forwarded-proto") ?? "https";
  const base = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(req.url).origin;
  const body = `# ComputeGrid

Open price feed for the GPU spot market. Aggregates RunPod, Vast.ai, Vultr,
and 30+ additional providers via getdeploying.com.

## Endpoints

- MCP server: ${base}/mcp (streamable HTTP)
- Snapshot JSON: ${base}/api/snapshot.json
- Live stream (SSE): ${base}/api/stream
- Recent events: ${base}/api/events
- Health: ${base}/api/health

## MCP tools

- list_gpus(gpu_model?, provider?, tier?, max_price_per_gpu_hour?, min_vram_gb?, available_only?, region?, limit?) -> GpuRow[]
- find_cheapest(gpu_model, gpu_count?, min_vram_gb?, tier?, region?) -> { cheapest, alternatives, market_context }

## Schema (GpuRow)

{
  id, provider, tier, gpu_model, vram_gb, gpu_count,
  price_per_gpu_hour_usd, price_per_instance_hour_usd,
  available, offer_count, regions, metadata, fetched_at
}

## License

Open. Free to use. Public benefit.
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...PUBLIC_CORS_HEADERS,
    },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
