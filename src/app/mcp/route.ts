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
      const rows = listGpus(input, (await readState()).rows);
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

import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { readState } from "@/lib/store";
import { mcpLimiter, clientIp } from "@/lib/rate-limit";

async function handle(req: Request): Promise<Response> {
  const ip = clientIp(req);
  const rl = mcpLimiter.check(ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32029,
          message: `Rate limit exceeded. Retry in ${rl.retryAfterSec}s.`,
        },
        id: null,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(rl.retryAfterSec),
          ...PUBLIC_CORS_HEADERS,
        },
      },
    );
  }
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(req);
  // Layer CORS headers onto the SDK's response
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(PUBLIC_CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
export async function OPTIONS() {
  return corsPreflight();
}
