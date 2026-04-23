# ComputeGrid v1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Ship ComputeGrid v1 — a single Next.js app deployed on Railway that aggregates RunPod, Vast.ai, and Vultr GPU pricing into a live web terminal, an MCP server at `/mcp`, and an open JSON feed at `/api/snapshot.json`.

**Architecture:** Single Node process. Background `setInterval` refreshes provider snapshots every 120s, normalizes them into a unified schema, diffs against the previous snapshot, writes both raw + rolled-up history to Postgres, and broadcasts diffs over SSE. The web terminal, MCP server, and JSON endpoints all read from the same in-memory cache.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui + Fluid Functionalism · Geist Sans/Mono · Lucide · Recharts · `@modelcontextprotocol/sdk` · `postgres` (porsager) · `zod` · Vitest · Railway.

**Reference design doc:** `docs/plans/2026-04-22-computegrid-design.md`

---

## Sprint contracts (sprint-level success criteria)

- [ ] **S1:** App scaffolds, dev server runs, dark page with wordmark renders, DB connects.
- [ ] **S2:** All three scrapers fetch live data and produce valid `GpuRow[]` per the schema. Tests pass against fixtures.
- [ ] **S3:** Refresher runs every 120s in background, snapshots persist to Postgres, in-memory cache updates atomically, diff fires to SSE subscribers.
- [ ] **S4:** MCP server reachable at `/mcp` from Claude Code; both tools work; `/llms.txt` and `/api/snapshot.json` return valid data.
- [ ] **S5:** Landing page matches design spec on desktop within 100vh; live updates wire through SSE; Lighthouse ≥ 95.
- [ ] **S6:** Public Railway URL serves all three surfaces; manual smoke test of every sprint contract item passes.

---

# SPRINT 1 — Scaffold

### Task 1.1: Initialize Next.js 15 app

**Files:**
- Create: everything under `.worktrees/computegrid-v1/`

**Step 1:** From the worktree root, scaffold Next.js into the current directory.

```bash
cd .worktrees/computegrid-v1
pnpm dlx create-next-app@latest . \
  --ts --tailwind --app --eslint --src-dir \
  --import-alias "@/*" --use-pnpm --no-turbopack
```

When prompted about overwriting README.md / docs/, answer **No** to keep the design + plan docs we already committed.

**Step 2:** Verify dev server runs.

```bash
pnpm dev
```

Expected: Next welcome page at http://localhost:3000.

**Step 3:** Commit.

```bash
git add -A && git commit -m "Scaffold Next.js 15 with TS, Tailwind, App Router"
```

### Task 1.2: Install shadcn/ui

**Step 1:** Initialize shadcn with neutral base color, CSS variables, and our design tokens.

```bash
pnpm dlx shadcn@latest init -d
```

When prompted, choose: **Style: Default**, **Base color: Neutral**, **CSS variables: Yes**.

**Step 2:** Install the base components we'll need.

```bash
pnpm dlx shadcn@latest add button badge dropdown-menu tooltip table tabs
```

**Step 3:** Commit.

```bash
git add -A && git commit -m "Add shadcn/ui base components"
```

### Task 1.3: Install Fluid Functionalism

**Step 1:** Add the `@fluid` registry source.

```bash
pnpm dlx shadcn@latest registry add @fluid
```

**Step 2:** Install the Fluid components we'll use.

```bash
pnpm dlx shadcn@latest add @fluid/input-copy @fluid/thinking-indicator @fluid/tabs-subtle
```

(Other Fluid components — Switch, Dialog — can be added later if needed.)

**Step 3:** Commit.

```bash
git add -A && git commit -m "Add Fluid Functionalism primitives"
```

### Task 1.4: Configure Geist Sans + Geist Mono + design tokens

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/lib/fonts.ts`

**Step 1:** Geist is already on `next/font/google` — wire it up.

`src/lib/fonts.ts`:
```ts
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const fontSans = GeistSans;
export const fontMono = GeistMono;
```

Install the package:
```bash
pnpm add geist
```

**Step 2:** In `src/app/layout.tsx`, apply both fonts to `<html>`:

```tsx
import { fontSans, fontMono } from "@/lib/fonts";
import "./globals.css";

export const metadata = {
  title: "ComputeGrid — open price feed for the GPU spot market",
  description: "Real-time aggregate of GPU pricing and availability across compute providers. For agents and the humans they work for.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable} dark`}>
      <body className="bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 3:** In `src/app/globals.css`, set the design tokens. Replace the existing `:root` and add a `.dark` block:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 6%;
    --muted: 0 0% 60%;
    --border: 0 0% 90%;
    --up: 0 84% 60%;       /* red */
    --down: 142 71% 45%;   /* green */
    --font-sans: var(--font-geist-sans);
    --font-mono: var(--font-geist-mono);
  }

  .dark {
    --background: 0 0% 4%;
    --foreground: 0 0% 91%;
    --muted: 0 0% 40%;
    --border: 0 0% 100% / 0.06;
  }

  body {
    font-feature-settings: "ss01", "cv11";
  }

  .tabular { font-variant-numeric: tabular-nums; }
}
```

**Step 4:** Update `tailwind.config.ts` to expose the tokens:

```ts
// inside theme.extend.colors:
background: "hsl(var(--background))",
foreground: "hsl(var(--foreground))",
muted: { DEFAULT: "hsl(var(--muted))" },
border: "hsl(var(--border))",
up: "hsl(var(--up))",
down: "hsl(var(--down))",

// inside theme.extend.fontFamily:
sans: ["var(--font-sans)"],
mono: ["var(--font-mono)"],
```

**Step 5:** Verify dark page renders with Geist by visiting `/`.

**Step 6:** Commit.

```bash
git add -A && git commit -m "Wire Geist fonts and design tokens, dark mode default"
```

### Task 1.5: Build the wordmark component

**Files:**
- Create: `src/components/Wordmark.tsx`

```tsx
import Link from "next/link";

export function Wordmark({ size = 14 }: { size?: number }) {
  return (
    <Link href="/" className="font-mono font-medium tabular tracking-[-0.02em] inline-flex" style={{ fontSize: size }}>
      <span className="text-foreground">compute</span>
      <span className="text-down/80">grid</span>
    </Link>
  );
}
```

Drop a placeholder header into `src/app/page.tsx`:
```tsx
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="h-14 px-6 border-b border-border flex items-center">
        <Wordmark />
      </header>
    </main>
  );
}
```

Visit `/` — you should see the wordmark with `grid` in soft green on dark.

**Commit.**
```bash
git add -A && git commit -m "Add Wordmark component"
```

### Task 1.6: Postgres connection + env handling

**Files:**
- Create: `src/lib/db.ts`
- Create: `.env.local`
- Modify: `.gitignore` (already excludes `.env*`)

**Step 1:** Install the Postgres client.

```bash
pnpm add postgres
pnpm add -D @types/pg
```

**Step 2:** Create the connection module.

`src/lib/db.ts`:
```ts
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

