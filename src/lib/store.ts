import { sql } from "@/lib/db";
import type { SnapshotDiff } from "@/lib/cache";
import type { GpuRow } from "@/lib/schema";

export type StoreEvent = {
  type: "added" | "removed" | "repriced";
  row?: GpuRow;
  id?: string;
  from?: number;
  to?: number;
  ts: string;
};

export type CurrentState = {
  rows: GpuRow[];
  fetchedAt: string | null;
  events: StoreEvent[];
};

const EMPTY: CurrentState = { rows: [], fetchedAt: null, events: [] };

// Keep the activity ticker bounded — it only ever renders the newest ~20.
const MAX_EVENTS = 100;

/** Postgres "undefined_table" — the schema hasn't been migrated yet. */
function isMissingTable(e: unknown): boolean {
  return (e as { code?: string })?.code === "42P01";
}

/**
 * Read the shared current state.
 *
 * Deliberately does NOT run migrations: this is on the hot read path for
 * every request, and migrate() touches the filesystem (see migrate.ts),
 * which is the fragile part of a bundled serverless function. Before the
 * first refresh ever lands, an unmigrated DB simply reads as empty — the
 * refresh path is what creates the schema.
 */
export async function readState(): Promise<CurrentState> {
  try {
    const got = await sql<
      { fetched_at: Date | null; rows: GpuRow[]; events: StoreEvent[] }[]
    >`select fetched_at, "rows", events from app_state where id = 1`;
    const r = got[0];
    if (!r) return EMPTY;
    return {
      rows: r.rows ?? [],
      fetchedAt: r.fetched_at ? new Date(r.fetched_at).toISOString() : null,
      events: r.events ?? [],
    };
  } catch (e) {
    if (isMissingTable(e)) return EMPTY;
    throw e;
  }
}

/** Age of the current snapshot in ms; Infinity when there's never been one. */
export function stateAgeMs(state: CurrentState): number {
  if (!state.fetchedAt) return Infinity;
  return Date.now() - new Date(state.fetchedAt).getTime();
}

/**
 * Replace the current state, prepending this cycle's diff to the event log.
 */
export async function writeState(
  rows: GpuRow[],
  diff: SnapshotDiff,
  prevEvents: StoreEvent[],
): Promise<string> {
  const ts = new Date().toISOString();
  const fresh: StoreEvent[] = [];
  for (const r of diff.added) fresh.unshift({ type: "added", row: r, ts });
  for (const r of diff.removed) fresh.unshift({ type: "removed", row: r, ts });
  for (const e of diff.repriced)
    fresh.unshift({ type: "repriced", id: e.id, from: e.from, to: e.to, ts });

  const events = [...fresh, ...prevEvents].slice(0, MAX_EVENTS);

  await sql`
    insert into app_state (id, fetched_at, "rows", events)
    values (1, ${ts}, ${sql.json(rows as never)}, ${sql.json(events as never)})
    on conflict (id) do update set
      fetched_at = excluded.fetched_at,
      "rows" = excluded."rows",
      events = excluded.events
  `;
  return ts;
}

/**
 * Try to claim the right to refresh.
 *
 * Several concurrent requests can each notice stale data at the same
 * moment; without this they'd all scrape every provider simultaneously.
 * The conditional UPDATE is atomic and pooler-safe (unlike a session-level
 * advisory lock, which doesn't survive PgBouncer transaction pooling), and
 * the lease expires on its own so a killed invocation can't wedge refreshes
 * permanently.
 */
export async function acquireRefreshLease(ttlSeconds = 90): Promise<boolean> {
  try {
    const got = await sql`
      update app_state
         set refresh_lease_until = now() + (${ttlSeconds} * interval '1 second')
       where id = 1
         and (refresh_lease_until is null or refresh_lease_until < now())
      returning id
    `;
    return got.length > 0;
  } catch (e) {
    if (isMissingTable(e)) return true; // pre-migration: let the refresh run and create it
    throw e;
  }
}

export async function releaseRefreshLease(): Promise<void> {
  await sql`update app_state set refresh_lease_until = null where id = 1`.catch(
    (e) => console.error("store: releasing refresh lease failed", e),
  );
}
