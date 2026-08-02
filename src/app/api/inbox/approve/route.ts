import { NextResponse } from "next/server";
import { getChatServerClient } from "@/lib/chat/supabase-server";
import { sendText, getChannelCreds, type ChannelCreds } from "@/lib/whatsapp/client";
import { STAFF_MEMBERS } from "@/lib/chat/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/inbox/approve — approve (and optionally edit) a drafted bot reply,
// mark it reviewed + sent, and ship it. Body: { message_id, content?, staff_id? }
export async function POST(req: Request) {
  try {
    const { message_id, content, staff_id } = (await req.json()) as {
      message_id: string;
      content?: string;
      staff_id?: string;
    };
    if (!message_id) {
      return NextResponse.json({ success: false, error: "message_id is required" }, { status: 400 });
    }

    const supabase = getChatServerClient();
    const { data: draft, error: draftErr } = await supabase
      .from("messages")
      .select("id, conversation_id, content")
      .eq("id", message_id)
      .single();
    if (draftErr || !draft) throw draftErr ?? new Error("draft not found");

    const conversationId = draft.conversation_id as string;
    const finalContent = (content?.trim() || (draft.content as string) || "").trim();
    const edited = Boolean(content && content.trim() && content.trim() !== draft.content);

    const { data: conv } = await supabase
      .from("conversations")
      .select("customer_id, channel, wa_channel_id")
      .eq("id", conversationId)
      .single();
    const { data: customer } = conv
      ? await supabase.from("customer_profiles").select("phone").eq("id", conv.customer_id).single()
      : { data: null };

    let externalId: string | null = null;
    let sendError: string | null = null;
    const phone = (customer as { phone?: string } | null)?.phone;

    if (phone) {
      if ((conv as { channel?: string } | null)?.channel === "baileys") {
        const gatewayUrl = process.env.BAILEYS_GATEWAY_URL;
        if (gatewayUrl) {
          try {
            const res = await fetch(`${gatewayUrl}/send-text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Gateway-Secret": process.env.BAILEYS_GATEWAY_SECRET || "" },
              body: JSON.stringify({ phone: phone.replace(/^\+/, ""), text: finalContent }),
            });
            if (res.ok) externalId = ((await res.json().catch(() => ({}))) as Record<string, unknown>).messageId as string ?? null;
            else sendError = `Baileys gateway error ${res.status}`;
          } catch (e) {
            sendError = e instanceof Error ? e.message : String(e);
          }
        } else sendError = "BAILEYS_GATEWAY_URL not configured";
      } else {
        try {
          let creds: ChannelCreds | undefined;
          const waChannelId = (conv as { wa_channel_id?: string } | null)?.wa_channel_id;
          if (waChannelId) creds = await getChannelCreds(waChannelId);
          const waRes = await sendText(phone, finalContent, undefined, creds);
          externalId = waRes.messages?.[0]?.id ?? null;
        } catch (e) {
          sendError = e instanceof Error ? e.message : String(e);
        }
      }
    } else {
      sendError = "customer phone missing";
    }

    const now = new Date().toISOString();
    const staffName = STAFF_MEMBERS.find((s) => s.id === staff_id)?.name ?? null;
    await supabase
      .from("messages")
      .update({
        content: finalContent,
        reviewed_at: now,
        requires_review: false,
        was_sent: !sendError,
        sent_at: sendError ? null : now,
        external_message_id: externalId,
        error: sendError,
      })
      .eq("id", message_id);

    await supabase
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);

    return NextResponse.json({ success: !sendError, external_id: externalId, wa_error: sendError ?? undefined });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
