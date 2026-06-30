import { NextResponse } from "next/server";
import { getChatServerClient, chatConfigured } from "@/lib/chat/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!chatConfigured()) return NextResponse.json({ success: false, error: "not_configured" });
  try {
    const sb = getChatServerClient();
    const headCount = async (table: string, eq?: [string, string]) => {
      let q = sb.from(table).select("id", { count: "exact", head: true });
      if (eq) q = q.eq(eq[0], eq[1]);
      const { count } = await q;
      return count ?? 0;
    };
    const [orders, confirmed, completed, campaigns, messages] = await Promise.all([
      headCount("bb_whatsapp_orders"),
      headCount("bb_whatsapp_orders", ["status", "confirmed"]),
      headCount("bb_whatsapp_orders", ["status", "completed"]),
      headCount("campaigns"),
      headCount("campaign_messages"),
    ]);
    return NextResponse.json({
      success: true,
      data: { orders, confirmed, completed, campaigns, messages },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message });
  }
}
