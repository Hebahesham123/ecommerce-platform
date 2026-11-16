import { joinRoom } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live chat as it happens (server-sent events). The page opens one of these per live:
 *   event: comment   a new comment (same shape as GET /messages returns)
 *   event: viewers   { viewers } whenever someone joins or leaves
 * `?role=host` keeps the host out of the viewer count; it changes nothing else.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const role = new URL(req.url).searchParams.get("role") === "host" ? "host" : "viewer";
  const encoder = new TextEncoder();
  let leave = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed */
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      write("retry: 3000\n\n");
      leave = joinRoom(id, { role, send });
      // Keeps proxies and phones from closing an idle connection.
      ping = setInterval(() => write(": ping\n\n"), 20000);
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        leave();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      clearInterval(ping);
      leave();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
