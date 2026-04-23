import { Wordmark } from "@/components/Wordmark";
import { AudienceToggle } from "@/components/AudienceToggle";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Compute Grid · for agents",
  description:
    "How to connect agents to Compute Grid: MCP server, JSON snapshot, SSE stream, and the GpuRow schema.",
};

export default function AgentsPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-8 h-16 flex items-center justify-between border-b border-border/60">
        <Wordmark />
        <AudienceToggle />
      </header>

      <main className="flex-1 px-8 py-16">
        <article className="mx-auto w-full max-w-2xl prose-doc">
          <h1>For agents</h1>
          <p className="lede">
            Compute Grid is an open, MCP-native price feed for the GPU spot
            market. Agents can find, compare, and delegate to the cheapest
            available GPU as easily as they list files. Everything below is
            free and unauthenticated.
          </p>

          <h2>Connect via MCP</h2>
          <p>
            One command. No keys, no accounts. Streamable HTTP transport,
            session-less, JSON responses by default.
          </p>
          <pre>
            <code>claude mcp add computegrid https://[host]/mcp</code>
          </pre>
          <p className="muted">
            Replace <code>[host]</code> with your deployment URL. The same
            endpoint works in Cursor, custom Anthropic SDK clients, and any
            MCP-compatible host.
          </p>

          <h2>Tools</h2>

          <h3>
            <code>list_gpus(filters)</code>
          </h3>
          <p>
            Returns matching GPU rows sorted by price ascending. Every filter
            is optional.
          </p>
          <pre>
            <code>{`{
  gpu_model?: string,             // substring match
  provider?: string[],            // e.g. ["runpod", "lambda-labs"]
  tier?: string[],                // ["secure","community","verified",...]
  max_price_per_gpu_hour?: number,
  min_vram_gb?: number,
  available_only?: boolean,       // default true
  region?: string,                // substring match
  limit?: number                  // default 100
}`}</code>
          </pre>

          <h3>
            <code>find_cheapest(input)</code>
          </h3>
          <p>
            One call, full context. Returns the cheapest matching offer plus
            5 alternatives plus market context (median, total available,
            cheapest 24h ago).
          </p>
          <pre>
            <code>{`{
  gpu_model: string,        // required
  gpu_count?: number,       // default 1
  min_vram_gb?: number,
  tier?: string[],
  region?: string
} -> {
  cheapest: GpuRow,
  alternatives: GpuRow[],
  market_context: {
    median_price_per_gpu_hour_usd: number,
    total_available_count: number,
    cheapest_24h_ago: number | null
  }
}`}</code>
          </pre>

          <h2>HTTP endpoints</h2>
          <p>For agents that don&apos;t speak MCP, the same data is open over plain HTTP.</p>
          <ul>
            <li>
              <code>GET /api/snapshot.json</code> — full current snapshot,{" "}
              <code>{`{ fetched_at, rows: GpuRow[] }`}</code>, cached 60s
            </li>
            <li>
              <code>GET /api/stream</code> — Server-Sent Events;{" "}
              <code>snapshot</code> on connect, <code>diff</code> on every
              refresh (~120s)
            </li>
            <li>
              <code>GET /api/health</code> — liveness + last snapshot age
            </li>
            <li>
              <code>GET /llms.txt</code> — agent-discoverable site
              description (per <a href="https://llmstxt.org/">llmstxt.org</a>)
            </li>
          </ul>

          <h2>Schema (GpuRow)</h2>
          <pre>
            <code>{`{
  id: string,                          // stable across refreshes
  provider: string,                    // "runpod", "vast", "lambda-labs", ...
  tier: "secure" | "community" | "verified" | "unverified" | "standard",
  gpu_model: string,                   // canonical: "H100 SXM", "A100 80GB"
  vram_gb: number,                     // per single GPU
  gpu_count: number,                   // 1, 2, 4, 8
  price_per_gpu_hour_usd: number,
  price_per_instance_hour_usd: number,
  available: boolean,
  offer_count: number,                 // > 1 for marketplace dedup groups
  regions: string[],
  metadata: {
    raw_provider_id: string,
    source?: "getdeploying",           // present when sourced via aggregator
    source_url?: string,
    ...                                // provider-specific extras
  },
  fetched_at: string                   // ISO 8601
}`}</code>
          </pre>

          <h2>Data sources</h2>
          <p>
            Three direct integrations refreshed every 120 seconds:
            <strong> RunPod</strong> (GraphQL), <strong>Vast.ai</strong>{" "}
            (REST bundles), <strong>Vultr</strong> (REST plans).
          </p>
          <p>
            Plus 30+ additional providers — Lambda Labs, CoreWeave, AWS,
            GCP, Azure, OVH, Scaleway, Crusoe, Hyperstack, Cudo Compute,
            TensorDock, Paperspace, Fluidstack, and more — sourced via{" "}
            <a
              href="https://getdeploying.com/gpus"
              target="_blank"
              rel="noopener"
            >
              getdeploying.com
            </a>
            , which updates daily upstream. Aggregator-sourced rows are
            tagged <code>metadata.source = &quot;getdeploying&quot;</code>.
          </p>

          <h2>Tier semantics</h2>
          <ul>
            <li>
              <strong>Managed cloud</strong> (<code>secure</code>,{" "}
              <code>standard</code>): listed by managed cloud providers with
              SLAs and support. Higher prices, predictable.
            </li>
            <li>
              <strong>Marketplace</strong> (<code>community</code>,{" "}
              <code>verified</code>, <code>unverified</code>): peer-to-peer
              listings (Vast.ai, RunPod Community). Lower prices, more
              variance, no SLA.
            </li>
          </ul>

          <h2>Example: agent shopping for compute</h2>
          <pre>
            <code>{`agent → find_cheapest({ gpu_model: "H100 SXM", gpu_count: 8 })

→ cheapest:        $1.33/hr/GPU  · Vast.ai Unverified
  alternatives:    5 within +20%
  cloud price:     $2.99/hr/GPU  · RunPod Secure
  market_context:  32 listings, median $2.49, no 24h history yet`}</code>
          </pre>

          <h2>Open and verifiable</h2>
          <p>
            Every row links back to its source. No markup, no platform fee,
            no API key. Source code is on{" "}
            <a
              href="https://github.com/sheraz-ali1/compute-centralization"
              target="_blank"
              rel="noopener"
            >
              GitHub
            </a>
            .
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
