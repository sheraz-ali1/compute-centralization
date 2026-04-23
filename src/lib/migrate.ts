import fs from "node:fs";
import path from "node:path";
import { sql } from "@/lib/db";

export async function migrate() {
  const dir = path.join(process.cwd(), "src/lib/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.unsafe(text);
    console.log("applied", f);
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
