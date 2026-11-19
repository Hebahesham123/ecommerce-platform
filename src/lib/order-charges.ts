/**
 * The two charges that sit between the basket and the total: the fee for
 * paying cash on delivery, and tax.
 *
 * Pure, and apart from the database read, for the same reason `shipping.ts`
 * is: these decide what a shopper pays, and that deserves tests that do not
 * need a database.
 *
 * Neither is stored in its own column — `place_store_order` takes a subtotal,
 * a shipping cost and a total, and nothing else. That is already how the
 * coupon works: the discount is folded into the total and written into the
 * order note. These follow it rather than changing the signature of the
 * function that every order on both channels goes through.
 */

import { foldPlace } from "@/lib/shipping";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.max(0, Math.round(n * 100) / 100);

// ---- Cash on delivery -------------------------------------------------------

/**
 * What the shopper pays for the privilege of paying cash.
 *
 * Only ever charged on a cash-on-delivery method, and only when the merchant
 * has entered a fee. An unset or zero `cod_fee` costs nothing, which is what
 * every order did before this was wired up.
 */
export function codFeeFor(paymentsSection: unknown, kind: string | null | undefined): number {
  if (kind !== "cod") return 0;
  const s = (paymentsSection ?? {}) as Record<string, unknown>;
  return money(num(s.cod_fee));
}

// ---- Tax --------------------------------------------------------------------

export type TaxSettings = {
  /** True when the prices on the shelf already contain the tax. */
  included: boolean;
  onShipping: boolean;
  /** Rate per region, as a fraction: 14% arrives as 0.14. */
  regions: { region: string; rate: number }[];
};

export type TaxResult = {
  /** The tax in the order. Added to the total only when `included` is false. */
  amount: number;
  /** True when it was already inside the prices, so the total does not move. */
  included: boolean;
  rate: number;
};

export function taxFrom(raw: unknown): TaxSettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(s.regions) ? s.regions : [];
  return {
    included: s.prices_include_tax === true || s.prices_include_tax === "true",
    onShipping: s.tax_on_shipping === true || s.tax_on_shipping === "true",
    regions: list
      .map((r) => {
        const o = (r ?? {}) as Record<string, unknown>;
        // The screen asks for a percentage, so 14 means 14%.
        return { region: String(o.region ?? "").trim(), rate: num(o.rate) / 100 };
      })
      .filter((r) => r.rate > 0),
  };
}

/**
 * The rate that applies to an address.
 *
 * A region left blank, or `*`, is the rate for everywhere — the usual case in
 * a country with one national VAT. A named region only applies to a matching
 * governorate, folded the same way shipping zones are so that spelling
 * variants agree.
 */
export function rateFor(settings: TaxSettings, governorate = ""): number {
  if (!settings.regions.length) return 0;
  const want = foldPlace(governorate);
  let fallback = 0;
  for (const r of settings.regions) {
    if (!r.region || r.region === "*") {
      fallback = fallback || r.rate;
      continue;
    }
    const got = foldPlace(r.region);
    if (got && want && (got === want || got.includes(want) || want.includes(got))) return r.rate;
  }
  return fallback;
}

/**
 * The tax on an order.
 *
 * When prices include tax, the amount is what is already inside them — worked
 * backwards, so the books can show it — and the total does not move. When they
 * do not, it is added on top. Shipping joins the taxed amount only if the
 * merchant said it should.
 *
 * With no rates configured this is zero and nothing changes.
 */
export function taxOn(
  settings: TaxSettings,
  opts: { goods: number; shipping: number; governorate?: string },
): TaxResult {
  const rate = rateFor(settings, opts.governorate ?? "");
  if (rate <= 0) return { amount: 0, included: settings.included, rate: 0 };

  const base = Math.max(0, opts.goods) + (settings.onShipping ? Math.max(0, opts.shipping) : 0);
  const amount = settings.included
    ? base - base / (1 + rate) // the share of a tax-inclusive price that is tax
    : base * rate;
  return { amount: money(amount), included: settings.included, rate };
}
