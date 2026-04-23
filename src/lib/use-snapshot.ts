"use client";
import { useEffect, useState } from "react";
import type { GpuRow } from "@/lib/schema";

export type SnapshotState = { rows: GpuRow[]; fetchedAt: string | null };

export function useSnapshot(): SnapshotState & { connected: boolean } {
  const [state, setState] = useState<SnapshotState>({
    rows: [],
    fetchedAt: null,
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    const onSnapshot = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setState({ rows: data.rows ?? [], fetchedAt: data.fetched_at ?? null });
        setConnected(true);
      } catch {
        // ignore parse errors
      }
    };

    const onDiff = () => {
      // re-fetch authoritative snapshot on diff for simplicity
      fetch("/api/snapshot.json")
        .then((r) => r.json())
        .then((d) =>
          setState({ rows: d.rows ?? [], fetchedAt: d.fetched_at ?? null }),
        )
        .catch(() => {});
    };

    es.addEventListener("snapshot", onSnapshot as EventListener);
    es.addEventListener("diff", onDiff as EventListener);
    es.onerror = () => setConnected(false);

    return () => {
      es.removeEventListener("snapshot", onSnapshot as EventListener);
      es.removeEventListener("diff", onDiff as EventListener);
      es.close();
    };
  }, []);

  return { ...state, connected };
}
