import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { methodsFrom, type PaymentMethod } from "./payments";

/**
 * The methods both checkouts offer, read where they are rendered.
 *
 * Same row as the rest of the store's settings — one read, no migration for
 * what is a handful of short strings — and cached for a few seconds because
 * every checkout, on both storefronts, asks for it.
 */
let cache: { at: number; value: PaymentMethod[] } | null = null;
const CACHE_MS = 15_000;

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (!isSupabaseConfigured()) return methodsFrom(null);
  try {
    const { data } = await getServerSupabase()
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const all = (data?.data ?? {}) as Record<string, unknown>;
    const value = methodsFrom(all.payments);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // A checkout that cannot read the settings still has to take an order.
    return methodsFrom(null);
  }
}

/** Called after the Payments screen is saved, so the next checkout sees it. */
export function forgetPaymentMethods() {
  cache = null;
}
