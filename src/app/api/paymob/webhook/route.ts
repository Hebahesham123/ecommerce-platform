import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getPaymobConfig, verifyPaymobHmac } from "@/lib/paymob-server";
import { postOrderSaleToJournal } from "@/lib/accounting/post-order";

/**
 * Paymob transaction webhook.
 *
 * Paymob POSTs the processed transaction here with `?hmac=` on the URL. We
 * verify that signature with the account's HMAC secret, find which order the
 * transaction belongs to (via the reference / extras we sent when opening the
 * intention), and record the payment on that order — once, guarded by the
 * paymob_payments row so a retried callback can't pay twice.
 *
 * Configure this URL as the Transaction Processed callback in the Paymob
 * dashboard: https://<your-domain>/api/paymob/webhook
 */

export const dynamic = "force-dynamic";

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const obj = (body.obj ?? body) as Record<string, unknown>;
  const received = new URL(req.url).searchParams.get("hmac") || s((body as Record<string, unknown>).hmac);

  const cfg = await getPaymobConfig();
  if (!verifyPaymobHmac(obj, received, cfg.hmacSecret)) {
    return NextResponse.json({ ok: false, error: "bad_hmac" }, { status: 401 });
  }

  // Which order is this? Gather every reference Paymob might echo back.
  const order = (obj.order ?? {}) as Record<string, unknown>;
  const claims = (obj.payment_key_claims ?? {}) as Record<string, unknown>;
  const extra = (claims.extra ?? {}) as Record<string, unknown>;
  const candidates = [order.merchant_order_id, extra.order_number, claims.order_id]
    .map((c) => s(c))
    .filter(Boolean);

  const supabase = getServerSupabase();
  type Mapping = { special_reference: string; order_number: string; status: string };
  let mapping: Mapping | null = null;
  if (candidates.length) {
    const bySpecial = await supabase.from("paymob_payments").select("special_reference,order_number,status").in("special_reference", candidates).maybeSingle();
    mapping = (bySpecial.data as unknown as Mapping | null) ?? null;
    if (!mapping) {
      const byOrder = await supabase
        .from("paymob_payments")
        .select("special_reference,order_number,status")
        .in("order_number", candidates)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      mapping = (byOrder.data as unknown as Mapping | null) ?? null;
    }
  }
  if (!mapping) return NextResponse.json({ ok: true, note: "no_matching_order" });

  const success = obj.success === true || obj.success === "true";
  const isRefund = obj.is_refunded === true || obj.is_refunded === "true";
  const txnId = s(obj.id);
  const amount = n(obj.amount_cents) / 100;

  if (mapping.status === "paid") return NextResponse.json({ ok: true, note: "already_recorded" });

  if (success && !isRefund) {
    const { error } = await supabase.rpc("order_record_payment", {
      p_order_number: mapping.order_number,
      p_kind: "payment",
      p_amount: amount,
      p_method: "card",
      p_reference: txnId,
      p_note: "Paymob card payment",
    });
    if (!error) {
      await supabase.from("paymob_payments").update({ status: "paid", transaction_id: txnId, updated_at: new Date().toISOString() }).eq("special_reference", mapping.special_reference);
      // Card payment is cash in — post a balanced journal entry (Debit card clearing, Credit sales).
      await postOrderSaleToJournal({ method: "card", amount, orderNumber: mapping.order_number, note: "دفع بالبطاقة (باي موب)" });
    }
  } else {
    await supabase.from("paymob_payments").update({ status: "failed", transaction_id: txnId, updated_at: new Date().toISOString() }).eq("special_reference", mapping.special_reference);
  }

  return NextResponse.json({ ok: true });
}