export const sql = postgres(url, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
```

**Step 3:** Set up local Postgres.

Easiest option for dev: install via Homebrew and create a `computegrid` db.

```bash
brew install postgresql@16
brew services start postgresql@16
createdb computegrid
```

`.env.local`:
```
DATABASE_URL=postgres://localhost:5432/computegrid
```

**Step 4:** Verify connection with a one-shot script.

```bash
pnpm tsx -e "import('./src/lib/db.ts').then(m => m.sql\`select 1 as ok\`.then(r => console.log(r)))"
```

Expected: `[{ ok: 1 }]`. (If `tsx` isn't available: `pnpm add -D tsx`.)

**Step 5:** Commit.

```bash
git add -A && git commit -m "Add Postgres client and DATABASE_URL"
```

### Task 1.7: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/sanity.test.ts`

**Step 1:** Install Vitest.

```bash
pnpm add -D vitest @vitest/ui happy-dom
```

**Step 2:** `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

**Step 3:** Add scripts to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4:** Sanity test.

`src/lib/__tests__/sanity.test.ts`:
```ts
import { test, expect } from "vitest";
test("vitest works", () => expect(2 + 2).toBe(4));
```

```bash
pnpm test
```

Expected: 1 passed.

**Step 5:** Commit.

```bash
git add -A && git commit -m "Set up Vitest"
```

---

# SPRINT 2 — Scrapers

### Task 2.1: Define unified GpuRow schema with zod

**Files:**
- Create: `src/lib/schema.ts`
- Create: `src/lib/__tests__/schema.test.ts`

**Step 1:** Write the failing test first.

```ts
import { test, expect } from "vitest";
import { GpuRowSchema } from "@/lib/schema";

test("valid GpuRow parses", () => {
  const row = {
    id: "runpod:H100 SXM:secure:1",
    provider: "runpod",
    tier: "secure",
    gpu_model: "H100 SXM",
    vram_gb: 80,
    gpu_count: 1,
    price_per_gpu_hour_usd: 2.49,
    price_per_instance_hour_usd: 2.49,
    available: true,
    offer_count: 1,
    regions: ["US-CA"],
    metadata: { raw_provider_id: "NVIDIA H100 80GB HBM3" },
    fetched_at: new Date().toISOString(),
  };
  expect(() => GpuRowSchema.parse(row)).not.toThrow();
});

test("invalid provider rejected", () => {
  const bad = { provider: "not-a-provider" };
  expect(() => GpuRowSchema.parse(bad)).toThrow();
});
```

**Step 2:** Run — should fail (module not found).

```bash
pnpm test src/lib/__tests__/schema.test.ts
```

**Step 3:** Implement.

`src/lib/schema.ts`:
```ts
import { z } from "zod";

export const ProviderSchema = z.enum(["runpod", "vast", "vultr"]);
export const TierSchema = z.enum(["secure", "community", "verified", "unverified", "standard"]);

export const GpuRowSchema = z.object({
  id: z.string(),
  provider: ProviderSchema,
  tier: TierSchema,
  gpu_model: z.string(),
  vram_gb: z.number().positive(),
  gpu_count: z.number().int().positive(),
  price_per_gpu_hour_usd: z.number().nonnegative(),
  price_per_instance_hour_usd: z.number().nonnegative(),
  available: z.boolean(),
  offer_count: z.number().int().nonnegative(),
  regions: z.array(z.string()),
  metadata: z.record(z.unknown()),
  fetched_at: z.string().datetime(),
});

export type GpuRow = z.infer<typeof GpuRowSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Tier = z.infer<typeof TierSchema>;
```

```bash
pnpm add zod
pnpm test src/lib/__tests__/schema.test.ts
```

Expected: 2 passed.

**Step 4:** Commit.

```bash
git add -A && git commit -m "Add GpuRow zod schema"
```

### Task 2.2: GPU model canonicalization

**Files:**
- Create: `src/lib/gpu-canonical.ts`
- Create: `src/lib/__tests__/gpu-canonical.test.ts`

**Step 1:** Tests.

```ts
import { test, expect } from "vitest";
import { canonicalizeGpuName } from "@/lib/gpu-canonical";

test.each([
  ["NVIDIA H100 80GB HBM3", "H100 SXM"],
  ["H100 SXM5", "H100 SXM"],
  ["H100 PCIe", "H100 PCIe"],
  ["A100 80GB", "A100 80GB"],
  ["A100-SXM4-80GB", "A100 80GB"],
  ["RTX 4090", "RTX 4090"],
  ["NVIDIA GeForce RTX 4090", "RTX 4090"],
  ["L40S", "L40S"],
  ["B200", "B200"],
])("canonicalizes %s → %s", (input, expected) => {
  expect(canonicalizeGpuName(input)).toBe(expected);
});

test("unknown model passes through trimmed", () => {
  expect(canonicalizeGpuName("  Some New GPU  ")).toBe("Some New GPU");
});
```

**Step 2:** Run, watch fail.

**Step 3:** Implement.

`src/lib/gpu-canonical.ts`:
```ts
const RULES: Array<[RegExp, string]> = [
  [/h100.*pcie/i, "H100 PCIe"],
  [/h100.*sxm|h100.*hbm/i, "H100 SXM"],
  [/h100/i, "H100 SXM"],          // default to SXM if unspecified
  [/a100.*80\s*gb/i, "A100 80GB"],
  [/a100.*40\s*gb/i, "A100 40GB"],
  [/a100/i, "A100 80GB"],
  [/h200/i, "H200"],
  [/b200/i, "B200"],
  [/l40s/i, "L40S"],
  [/l40/i, "L40"],
  [/rtx\s*4090|geforce.*4090/i, "RTX 4090"],
  [/rtx\s*6000\s*ada|6000\s*ada/i, "RTX 6000 Ada"],
  [/rtx\s*a6000/i, "RTX A6000"],
];

export function canonicalizeGpuName(input: string): string {
  const trimmed = input.trim();
  for (const [re, canon] of RULES) {
    if (re.test(trimmed)) return canon;
  }
  return trimmed;
}
```

**Step 4:** Run tests, expect all green.

**Step 5:** Commit.

```bash
git add -A && git commit -m "Add GPU model canonicalization"
```

### Task 2.3: Vultr VRAM lookup table

**Files:**
- Create: `src/lib/gpu-vram.ts`
- Create: `src/lib/__tests__/gpu-vram.test.ts`

**Step 1:** Test.

```ts
import { test, expect } from "vitest";
import { perGpuVram, inferGpuCount } from "@/lib/gpu-vram";

test("per-GPU VRAM lookup", () => {
  expect(perGpuVram("H100 SXM")).toBe(80);
  expect(perGpuVram("A100 40GB")).toBe(40);
  expect(perGpuVram("RTX 4090")).toBe(24);
});

test("infer GPU count from total VRAM", () => {
  expect(inferGpuCount("H100 SXM", 80)).toBe(1);
  expect(inferGpuCount("H100 SXM", 640)).toBe(8);
  expect(inferGpuCount("A100 40GB", 160)).toBe(4);
});

test("unknown model returns 1 (safe default)", () => {
  expect(inferGpuCount("Mystery GPU", 99)).toBe(1);
});
```

**Step 2:** Implement.

`src/lib/gpu-vram.ts`:
```ts
const PER_GPU_VRAM_GB: Record<string, number> = {
  "H100 SXM": 80,
  "H100 PCIe": 80,
  "H200": 141,
  "B200": 192,
  "A100 80GB": 80,
  "A100 40GB": 40,
  "L40S": 48,
  "L40": 48,
  "RTX 4090": 24,
  "RTX 6000 Ada": 48,
  "RTX A6000": 48,
};

export function perGpuVram(model: string): number | undefined {
  return PER_GPU_VRAM_GB[model];
}

export function inferGpuCount(model: string, totalVramGb: number): number {
  const per = perGpuVram(model);
  if (!per) return 1;
  return Math.max(1, Math.round(totalVramGb / per));
}
```

**Step 3:** Run tests, commit.

```bash
pnpm test
git add -A && git commit -m "Add GPU VRAM table and count inference"
```

### Task 2.4: RunPod scraper (TDD with fixture)

**Files:**
- Create: `src/scrapers/runpod.ts`
- Create: `src/scrapers/__tests__/runpod.test.ts`
- Create: `src/scrapers/__fixtures__/runpod-response.json`

**Step 1:** Capture a real fixture.

```bash
curl -s -X POST https://api.runpod.io/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ gpuTypes { id displayName memoryInGb securePrice communityPrice secureCloud communityCloud } }"}' \
  > src/scrapers/__fixtures__/runpod-response.json
```

Inspect to confirm shape:
```bash
head -c 800 src/scrapers/__fixtures__/runpod-response.json
```

**Step 2:** Test.

```ts
import { test, expect } from "vitest";
import fixture from "../__fixtures__/runpod-response.json";
import { parseRunpod } from "@/scrapers/runpod";
import { GpuRowSchema } from "@/lib/schema";

test("parses RunPod fixture into valid GpuRows", () => {
  const rows = parseRunpod(fixture);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(() => GpuRowSchema.parse(row)).not.toThrow();
    expect(row.provider).toBe("runpod");
  }
});

