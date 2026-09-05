/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { computeDiscount as builtinOffer } from "@/lib/offers";
import { phoneVariants } from "@/lib/phone";

/**
 * What a discount code is actually worth on this cart.
 *
 * 0001 gave the store a full Shopify-parity discounts table and an admin to
 * manage it; nothing ever read it. Checkout priced against the four hardcoded
 * codes in lib/offers.ts, so every code a merchant created was rejected at the
 * till. This is the missing half.
 *
 * Server-only and authoritative: the checkout page calls it through a server
 * action to preview a code, and placeOrder calls it again to price the order,
 * so a tampered client can never set its own discount.
 */

export type DiscountLine = {
  itemId: string;
  productName: string;
  price: number;
  quantity: number;
};

export type DiscountRejection =
  | "empty"
  | "unknown"
  | "inactive"
  | "not_started"
  | "expired"
  | "min_amount"
  | "min_quantity"
  | "usage_limit"
  | "already_used"
  | "not_eligible"
  | "no_matching_items"
  | "unsupported";

export type DiscountVerdict =
  | {
      ok: true;
      code: string;
      /** Human label for the checkout summary, e.g. "10% off" or the title. */
      label: string;
      amount: number;
      freeShipping: boolean;
      /** Where it came from — the merchant's table, or the legacy built-ins. */
      source: "table" | "builtin";
    }
  | {
      ok: false;
      reason: DiscountRejection;
      /** Present on min_amount / min_quantity so the UI can say how far off. */
      requiredAmount?: number;
      requiredQuantity?: number;
    };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type Row = Record<string, unknown>;
const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

/** `applies_to_ids` holds [{id,label}] but tolerate bare strings too. */
function refIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => (typeof e === "string" ? e : ((e as Row)?.id as string) ?? ""))
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/** Product names belonging to the given manual collections. */
async function namesInCollections(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  try {
    const { data } = await getServerSupabase()
      .from("collection_products")
      .select("product_name")
      .in("collection_id", ids);
    for (const r of (data ?? []) as Row[]) {
      const n = String(r.product_name ?? "").trim().toLowerCase();
      if (n) out.add(n);
    }
  } catch {
    /* a missing collections table just means nothing qualifies */
  }
  return out;
}

/**
 * The slice of the cart a product-scoped discount applies to.
 *
 * `all` is the whole cart; `products` matches variant ids; `collections`
 * matches by product name, which is what a collection membership stores.
 */
async function qualifyingTotal(
  row: Row,
  items: DiscountLine[],
  subtotal: number,
): Promise<number> {
  const scope = String(row.applies_to ?? "all");
  if (scope === "all") return subtotal;

  if (scope === "products") {
    const ids = new Set(refIds(row.applies_to_ids));
    return round2(
      items
        .filter((i) => ids.has(i.itemId))
        .reduce((s, i) => s + i.price * i.quantity, 0),
    );
  }

  const names = await namesInCollections(refIds(row.applies_to_ids));
  return round2(
    items
      .filter((i) => names.has(i.productName.trim().toLowerCase()))
      .reduce((s, i) => s + i.price * i.quantity, 0),
  );
}

/** Apply a percentage or a flat amount, never below zero or above the base. */
function applyValue(row: Row, base: number): number {
  const valueType = String(row.value_type ?? "percentage");
  const value = num(row.value) ?? 0;
  const raw = valueType === "percentage" ? (base * value) / 100 : value;
  return round2(Math.max(0, Math.min(raw, base)));
}

function labelFor(row: Row, amount: number): string {
  const title = String(row.title ?? "").trim();
  if (title) return title;
  const valueType = String(row.value_type ?? "percentage");
  const value = num(row.value) ?? 0;
  return valueType === "percentage" ? `${value}% off` : `${amount} off`;
}

/**
 * Validate a code against the merchant's own discounts, falling back to the
 * legacy built-in offers so codes that already worked keep working.
 */
