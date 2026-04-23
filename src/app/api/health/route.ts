import { cache } from "@/lib/cache";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function GET() {
  const last = cache.getLastFetched();
  const ageS = last ? (Date.now() - new Date(last).getTime()) / 1000 : null;
  const cacheOk = ageS !== null && ageS < 600;

  // Check DB connectivity AND that the tables exist. A green health
  // check that ignores the DB hides bad deploys (where migrations
  // didn't run).
  let dbOk = false;
  let dbError: string | undefined;
  try {
    const r = await sql<{ count: number }[]>`
      select count(*)::int as count from snapshots
      where fetched_at >= now() - interval '10 minutes'`;
    dbOk = (r[0]?.count ?? 0) >= 0;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const ok = cacheOk && dbOk;
  return NextResponse.json(
    {
      ok,
      cache: { ok: cacheOk, last_snapshot_age_s: ageS, rows: cache.getRows().length },
      db: { ok: dbOk, error: dbError },
    },
    {
      status: ok ? 200 : 503,
      headers: PUBLIC_CORS_HEADERS,
    },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
