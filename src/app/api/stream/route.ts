import { sseBus } from "@/lib/sse-bus";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  let unsub: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      // initial snapshot
      controller.enqueue(
        enc.encode(
          `event: snapshot\ndata: ${JSON.stringify({
            rows: cache.getRows(),
            fetched_at: cache.getLastFetched(),
          })}\n\n`,
        ),
      );
      unsub = sseBus.subscribe((payload) => controller.enqueue(enc.encode(payload)));
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
    },
  });
}
