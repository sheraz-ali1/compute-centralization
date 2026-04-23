type Listener = (data: string) => void;

// Global cap on concurrent SSE listeners (memory + FD ceiling).
const MAX_LISTENERS = 200;
// Per-IP cap so no single client can monopolize the pool.
const MAX_PER_IP = 5;

type Entry = { fn: Listener; ip: string };

class SseBus {
  private entries = new Set<Entry>();
  private perIpCount = new Map<string, number>();

  /**
   * Subscribe a listener identified by client IP. Returns the unsubscribe
   * function, or null if either the global cap or the per-IP cap is hit.
   */
  subscribe(fn: Listener, ip: string): (() => void) | null {
    if (this.entries.size >= MAX_LISTENERS) return null;
    const ipCount = this.perIpCount.get(ip) ?? 0;
    if (ipCount >= MAX_PER_IP) return null;

    const entry: Entry = { fn, ip };
    this.entries.add(entry);
    this.perIpCount.set(ip, ipCount + 1);

    return () => {
      if (!this.entries.delete(entry)) return;
      const c = (this.perIpCount.get(ip) ?? 1) - 1;
      if (c <= 0) this.perIpCount.delete(ip);
      else this.perIpCount.set(ip, c);
    };
  }

  publish(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const entry of this.entries) {
      try {
        entry.fn(payload);
      } catch {
        // listener errored — drop it so it can't keep failing
        this.entries.delete(entry);
        const c = (this.perIpCount.get(entry.ip) ?? 1) - 1;
        if (c <= 0) this.perIpCount.delete(entry.ip);
        else this.perIpCount.set(entry.ip, c);
      }
    }
  }

  size() {
    return this.entries.size;
  }
}
// Pin singleton on globalThis so it survives across module instances
// (Next dev mode / Turbopack may otherwise compile this module twice).
const g = globalThis as unknown as { __computegridSseBus?: SseBus };
export const sseBus =
  g.__computegridSseBus ?? (g.__computegridSseBus = new SseBus());
