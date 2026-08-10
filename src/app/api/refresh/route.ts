import { NextResponse } from "next/server";
import { refreshIfStale, runRetention } from "@/lib/refresher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron-triggered refresh floor.
 *
 * Freshness is normally traffic-driven (see refreshIfStale), which means a
 * day with no visitors would leave the index arbitrarily stale. Vercel's
 * Hobby plan allows one cron execution per day, so this guarantees at least
 * one refresh daily and is where table retention runs.
 *
 * Vercel Cron authenticates by sending `Authorization: Bearer $CRON_SECRET`.
 * Fails closed: with no CRON_SECRET configured, nobody can trigger this.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  // maxAgeMs 0 — the cron's whole job is to refresh unconditionally. The
  // lease still applies, so this no-ops if a request-driven refresh is
  // already mid-flight.
  const outcome = await refreshIfStale(0);
  await runRetention();

  return NextResponse.json(
    { ok: outcome !== "failed", outcome },
    { status: outcome === "failed" ? 500 : 200, headers: { "cache-control": "no-store" } },
  );
}
