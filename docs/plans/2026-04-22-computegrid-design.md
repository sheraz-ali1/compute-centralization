# ComputeGrid — Design

**One-line positioning:** Open price feed for the GPU spot market. For agents and the humans they work for.

**Status:** Design approved 2026-04-22, awaiting implementation plan.

## 1. Mission alignment

ComputeGrid is the public, agent-native, real-time analogue of Anjney Midha's internal AMP Grid (the price-aggregation system AMP PBC uses to forecast GPU infrastructure). Where AMP Grid serves portfolio companies with quarterly batch reports, ComputeGrid serves any team or agent with a live feed of cross-provider GPU prices, availability, and market activity.

The thesis it embodies — "all compute must flow" — requires a price/availability oracle. ComputeGrid is layer zero: the read-side primitive that any future allocation layer (marketplaces, dynamic priority pricing) needs to function. It also makes "orphaned compute" — the long tail of community/spot capacity that exists but is invisible to enterprise buyers — visible and addressable.

## 2. Surface contract

Three parallel surfaces, one source of truth:

| Surface | Audience | Endpoint |
|---|---|---|
| Web terminal | Humans browsing the market | `/` |
| MCP server | Agents (Claude, Cursor, custom) | `/mcp` (HTTP/SSE transport) |
| Open JSON | Anyone scraping or integrating | `/api/snapshot.json`, `/api/stream` (SSE), `/llms.txt` |

