import { NextResponse } from "next/server";
import { readState, stateAgeMs, type CurrentState } from "@/lib/store";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("db timeout")), ms),
  );
}

export async function GET() {
  // The snapshot now lives in Postgres, so one read answers both questions:
  // is the DB reachable, and is the data fresh.
  let state: CurrentState | null = null;
  let dbOk = false;
  let dbError: string | undefined;
  try {
    // Race against a 3s timeout so a stuck Postgres can't hang the
    // health check request indefinitely.
    state = await Promise.race([readState(), timeoutAfter(3000)]);
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

  const ageMs = state ? stateAgeMs(state) : Infinity;
  const ageS = Number.isFinite(ageMs) ? ageMs / 1000 : null;
  const snapshotOk = ageS !== null && ageS < 600;

  const ok = snapshotOk && dbOk;
  return NextResponse.json(
    {
      ok,
      snapshot: {
        ok: snapshotOk,
        last_snapshot_age_s: ageS,
        rows: state?.rows.length ?? 0,
      },
      db: { ok: dbOk, error: dbError },
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store", ...PUBLIC_CORS_HEADERS },
    },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
