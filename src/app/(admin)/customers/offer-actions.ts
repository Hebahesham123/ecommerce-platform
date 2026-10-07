"use server";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import { mintPersonalCode, offerLabel } from "@/lib/exclusive-offers";
import type { ActionResult } from "../../store/actions";

type Row = Record<string, unknown>;

function mapError(message: string): string {
  return /customer_offers/i.test(message) ? "migration_missing" : message;
}

export type CustomerOffer = {
  id: string;
  code: string;
  label: string;
  message: string;
  endsAt: string;
  popup: boolean;
  createdAt: string;
  shownAt: string | null;
  claimedAt: string | null;
  cancelledAt: string | null;
  /** Used at checkout: the order went through with it. */
  used: boolean;
};

export type NewOffer = {
  phone: string;
  valueType: "percentage" | "fixed_amount";
  value: number;
  hours: number;
  minAmount: number | null;
  message: string;
  popup: boolean;
  popupSeconds: number;
};

/** Make an offer for one customer: a code only her phone can use, optionally popped up for her. */
export async function createCustomerOffer(input: NewOffer): Promise<ActionResult<CustomerOffer>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const phone = normalizePhone(input.phone);
    const supabase = getServerSupabase();
    const { data: who } = await supabase.from("store_customers").select("name").in("phone", phoneVariants(phone)).maybeSingle();
    const name = (who as { name?: string } | null)?.name || phone;

    const made = await mintPersonalCode(
      {
        valueType: input.valueType,
        value: input.value,
        hours: input.hours,
        minAmount: input.minAmount,
        title: `For ${name} · ${offerLabel(input)}`,
      },
      phone,
    );
    if (!made.ok) return made;

    const { data, error } = await supabase
      .from("customer_offers")
      .insert({
        phone,
        code: made.data.code,
        label: made.data.label,
        message: input.message.trim().slice(0, 300),
        value_type: input.valueType,
        value: input.value,
        min_amount: input.minAmount && input.minAmount > 0 ? input.minAmount : null,
        ends_at: made.data.endsAt,
        popup: input.popup,
        popup_seconds: Math.max(3, Math.min(120, Math.trunc(input.popupSeconds) || 8)),
      })
      .select("*")
      .single();
    if (error) return { ok: false, error: mapError(error.message) };
    return { ok: true, data: mapOffer(data as Row, false) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

function mapOffer(r: Row, used: boolean): CustomerOffer {
  return {
    id: String(r.id),
    code: String(r.code),
    label: String(r.label ?? ""),
    message: String(r.message ?? ""),
    endsAt: String(r.ends_at),
    popup: Boolean(r.popup),
    createdAt: String(r.created_at),
    shownAt: r.shown_at ? String(r.shown_at) : null,
    claimedAt: r.claimed_at ? String(r.claimed_at) : null,
    cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
    used,
  };
}

export async function listCustomerOffers(phone: string): Promise<ActionResult<CustomerOffer[]>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("customer_offers")
      .select("*")
      .in("phone", phoneVariants(phone))
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: mapError(error.message) };
    const rows = (data ?? []) as Row[];
    const codes = rows.map((r) => String(r.code));
    const used = new Set<string>();
    if (codes.length) {
      const { data: ds } = await supabase.from("discounts").select("code,used_count").in("code", codes);
      for (const d of (ds ?? []) as Row[]) if (Number(d.used_count ?? 0) > 0) used.add(String(d.code));
    }
    return { ok: true, data: rows.map((r) => mapOffer(r, used.has(String(r.code)))) };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}

/** Withdraw an offer: the code stops working and the popup stops showing. */
export async function cancelCustomerOffer(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("customer_offers")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", id)
      .select("code")
      .single();
    if (error) return { ok: false, error: mapError(error.message) };
    await supabase
      .from("discounts")
      .update({ status: "expired", ends_at: new Date().toISOString() })
      .eq("code", String((data as Row).code));
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: mapError((e as Error).message) };
  }
}
