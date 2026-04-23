import { cache } from "@/lib/cache";
import { sql } from "@/lib/db";
import { NextResponse } from "next/server";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("db timeout")), ms),
  );
}

export async function GET() {
  const last = cache.getLastFetched();
  const ageS = last ? (Date.now() - new Date(last).getTime()) / 1000 : null;
  const cacheOk = ageS !== null && ageS < 600;

  let dbOk = false;
  let dbError: string | undefined;
  try {
    // Race against a 3s timeout so a stuck Postgres can't hang the
    // health check request indefinitely.
    await Promise.race([
      sql`select 1 as ok`,
      timeoutAfter(3000),
    ]);
    dbOk = true;
  } catch (e) {
    // Don't leak raw error text — the DATABASE_URL is in there on
    // some connection failures. Just a generic category.
    const msg = e instanceof Error ? e.message : String(e);
    dbError = msg.includes("timeout")
      ? "timeout"
      : msg.includes("DATABASE_URL")
        ? "not_configured"
        : "unreachable";
  }

  const ok = cacheOk && dbOk;
  return NextResponse.json(
    {
      ok,
      cache: {
        ok: cacheOk,
        last_snapshot_age_s: ageS,
        rows: cache.getRows().length,
      },
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
