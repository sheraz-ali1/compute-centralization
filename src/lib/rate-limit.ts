// Tiny in-memory token bucket per IP. Survives the lifetime of the
// process; resets on restart. On a multi-instance deploy this becomes
// per-instance; that's fine for v1 deterrence (raises the cost of
// scripted abuse) without needing Redis.

type Bucket = { tokens: number; lastRefill: number };

class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(opts: { capacity: number; refillPerMin: number }) {
    this.capacity = opts.capacity;
    this.refillPerMs = opts.refillPerMin / 60_000;
    // Periodic eviction so we don't leak buckets indefinitely
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.evict(), 5 * 60_000);
    }
  }

  check(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, b);
    }
    const elapsed = now - b.lastRefill;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerMs);
    b.lastRefill = now;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { allowed: true, retryAfterSec: 0 };
    }
    const tokensNeeded = 1 - b.tokens;
    const retryAfterSec = Math.ceil(tokensNeeded / this.refillPerMs / 1000);
    return { allowed: false, retryAfterSec };
  }

  private evict() {
    const now = Date.now();
    for (const [k, b] of this.buckets) {
      // Drop buckets that have been full and idle for >10 min
      if (now - b.lastRefill > 10 * 60_000 && b.tokens >= this.capacity) {
        this.buckets.delete(k);
      }
    }
  }

  size() {
    return this.buckets.size;
  }
}

const g = globalThis as unknown as {
  __computegridMcpLimiter?: RateLimiter;
};
export const mcpLimiter =
  g.__computegridMcpLimiter ??
  (g.__computegridMcpLimiter = new RateLimiter({
    capacity: 60,
    refillPerMin: 60,
  }));

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
