-- Serverless current-state store.
--
-- On Railway the process was long-lived, so the "current snapshot" lived in
-- an in-memory singleton (src/lib/cache.ts) written by a setInterval
-- refresher. On Vercel every request may hit a cold, isolated instance, so
-- that singleton is always empty. This table is the shared replacement:
-- one row holding the latest rows + recent activity events, plus a lease
-- column used to keep concurrent invocations from all refreshing at once.
create table if not exists app_state (
  id int primary key,
  fetched_at timestamptz,
  rows jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  -- Refresh lease. A would-be refresher claims it with a conditional
  -- UPDATE (see store.ts:acquireRefreshLease); the timestamp means a
  -- crashed invocation can't hold the lease forever.
  refresh_lease_until timestamptz
);

insert into app_state (id) values (1) on conflict (id) do nothing;
