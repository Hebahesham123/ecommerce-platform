// Shared offer / coupon engine + delivery slot definitions.
// Imported by BOTH the checkout client UI (for display) and the server action
// (for authoritative validation) so pricing can never be faked from the client.

export type Offer = {
  code: string;
  kind: "percent" | "fixed";
  value: number; // percent (0–100) or a fixed EGP amount
  minSubtotal: number; // minimum subtotal (EGP) required to qualify
  labelAr: string;
  labelEn: string;
  birthdayOnly?: boolean; // only valid on the customer's birthday
};

/**
 * Birthday gift coupon — kept OUT of the public OFFERS list. It only applies on
 * the customer's birthday, which is validated against their saved profile.
 */
export const BIRTHDAY_OFFER: Offer = {
  code: "BIRTHDAY",
  kind: "percent",
  value: 20,
  minSubtotal: 0,
  labelAr: "هدية عيد ميلادك 🎂 خصم ٢٠٪",
  labelEn: "Birthday gift 🎂 20% off",
  birthdayOnly: true,
};

/**
 * Demo offers — edit freely. `BUNDLE15` is framed as a "bundle & save" deal.
 * Free shipping is already included on every order, so there's no shipping code.
 */
export const OFFERS: Offer[] = [
  { code: "WELCOME10", kind: "percent", value: 10, minSubtotal: 0, labelAr: "خصم ترحيبي ١٠٪", labelEn: "10% welcome" },
  { code: "SAVE50", kind: "fixed", value: 50, minSubtotal: 500, labelAr: "خصم ٥٠ ج على ٥٠٠+", labelEn: "50 EGP off 500+" },
  { code: "BUNDLE15", kind: "percent", value: 15, minSubtotal: 1000, labelAr: "وفّر ١٥٪ على الباقات ١٠٠٠+", labelEn: "15% bundle off 1000+" },
];

export type DiscountReason = "ok" | "empty" | "unknown" | "min_not_met" | "birthday_only";

export type DiscountResult = {
  ok: boolean;
  discount: number; // EGP amount to subtract
  offer: Offer | null;
  reason: DiscountReason;
};

export function findOffer(code: string | null | undefined): Offer | null {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  return OFFERS.find((o) => o.code === c) ?? null;
}

/**
 * Authoritative discount calculation. Same result on client and server.
 * Pass `opts.birthday = true` only when it's verified to be the customer's
 * birthday — required for the BIRTHDAY coupon to apply.
 */
export function computeDiscount(
  code: string | null | undefined,
  subtotal: number,
  opts?: { birthday?: boolean },
): DiscountResult {
  if (!code || !code.trim()) return { ok: false, discount: 0, offer: null, reason: "empty" };
  const c = code.trim().toUpperCase();

  // Birthday coupon — only valid on the customer's birthday.
  if (c === BIRTHDAY_OFFER.code) {
    if (!opts?.birthday) return { ok: false, discount: 0, offer: BIRTHDAY_OFFER, reason: "birthday_only" };
    const raw = Math.round((subtotal * BIRTHDAY_OFFER.value) / 100);
    return { ok: true, discount: Math.max(0, Math.min(raw, subtotal)), offer: BIRTHDAY_OFFER, reason: "ok" };
  }

  const offer = findOffer(c);
  if (!offer) return { ok: false, discount: 0, offer: null, reason: "unknown" };
  if (subtotal < offer.minSubtotal) return { ok: false, discount: 0, offer, reason: "min_not_met" };
  const raw = offer.kind === "percent" ? Math.round((subtotal * offer.value) / 100) : offer.value;
  const discount = Math.max(0, Math.min(raw, subtotal));
  return { ok: true, discount, offer, reason: "ok" };
}

/** True when `birthday` (yyyy-mm-dd) falls on the same month/day as `now`. */
export function isBirthday(birthday: string | null | undefined, now: Date): boolean {
  if (!birthday) return false;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return false;
  return b.getUTCMonth() === now.getMonth() && b.getUTCDate() === now.getDate();
}

// ---- Delivery time slots ----------------------------------------------------
export type DeliverySlot = { id: string; ar: string; en: string };

export const DELIVERY_SLOTS: DeliverySlot[] = [
  { id: "morning", ar: "صباحاً · ٩–١٢", en: "Morning · 9–12" },
  { id: "afternoon", ar: "ظهراً · ١٢–٣", en: "Afternoon · 12–3" },
  { id: "evening", ar: "عصراً · ٣–٦", en: "Evening · 3–6" },
  { id: "night", ar: "مساءً · ٦–٩", en: "Night · 6–9" },
];

export function slotLabel(id: string | null | undefined, lang: "ar" | "en" = "ar"): string {
  const s = DELIVERY_SLOTS.find((x) => x.id === id);
  return s ? s[lang] : "";
}
