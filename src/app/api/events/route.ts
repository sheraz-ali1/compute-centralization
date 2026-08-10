import { NextResponse } from "next/server";
import { readState } from "@/lib/store";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readState();
  return NextResponse.json(state.events.slice(0, 20), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      ...PUBLIC_CORS_HEADERS,
    },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
