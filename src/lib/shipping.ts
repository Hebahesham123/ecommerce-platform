/**
 * What delivery costs, decided from the merchant's Shipping settings.
 *
 * Pure on purpose, and kept apart from the database read in
 * `shipping-server.ts`, the same way `payments.ts` is kept apart from
 * `payments-server.ts`: the zone matching is the part worth testing, and a
 * test should not need a database to ask what Giza costs.
 *
 * The shape comes from the Shipping section of `settings.ts`:
 *
 *   free_shipping_enabled   toggle
 *   free_shipping_threshold number
 *   zones[]                 { name, areas, rate_name, rate_price }
 *
 * where `areas` is whatever the merchant typed into one box — a list of
 * governorates separated by commas, Arabic commas, slashes or newlines.
 */

export type ShippingZone = {
  name: string;
  /** Governorates this zone covers, as the merchant typed them. */
  areas: string;
  rateName: string;
  price: number;
};

export type ShippingSettings = {
  freeOver: number | null;
  zones: ShippingZone[];
};

export type ShippingQuote = {
  /** What to charge. Always a number, never NaN. */
  cost: number;
  /** The zone that decided it, empty when nothing matched. */
  zone: string;
  rateName: string;
  /** True when a zone was found but the order earned free delivery. */
  waived: boolean;
  /** False when the merchant has not set up any zone yet. */
  configured: boolean;
  /** True when zones exist but none covers this address. */
  unmatched: boolean;
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
};
const text = (v: unknown): string => (v == null ? "" : String(v)).trim();

/**
 * Fold an Egyptian place name down to something two spellings can share.
 *
 * "محافظة الجيزة", "الجيزة" and "جيزة" are one place, and a merchant typing a
 * zone will not match a shopper's address character for character. So: drop
 * the word for "governorate" and the leading article, flatten the alef and ya
 * and ta-marbuta variants that Egyptian typing mixes freely, strip tatweel and
 * diacritics, and casefold the Latin.
 */
export function foldPlace(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // harakat and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\bmuhafazat\b|\bgovernorate\b/g, "")
    .replace(/محافظه|محافظة/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^\s*ال/, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Split the one "areas" box into the places it lists. */
export function splitAreas(areas: string): string[] {
  return String(areas ?? "")
    .split(/[,،;/|\n\r]+/)
    .map((a) => foldPlace(a))
    .filter(Boolean);
}

/** Read the Shipping section into a shape the quote can use. */
export function shippingFrom(raw: unknown): ShippingSettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  const on = s.free_shipping_enabled === true || s.free_shipping_enabled === "true";
  const threshold = num(s.free_shipping_threshold);
  const list = Array.isArray(s.zones) ? s.zones : [];
  const zones: ShippingZone[] = list
    .map((z) => {
      const o = (z ?? {}) as Record<string, unknown>;
      return {
        name: text(o.name),
        areas: text(o.areas),
        rateName: text(o.rate_name),
        price: num(o.rate_price),
      };
    })
    // A zone with no name and no areas is an empty row the merchant added and
    // never filled in; it should not become a catch-all that bills everyone.
    .filter((z) => z.name || z.areas);
  return { freeOver: on && threshold > 0 ? threshold : null, zones };
}

/**
 * Which zone covers this address?
 *
 * An exact fold match wins. Failing that a zone whose listed area contains the
 * address word (or the reverse) matches, so "6th of October" finds a zone
 * listing "October". A zone whose areas box is blank or `*` is the catch-all
 * and is only used when nothing more specific matched.
 */
export function zoneFor(
  zones: ShippingZone[],
  governorate: string,
  city = "",
): ShippingZone | null {
  const wanted = [foldPlace(governorate), foldPlace(city)].filter(Boolean);
  if (!zones.length) return null;

  let catchAll: ShippingZone | null = null;
  const loose: ShippingZone[] = [];

  for (const z of zones) {
    const areas = splitAreas(z.areas);
    if (!areas.length || z.areas.trim() === "*") {
      catchAll = catchAll ?? z;
      continue;
    }
    for (const a of areas) {
      for (const w of wanted) {
        if (a === w) return z; // exact beats everything
        if (a.length > 2 && w.length > 2 && (a.includes(w) || w.includes(a))) {
          loose.push(z);
        }
      }
    }
  }
  return loose[0] ?? catchAll;
}

/**
 * What this order pays for delivery.
 *
 * `goods` is the value of the basket the threshold is judged on — the subtotal
 * after any discount, because "free delivery over 1000" is about what the
 * shopper spends, not what the basket listed before a coupon.
 *
 * Every unset case returns 0. A store that has configured no zones charges
 * nothing, which is exactly what it did before any of this existed, so
 * switching this on cannot surprise a shopper with a fee the merchant never
 * entered.
 */
export function quoteShipping(
  settings: ShippingSettings,
  opts: { goods: number; governorate?: string; city?: string },
): ShippingQuote {
  const empty: ShippingQuote = {
    cost: 0,
    zone: "",
    rateName: "",
    waived: false,
    configured: settings.zones.length > 0,
    unmatched: false,
  };
  if (!settings.zones.length) return empty;

  const zone = zoneFor(settings.zones, opts.governorate ?? "", opts.city ?? "");
  if (!zone) return { ...empty, unmatched: true };

  const base = Math.max(0, Math.round(zone.price * 100) / 100);
  const waived = settings.freeOver != null && opts.goods >= settings.freeOver;
  return {
    cost: waived ? 0 : base,
    zone: zone.name,
    rateName: zone.rateName,
    waived,
    configured: true,
    unmatched: false,
  };
}
