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
export function startRefresher() {
  if (started) return;
  started = true;
  console.log("refresher: starting");
  refreshOnce().catch((e) => console.error("initial refresh failed", e));
  setInterval(
    () => refreshOnce().catch((e) => console.error("refresh failed", e)),
    INTERVAL_MS,
  );
}
