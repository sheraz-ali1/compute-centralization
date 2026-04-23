import { Section } from "./Section";

export function AgentAccess() {
  return (
    <Section label="AGENT ACCESS">
      <div className="font-mono text-[13px] space-y-2">
        <div className="bg-foreground/5 rounded px-3 py-2 select-all">
          $ claude mcp add computegrid https://[host]/mcp
        </div>
        <div className="text-muted-foreground">
          tools:{" "}
          <span className="text-foreground/80">list_gpus(filters)</span> ·{" "}
          <span className="text-foreground/80">
            find_cheapest(model, count, max_price)
          </span>
        </div>
        <div className="text-muted-foreground">
          also: GET /api/snapshot.json · GET /llms.txt
        </div>
      </div>
    </Section>
  );
}