export async function validateDiscount(
  rawCode: string | null | undefined,
  ctx: {
    subtotal: number;
    items: DiscountLine[];
    phone?: string | null;
    /** Only pass true when it is verifiably the customer's birthday. */
    birthday?: boolean;
  },
): Promise<DiscountVerdict> {
  const code = String(rawCode ?? "").trim();
  if (!code) return { ok: false, reason: "empty" };

  const fallback = (): DiscountVerdict => {
    const res = builtinOffer(code, ctx.subtotal, { birthday: ctx.birthday });
    if (res.ok && res.offer) {
      return {
        ok: true,
        code: res.offer.code,
        label: res.offer.labelEn,
        amount: round2(res.discount),
        freeShipping: false,
        source: "builtin",
      };
    }
    if (res.reason === "min_not_met" && res.offer)
      return { ok: false, reason: "min_amount", requiredAmount: res.offer.minSubtotal };
    if (res.reason === "birthday_only") return { ok: false, reason: "not_eligible" };
    return { ok: false, reason: "unknown" };
  };

  if (!isSupabaseConfigured()) return fallback();

  let row: Row | null = null;
  try {
    const { data } = await getServerSupabase()
      .from("discounts")
      .select("*")
      .ilike("code", code)
      .limit(1)
      .maybeSingle();
    row = (data as Row) ?? null;
  } catch {
    // The discounts table is optional to this flow; never block a checkout on it.
    return fallback();
  }
  if (!row) return fallback();

  // ---- Is it live? ----------------------------------------------------------
  if (String(row.method ?? "code") !== "code") return { ok: false, reason: "unknown" };
  if (String(row.status ?? "") === "draft") return { ok: false, reason: "inactive" };

  const now = Date.now();
  const startsAt = row.starts_at ? new Date(String(row.starts_at)).getTime() : null;
  const endsAt = row.ends_at ? new Date(String(row.ends_at)).getTime() : null;
  if (startsAt && startsAt > now) return { ok: false, reason: "not_started" };
  if (endsAt && endsAt < now) return { ok: false, reason: "expired" };

  // ---- Minimum purchase -----------------------------------------------------
  const totalQty = ctx.items.reduce((s, i) => s + i.quantity, 0);
  const minReq = String(row.min_requirement ?? "none");
  if (minReq === "minimum_amount") {
    const min = num(row.min_amount) ?? 0;
    if (ctx.subtotal < min)
      return { ok: false, reason: "min_amount", requiredAmount: min };
  }
  if (minReq === "minimum_quantity") {
    const min = num(row.min_quantity) ?? 0;
    if (totalQty < min)
      return { ok: false, reason: "min_quantity", requiredQuantity: min };
  }

  // ---- Usage limits ---------------------------------------------------------
  const limit = num(row.usage_limit_total);
  const used = num(row.used_count) ?? 0;
  if (limit != null && used >= limit) return { ok: false, reason: "usage_limit" };

  if (row.usage_limit_once_per_customer && ctx.phone) {
    try {
      const { data } = await getServerSupabase().rpc("discount_used_by", {
        p_code: code,
        p_phones: phoneVariants(ctx.phone),
      });
      if (Number(data ?? 0) > 0) return { ok: false, reason: "already_used" };
    } catch {
      /* helper not applied yet — fall through rather than block the sale */
    }
  }

  // Segment and named-customer eligibility isn't modelled on this store (the
  // account is a phone number, and segments live client-side), so a code
  // restricted to either is honoured by refusing it rather than quietly
  // handing it to everyone.
  if (String(row.eligibility ?? "all") !== "all") return { ok: false, reason: "not_eligible" };

  // ---- What it is worth -----------------------------------------------------
  const type = String(row.discount_type ?? "");

  if (type === "free_shipping") {
    // Shipping is free on every order today, so this is worth nothing in
    // money — but it is a valid code and must not read as rejected.
    return {
      ok: true,
      code: String(row.code ?? code),
      label: labelFor(row, 0),
      amount: 0,
      freeShipping: true,
      source: "table",
    };
  }

  if (type === "buy_x_get_y") {
    // Needs per-line "get" allocation the cart doesn't model yet. Saying so is
    // better than charging the wrong total.
    return { ok: false, reason: "unsupported" };
  }

  const base =
    type === "amount_off_products"
      ? await qualifyingTotal(row, ctx.items, ctx.subtotal)
      : ctx.subtotal;

  if (type === "amount_off_products" && base <= 0)
    return { ok: false, reason: "no_matching_items" };

  const amount = applyValue(row, base);
  return {
    ok: true,
    code: String(row.code ?? code),
    label: labelFor(row, amount),
    amount,
    freeShipping: false,
    source: "table",
  };
}

/**
 * Burn one use of a merchant code. Best-effort and race-safe: the SQL checks
 * the limit and increments in one statement, so the loser of a race simply
 * gets nothing back. Built-in offers have no counter to move.
 */
export async function redeemDiscount(code: string | null | undefined): Promise<void> {
  if (!code || !isSupabaseConfigured()) return;
  try {
    await getServerSupabase().rpc("redeem_discount", { p_code: code });
  } catch {
    /* the order is already placed; a missed counter must never fail it */
  }
}
