"use client";
import { useOrigin } from "@/lib/use-origin";

export function AgentsInstall() {
  const origin = useOrigin();
  return (
    <pre>
      <code>claude mcp add computegrid {origin}/mcp</code>
    </pre>
  );
}
