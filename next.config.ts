import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  // Ensure SQL migration files are bundled into the production server output
  // so instrumentation.register() can read them at startup on Railway.
  outputFileTracingIncludes: {
    "/instrumentation": ["./src/lib/migrations/**/*.sql"],
    "/api/**/*": ["./src/lib/migrations/**/*.sql"],
  },
};

export default nextConfig;
