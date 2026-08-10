import { after, NextResponse } from "next/server";
import { readState } from "@/lib/store";
import { refreshIfStale } from "@/lib/refresher";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";
// Scraping four providers is the slow part of a refresh; `after()` runs
// within this route's budget, so it needs headroom beyond the response.
export const maxDuration = 60;

export async function GET() {
  const state = await readState();

  // Traffic is what keeps the index fresh here — there's no background
  // timer on serverless. Respond with what we have, then refresh behind
  // the response if it has aged out. Only one invocation wins the lease.
  after(() => refreshIfStale());

  return NextResponse.json(
    {
      fetched_at: state.fetchedAt,
      rows: state.rows,
    },
    {
      headers: {
        // s-maxage caps how often the CDN lets a request through to the
        // function. It must stay well under the refresh interval, or the
        // edge would keep serving cached bytes and no request would ever
        // arrive to trigger a refresh — the index would freeze.
        "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        ...PUBLIC_CORS_HEADERS,
      },
    },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
