import { getChatServerClient, chatConfigured } from "@/lib/chat/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events: the server subscribes to chat.* realtime with the
// service-role key (bypasses RLS) and streams change notifications to the
// browser. The browser never touches the chat tables directly.
export async function GET(req: Request) {
  if (!chatConfigured()) return new Response("not configured", { status: 503 });
  const supabase = getChatServerClient();
  const encoder = new TextEncoder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channel: any;
  let ping: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send({ type: "ready" });

      channel = supabase
        .channel(`inbox-${Math.random().toString(36).slice(2)}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("postgres_changes", { event: "*", schema: "chat", table: "messages" }, (p: any) =>
          send({ type: "message", conversationId: p?.new?.conversation_id ?? p?.old?.conversation_id ?? null }),
        )
        .on("postgres_changes", { event: "*", schema: "chat", table: "conversations" }, () =>
          send({ type: "conversation" }),
        )
        .subscribe();

      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        try {
          supabase.removeChannel(channel);
        } catch {
          /* noop */
        }
        try {
          controller.close();
        } catch {
          /* noop */
        }
      });
    },
    cancel() {
      clearInterval(ping);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
