// Public read-only endpoints (snapshot.json, stream, health, llms.txt)
// should be callable from any origin — agents and browser clients alike.
// MCP endpoint is also public.
export const PUBLIC_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers":
    "content-type, accept, mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: PUBLIC_CORS_HEADERS,
  });
}
