import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

/**
 * Lazily initialize the Postgres client. Imports are dependency-free so a
 * missing/wrong DATABASE_URL doesn't crash the container at module load
 * (which would kill every route, including /api/health, and cause a
 * Railway CrashLoopBackOff). Instead, the first query throws — callers
 * can catch and report a degraded state.
 */
function getClient(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set");
  }
  client = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    // Cap any single statement at 10s so a hung Postgres can't wedge a
    // refresh cycle or a health check indefinitely.
    connection: { statement_timeout: 10_000 },
  });
  return client;
}

/**
 * Tagged template proxy. `sql\`select …\`` works exactly as before, but
 * the underlying client is only created on first call. Also exposes
 * `.unsafe` and `.json` for the few places that need them.
 */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_t, _this, args: unknown[]) {
    // porsager/postgres's sql is a function you call with a template
    // string array; forward directly.
    return (
      getClient() as unknown as (...a: unknown[]) => unknown
    )(...args);
  },
  get(_t, prop: string | symbol) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
}) as Sql;
