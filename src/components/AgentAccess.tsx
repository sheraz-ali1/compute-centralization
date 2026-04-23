"use client";
import { Section } from "./Section";
import { useState } from "react";

const SNIPPET = "claude mcp add computegrid https://[host]/mcp";

export function AgentAccess() {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Section label="Agent access">
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-3">
          <div className="relative font-mono text-[13px] bg-muted/40 border border-border rounded-md px-4 py-3 group">
            <span className="text-muted-foreground select-none">$ </span>
            <span className="text-foreground select-all">{SNIPPET}</span>
            <button
              onClick={onCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded font-mono"
              aria-label="copy"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground font-mono">
            <span>
              <span className="text-foreground">list_gpus</span>(filters)
            </span>
            <span>
              <span className="text-foreground">find_cheapest</span>(model,
              count, max_price)
            </span>
          </div>
        </div>
        <div className="text-[13px] text-muted-foreground space-y-1 font-mono">
          <div>
            <span className="text-foreground">GET</span> /api/snapshot.json
          </div>
          <div>
            <span className="text-foreground">GET</span> /api/stream
          </div>
          <div>
            <span className="text-foreground">GET</span> /llms.txt
          </div>
        </div>
      </div>
    </Section>
  );
}
