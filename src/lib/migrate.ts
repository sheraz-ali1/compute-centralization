import fs from "node:fs";
import path from "node:path";
import { sql } from "@/lib/db";

function findMigrationsDir(): string | null {
  // Try multiple cwd-relative paths. Railway (and most Next 16 deploys)
  // boot with cwd == project root, so src/lib/migrations resolves. For
  // standalone builds the path differs; both are tried.
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "src/lib/migrations"),
    path.join(cwd, "lib/migrations"),
    path.join(cwd, ".next/server/src/lib/migrations"),
    path.join(cwd, ".next/standalone/src/lib/migrations"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      /* try next */
    }
  }
  console.error("migrate: NO migrations directory found. Tried:", candidates);
  return null;
}

export async function migrate() {
  const dir = findMigrationsDir();
  if (!dir) {
    // Fail loud — better than silently running a server whose DB schema
    // doesn't exist.
    throw new Error(
      "migrate: could not resolve migrations directory — see console for tried paths",
    );
  }
  // Track applied migrations so future migrations (with real ALTER
  // statements) don't re-run on every boot. All current migrations use
  // `create ... if not exists` so this is forward-compatible too.
  await sql`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const done = await sql<{ name: string }[]>`
      select name from _migrations where name = ${f}
    `;
    if (done.length > 0) continue;
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.unsafe(text);
    await sql`insert into _migrations (name) values (${f}) on conflict do nothing`;
    console.log("migrate: applied", f);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
