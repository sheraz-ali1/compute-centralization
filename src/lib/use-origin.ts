"use client";
import { useSyncExternalStore } from "react";

/**
 * Returns window.location.origin on the client, a placeholder on the server.
 * Uses useSyncExternalStore so we never call setState in an effect for this
 * hydration-time read (React 19 lints the simpler useState+useEffect pattern).
 */
const subscribe = () => () => {};
const getClientSnapshot = () =>
  typeof window !== "undefined" ? window.location.origin : "https://[host]";
const getServerSnapshot = () => "https://[host]";

export function useOrigin(): string {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
