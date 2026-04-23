type Listener = (data: string) => void;

// Cap concurrent SSE listeners to prevent unbounded memory / FD growth
// from a hostile client opening thousands of /api/stream connections.
// On Railway a single instance has limited file descriptors and this
// number is already comfortably above realistic legitimate usage.
const MAX_LISTENERS = 200;

class SseBus {
  private listeners = new Set<Listener>();
  /** Returns the unsubscribe function, or null if at capacity. */
  subscribe(fn: Listener): (() => void) | null {
    if (this.listeners.size >= MAX_LISTENERS) return null;
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  publish(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const fn of this.listeners) {
      try {
        fn(payload);
      } catch {
        // listener errored — drop it so it can't keep failing
        this.listeners.delete(fn);
      }
    }
  }
  size() {
    return this.listeners.size;
  }
}
// Pin singleton on globalThis so it survives across module instances
// (Next dev mode / Turbopack may otherwise compile this module twice).
const g = globalThis as unknown as { __computegridSseBus?: SseBus };
export const sseBus =
  g.__computegridSseBus ?? (g.__computegridSseBus = new SseBus());
