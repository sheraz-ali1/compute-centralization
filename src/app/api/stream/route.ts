import { sseBus } from "@/lib/sse-bus";
import { cache } from "@/lib/cache";
import { PUBLIC_CORS_HEADERS, corsPreflight } from "@/lib/cors";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req);
  let unsub: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(
        enc.encode(
          `event: snapshot\ndata: ${JSON.stringify({
            rows: cache.getRows(),
            fetched_at: cache.getLastFetched(),
          })}\n\n`,
        ),
      );
      const sub = sseBus.subscribe(
        (payload) => controller.enqueue(enc.encode(payload)),
        ip,
      );
      if (sub === null) {
        // Either the global pool is full or this IP already holds its
        // per-client share. Close the stream cleanly with a notice.
        controller.enqueue(
          enc.encode(
            `event: error\ndata: ${JSON.stringify({
              code: "stream_capacity",
              message:
                "Live stream at capacity for this client. Close existing connections or try again shortly.",
            })}\n\n`,
          ),
        );
        controller.close();
        return;
      }
      unsub = sub;
      heartbeat = setInterval(
        () => controller.enqueue(enc.encode(": ping\n\n")),
        30_000,
      );
    },
    cancel() {
      unsub?.();
      if (heartbeat) clearInterval(heartbeat);
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
