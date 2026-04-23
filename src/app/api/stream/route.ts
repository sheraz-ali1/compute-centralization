import { sseBus } from "@/lib/sse-bus";
import { cache } from "@/lib/cache";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req);
  let unsub: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsub?.();
    if (heartbeat) clearInterval(heartbeat);
  };

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          // Stream was closed underneath us (common when client drops
          // without the TCP-level cancel firing). Clean up so we don't
          // leak a listener slot.
          cleanup();
          return false;
        }
      };

      safeEnqueue(
        enc.encode(
          `event: snapshot\ndata: ${JSON.stringify({
            rows: cache.getRows(),
            fetched_at: cache.getLastFetched(),
          })}\n\n`,
        ),
      );

      const sub = sseBus.subscribe(
        (payload) => safeEnqueue(enc.encode(payload)),
        ip,
      );
      if (sub === null) {
        safeEnqueue(
          enc.encode(
            `event: error\ndata: ${JSON.stringify({
              code: "stream_capacity",
              message:
                "Live stream at capacity for this client. Close existing connections or try again shortly.",
            })}\n\n`,
          ),
        );
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        return;
      }
      unsub = sub;
      heartbeat = setInterval(() => {
        safeEnqueue(enc.encode(": ping\n\n"));
      }, 30_000);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      ...PUBLIC_CORS_HEADERS,
    },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
