type Listener = (data: string) => void;

class SseBus {
  private listeners = new Set<Listener>();
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  publish(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const fn of this.listeners) fn(payload);
  }
}
// Pin singleton on globalThis so it survives across module instances
// (Next dev mode / Turbopack may otherwise compile this module twice).
const g = globalThis as unknown as { __computegridSseBus?: SseBus };
export const sseBus = g.__computegridSseBus ?? (g.__computegridSseBus = new SseBus());