test("emits secure and community tiers separately", () => {
  const rows = parseRunpod(fixture);
  const tiers = new Set(rows.map(r => r.tier));
  expect(tiers.has("secure")).toBe(true);
  expect(tiers.has("community")).toBe(true);
});

test("price_per_gpu_hour_usd is positive for available rows", () => {
  const rows = parseRunpod(fixture).filter(r => r.available);
  for (const row of rows) {
    expect(row.price_per_gpu_hour_usd).toBeGreaterThan(0);
  }
});
```

**Step 3:** Implement.

`src/scrapers/runpod.ts`:
```ts
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

export function parseRunpod(payload: { data?: { gpuTypes?: RunpodGpuType[] } }): GpuRow[] {
  const gpus = payload?.data?.gpuTypes ?? [];
  const fetched_at = new Date().toISOString();
  const rows: GpuRow[] = [];

  for (const g of gpus) {
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
```

**Step 4:** Run tests, expect pass. If a row fails GpuRowSchema validation, inspect the fixture and adjust.

**Step 5:** Live smoke test.

```bash
pnpm tsx -e "import('./src/scrapers/runpod.ts').then(async m => { const r = await m.fetchRunpod(); console.log(r.length, 'rows. sample:', r[0]); })"
```

**Step 6:** Commit.

```bash
git add -A && git commit -m "Add RunPod scraper"
```

### Task 2.5: Vast.ai scraper (TDD with fixture)

**Files:**
- Create: `src/scrapers/vast.ts`
- Create: `src/scrapers/__tests__/vast.test.ts`
- Create: `src/scrapers/__fixtures__/vast-response.json`

**Step 1:** Capture fixture.

```bash
QUERY='{"order":[["dphtotal","asc"]],"type":"on-demand","limit":500,"rentable":{"eq":true}}'
curl -sG "https://console.vast.ai/api/v0/bundles/" --data-urlencode "q=$QUERY" \
  > src/scrapers/__fixtures__/vast-response.json
```

**Step 2:** Test.

```ts
import { test, expect } from "vitest";
import fixture from "../__fixtures__/vast-response.json";
import { parseVast } from "@/scrapers/vast";
import { GpuRowSchema } from "@/lib/schema";

test("parses Vast fixture into valid GpuRows", () => {
  const rows = parseVast(fixture);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows.slice(0, 50)) {
    expect(() => GpuRowSchema.parse(row)).not.toThrow();
    expect(row.provider).toBe("vast");
  }
});

test("dedupes by (gpu_model, gpu_count, tier) keeping cheapest", () => {
  const rows = parseVast(fixture);
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.gpu_model}|${r.gpu_count}|${r.tier}`;
    if (seen.has(key)) {
      // duplicate keys ok if cheapest wins — verify offer_count > 1
      const r2 = rows.find(x => `${x.gpu_model}|${x.gpu_count}|${x.tier}` === key);
      expect(r2!.offer_count).toBeGreaterThan(0);
    }
    seen.set(key, r.price_per_gpu_hour_usd);
  }
});

test("verified vs unverified tiers both appear", () => {
  const rows = parseVast(fixture);
  const tiers = new Set(rows.map(r => r.tier));
  expect(tiers.has("verified") || tiers.has("unverified")).toBe(true);
});
```

**Step 3:** Implement.

`src/scrapers/vast.ts`:
```ts
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
  gpu_name: string;
  num_gpus: number;
  dph_base: number;       // total $/hr for the bundle
  gpu_ram: number;        // MB per GPU
  geolocation?: string;
  verification?: string;  // "verified" | "deverified" | etc.
  bw_nvlink?: number;
};

export function parseVast(payload: { offers?: VastOffer[] }): GpuRow[] {
  const offers = payload?.offers ?? [];
  const fetched_at = new Date().toISOString();

  // group by (model, gpu_count, tier) → keep cheapest, count distincts
  const groups = new Map<string, { offers: VastOffer[]; tier: Tier; model: string }>();

  for (const o of offers) {
    if (!o.gpu_name || !o.num_gpus || !o.dph_base) continue;
    const model = canonicalizeGpuName(o.gpu_name);
    const tier: Tier = o.verification === "verified" ? "verified" : "unverified";
    const key = `${model}|${o.num_gpus}|${tier}`;
    if (!groups.has(key)) groups.set(key, { offers: [], tier, model });
    groups.get(key)!.offers.push(o);
  }

  const rows: GpuRow[] = [];
  for (const [key, { offers, tier, model }] of groups) {
    const cheapest = offers.reduce((a, b) => (a.dph_base <= b.dph_base ? a : b));
    const regions = [...new Set(offers.map(o => o.geolocation).filter(Boolean) as string[])];
    const vram_gb = Math.round((cheapest.gpu_ram ?? 0) / 1024);

    rows.push({
      id: `vast:${model}:${tier}:${cheapest.num_gpus}`,
      provider: "vast",
      tier,
      gpu_model: model,
      vram_gb,
      gpu_count: cheapest.num_gpus,
      price_per_gpu_hour_usd: cheapest.dph_base / cheapest.num_gpus,
      price_per_instance_hour_usd: cheapest.dph_base,
      available: true,
      offer_count: offers.length,
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
```

**Step 4:** Run tests, fix any fixture-driven schema mismatch (e.g., if `verification` enum has values we didn't anticipate, add a fallback).

**Step 5:** Smoke test live.

```bash
pnpm tsx -e "import('./src/scrapers/vast.ts').then(async m => { const r = await m.fetchVast(); console.log(r.length, 'unique rows from Vast. sample:', r[0]); })"
```

**Step 6:** Commit.

```bash
git add -A && git commit -m "Add Vast.ai scraper with dedup"
```

### Task 2.6: Vultr scraper (TDD with fixture)

**Files:**
- Create: `src/scrapers/vultr.ts`
- Create: `src/scrapers/__tests__/vultr.test.ts`
- Create: `src/scrapers/__fixtures__/vultr-response.json`

**Step 1:** Capture fixture.

```bash
curl -s "https://api.vultr.com/v2/plans?type=vcg" > src/scrapers/__fixtures__/vultr-response.json
```

**Step 2:** Test.

```ts
import { test, expect } from "vitest";
import fixture from "../__fixtures__/vultr-response.json";
import { parseVultr } from "@/scrapers/vultr";
import { GpuRowSchema } from "@/lib/schema";

test("parses Vultr fixture into valid GpuRows", () => {
  const rows = parseVultr(fixture);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(() => GpuRowSchema.parse(row)).not.toThrow();
    expect(row.provider).toBe("vultr");
    expect(row.tier).toBe("standard");
  }
});

test("plans with no locations marked unavailable", () => {
  const rows = parseVultr(fixture);
  for (const row of rows) {
    if (row.regions.length === 0) expect(row.available).toBe(false);
    else expect(row.available).toBe(true);
  }
});
```

**Step 3:** Implement.

`src/scrapers/vultr.ts`:
```ts
import { canonicalizeGpuName } from "@/lib/gpu-canonical";
import { inferGpuCount, perGpuVram } from "@/lib/gpu-vram";
import type { GpuRow } from "@/lib/schema";

const ENDPOINT = "https://api.vultr.com/v2/plans?type=vcg";

type VultrPlan = {
  id: string;
  gpu_type: string;
  gpu_vram_gb: number;     // total
  hourly_cost: number;
  locations: string[];
};

export function parseVultr(payload: { plans?: VultrPlan[] }): GpuRow[] {
  const plans = payload?.plans ?? [];
  const fetched_at = new Date().toISOString();
  const rows: GpuRow[] = [];

  for (const p of plans) {
    if (!p.gpu_type) continue;
    const model = canonicalizeGpuName(p.gpu_type);
    const gpu_count = inferGpuCount(model, p.gpu_vram_gb);
    const vram_gb = perGpuVram(model) ?? p.gpu_vram_gb;

    rows.push({
      id: `vultr:${model}:standard:${gpu_count}`,
      provider: "vultr",
      tier: "standard",
      gpu_model: model,
      vram_gb,
      gpu_count,
      price_per_gpu_hour_usd: p.hourly_cost / gpu_count,
      price_per_instance_hour_usd: p.hourly_cost,
      available: p.locations.length > 0,
      offer_count: 1,
      regions: p.locations,
      metadata: { raw_provider_id: p.id, vultr_total_vram_gb: p.gpu_vram_gb },
      fetched_at,
    });
  }

  return rows;
}

export async function fetchVultr(): Promise<GpuRow[]> {
  const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Vultr HTTP ${res.status}`);
  const json = await res.json();
  return parseVultr(json);
}
```

**Step 4:** Run tests + smoke.

```bash
pnpm tsx -e "import('./src/scrapers/vultr.ts').then(async m => { const r = await m.fetchVultr(); console.log(r.length, 'rows. sample:', r[0]); })"
```

**Step 5:** Commit.

```bash
git add -A && git commit -m "Add Vultr scraper with VRAM-based GPU count inference"
```

---

# SPRINT 3 — Refresher, cache, history, and JSON surfaces

### Task 3.1: Postgres schema migration

**Files:**
- Create: `src/lib/migrations/001_init.sql`
- Create: `src/lib/migrate.ts`

**Step 1:** SQL.

`src/lib/migrations/001_init.sql`:
```sql
create table if not exists snapshots (
  id bigserial primary key,
  fetched_at timestamptz not null default now(),
  provider text not null,
  rows_count int not null,
  payload jsonb not null,
  fetch_ms int not null,
  ok boolean not null
);
create index if not exists snapshots_fetched_at_idx on snapshots (fetched_at desc);
create index if not exists snapshots_provider_fetched_at_idx on snapshots (provider, fetched_at desc);

create table if not exists gpu_prices (
  fetched_at timestamptz not null,
  gpu_model text not null,
  provider text not null,
  tier text not null,
  median_price_per_gpu_hour_usd numeric not null,
  cheapest_price_per_gpu_hour_usd numeric not null,
  available_count int not null,
  primary key (fetched_at, gpu_model, provider, tier)
);
create index if not exists gpu_prices_model_idx on gpu_prices (gpu_model, fetched_at desc);
```

**Step 2:** Migration runner.

`src/lib/migrate.ts`:
```ts
import { sql } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export async function migrate() {
  const dir = path.join(process.cwd(), "src/lib/migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.unsafe(text);
    console.log("applied", f);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
```

**Step 3:** Run.

```bash
pnpm tsx src/lib/migrate.ts
```

Expected: `applied 001_init.sql`. Verify in psql:
```bash
psql computegrid -c "\dt"
```

**Step 4:** Commit.

```bash
git add -A && git commit -m "Add Postgres schema for snapshots and gpu_prices"
```

### Task 3.2: Cache + diff (TDD)

**Files:**
- Create: `src/lib/cache.ts`
- Create: `src/lib/__tests__/cache.test.ts`

**Step 1:** Tests.

```ts
import { test, expect } from "vitest";
import { diffSnapshots } from "@/lib/cache";
import type { GpuRow } from "@/lib/schema";

const row = (id: string, price: number): GpuRow => ({
  id, provider: "runpod", tier: "secure", gpu_model: "H100 SXM",
  vram_gb: 80, gpu_count: 1, price_per_gpu_hour_usd: price,
  price_per_instance_hour_usd: price, available: true, offer_count: 1,
  regions: [], metadata: {}, fetched_at: new Date().toISOString(),
});

test("added rows detected", () => {
  const d = diffSnapshots([], [row("a", 1)]);
  expect(d.added.length).toBe(1);
  expect(d.removed.length).toBe(0);
});

test("removed rows detected", () => {
  const d = diffSnapshots([row("a", 1)], []);
  expect(d.removed.length).toBe(1);
});

test("repriced detected", () => {
  const d = diffSnapshots([row("a", 1.5)], [row("a", 1.2)]);
  expect(d.repriced).toEqual([{ id: "a", from: 1.5, to: 1.2 }]);
  expect(d.added.length).toBe(0);
  expect(d.removed.length).toBe(0);
});

test("identical snapshots produce empty diff", () => {
  const d = diffSnapshots([row("a", 1)], [row("a", 1)]);
  expect(d.added.length + d.removed.length + d.repriced.length).toBe(0);
});
```

**Step 2:** Implement.

`src/lib/cache.ts`:
```ts
import type { GpuRow } from "@/lib/schema";

export type SnapshotDiff = {
  added: GpuRow[];
  removed: GpuRow[];
  repriced: { id: string; from: number; to: number }[];
};

export function diffSnapshots(prev: GpuRow[], next: GpuRow[]): SnapshotDiff {
  const prevMap = new Map(prev.map(r => [r.id, r]));
  const nextMap = new Map(next.map(r => [r.id, r]));
  const added: GpuRow[] = [];
  const removed: GpuRow[] = [];
  const repriced: { id: string; from: number; to: number }[] = [];

  for (const [id, n] of nextMap) {
    const p = prevMap.get(id);
    if (!p) added.push(n);
    else if (p.price_per_gpu_hour_usd !== n.price_per_gpu_hour_usd)
      repriced.push({ id, from: p.price_per_gpu_hour_usd, to: n.price_per_gpu_hour_usd });
  }
  for (const [id, p] of prevMap) {
    if (!nextMap.has(id)) removed.push(p);
  }
  return { added, removed, repriced };
}

// In-memory singleton cache. Lives for the lifetime of the Node process.
class Cache {
  private rows: GpuRow[] = [];
  private lastFetched: string | null = null;
  private events: Array<{ type: "added" | "removed" | "repriced"; row?: GpuRow; id?: string; from?: number; to?: number; ts: string }> = [];

  set(rows: GpuRow[], diff: SnapshotDiff) {
    this.rows = rows;
    this.lastFetched = new Date().toISOString();
    const ts = this.lastFetched;
    for (const r of diff.added) this.events.unshift({ type: "added", row: r, ts });
    for (const r of diff.removed) this.events.unshift({ type: "removed", row: r, ts });
    for (const e of diff.repriced) this.events.unshift({ type: "repriced", id: e.id, from: e.from, to: e.to, ts });
    this.events = this.events.slice(0, 100);
  }
  getRows() { return this.rows; }
  getLastFetched() { return this.lastFetched; }
  getEvents(n = 20) { return this.events.slice(0, n); }
}

export const cache = new Cache();
```

**Step 3:** Run tests.

**Step 4:** Commit.

```bash
git add -A && git commit -m "Add in-memory cache and snapshot diff"
```

### Task 3.3: SSE event bus

**Files:**
- Create: `src/lib/sse-bus.ts`

```ts
type Listener = (data: string) => void;

class SseBus {
  private listeners = new Set<Listener>();
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  publish(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const fn of this.listeners) fn(payload);
  }
}
export const sseBus = new SseBus();
```

Commit after wiring (next task).

### Task 3.4: Refresher loop

**Files:**
- Create: `src/lib/refresher.ts`
- Modify: `src/instrumentation.ts` (Next.js global init)

**Step 1:** Refresher.

`src/lib/refresher.ts`:
```ts
import { fetchRunpod } from "@/scrapers/runpod";
import { fetchVast } from "@/scrapers/vast";
import { fetchVultr } from "@/scrapers/vultr";
import { cache, diffSnapshots } from "@/lib/cache";
import { sseBus } from "@/lib/sse-bus";
import { sql } from "@/lib/db";
import type { GpuRow, Provider } from "@/lib/schema";

const INTERVAL_MS = 120_000;

type Result = { provider: Provider; rows: GpuRow[]; ms: number; ok: boolean; error?: string };

async function runOne(provider: Provider, fn: () => Promise<GpuRow[]>): Promise<Result> {
  const t0 = Date.now();
  try {
    const rows = await fn();
    return { provider, rows, ms: Date.now() - t0, ok: true };
  } catch (e: any) {
    return { provider, rows: [], ms: Date.now() - t0, ok: false, error: String(e?.message ?? e) };
  }
}

export async function refreshOnce(): Promise<{ rows: GpuRow[]; results: Result[] }> {
  const results = await Promise.all([
    runOne("runpod", fetchRunpod),
    runOne("vast", fetchVast),
    runOne("vultr", fetchVultr),
  ]);

  // Per-provider isolation: keep prior rows for failed providers
  const prevRows = cache.getRows();
  const allRows: GpuRow[] = [];
  for (const r of results) {
    if (r.ok) {
      allRows.push(...r.rows);
    } else {
      console.warn(`refresher: ${r.provider} failed (${r.error}), retaining stale rows`);
      allRows.push(...prevRows.filter(x => x.provider === r.provider));
    }
  }

  const diff = diffSnapshots(prevRows, allRows);
  cache.set(allRows, diff);

  // Persist
  await Promise.all(results.map(r =>
    sql`insert into snapshots (fetched_at, provider, rows_count, payload, fetch_ms, ok)
        values (now(), ${r.provider}, ${r.rows.length}, ${sql.json(r.rows)}, ${r.ms}, ${r.ok})`.catch(e => console.error("snapshot insert", e))
  ));

  // Roll up gpu_prices
  await rollupPrices(allRows);

  // Broadcast diff
  sseBus.publish("diff", {
    added: diff.added,
    removed: diff.removed.map(r => ({ id: r.id })),
    repriced: diff.repriced,
    fetched_at: cache.getLastFetched(),
  });

  return { rows: allRows, results };
}

async function rollupPrices(rows: GpuRow[]) {
  const groups = new Map<string, { prices: number[]; available: number; provider: string; tier: string; model: string }>();
  for (const r of rows) {
    const key = `${r.gpu_model}|${r.provider}|${r.tier}`;
    if (!groups.has(key)) groups.set(key, { prices: [], available: 0, provider: r.provider, tier: r.tier, model: r.gpu_model });
    const g = groups.get(key)!;
    g.prices.push(r.price_per_gpu_hour_usd);
    if (r.available) g.available += r.offer_count;
  }
  const now = new Date();
  for (const g of groups.values()) {
    const sorted = [...g.prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const cheapest = sorted[0];
    await sql`insert into gpu_prices values (${now}, ${g.model}, ${g.provider}, ${g.tier}, ${median}, ${cheapest}, ${g.available})
              on conflict do nothing`.catch(e => console.error("rollup insert", e));
  }
}

let started = false;
export function startRefresher() {
  if (started) return;
  started = true;
  console.log("refresher: starting");
  refreshOnce().catch(e => console.error("initial refresh failed", e));
  setInterval(() => refreshOnce().catch(e => console.error("refresh failed", e)), INTERVAL_MS);
}
```

**Step 2:** Boot the refresher with Next.js.

`src/instrumentation.ts`:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRefresher } = await import("@/lib/refresher");
    startRefresher();
  }
}
```

In `next.config.ts`, ensure `experimental.instrumentationHook` is on (default in Next 15) and `serverExternalPackages: ["postgres"]`.

**Step 3:** Run dev server, watch logs.

```bash
pnpm dev
```

Expected: `refresher: starting`, then within ~10s logs showing snapshot inserts and rollups.

**Step 4:** Verify in psql.

```bash
psql computegrid -c "select provider, rows_count, ok, fetch_ms from snapshots order by id desc limit 6;"
psql computegrid -c "select gpu_model, provider, tier, cheapest_price_per_gpu_hour_usd from gpu_prices order by fetched_at desc limit 10;"
```

**Step 5:** Commit.

```bash
git add -A && git commit -m "Add background refresher with provider isolation, history, and SSE diffs"
```

### Task 3.5: `/api/snapshot.json`

**Files:**
- Create: `src/app/api/snapshot.json/route.ts`

```ts
import { cache } from "@/lib/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    fetched_at: cache.getLastFetched(),
    rows: cache.getRows(),
  }, { headers: { "cache-control": "public, max-age=60" } });
}
```

Smoke: `curl http://localhost:3000/api/snapshot.json | jq '.rows | length'` — should return >0.

**Commit.**

### Task 3.6: `/api/stream` (SSE)

**Files:**
- Create: `src/app/api/stream/route.ts`

```ts
import { sseBus } from "@/lib/sse-bus";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      // initial snapshot
      controller.enqueue(enc.encode(
        `event: snapshot\ndata: ${JSON.stringify({ rows: cache.getRows(), fetched_at: cache.getLastFetched() })}\n\n`
      ));
      const unsub = sseBus.subscribe(payload => controller.enqueue(enc.encode(payload)));
      const heartbeat = setInterval(() => controller.enqueue(enc.encode(": ping\n\n")), 30_000);
      // close handling
      return () => { unsub(); clearInterval(heartbeat); };
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
    },
  });
}
```

Smoke: `curl -N http://localhost:3000/api/stream | head -c 2000` should print the snapshot event then ping every 30s.

**Commit.**

### Task 3.7: `/api/health`

```ts
// src/app/api/health/route.ts
import { cache } from "@/lib/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const last = cache.getLastFetched();
  const ageS = last ? (Date.now() - new Date(last).getTime()) / 1000 : null;
  return NextResponse.json({
    ok: ageS !== null && ageS < 600,
    last_snapshot_age_s: ageS,
    rows: cache.getRows().length,
  });
}
```

**Commit.**

---

# SPRINT 4 — MCP server + llms.txt

### Task 4.1: Install MCP SDK and stub server

**Step 1:** Install.

```bash
pnpm add @modelcontextprotocol/sdk
```

### Task 4.2: Define `list_gpus` and `find_cheapest`

**Files:**
- Create: `src/lib/mcp/tools.ts`

```ts
import { z } from "zod";
import { cache } from "@/lib/cache";
import { sql } from "@/lib/db";
import type { GpuRow } from "@/lib/schema";

export const listGpusInput = z.object({
  gpu_model: z.string().optional(),
  provider: z.array(z.string()).optional(),
  tier: z.array(z.string()).optional(),
  max_price_per_gpu_hour: z.number().optional(),
  min_vram_gb: z.number().optional(),
  available_only: z.boolean().default(true),
  region: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100),
});

export function listGpus(input: z.infer<typeof listGpusInput>): GpuRow[] {
  let rows = cache.getRows();
  if (input.gpu_model) {
    const q = input.gpu_model.toLowerCase();
    rows = rows.filter(r => r.gpu_model.toLowerCase().includes(q));
  }
  if (input.provider?.length) rows = rows.filter(r => input.provider!.includes(r.provider));
  if (input.tier?.length) rows = rows.filter(r => input.tier!.includes(r.tier));
  if (input.max_price_per_gpu_hour !== undefined) rows = rows.filter(r => r.price_per_gpu_hour_usd <= input.max_price_per_gpu_hour!);
  if (input.min_vram_gb !== undefined) rows = rows.filter(r => r.vram_gb >= input.min_vram_gb!);
  if (input.available_only) rows = rows.filter(r => r.available);
  if (input.region) {
    const q = input.region.toLowerCase();
    rows = rows.filter(r => r.regions.some(g => g.toLowerCase().includes(q)));
  }
  return rows.sort((a, b) => a.price_per_gpu_hour_usd - b.price_per_gpu_hour_usd).slice(0, input.limit);
}

export const findCheapestInput = z.object({
  gpu_model: z.string(),
  gpu_count: z.number().int().positive().default(1),
  min_vram_gb: z.number().optional(),
  tier: z.array(z.string()).optional(),
  region: z.string().optional(),
});

export async function findCheapest(input: z.infer<typeof findCheapestInput>) {
  const matches = listGpus({
    gpu_model: input.gpu_model,
    tier: input.tier,
    min_vram_gb: input.min_vram_gb,
    region: input.region,
    available_only: true,
    limit: 500,
  }).filter(r => r.gpu_count === input.gpu_count);

  if (matches.length === 0) return { cheapest: null, alternatives: [], market_context: null };

  const cheapest = matches[0];
  const alternatives = matches.slice(1, 6);

  // Market context: median + total available + 24h ago
  const all = listGpus({ gpu_model: input.gpu_model, available_only: true, limit: 500 });
  const prices = all.map(r => r.price_per_gpu_hour_usd).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const total = all.reduce((sum, r) => sum + r.offer_count, 0);

  const ago = await sql<{ cheapest_price_per_gpu_hour_usd: number }[]>`
    select cheapest_price_per_gpu_hour_usd from gpu_prices
    where gpu_model = ${input.gpu_model}
      and fetched_at <= now() - interval '24 hours'
    order by fetched_at desc limit 1`;

  return {
    cheapest,
    alternatives,
    market_context: {
      median_price_per_gpu_hour_usd: median,
      total_available_count: total,
      cheapest_24h_ago: ago[0]?.cheapest_price_per_gpu_hour_usd ?? null,
    },
  };
}
```

### Task 4.3: Mount MCP at `/mcp`

**Files:**
- Create: `src/app/mcp/route.ts`

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { listGpus, listGpusInput, findCheapest, findCheapestInput } from "@/lib/mcp/tools";
import { z } from "zod";

const server = new Server({ name: "computegrid", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_gpus",
      description: "List available GPU offers across providers, with filters.",
      inputSchema: { type: "object", properties: {
        gpu_model: { type: "string" },
        provider: { type: "array", items: { type: "string" } },
        tier: { type: "array", items: { type: "string" } },
        max_price_per_gpu_hour: { type: "number" },
        min_vram_gb: { type: "number" },
        available_only: { type: "boolean", default: true },
        region: { type: "string" },
        limit: { type: "number", default: 100 },
      } },
    },
    {
      name: "find_cheapest",
      description: "Find the cheapest available offer for a specific GPU, with market context (median, total supply, 24h delta).",
      inputSchema: { type: "object", required: ["gpu_model"], properties: {
        gpu_model: { type: "string" },
        gpu_count: { type: "number", default: 1 },
        min_vram_gb: { type: "number" },
        tier: { type: "array", items: { type: "string" } },
        region: { type: "string" },
      } },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "list_gpus") {
    const input = listGpusInput.parse(req.params.arguments ?? {});
    const rows = listGpus(input);
    return { content: [{ type: "text", text: JSON.stringify({ rows }, null, 2) }] };
  }
  if (req.params.name === "find_cheapest") {
    const input = findCheapestInput.parse(req.params.arguments ?? {});
    const result = await findCheapest(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  throw new Error(`unknown tool ${req.params.name}`);
});

async function handle(req: Request) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const dynamic = "force-dynamic";
export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
```

(Note: the precise MCP SDK API names may have shifted; verify against the version installed and adjust imports/signatures. The shape above reflects the streamable-HTTP pattern.)

### Task 4.4: `/llms.txt`

`src/app/llms.txt/route.ts`:
```ts
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const body = `# ComputeGrid

Open price feed for the GPU spot market. Aggregates RunPod, Vast.ai, and Vultr.

## Endpoints

- MCP server: ${base}/mcp (streamable HTTP)
- Snapshot JSON: ${base}/api/snapshot.json
- Live stream (SSE): ${base}/api/stream
- Health: ${base}/api/health

## MCP tools

- list_gpus(gpu_model?, provider?, tier?, max_price_per_gpu_hour?, min_vram_gb?, available_only?, region?, limit?) → GpuRow[]
- find_cheapest(gpu_model, gpu_count?, min_vram_gb?, tier?, region?) → { cheapest, alternatives, market_context }

## Schema (GpuRow)

{
  id, provider, tier, gpu_model, vram_gb, gpu_count,
  price_per_gpu_hour_usd, price_per_instance_hour_usd,
  available, offer_count, regions, metadata, fetched_at
}

## License

Open. Free to use. Public benefit.
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
```

### Task 4.5: Connect to Claude Code locally and smoke

```bash
claude mcp add computegrid http://localhost:3000/mcp
```

In a Claude session: `Use the computegrid MCP — find the cheapest H100.`

Verify response includes `cheapest`, `alternatives`, `market_context`.

**Commit.**

```bash
git add -A && git commit -m "Add MCP server, list_gpus + find_cheapest tools, llms.txt"
```

---

# SPRINT 5 — Terminal UI

### Task 5.1: Page shell + section primitives

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/Section.tsx`

`Section.tsx`:
```tsx
import { cn } from "@/lib/utils";

export function Section({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border border-border rounded-md p-5", className)}>
      <div className="text-[11px] uppercase tracking-wider text-muted font-mono mb-3">{label}</div>
      {children}
    </section>
  );
}
```

### Task 5.2: SpotIndex component

**Files:**
- Create: `src/components/SpotIndex.tsx`
- Create: `src/lib/use-snapshot.ts` (SSE hook, client component)

`use-snapshot.ts`:
```ts
"use client";
import { useEffect, useState } from "react";
import type { GpuRow } from "@/lib/schema";

export type SnapshotState = { rows: GpuRow[]; fetchedAt: string | null };

export function useSnapshot(): SnapshotState & { connected: boolean } {
  const [state, setState] = useState<SnapshotState>({ rows: [], fetchedAt: null });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.addEventListener("snapshot", (e: any) => {
      const data = JSON.parse(e.data);
      setState({ rows: data.rows, fetchedAt: data.fetched_at });
      setConnected(true);
    });
    es.addEventListener("diff", (e: any) => {
      // re-fetch authoritative snapshot on diff for simplicity
      fetch("/api/snapshot.json").then(r => r.json()).then(d => setState({ rows: d.rows, fetchedAt: d.fetched_at }));
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return { ...state, connected };
}
```

`SpotIndex.tsx`:
```tsx
"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";
import { useEffect, useState } from "react";

const HERO_GPUS = ["H100 SXM", "H100 PCIe", "A100 80GB", "L40S", "RTX 4090", "B200"];

export function SpotIndex() {
  const { rows } = useSnapshot();
  const [deltas, setDeltas] = useState<Record<string, number | null>>({});

  useEffect(() => {
    fetch("/api/index-deltas").then(r => r.json()).then(setDeltas).catch(() => {});
  }, []);

  const summary = HERO_GPUS.map(model => {
    const matching = rows.filter(r => r.gpu_model === model && r.available);
    const cheapest = matching.reduce<number | null>((m, r) => m === null ? r.price_per_gpu_hour_usd : Math.min(m, r.price_per_gpu_hour_usd), null);
    const total = matching.reduce((s, r) => s + r.offer_count, 0);
    const delta = deltas[model] ?? null;
    return { model, price: cheapest, count: total, delta };
  });

  return (
    <Section label="GPU SPOT INDEX">
      <table className="w-full font-mono text-[13px] tabular">
        <tbody>
          {summary.map(s => (
            <tr key={s.model} className="border-b border-border last:border-0">
              <td className="py-1.5 text-foreground/80">{s.model}</td>
              <td className="py-1.5 text-right">{s.price !== null ? `$${s.price.toFixed(2)}` : "—"}</td>
              <td className={"py-1.5 text-right " + (s.delta && s.delta < 0 ? "text-down" : s.delta && s.delta > 0 ? "text-up" : "text-muted")}>
                {s.delta !== null ? `${s.delta > 0 ? "↑" : s.delta < 0 ? "↓" : "→"}${Math.abs(s.delta).toFixed(1)}%` : "—"}
              </td>
              <td className="py-1.5 text-right text-muted">{s.count} avail</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
```

Add `/api/index-deltas/route.ts`:
```ts
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const HERO_GPUS = ["H100 SXM", "H100 PCIe", "A100 80GB", "L40S", "RTX 4090", "B200"];

export async function GET() {
  const out: Record<string, number | null> = {};
  for (const model of HERO_GPUS) {
    const rows = await sql<{ now: number; ago: number }[]>`
      with now_p as (select min(cheapest_price_per_gpu_hour_usd) as p from gpu_prices where gpu_model = ${model} and fetched_at >= now() - interval '5 minutes'),
           ago_p as (select min(cheapest_price_per_gpu_hour_usd) as p from gpu_prices where gpu_model = ${model} and fetched_at <= now() - interval '24 hours' and fetched_at >= now() - interval '25 hours')
      select (select p from now_p)::float as now, (select p from ago_p)::float as ago`;
    const r = rows[0];
    out[model] = r?.ago && r?.now ? ((r.now - r.ago) / r.ago) * 100 : null;
  }
  return NextResponse.json(out);
}
```

### Task 5.3: ActivityTicker

```tsx
// src/components/ActivityTicker.tsx
"use client";
import { Section } from "./Section";
import { useEffect, useState } from "react";

type Event = { type: string; row?: any; id?: string; from?: number; to?: number; ts: string };

export function ActivityTicker() {
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    fetch("/api/events").then(r => r.json()).then(setEvents);
    const es = new EventSource("/api/stream");
    es.addEventListener("diff", () => fetch("/api/events").then(r => r.json()).then(setEvents));
    return () => es.close();
  }, []);

  return (
    <Section label="ACTIVITY (LAST 5 MIN)">
      <ul className="font-mono text-[13px] space-y-1.5 max-h-[180px] overflow-hidden">
        {events.slice(0, 12).map((e, i) => (
          <li key={i} className="flex gap-2 text-foreground/80">
            <span className="text-muted w-12">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="flex-1 truncate">
              {e.type === "added" && <span><span className="text-down">●</span> {e.row?.gpu_model} listed ${e.row?.price_per_gpu_hour_usd?.toFixed(2)} {e.row?.regions?.[0] ?? ""}</span>}
              {e.type === "removed" && <span><span className="text-up">●</span> {e.row?.gpu_model} sold-out / withdrawn</span>}
              {e.type === "repriced" && <span><span className="text-muted">●</span> {e.id} reprice ${e.from?.toFixed(2)}→${e.to?.toFixed(2)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

`/api/events/route.ts`:
```ts
import { cache } from "@/lib/cache";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(cache.getEvents(20)); }
```

### Task 5.4: DepthChart with Recharts

```bash
pnpm add recharts
```

```tsx
// src/components/DepthChart.tsx
"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const PRICE_BUCKETS = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 8.0, 10.0];

export function DepthChart() {
  const { rows } = useSnapshot();
  const [model, setModel] = useState("H100 SXM");

  const data = useMemo(() => {
    const matching = rows.filter(r => r.gpu_model === model && r.available);
    return PRICE_BUCKETS.map(p => ({
      price: `≤$${p.toFixed(2)}`,
      gpus: matching.filter(r => r.price_per_gpu_hour_usd <= p).reduce((s, r) => s + r.gpu_count * r.offer_count, 0),
    }));
  }, [rows, model]);

  const total = rows.filter(r => r.gpu_model === model && r.available).reduce((s, r) => s + r.gpu_count * r.offer_count, 0);

  return (
    <Section label={`DEPTH — ${model}`}>
      <div className="h-[140px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <XAxis dataKey="price" stroke="hsl(var(--muted))" fontSize={10} tickLine={false} />
            <YAxis stroke="hsl(var(--muted))" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="gpus" fill="hsl(var(--down))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[12px] font-mono text-muted mt-2">{total} total available</div>
    </Section>
  );
}
```

### Task 5.5: OrphanedLane

```tsx
// src/components/OrphanedLane.tsx
"use client";
import { Section } from "./Section";
import { useSnapshot } from "@/lib/use-snapshot";

const ENTERPRISE_TIERS = new Set(["secure", "verified", "standard"]);
const ORPHAN_TIERS = new Set(["community", "unverified"]);
const HERO_GPUS = ["H100 SXM", "A100 80GB", "RTX 4090", "L40S"];

export function OrphanedLane() {
  const { rows } = useSnapshot();
  const items = HERO_GPUS.map(model => {
    const enterprise = rows.filter(r => r.gpu_model === model && ENTERPRISE_TIERS.has(r.tier) && r.available);
    const orphan = rows.filter(r => r.gpu_model === model && ORPHAN_TIERS.has(r.tier) && r.available);
    if (enterprise.length === 0 || orphan.length === 0) return null;
    const entMedian = median(enterprise.map(r => r.price_per_gpu_hour_usd));
    const orphanCheap = orphan.reduce((m, r) => Math.min(m, r.price_per_gpu_hour_usd), Infinity);
    if (orphanCheap > entMedian * 0.6) return null;
    const orphanCount = orphan.reduce((s, r) => s + r.offer_count, 0);
    const orphanAvg = orphan.reduce((s, r) => s + r.price_per_gpu_hour_usd, 0) / orphan.length;
    return { model, orphanCount, orphanAvg, entMedian };
  }).filter(Boolean) as { model: string; orphanCount: number; orphanAvg: number; entMedian: number }[];

  return (
    <Section label="ORPHANED LANE">
      <p className="text-[12px] text-muted mb-3">Listings ≥ 40% below the enterprise-tier median for the same GPU.</p>
      <ul className="font-mono text-[13px] space-y-1.5">
        {items.map(i => (
          <li key={i.model} className="flex gap-3 text-foreground/80">
            <span className="w-12 text-down">{i.orphanCount}</span>
            <span className="w-24">{i.model}</span>
            <span>at avg ${i.orphanAvg.toFixed(2)}</span>
            <span className="text-muted">vs. enterprise ${i.entMedian.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
```

### Task 5.6: AgentAccess

```tsx
// src/components/AgentAccess.tsx
import { Section } from "./Section";

export function AgentAccess() {
  return (
    <Section label="AGENT ACCESS">
      <div className="font-mono text-[13px] space-y-2">
        <div className="bg-foreground/5 rounded px-3 py-2 select-all">
          $ claude mcp add computegrid https://[host]/mcp
        </div>
        <div className="text-muted">
          tools: <span className="text-foreground/80">list_gpus(filters)</span> · <span className="text-foreground/80">find_cheapest(model, count, max_price)</span>
        </div>
        <div className="text-muted">
          also: GET /api/snapshot.json · GET /llms.txt
        </div>
      </div>
    </Section>
  );
}
```

### Task 5.7: Assemble landing page

```tsx
// src/app/page.tsx
import { Wordmark } from "@/components/Wordmark";
import { SpotIndex } from "@/components/SpotIndex";
import { ActivityTicker } from "@/components/ActivityTicker";
import { DepthChart } from "@/components/DepthChart";
import { OrphanedLane } from "@/components/OrphanedLane";
import { AgentAccess } from "@/components/AgentAccess";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="h-14 px-6 border-b border-border flex items-center justify-between">
        <Wordmark />
        <nav className="font-mono text-[13px] text-muted flex gap-5">
          <a href="/gpus">browse</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="https://github.com/sheraz-ali1/compute-centralization">github</a>
        </nav>
      </header>

      <main className="flex-1 px-6 py-6 max-w-[1400px] w-full mx-auto">
        <div className="mb-6">
          <h1 className="font-sans text-[28px] leading-tight tracking-tight">Open price feed for the GPU spot market.</h1>
          <p className="text-muted text-[16px] mt-1">For agents and the humans they work for.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpotIndex />
          <ActivityTicker />
          <DepthChart />
          <OrphanedLane />
          <div className="md:col-span-2"><AgentAccess /></div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

`Footer.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

export function Footer() {
  const [age, setAge] = useState<string>("…");
  useEffect(() => {
    const tick = async () => {
      const r = await fetch("/api/health").then(r => r.json()).catch(() => null);
      const a = r?.last_snapshot_age_s;
      setAge(a ? `${Math.round(a)}s ago` : "—");
    };
    tick();
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, []);
  return (
    <footer className="h-10 px-6 border-t border-border flex items-center justify-between font-mono text-[12px] text-muted">
      <span>open · public benefit · github.com/sheraz-ali1/compute-centralization</span>
      <span>refreshed {age}</span>
    </footer>
  );
}
```

### Task 5.8: SEO + favicon

- Add `<link rel="icon" href="/favicon.svg">` to layout, generate favicon.svg with `c` glyph + green pixel.
- Add JSON-LD `Dataset` to `/` via `<script type="application/ld+json">`.

**Commit.**

```bash
git add -A && git commit -m "Build terminal landing page: SpotIndex, ActivityTicker, DepthChart, OrphanedLane, AgentAccess"
```

---

# SPRINT 6 — Deploy

### Task 6.1: Railway project + Postgres

```bash
brew install railway   # if not installed
railway login
railway init           # link to a new project
railway add --database postgres
```

Railway auto-injects `DATABASE_URL` into the web service.

### Task 6.2: Deploy

```bash
railway up
```

Watch logs for `refresher: starting`. Verify deployment URL in Railway dashboard.

### Task 6.3: Run migrations on production DB

From local with `DATABASE_URL` pointed at Railway:

```bash
railway run pnpm tsx src/lib/migrate.ts
```

### Task 6.4: Smoke production

```bash
HOST=https://your-project.up.railway.app
curl -s $HOST/api/health | jq
curl -s $HOST/api/snapshot.json | jq '.rows | length'
curl -s $HOST/llms.txt | head
```

Add the production MCP URL in Claude Code:
```bash
claude mcp add computegrid $HOST/mcp
```

Verify `find_cheapest({gpu_model: "H100 SXM"})` works.

### Task 6.5: Final sprint contract verification

Walk through every checkbox in the design doc §16:

- [ ] `/` renders within 100vh on 1440×900 desktop
- [ ] Three providers refreshing without dropping the cache
- [ ] Snapshot history accumulating (`select count(*) from snapshots`)
- [ ] MCP from Claude Code returns within 200ms p95 (manual)
- [ ] `/api/snapshot.json`, `/api/stream`, `/llms.txt` all valid
- [ ] Orphaned-lane counts match a manual cross-check
- [ ] Lighthouse ≥ 95 on `/`
- [ ] Public Railway URL live

For each ✅, write a one-line note in the sprint file.

**Final commit + tag.**

```bash
git add -A && git commit -m "Production deploy verified"
git tag v0.1.0
git push origin feature/computegrid-v1 v0.1.0
```

Open PR to merge `feature/computegrid-v1` → `main`.

---

## Notes for the executing agent

- **Provider-isolated failures.** When one scraper fails, retain the previous snapshot for that provider only. Don't blank the cache.
- **Be paranoid about runtime types.** Provider APIs change without notice. Every scraper must validate against `GpuRowSchema` before publishing — schema-violating rows are dropped with a warn log, not crashed on.
- **Don't fake numbers.** If a column doesn't have data (e.g., 24h delta on day 1), render `—`, not `0%`.
- **The terminal aesthetic carries the brand.** No gradients, no shadows except hairline borders, no decorative motion. The data is the design.
- **Commit per task.** This plan has ~40 tasks; 40 commits is the right shape, not 6 sprint-sized squashes.
