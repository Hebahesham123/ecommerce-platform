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

export type DiscountReason = "ok" | "empty" | "unknown" | "min_not_met";

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

/** Authoritative discount calculation. Same result on client and server. */
export function computeDiscount(code: string | null | undefined, subtotal: number): DiscountResult {
  if (!code || !code.trim()) return { ok: false, discount: 0, offer: null, reason: "empty" };
  const offer = findOffer(code);
  if (!offer) return { ok: false, discount: 0, offer: null, reason: "unknown" };
  if (subtotal < offer.minSubtotal) return { ok: false, discount: 0, offer, reason: "min_not_met" };
  const raw = offer.kind === "percent" ? Math.round((subtotal * offer.value) / 100) : offer.value;
  const discount = Math.max(0, Math.min(raw, subtotal));
  return { ok: true, discount, offer, reason: "ok" };
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
