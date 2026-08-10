import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  // Ensure SQL migration files are bundled into the serverless function
  // output so ensureMigrated() can read them at runtime. Only the /api
  // routes reach the migration path (the refresh flow); read paths tolerate
  // an unmigrated DB, so they don't need the files.
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/lib/migrations/**/*.sql"],
  },
};

export default nextConfig;
