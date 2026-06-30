import { NextResponse } from "next/server";
import { getChatServerClient, chatConfigured } from "@/lib/chat/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/inbox/contact?phone= — a customer's orders + campaign engagement.
export async function GET(req: Request) {
  if (!chatConfigured()) return NextResponse.json({ success: false, error: "not_configured" });
  try {
    const phone = new URL(req.url).searchParams.get("phone");
    if (!phone) return NextResponse.json({ success: false, error: "phone required" }, { status: 400 });
    const sb = getChatServerClient();

    const [ordersRes, msgsRes] = await Promise.all([
      sb.from("bb_whatsapp_orders")
        .select("id, order_name, status, delivery_date, delivery_time, delivery_location, created_at")
        .eq("customer_phone", phone)
        .order("created_at", { ascending: false }),
      sb.from("campaign_messages")
        .select("id, campaign_id, status, clicked, delivered_at, read_at, clicked_at, created_at")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (ordersRes.error) throw ordersRes.error;

    const msgs = msgsRes.data ?? [];
    const campIds = [...new Set(msgs.map((m: Record<string, unknown>) => m.campaign_id).filter(Boolean))];
    let names: Record<string, string> = {};
    if (campIds.length) {
      const { data: camps } = await sb.from("campaigns").select("id, name").in("id", campIds);
      names = Object.fromEntries((camps ?? []).map((c: Record<string, unknown>) => [c.id, c.name]));
    }
    const messages = msgs.map((m: Record<string, unknown>) => ({
      id: m.id,
      campaignName: names[m.campaign_id as string] ?? "—",
      status: m.status,
      clicked: m.clicked,
      delivered: Boolean(m.delivered_at),
      read: Boolean(m.read_at),
      createdAt: m.created_at,
    }));

    return NextResponse.json({ success: true, orders: ordersRes.data ?? [], messages });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message });
  }
}
