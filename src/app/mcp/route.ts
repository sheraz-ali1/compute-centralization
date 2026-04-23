import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  listGpus,
  listGpusInput,
  findCheapest,
  findCheapestInput,
} from "@/lib/mcp/tools";

function buildServer() {
  const server = new Server(
    { name: "computegrid", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_gpus",
        description:
          "List available GPU offers across providers, with filters.",
        inputSchema: {
          type: "object",
          properties: {
            gpu_model: { type: "string" },
            provider: { type: "array", items: { type: "string" } },
            tier: { type: "array", items: { type: "string" } },
            max_price_per_gpu_hour: { type: "number" },
            min_vram_gb: { type: "number" },
            available_only: { type: "boolean", default: true },
            region: { type: "string" },
            limit: { type: "number", default: 100 },
          },
        },
      },
      {
        name: "find_cheapest",
        description:
          "Find the cheapest available offer for a specific GPU, with market context (median, total supply, 24h delta).",
        inputSchema: {
          type: "object",
          required: ["gpu_model"],
          properties: {
            gpu_model: { type: "string" },
            gpu_count: { type: "number", default: 1 },
            min_vram_gb: { type: "number" },
            tier: { type: "array", items: { type: "string" } },
            region: { type: "string" },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === "list_gpus") {
      const input = listGpusInput.parse(req.params.arguments ?? {});
      const rows = listGpus(input);
      return {
        content: [
          { type: "text", text: JSON.stringify({ rows }, null, 2) },
        ],
      };
    }
    if (req.params.name === "find_cheapest") {
      const input = findCheapestInput.parse(req.params.arguments ?? {});
      const result = await findCheapest(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    throw new Error(`unknown tool ${req.params.name}`);
  });

  return server;
}

async function handle(req: Request): Promise<Response> {
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(req);
  return response;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
export async function DELETE(req: Request) {
  return handle(req);
}
