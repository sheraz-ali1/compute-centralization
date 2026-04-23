import { fetchRunpod } from "@/scrapers/runpod";
import { fetchVast } from "@/scrapers/vast";
import { fetchVultr } from "@/scrapers/vultr";
import { cache, diffSnapshots } from "@/lib/cache";
import { sseBus } from "@/lib/sse-bus";
import { sql } from "@/lib/db";
import type { GpuRow, Provider } from "@/lib/schema";

const INTERVAL_MS = 120_000;

type Result = {
  provider: Provider;
  rows: GpuRow[];
  ms: number;
  ok: boolean;
  error?: string;
};

async function runOne(
  provider: Provider,
  fn: () => Promise<GpuRow[]>,
): Promise<Result> {
  const t0 = Date.now();
  try {
    const rows = await fn();
    return { provider, rows, ms: Date.now() - t0, ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { provider, rows: [], ms: Date.now() - t0, ok: false, error: message };
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
      console.warn(
        `refresher: ${r.provider} failed (${r.error}), retaining stale rows`,
      );
      allRows.push(...prevRows.filter((x) => x.provider === r.provider));
    }
  }

  const diff = diffSnapshots(prevRows, allRows);
  cache.set(allRows, diff);

  // Persist
  await Promise.all(
    results.map((r) =>
      sql`insert into snapshots (fetched_at, provider, rows_count, payload, fetch_ms, ok)
          values (now(), ${r.provider}, ${r.rows.length}, ${sql.json(r.rows as unknown as Parameters<typeof sql.json>[0])}, ${r.ms}, ${r.ok})`.catch(
        (e) => console.error("snapshot insert", e),
      ),
    ),
  );

  // Roll up gpu_prices
  await rollupPrices(allRows);

  // Broadcast diff
  sseBus.publish("diff", {
    added: diff.added,
    removed: diff.removed.map((r) => ({ id: r.id })),
    repriced: diff.repriced,
    fetched_at: cache.getLastFetched(),
  });

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
