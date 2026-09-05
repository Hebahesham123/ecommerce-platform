import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/phone";

/**
 * Reading a customer's own account.
 *
 * The phone is a required argument, and it is the shopper whose data comes
 * back — so this must not live in a Server Action module. An action's
 * arguments are supplied by the caller and its id ships in the client bundle,
 * which would make "whose account?" a question any browser could answer for
 * itself. The website's action passes the session cookie's phone; the mobile
 * API passes the bearer token's. Both were verified by this server.
 */

export type AccountOrder = {
  orderNumber: string;
  total: number;
  createdAt: string;
  lifecycle: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

export type Account = {
  phone: string;
  name: string | null;
  email: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  orders: AccountOrder[];
};

/** One shopper's profile and recent orders, or null if we have neither. */
export async function accountFor(viewerPhone: string | null): Promise<Account | null> {
  if (!isSupabaseConfigured()) return null;
  const phone = viewerPhone;
  if (!phone) return null;

  try {
    const supabase = getServerSupabase();
    const [{ data: profile }, { data: verified }, { data: orders }] = await Promise.all([
      supabase
        .from("store_customers")
        .select("name,email,governorate,city,address")
        .eq("phone", phone)
        .maybeSingle(),
      // A phone verified at checkout has its name here and no profile row yet
      // (profiles are only written when an order is placed), so this is the
      // fallback for the name.
      supabase
        .from("verified_phones")
        .select("name")
        .eq("phone", phone)
        .maybeSingle(),
      supabase
        .from("store_orders")
        .select(
          "order_number,total,created_at,lifecycle,payment_status,fulfillment_status,customer_name,governorate,city,address",
        )
        // Orders written before phones were normalized are still this shopper's.
        .in("phone", phoneVariants(phone))
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // Their latest order carries a name and address even when there is no
    // profile row — better than showing a returning customer nothing but "—".
    const last = orders?.[0];
    return {
      phone,
      name:
        ((profile?.name as string) ||
          (verified?.name as string) ||
          (last?.customer_name as string)) ??
        null,
      email: (profile?.email as string) ?? null,
      governorate: ((profile?.governorate as string) || (last?.governorate as string)) ?? null,
      city: ((profile?.city as string) || (last?.city as string)) ?? null,
      address: ((profile?.address as string) || (last?.address as string)) ?? null,
      orders: (orders ?? []).map((o) => ({
        orderNumber: String(o.order_number),
        total: Number(o.total),
        createdAt: String(o.created_at),
        lifecycle: String(o.lifecycle),
        paymentStatus: String(o.payment_status),
        fulfillmentStatus: String(o.fulfillment_status),
      })),
    };
  } catch {
    return null;
  }
}
