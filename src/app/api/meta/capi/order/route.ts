import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { sendConversionEvent, sha256 } from "@/lib/meta";

// Server-side Conversions API for real WhatsApp orders.
// Wired to fire from a Supabase Database Webhook on the chat project's
// `bb_whatsapp_orders` table (INSERT). Every new order => one Purchase event.
// It reads the Meta token from meta_connection (main project) — no chat creds
// needed here, because the webhook delivers the order row in its payload.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://your-store.example.com";

// Normalise a phone to digits with country code (Meta match requirement).
// Egyptian local numbers like 01012345678 -> 201012345678.
function normPhone(p?: string | null): string | null {
  if (!p) return null;
  let d = String(p).replace(/[^0-9]/g, "");
  if (!d) return null;
  if (d.length === 11 && d.startsWith("0")) d = "20" + d.slice(1);
  return d;
}

type OrderRow = {
  id?: string | number;
  order_id?: string | number;
  order_name?: string;
  customer_phone?: string;
  customer_name?: string;
  status?: string;
  // optional monetary columns — used only if present
  total_amount?: number | string;
  total?: number | string;
  amount?: number | string;
  order_total?: number | string;
  grand_total?: number | string;
};

export async function POST(req: Request) {
  // 1) Shared-secret gate (set META_CAPI_WEBHOOK_SECRET + matching webhook header).
  const secret = process.env.META_CAPI_WEBHOOK_SECRET;
  if (secret) {
    const got =
      req.headers.get("x-webhook-secret") ||
      new URL(req.url).searchParams.get("secret");
    if (got !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Supabase webhook shape: { type, table, record, old_record }.
  // Also accept a raw order object for manual/testing calls.
  const b = body as { type?: string; record?: OrderRow } & OrderRow;
  const type = b?.type;
  if (type === "DELETE") return NextResponse.json({ ok: true, skipped: "delete" });
  const rec: OrderRow = (b?.record ?? b) as OrderRow;

  const orderId = String(rec.order_id ?? rec.id ?? "").trim();
  if (!orderId) return NextResponse.json({ ok: false, error: "missing_order_id" }, { status: 400 });

  // 2) Load Meta connection (token + pixel) from the main project.
  const supabase = getServerSupabase();
  const { data: conn } = await supabase
    .from("meta_connection")
    .select("access_token,pixel_id,capi_enabled,test_event_code")
    .eq("id", "default")
    .single();

  const token = conn?.access_token as string | undefined;
  const pixelId = conn?.pixel_id as string | undefined;
  if (!token || !pixelId) {
    return NextResponse.json({ ok: false, error: "meta_not_connected" }, { status: 200 });
  }
  if (conn?.capi_enabled === false) {
    return NextResponse.json({ ok: true, skipped: "capi_disabled" });
  }

  // 3) Build hashed customer data for matching.
  const phone = normPhone(rec.customer_phone);
  const name = String(rec.customer_name ?? "").trim();
  const [first, ...rest] = name ? name.split(/\s+/) : [];
  const last = rest.join(" ");

  const user_data: Record<string, string[] | string> = {};
  if (phone) user_data.ph = [sha256(phone)];
  if (first) user_data.fn = [sha256(first)];
  if (last) user_data.ln = [sha256(last)];

  // Optional order value, only if the orders table has such a column.
  const rawValue =
    rec.total_amount ?? rec.total ?? rec.amount ?? rec.order_total ?? rec.grand_total;
  const value = rawValue != null && !isNaN(Number(rawValue)) ? Number(rawValue) : undefined;

  const custom_data: Record<string, unknown> = { currency: "EGP", order_id: orderId };
  if (value !== undefined) custom_data.value = value;

  // 4) Send the Purchase event. order_id is the dedup key (event_id).
  //    Add ?test=1 to the URL to route this event to Meta's "Test Events" tab
  //    (uses the saved test_event_code) for instant verification. Real webhook
  //    calls omit it and go to live tracking.
  const wantTest = new URL(req.url).searchParams.get("test") === "1";
  const testCode = wantTest ? (conn?.test_event_code as string) || undefined : undefined;
  try {
    const res = await sendConversionEvent(
      pixelId,
      token,
      {
        event_name: "Purchase",
        event_id: orderId,
        event_source_url: SITE_URL,
        user_data,
        custom_data,
      },
      testCode,
    );
    await supabase.from("meta_events").insert({
      event_name: "Purchase",
      event_id: orderId,
      source: "capi",
      status: "sent",
      payload: { order_id: orderId, has_phone: Boolean(phone), value: value ?? null },
      response: res,
    });
    return NextResponse.json({
      ok: true,
      events_received: res.events_received ?? 0,
      trace: res.fbtrace_id ?? null,
    });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("meta_events").insert({
      event_name: "Purchase",
      event_id: orderId,
      source: "capi",
      status: "error",
      payload: { order_id: orderId },
      response: { error: msg },
    });
    // 200 so the webhook does not spam-retry on a permanent error; it's logged.
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}

// Simple health check.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "meta-capi-order", ts: Date.now() });
}
