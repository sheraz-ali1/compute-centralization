import { cache } from "@/lib/cache";
import { NextResponse } from "next/server";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      fetched_at: cache.getLastFetched(),
      rows: cache.getRows(),
    },
    {
      headers: {
        "cache-control": "public, max-age=60",
        ...PUBLIC_CORS_HEADERS,
      },
    },
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
