export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Apply pending migrations BEFORE starting the refresher. On a fresh
  // Railway Postgres, snapshots/gpu_prices don't exist yet — without
  // this the refresher quietly fails every insert and find_cheapest
  // crashes when it queries gpu_prices.
  try {
    const { migrate } = await import("@/lib/migrate");
    await migrate();
    console.log("instrumentation: migrations applied");
  } catch (e) {
    console.error("instrumentation: migrations failed", e);
    // Fail loud — better than serving stale data with a broken DB.
    throw e;
  }
  const { startRefresher } = await import("@/lib/refresher");
  startRefresher();
}