The web terminal is intentionally short — single screen, no scroll required for the value proposition. Supplementary pages (`/gpus`, `/charts`, `/docs`) live elsewhere.

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 15 app on Railway (single deploy, single process)   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Background refresher (setInterval, 120s)            │    │
│  │  ↳ scrapers/runpod.ts, vast.ts, vultr.ts             │    │
│  │  ↳ normalize → diff against prev snapshot            │    │
│  │  ↳ write snapshot row to Postgres (history)          │    │
│  │  ↳ update in-memory cache                            │    │
│  │  ↳ broadcast diff over SSE to connected clients      │    │
│  └──────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  In-memory cache (Map<string, GpuRow>)               │    │
│  │  + diff buffer (last 100 events) for ticker          │    │
│  └──────────────────────────────────────────────────────┘    │
│                              │                               │
│        ┌─────────────────────┼─────────────────────┐         │
│        ▼                     ▼                     ▼         │
│  /  (terminal)         /mcp endpoint        /api/* (json)    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   Postgres (Railway-managed)
                   ↳ snapshots(provider, gpu_model, tier, …, fetched_at)
                   ↳ retention: 90 days raw, indefinite hourly rollups
```

A single Node process owns the cache, the refresher, and serves all surfaces. No external KV, no separate cron service, no Redis. Restarts cold-start the cache from the most recent Postgres snapshot.

## 4. Stack

- **Next.js 15** (App Router, RSC for the static parts of the terminal)
- **TypeScript**, strict
- **Tailwind CSS** + **shadcn/ui** + **Fluid Functionalism** (`npx shadcn@latest registry add @fluid`)
- **Geist Sans** + **Geist Mono** (built into Next.js)
- **Lucide** icons
- **Recharts** for the depth chart (composable, Tailwind-friendly, light)
- **`@modelcontextprotocol/sdk`** for the MCP server, streamable HTTP transport
- **`postgres`** (porsager/postgres) for DB
- **`zod`** for runtime validation of provider responses
- **Railway** for hosting (Node service + managed Postgres in the same project)

## 5. Data sources (v1)

All three are no-auth.

### 5.1 RunPod

```
POST https://api.runpod.io/graphql
Content-Type: application/json
Body: {"query":"{ gpuTypes { id displayName memoryInGb securePrice communityPrice secureCloud communityCloud } }"}
```

Yields one row per `gpuTypes` entry × tier. `securePrice` and `communityPrice` are USD/hr per single GPU. Tier availability inferred from `secureCloud` / `communityCloud` booleans.

### 5.2 Vast.ai

```
GET https://console.vast.ai/api/v0/bundles/?q={"order":[["dphtotal","asc"]],"type":"on-demand","limit":500,"rentable":{"eq":true}}
```

Returns up to 500 currently-rentable offers with `gpu_name`, `num_gpus`, `dph_base` (total $/hr), `gpu_ram` (MB per GPU), `geolocation`, `verification`, `bw_nvlink`. Dedupe by `(gpu_name, num_gpus, verification)` keeping the cheapest as the headline row, but retain offer count and price distribution for the depth chart and orphaned-lane calculation.

### 5.3 Vultr

```
GET https://api.vultr.com/v2/plans?type=vcg
```

Returns plans with `gpu_type`, `gpu_vram_gb` (total, not per-GPU), `hourly_cost`, `locations[]`. GPU count inferred from total VRAM via lookup table (H100 = 80GB per GPU, A100 = 80GB or 40GB, etc. — explicit table in `lib/gpu-vram-table.ts`). A plan with empty `locations` is currently sold-out across all regions.

### 5.4 Future providers (v2)

Lambda (`/api/v1/instance-types`, requires API key), Fluidstack (page scrape or partner API). Schema is forward-compatible.

## 6. Unified GPU row schema

```ts
type GpuRow = {
  id: string;                       // stable: `${provider}:${gpu_model}:${tier}:${gpu_count}`
  provider: "runpod" | "vast" | "vultr";
  tier: "secure" | "community" | "verified" | "unverified" | "standard";
  gpu_model: string;                // normalized: "H100 SXM", "H100 PCIe", "A100 80GB", etc.
  vram_gb: number;                  // per-GPU
  gpu_count: number;                // 1, 2, 4, 8
  price_per_gpu_hour_usd: number;   // single-GPU equivalent
  price_per_instance_hour_usd: number;
  available: boolean;
  offer_count: number;              // 1 for RunPod/Vultr; many for Vast (deduped row represents N raw offers)
  regions: string[];
  metadata: {
    nvlink?: boolean;
    interconnect?: "PCIe" | "SXM" | "NVLink";
    raw_provider_id: string;
    provider_url?: string;          // deep link to listing
    [key: string]: unknown;
  };
  fetched_at: string;               // ISO8601
};

type Snapshot = {
  fetched_at: string;
  rows: GpuRow[];
  diff_from_previous: SnapshotDiff;
};

type SnapshotDiff = {
  added: GpuRow[];                  // listings new since last snapshot
  removed: GpuRow[];                // listings gone since last snapshot
  repriced: { id: string; from: number; to: number }[];
};
```

### Normalization rules

- `gpu_model` is canonicalized via a static map (`lib/gpu-name-canonical.ts`). `H100`, `H100 SXM5`, `H100 80GB SXM5` → `"H100 SXM"`. `H100 PCIe` and `H100 SXM` are kept separate (interconnect changes performance).
- `price_per_gpu_hour_usd` always reported per single GPU; multi-GPU offers divide their `dph_base`/`hourly_cost` by `gpu_count`.
- `gpu_count` configurations are exploded into separate rows for Vast (1, 2, 4, 8 are common); for RunPod and Vultr, `gpu_count` reflects what the plan offers.

## 7. Refresh pipeline

```
every 120s:
  1. fetch all 3 providers in parallel (httpx-style, 10s timeout each)
  2. parse + validate via zod, log + skip rows that fail
  3. normalize → GpuRow[]
  4. compute diff vs. previous snapshot in cache
  5. write snapshot row to Postgres (full snapshot as jsonb, plus indexed columns for query)
  6. atomically replace cache
  7. broadcast diff to all connected SSE clients
  8. emit metrics (rows_per_provider, fetch_ms, diff_size)
```

Provider failures are isolated: if RunPod times out, Vast and Vultr still update. The previous values for the failed provider are retained (with a `stale: true` flag) until the next successful fetch.

## 8. Snapshot history

Postgres table:

```sql
create table snapshots (
  id bigserial primary key,
  fetched_at timestamptz not null default now(),
  provider text not null,
  rows_count int not null,
  payload jsonb not null,           -- full provider snapshot
  fetch_ms int not null,
  ok boolean not null
);
create index on snapshots (fetched_at desc);
create index on snapshots (provider, fetched_at desc);

create table gpu_prices (
  fetched_at timestamptz not null,
  gpu_model text not null,
  provider text not null,
  tier text not null,
  median_price_per_gpu_hour_usd numeric not null,
  cheapest_price_per_gpu_hour_usd numeric not null,
  available_count int not null
);
create index on gpu_prices (gpu_model, fetched_at desc);
```

`gpu_prices` is the rollup that powers the index 24h-delta and any future `/charts` page. Written at refresh time alongside the raw snapshot. Retention: 90 days raw `snapshots`, indefinite `gpu_prices`.

## 9. MCP server

Transport: streamable HTTP per [MCP spec 2025-03-26](https://spec.modelcontextprotocol.io/), mounted at `/mcp`.

### Tools

```ts
list_gpus({
  gpu_model?: string,           // exact or substring match
  provider?: string[],
  tier?: string[],
  max_price_per_gpu_hour?: number,
  min_vram_gb?: number,
  available_only?: boolean,     // default true
  region?: string,              // substring match
  limit?: number,               // default 100
}): GpuRow[]

find_cheapest({
  gpu_model: string,            // required
  gpu_count?: number,           // default 1
  min_vram_gb?: number,
  tier?: string[],              // default all tiers
  region?: string,
}): {
  cheapest: GpuRow,
  alternatives: GpuRow[],       // next 5 in price order
  market_context: {
    median_price_per_gpu_hour_usd: number,
    total_available_count: number,
    cheapest_24h_ago?: number,
  }
}
```

`find_cheapest` is the high-leverage agent tool: one call, full context to make a decision. The `market_context` block is what makes it more than a database lookup.

### Resources

- `gpu-snapshot://current` — full current snapshot as JSON resource
- `gpu-snapshot://history/{gpu_model}` — last 7 days of price/availability for one model

## 10. Open HTTP API

Three endpoints exposing the same data outside MCP:

```
GET /api/snapshot.json
  → { fetched_at, rows: GpuRow[] }
  → cache-control: public, max-age=60

GET /api/stream
  → text/event-stream, server-sent events
  → emits { type: "diff", added, removed, repriced } every 2 min
  → emits { type: "snapshot", rows } on connect

GET /llms.txt
  → plain text, llmstxt.org convention
  → describes the site, MCP endpoint, JSON endpoint, schema
```

`/llms.txt` makes the site itself agent-readable without MCP — any LLM crawling the page can find the structured surfaces.

## 11. Landing page (`/`)

### Design language

- **Single screen on desktop**, no scroll required for the hero value prop. Supporting content (full table, docs, charts) lives on routes underneath.
- **Dark mode default**, light mode supported. Background `#0a0a0a` / foreground `#e8e8e8` / muted `#666`. Two semantic accents: `--up: #ef4444` (red — price up, sold out), `--down: #22c55e` (green — price down, new supply). No other colors.
- **Geist Sans** for chrome and copy (28px hero, 14px body, 13px UI). **Geist Mono** for all numerical/tabular data (13px), tabular-nums.
- **Generous internal padding**, tight external padding. The page hugs the viewport edges (~24px gutters); sections inside have ~32-40px internal padding. Borders are 1px hairlines `rgba(255,255,255,0.06)` — visible but not loud.
- **Motion = information.** Per Fluid's philosophy: animations only when they convey a real change (a number flashing on update, a row sliding in on a new diff). No decorative hovers, no parallax, no scroll-driven reveals.

### Wordmark

No symbol mark in v1 — wordmark only. The product is a data feed; a logomark would over-brand it.

- **Set:** `computegrid` — all lowercase
- **Face:** Geist Mono, weight 500
- **Tracking:** -0.02em (tight, terminal-precise)
- **Treatment:** the substring `grid` rendered in `--down` green at 80% opacity. So the wordmark reads `compute` in foreground + `grid` in soft green. One color signal, no other ornament. Reads as a single word at a glance, but the green communicates "live · market · grid" without any tagline.
- **Header size:** 14px. **Footer size:** 12px. **OG image / docs cover:** 64px.
- **Favicon:** the lowercase letter `c` rendered in Geist Mono on `#0a0a0a` background, with a 2×2 px green pixel in the top-right corner suggesting "live indicator." 32×32 and 16×16 PNG, plus an SVG.

If a mark is ever added (post-v1, for swag / OG fallback), it should be a 3×3 dot-grid where the bottom-right dot is the green accent — a literal grid, with one cell signaling activity. But default to wordmark-only.

### Sections (top to bottom)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [logo]  ComputeGrid                      [docs] [github] [agent ▾] │  ← 56px header, hairline bottom
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Open price feed for the GPU spot market.                           │  ← H1, Geist 28px, 1.1 line-height
│  For agents and the humans they work for.                           │  ← H2, Geist 18px, muted
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  GPU SPOT INDEX          │  │  ACTIVITY                        │ │  ← section labels, 11px uppercase, mono, muted
│  │  ─────────────────────   │  │  ─────────────────────           │ │
│  │  H100 SXM   $1.89  ↓6.0% │  │  14:23  H100 listed  $1.78  NL  │ │
│  │  H100 PCIe  $1.62  ↓2.4% │  │  14:22  4090 sold-out  US-CA    │ │
│  │  A100 80GB  $1.04  ↑1.9% │  │  14:22  A100 reprice  $1.04→.99 │ │
│  │  L40S       $0.89  ↓8.2% │  │  14:21  B200 new tier  RunPod   │ │
│  │  RTX 4090   $0.34  ↓2.9% │  │  14:21  H100 listed  $1.85  EU  │ │
│  │  B200       $4.20  ↑3.7% │  │  ...                            │ │
│  │                          │  │                                  │ │
│  └──────────────────────────┘  └──────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  DEPTH — H100 SXM                       [GPU model ▾] [tier ▾]  ││
│  │                                                                 ││
│  │  [bar chart, ~120px tall, cumulative supply at price ≤ X]       ││
│  │                                                                 ││
│  │  142 ≤ $2.00 · 280 ≤ $2.50 · 600 ≤ $4.00 · 847 total           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ORPHANED LANE                                                  ││
│  │  Listings ≥ 40% below the secure-tier median for the same GPU.  ││
│  │                                                                 ││
│  │  312 H100s available now at avg $1.92  (vs. enterprise $4.50)   ││
│  │  480 RTX 4090s at $0.31           (vs. retail-cloud $0.89)      ││
│  │  94  L40S at $0.79                (vs. enterprise $1.80)        ││
│  │                                                                 ││
│  │  → browse all orphaned listings                                 ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  AGENT ACCESS                                                   ││
│  │  $ claude mcp add computegrid https://[host]/mcp                ││
│  │  list_gpus(filters)  ·  find_cheapest(model, count, max_price)  ││
│  │  also: GET /api/snapshot.json  ·  GET /llms.txt                 ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  open · public benefit · github.com/...           refreshed 14s ago │  ← 40px footer
└─────────────────────────────────────────────────────────────────────┘
```

Total height target: ≤ 100vh on a 1440×900 desktop. Mobile collapses index/activity to stacked cards but maintains the same five sections.

### Component inventory (Fluid where applicable)

- `Tabs` — `[GPU model ▾] [tier ▾]` selectors above depth chart
- `Dropdown` — agent-access menu in header
- `Tooltip` — on every numerical cell, shows source + last-updated
- `Badge` — for tier labels in tables
- `Table` — for the spot index and orphaned-lane lists
- `InputCopy` — for the `claude mcp add ...` snippet (one-click copy)
- `ThinkingIndicator` — for "refreshed 14s ago / refreshing now" footer state

### Live behavior

- SSE subscription on mount; on each diff:
  - Repriced rows in the index flash subtly (200ms background pulse), then animate to new value
  - Activity ticker prepends new events (max 20 visible), oldest fades out
  - Depth chart re-renders with spring physics on bar heights
- "refreshed 14s ago" footer ticks every second, resets on diff arrival

## 12. Other routes (intentionally underbuilt for v1)

- `/gpus` — searchable, filterable table of every row in the current snapshot. Plain `Table`. No frills.
- `/docs` — MCP tool reference, JSON schema, llms.txt explanation. Single page, mono-typeset.
- `/charts` — *v2.* Time-series plots once snapshot history is meaningful.

No `/about`, no `/pricing`, no `/blog`. The product is the data; the data has its own pages.

## 13. SEO and agent-readability

- `<title>`: `ComputeGrid — open price feed for the GPU spot market`
- Meta description: same as positioning line
- Schema.org `Dataset` JSON-LD on `/`, `Offer` JSON-LD on `/gpus`
- `/llms.txt` at root, listing `/api/snapshot.json`, `/mcp`, `/docs/schema`
- `robots.txt` allows everything
- OG image: terminal screenshot (auto-generated nightly via `@vercel/og` or Playwright)

## 14. Deploy

- **Railway project** with two services:
  - `web` — Node 22, `pnpm build && pnpm start`, public on `*.up.railway.app` initially (custom domain TBD)
  - `db` — Railway-managed Postgres, internal network only
- Single env file. Secrets: `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL`. No provider API keys in v1.
- GitHub → Railway auto-deploy on `main`.
- Health check: `GET /api/health` returns `{ ok: true, last_snapshot_age_s }`.
- Estimated cost: ~$5-10/mo (web service + small Postgres).

## 15. v2+ roadmap (out of scope for v1)

- Lambda + Fluidstack scrapers (require keys / scraping; gated on user-supplied creds)
- `/charts` route — historical price/availability time series
- Per-GPU `/gpus/[id]` deep pages with full history
- Webhook/email alerts for price thresholds
- Provisioning (write-side) — actually rent through ComputeGrid as a broker
- Dynamic priority allocation (the "Ethereum-fee-inspired" layer)

## 16. Success criteria (sprint contract for v1)

- [ ] `/` renders the full terminal layout on desktop within 100vh, with live data from all three providers
- [ ] Snapshots refresh every 120s without dropping the cache; provider failures isolated
- [ ] Snapshot history accumulates in Postgres; index column shows real 24h deltas after first 24h
- [ ] MCP server reachable at `/mcp` from Claude Code and Claude Desktop; `find_cheapest` returns within 200ms p95
- [ ] `/api/snapshot.json` and `/api/stream` work without auth; `/llms.txt` valid per llmstxt.org
- [ ] Orphaned-lane counts match a manual cross-check against the live snapshot
- [ ] Lighthouse score ≥ 95 on `/`; no layout shift after data load
- [ ] Deployed publicly on Railway with a working domain
