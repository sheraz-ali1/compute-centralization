import { test, expect, vi, afterEach } from "vitest";
import { fetchGetdeploying } from "@/scrapers/getdeploying";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Regression: a partial scrape must fail loudly rather than return the
 * pages that happened to succeed.
 *
 * Returning partial rows reports as success, which walks straight past the
 * refresher's per-source stale-retention path and overwrites good rows with
 * an incomplete set. One blocked page took the live index from 532 rows to
 * 310 with ok=true everywhere. See
 * lessons/partial-scrape-silent-overwrite.md.
 */
test("throws when only some GPU pages fail", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("nvidia-h100")
        ? new Response("blocked", { status: 403 })
        : new Response("<html>no listings</html>", { status: 200 }),
    ),
  );

  await expect(fetchGetdeploying()).rejects.toThrow(/nvidia-h100/);
});

test("throws when every GPU page fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("blocked", { status: 403 })),
  );

  await expect(fetchGetdeploying()).rejects.toThrow(/pages failed/);
});

test("succeeds when every GPU page responds", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<html>no listings</html>", { status: 200 })),
  );

  await expect(fetchGetdeploying()).resolves.toEqual([]);
});
