import { NextResponse } from "next/server";
import { getChatServerClient, chatConfigured } from "@/lib/chat/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!chatConfigured()) return NextResponse.json({ success: false, error: "not_configured" });
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "150", 10), 300);
    const status = url.searchParams.get("status");
    const q = (url.searchParams.get("q") ?? "").trim();
    const sb = getChatServerClient();
    let query = sb
      .from("bb_whatsapp_orders")
      .select(
        "id, order_id, order_name, customer_phone, customer_name, delivery_date, delivery_time, delivery_location, status, conversation_id, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && status !== "all") query = query.eq("status", status);
    if (q) query = query.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,order_name.ilike.%${q}%`);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message });
    return NextResponse.json({ success: true, data: data ?? [], count: count ?? 0 });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message });
  }
}
