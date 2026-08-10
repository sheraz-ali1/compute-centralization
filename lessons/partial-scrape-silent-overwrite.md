# Partial scrape silently overwrites good data

## The bug

Moving from Railway to Vercel (2026-08-10), the index quietly lost ~42% of its
rows: 532 → 310. Nothing errored. `/api/health` reported `ok: true`. The
`snapshots` table recorded `ok=true` for every source.

`getdeploying` — the aggregator that supplies 30+ of the ~49 providers — fetches
six GPU pages sequentially. From Vercel's datacenter IPs, `getdeploying.com`
returns **HTTP 403** for some pages (it serves a residential IP fine). One failed
page (`nvidia-h100`, the highest-volume model) dropped 418 rows to 196.

## The wrong shape

`fetchGetdeploying()` only threw when **every** page failed:

```ts
if (successes === 0) {
  throw new Error(`getdeploying: all ${GPU_SLUGS.length} pages failed`);
}
return all;  // 1 of 6 failed? returns a partial set, reported as success
```

The comment above that guard names the exact hazard it is defending against —
"otherwise the refresher's per-source stale-retention path doesn't trigger and we
silently wipe ~30 aggregator providers." The guard was written for total failure
and left the far more likely case, **partial** failure, wide open.

Downstream, `refreshOnce()` has a correct per-source retention path:

```ts
if (r.ok) allRows.push(...r.rows);
else allRows.push(...prevRows.filter((x) => rowSource(x) === r.source));
```

That path is only as good as the `ok` flag feeding it. A partial result flagged
`ok: true` walks straight past the retention logic and overwrites good rows.

**The general shape: a multi-part fetch that reports success when only some parts
succeeded.** Any all-or-nothing failure check (`successes === 0`,
`errors.length === total`) over a loop of independent sub-fetches has this bug.

## Why nothing caught it

- Tests use fixtures — a fixture is always a complete page, so partial-fetch
  behavior was never exercised.
- Health only asks "is the snapshot recent" and "is the DB up." Both stayed true.
- Row count is not asserted anywhere against a floor, and no per-source count is
  surfaced, so a 42% drop looked identical to a normal cycle.
- It is environment-dependent: it does not reproduce from a laptop, because the
  403 is triggered by datacenter IPs. Local verification will pass forever.

## The fix

Treat any failed page as a failed source, so the retention path that already
exists actually runs:

```ts
if (errors.length > 0) {
  throw new Error(
    `getdeploying: ${errors.length}/${GPU_SLUGS.length} pages failed — ${errors.join("; ")}`,
  );
}
```

The tradeoff is deliberate: retaining the previous complete set is better than
publishing a silently truncated one, because this is a *price index* — a missing
provider reads as "this provider has no offers," which is a wrong answer, not a
missing one.

The tradeoff has its own hazard, documented here so it isn't rediscovered: if a
source fails **chronically**, retention republishes last-known rows every cycle
under a fresh `fetched_at`, so `gpu_prices` accumulates history that looks live
but is frozen. Retention is a bridge over transient failure, not a substitute for
fixing a persistent one. A chronically-failing source needs a real resolution
(API access, a different fetch path), not a longer retention window.

## How the harness should treat this for any scraper/aggregator work

1. **Never let a multi-part fetch report success on partial results.** If the
   unit of work is N sub-fetches, the success condition is N successes, not ≥1.
   Anything less is a source failure.
2. **Assert a row-count floor per source**, not just "rows exist." A cycle that
   returns <60% of the trailing median for a source should fail loudly. Absolute
   counts drifting down is exactly what this class of bug looks like.
3. **Surface per-source counts in `/api/health`.** Aggregate health that only
   checks freshness + DB liveness cannot see a source going dark.
4. **Verify scrapers from the deployment environment, not just locally.** Any
   scraper touching a third-party site must be re-verified after a hosting
   change — bot protection keys on datacenter IP ranges, so a laptop check is
   not evidence. Compare per-source row counts before and after the move.
5. **Suspect the aggregator first when totals move.** One aggregator page can be
   worth more rows than every direct provider integration combined.
