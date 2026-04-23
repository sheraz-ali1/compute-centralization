import { cache } from "@/lib/cache";
import { NextResponse } from "next/server";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function GET() {
  const last = cache.getLastFetched();
  const ageS = last ? (Date.now() - new Date(last).getTime()) / 1000 : null;
  return NextResponse.json(
    {
      ok: ageS !== null && ageS < 600,
      last_snapshot_age_s: ageS,
      rows: cache.getRows().length,
    },
    { headers: PUBLIC_CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
