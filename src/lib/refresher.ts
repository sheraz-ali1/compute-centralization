import { fetchRunpod } from "@/scrapers/runpod";
import { fetchVast } from "@/scrapers/vast";
import { fetchVultr } from "@/scrapers/vultr";
import { fetchGetdeploying } from "@/scrapers/getdeploying";
import { diffSnapshots } from "@/lib/cache";
import {
  acquireRefreshLease,
  readState,
  releaseRefreshLease,
  stateAgeMs,
  writeState,
} from "@/lib/store";
import { sql } from "@/lib/db";
import type { GpuRow } from "@/lib/schema";

// How old the stored snapshot may get before a request triggers a
// background refresh. Matches the 120s cadence the Railway setInterval
// used to run at.
const STALE_AFTER_MS = 120_000;

// Source identifiers — the *source*, not necessarily the provider name on
// the row. RunPod/Vast/Vultr are direct integrations; getdeploying is a
// daily-updated aggregator that fills in 30+ additional providers.
type SourceId = "runpod" | "vast" | "vultr" | "getdeploying";

type Result = {
  source: SourceId;
  rows: GpuRow[];
  ms: number;
  ok: boolean;
  error?: string;
};

async function runOne(
  source: SourceId,
  fn: () => Promise<GpuRow[]>,
): Promise<Result> {
  const t0 = Date.now();
  try {
    const rows = await fn();
    return { source, rows, ms: Date.now() - t0, ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { source, rows: [], ms: Date.now() - t0, ok: false, error: message };
  }
}

// Map a row back to the source that fetched it. Direct providers map
// trivially by `row.provider`; aggregator-sourced rows are identified by
// the metadata.source field set at parse time.
function rowSource(r: GpuRow): SourceId | null {
  if (r.provider === "runpod") return "runpod";
  if (r.provider === "vast") return "vast";
  if (r.provider === "vultr") return "vultr";
  if (r.metadata?.source === "getdeploying") return "getdeploying";
  return null;
}

export async function refreshOnce(): Promise<{ rows: GpuRow[]; results: Result[] }> {
  // The refresh path is the only place that touches the filesystem to read
  // migration SQL, so it's also the only place that needs the schema to
  // exist. Read paths tolerate an unmigrated DB by reading as empty.
  await ensureMigrated();
  const prev = await readState();

  const results = await Promise.all([
    runOne("runpod", fetchRunpod),
    runOne("vast", fetchVast),
    runOne("vultr", fetchVultr),
    runOne("getdeploying", fetchGetdeploying),
  ]);

  // Per-source isolation: keep prior rows for failed sources
  const prevRows = prev.rows;
  const allRows: GpuRow[] = [];
  for (const r of results) {
    if (r.ok) {
      allRows.push(...r.rows);
    } else {
      console.warn(
        `refresher: ${r.source} failed (${r.error}), retaining stale rows`,
      );
      allRows.push(...prevRows.filter((x) => rowSource(x) === r.source));
    }
  }

  // Cold start: on the very first refresh, prevRows is empty so every row
  // would register as "added", spamming the activity ticker with initial-
  // population noise. Suppress diff events for the first refresh; normal
  // diffs resume from refresh #2 onward.
  const isFirstRefresh = prevRows.length === 0;
  const diff = isFirstRefresh
    ? { added: [], removed: [], repriced: [] }
    : diffSnapshots(prevRows, allRows);
  await writeState(allRows, diff, prev.events);

  // Persist
  await Promise.all(
    results.map((r) =>
      sql`insert into snapshots (fetched_at, provider, rows_count, payload, fetch_ms, ok)
          values (now(), ${r.source}, ${r.rows.length}, ${sql.json(r.rows as unknown as Parameters<typeof sql.json>[0])}, ${r.ms}, ${r.ok})`.catch(
        (e) => console.error("snapshot insert", e),
      ),
    ),
  );

  // Roll up gpu_prices
  await rollupPrices(allRows);

  return { rows: allRows, results };
}

async function rollupPrices(rows: GpuRow[]) {
  const groups = new Map<
    string,
    {
      prices: number[];
      available: number;
      provider: string;
      tier: string;
      model: string;
    }
  >();
  for (const r of rows) {
    const key = `${r.gpu_model}|${r.provider}|${r.tier}`;
    if (!groups.has(key)) {
      groups.set(key, {
        prices: [],
        available: 0,
        provider: r.provider,
        tier: r.tier,
        model: r.gpu_model,
      });
    }
    const g = groups.get(key)!;
    g.prices.push(r.price_per_gpu_hour_usd);
    if (r.available) g.available += r.offer_count;
  }
  const now = new Date();
  const rollup = [...groups.values()].map((g) => {
    const sorted = [...g.prices].sort((a, b) => a - b);
    return {
      fetched_at: now,
      gpu_model: g.model,
      provider: g.provider,
      tier: g.tier,
      median_price_per_gpu_hour_usd: sorted[Math.floor(sorted.length / 2)],
      cheapest_price_per_gpu_hour_usd: sorted[0],
      available_count: g.available,
    };
  });
  if (rollup.length === 0) return;

  // One multi-row insert rather than ~260 sequential round trips. Under a
  // hard function timeout that difference is the whole margin: measured at
  // 81ms RTT the loop version cost ~21s on its own.
  try {
    await sql`
      insert into gpu_prices ${sql(
        rollup,
        "fetched_at",
        "gpu_model",
        "provider",
        "tier",
        "median_price_per_gpu_hour_usd",
        "cheapest_price_per_gpu_hour_usd",
        "available_count",
      )} on conflict do nothing
    `;
  } catch (e) {
    console.error("rollup insert", e);
  }
}

/**
 * Retention: keep the snapshots table (raw jsonb payloads) bounded. Without
 * this it grows unbounded — ~21k rows/month × multi-KB each = GBs over a
 * year. gpu_prices rollup is kept indefinitely since it's small and the
 * historical price track is the actual product.
 *
 * Previously on a 6h setInterval; now driven by the daily cron hitting
 * /api/refresh, which is well inside the 30-day retention window.
 */
export async function runRetention() {
  try {
    await sql`delete from snapshots where fetched_at < now() - interval '30 days'`;
  } catch (e) {
    console.warn("refresher: retention failed (non-fatal)", e);
  }
}

// Per-instance guard so a warm lambda doesn't re-check migrations on every
// single refresh. A cold instance pays one cheap `select from _migrations`.
let migrated = false;

async function ensureMigrated() {
  if (migrated) return;
  const { migrate } = await import("@/lib/migrate");
  await migrate();
  migrated = true;
}

export type RefreshOutcome = "fresh" | "refreshed" | "busy" | "failed";

/**
 * Refresh only if the stored snapshot has aged out.
 *
 * This replaces the setInterval loop that ran on Railway. Serverless
 * freezes the process between requests, so nothing fires on a timer —
 * instead traffic drives freshness: a request reads (possibly stale) state,
 * responds immediately, and schedules this via `after()`.
 *
 * The DB lease means that when 50 requests arrive at once and all see stale
 * data, exactly one of them actually scrapes the providers.
 */
export async function refreshIfStale(
  maxAgeMs = STALE_AFTER_MS,
): Promise<RefreshOutcome> {
  try {
    const state = await readState();
    if (stateAgeMs(state) < maxAgeMs) return "fresh";

    if (!(await acquireRefreshLease())) return "busy";
    try {
      await refreshOnce();
      return "refreshed";
    } finally {
      await releaseRefreshLease();
    }
  } catch (e) {
    // Never let a background refresh failure surface as a request error —
    // the response has already been sent by the time this runs.
    console.error("refresher: background refresh failed", e);
    return "failed";
  }
}
