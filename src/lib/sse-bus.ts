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
export const sseBus = new SseBus();
