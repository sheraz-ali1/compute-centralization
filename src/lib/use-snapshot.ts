"use client";
import { useEffect, useState } from "react";
import type { GpuRow } from "@/lib/schema";

export type SnapshotState = { rows: GpuRow[]; fetchedAt: string | null };

// The underlying index only moves every ~120s, so polling faster than this
// buys nothing but function invocations. Kept under the CDN's s-maxage so
// the poll reliably reaches the origin and keeps the refresh loop turning.
const POLL_MS = 30_000;

/**
 * Poll the current snapshot.
 *
 * This used to hold an SSE connection to /api/stream. That relied on the
 * scraper and the stream living in one long-lived process sharing an
 * in-memory bus — true on Railway, false on serverless, where each
 * invocation is isolated and frozen between requests. Polling the
 * Postgres-backed snapshot is equivalent at this data cadence.
 */
export function useSnapshot(): SnapshotState & { connected: boolean } {
  const [state, setState] = useState<SnapshotState>({
    rows: [],
    fetchedAt: null,
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controllers = new Set<AbortController>();

    const poll = async () => {
      const ac = new AbortController();
      controllers.add(ac);
      try {
        const res = await fetch("/api/snapshot.json", { signal: ac.signal });
        if (!res.ok) throw new Error(`snapshot ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setState({ rows: data.rows ?? [], fetchedAt: data.fetched_at ?? null });
        setConnected(true);
      } catch {
        // Network blip or an aborted in-flight request on unmount — keep
        // showing the last good rows and mark the feed as disconnected.
        if (!cancelled) setConnected(false);
      } finally {
        controllers.delete(ac);
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);

    // Catch up immediately when a backgrounded tab returns, rather than
    // showing data up to a full interval stale.
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      for (const ac of controllers) ac.abort();
    };
  }, []);

  return { ...state, connected };
}
