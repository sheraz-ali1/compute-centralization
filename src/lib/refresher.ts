import { fetchRunpod } from "@/scrapers/runpod";
import { fetchVast } from "@/scrapers/vast";
import { fetchVultr } from "@/scrapers/vultr";
import { fetchGetdeploying } from "@/scrapers/getdeploying";
import { cache, diffSnapshots } from "@/lib/cache";
import { sseBus } from "@/lib/sse-bus";
import { sql } from "@/lib/db";
import type { GpuRow } from "@/lib/schema";

const INTERVAL_MS = 120_000;

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
  const results = await Promise.all([
    runOne("runpod", fetchRunpod),
    runOne("vast", fetchVast),
    runOne("vultr", fetchVultr),
    runOne("getdeploying", fetchGetdeploying),
  ]);

  // Per-source isolation: keep prior rows for failed sources
  const prevRows = cache.getRows();
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
  cache.set(allRows, diff);

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

  // Broadcast diff (skipped on cold start — see above)
  if (!isFirstRefresh) {
    sseBus.publish("diff", {
      added: diff.added,
      removed: diff.removed.map((r) => ({ id: r.id })),
      repriced: diff.repriced,
      fetched_at: cache.getLastFetched(),
    });
  }

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
  for (const g of groups.values()) {
    const sorted = [...g.prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const cheapest = sorted[0];
    await sql`insert into gpu_prices values (${now}, ${g.model}, ${g.provider}, ${g.tier}, ${median}, ${cheapest}, ${g.available})
              on conflict do nothing`.catch((e) => console.error("rollup insert", e));
  }
}

let started = false;
// Cycle-owning token. When `inFlight !== null`, a tick is in progress;
// each path that releases the latch (watchdog vs finally) checks that
// it owns the current cycle before clearing, so a long-running tick #1
// can't release the latch belonging to tick #2 mid-flight (which would
// let tick #3 run concurrently with tick #2).
let inFlight: symbol | null = null;

// Hard watchdog: if a tick doesn't finish in this window, release the
// latch so the next tick can run. Prevents a silently hung scraper or
// stalled Postgres from permanently stopping the refresher.
const TICK_WATCHDOG_MS = 90_000;

async function tick() {
  if (inFlight) {
    console.warn("refresher: previous cycle still running, skipping tick");
    return;
  }
  const myToken = Symbol("tick");
  inFlight = myToken;
  const watchdog = setTimeout(() => {
    if (inFlight === myToken) {
      console.error(
        `refresher: watchdog fired after ${TICK_WATCHDOG_MS}ms — releasing in-flight latch`,
      );
      inFlight = null;
    }
  }, TICK_WATCHDOG_MS);
  try {
    await refreshOnce();
  } catch (e) {
    console.error("refresh failed", e);
  } finally {
    clearTimeout(watchdog);
    if (inFlight === myToken) inFlight = null;
  }
}

/**
 * Retention: keep the snapshots table (raw jsonb payloads) bounded. Without
 * this it grows unbounded — ~21k rows/month × multi-KB each = GBs over a
 * year. gpu_prices rollup is kept indefinitely since it's small and the
 * historical price track is the actual product.
 */
async function runRetention() {
  try {
    const { sql } = await import("@/lib/db");
    await sql`delete from snapshots where fetched_at < now() - interval '30 days'`;
  } catch (e) {
    console.warn("refresher: retention failed (non-fatal)", e);
  }
}

export function startRefresher() {
  if (started) return;
  started = true;
  console.log("refresher: starting");
  tick();
  setInterval(tick, INTERVAL_MS);
  // Retention every 6h.
  setInterval(runRetention, 6 * 60 * 60_000);
}
