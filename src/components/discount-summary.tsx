"use client";

import { useI18n, egp, num, type Lang } from "@/lib/i18n";
import type { Discount } from "@/lib/discounts";

/** One-line human summary, e.g. "10% off entire order" / "خصم ١٠٪ على الطلب". */
export function summaryLine(d: Discount, lang: Lang): string {
  const ar = lang === "ar";
  const val = (vt: typeof d.valueType, v: number | null) => {
    if (v === null) return ar ? "—" : "—";
    return vt === "percentage" ? `${num(v, lang)}%` : egp(v, lang);
  };

  switch (d.discountType) {
    case "amount_off_order":
      return ar
        ? `${val(d.valueType, d.value)} خصم على الطلب`
        : `${val(d.valueType, d.value)} off entire order`;
    case "amount_off_products": {
      const scope =
        d.appliesTo === "all"
          ? ar ? "كل المنتجات" : "all products"
          : d.appliesTo === "collections"
            ? ar ? "مجموعات محددة" : "specific collections"
            : ar ? "منتجات محددة" : "specific products";
      return ar
        ? `${val(d.valueType, d.value)} خصم على ${scope}`
        : `${val(d.valueType, d.value)} off ${scope}`;
    }
    case "buy_x_get_y": {
      const buy = d.buyValue ?? 0;
      const get = d.getQuantity ?? 0;
      if (ar)
        return `اشترِ ${num(buy, lang)} واحصل على ${num(get, lang)} ${d.getIsFree ? "مجاناً" : "بخصم"}`;
      return `Buy ${num(buy, lang)}, get ${num(get, lang)} ${d.getIsFree ? "free" : "discounted"}`;
    }
    case "free_shipping":
      return ar ? "شحن مجاني" : "Free shipping";
    default:
      return "";
  }
}

export function DiscountSummary({ d }: { d: Discount }) {
  const { lang } = useI18n();
  return <>{summaryLine(d, lang)}</>;
}
