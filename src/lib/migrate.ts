import fs from "node:fs";
import path from "node:path";
import { sql } from "@/lib/db";

export async function migrate() {
  // Look for migrations relative to either dev (src/lib/migrations) or
  // the .next standalone build output where the directory is copied via
  // experimental.outputFileTracingIncludes (configured in next.config.ts).
  const candidates = [
    path.join(process.cwd(), "src/lib/migrations"),
    path.join(process.cwd(), "lib/migrations"),
    path.join(process.cwd(), ".next/server/src/lib/migrations"),
  ];
  const dir = candidates.find((c) => {
    try {
      return fs.existsSync(c) && fs.statSync(c).isDirectory();
    } catch {
      return false;
    }
  });
  if (!dir) {
    console.warn("migrate: no migrations directory found at", candidates);
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.unsafe(text);
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
