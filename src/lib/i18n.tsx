"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

/**
 * Bilingual dictionary. Arabic is the primary language (RTL default),
 * English is the optional fallback. Add keys here as new UI strings appear.
 */
const dict = {
  brand: { ar: "متجر الأزياء", en: "Fashion Store" },
  search: { ar: "ابحث عن طلب، منتج، عميل…", en: "Search orders, products, customers…" },
  greeting: { ar: "أهلاً، هبة", en: "Hi, Heba" },

  // Navigation
  nav_overview: { ar: "نظرة عامة", en: "Overview" },
  nav_orders: { ar: "الطلبات", en: "Orders" },
  nav_products: { ar: "المنتجات", en: "Products" },
  nav_customers: { ar: "العملاء", en: "Customers" },
  nav_couriers: { ar: "الشحن والمندوبين", en: "Couriers" },
  nav_inbox: { ar: "المحادثات", en: "Inbox" },
  nav_marketing: { ar: "التسويق", en: "Marketing" },
  nav_settings: { ar: "الإعدادات", en: "Settings" },
  group_store: { ar: "المتجر", en: "Store" },
  group_engage: { ar: "التواصل", en: "Engage" },

  // Overview KPIs
  kpi_revenue: { ar: "الإيرادات", en: "Revenue" },
  kpi_orders: { ar: "الطلبات", en: "Orders" },
  kpi_aov: { ar: "متوسط قيمة الطلب", en: "Avg. order value" },
  kpi_cod_share: { ar: "نسبة الدفع عند الاستلام", en: "COD share" },
  kpi_return_rate: { ar: "نسبة المرتجعات", en: "Return rate" },
  kpi_pending_cod: { ar: "نقدية لم تُحصّل", en: "Uncollected COD" },
  vs_last_week: { ar: "مقارنة بالأسبوع الماضي", en: "vs last week" },

  sales_7d: { ar: "المبيعات آخر ٧ أيام", en: "Sales · last 7 days" },
  orders_by_status: { ar: "الطلبات حسب الحالة", en: "Orders by status" },
  recent_orders: { ar: "أحدث الطلبات", en: "Recent orders" },
  top_products: { ar: "الأكثر مبيعاً", en: "Top products" },
  needs_attention: { ar: "يحتاج انتباهك", en: "Needs attention" },
  view_all: { ar: "عرض الكل", en: "View all" },

  // Order table headers
  col_order: { ar: "الطلب", en: "Order" },
  col_customer: { ar: "العميل", en: "Customer" },
  col_total: { ar: "الإجمالي", en: "Total" },
  col_payment: { ar: "الدفع", en: "Payment" },
  col_fulfillment: { ar: "التنفيذ", en: "Fulfillment" },
  col_lifecycle: { ar: "المرحلة", en: "Stage" },
  col_governorate: { ar: "المحافظة", en: "Governorate" },
  col_date: { ar: "التاريخ", en: "Date" },
  col_courier: { ar: "المندوب", en: "Courier" },
  col_stock: { ar: "المخزون", en: "Stock" },
  col_price: { ar: "السعر", en: "Price" },
  col_status: { ar: "الحالة", en: "Status" },
  col_channel: { ar: "القناة", en: "Channel" },

  // Lifecycle
  s_placed: { ar: "تم الطلب", en: "Placed" },
  s_confirmed: { ar: "مؤكد", en: "Confirmed" },
  s_packed: { ar: "تم التغليف", en: "Packed" },
  s_shipped: { ar: "تم الشحن", en: "Shipped" },
  s_completed: { ar: "مكتمل", en: "Completed" },
  s_cancelled: { ar: "ملغي", en: "Cancelled" },
  // Payment
  p_pending: { ar: "بانتظار الدفع", en: "Pending" },
  p_authorized: { ar: "محجوز", en: "Authorized" },
  p_paid: { ar: "مدفوع", en: "Paid" },
  p_refunded: { ar: "مسترجع", en: "Refunded" },
  // Fulfillment
  f_unfulfilled: { ar: "لم يُنفّذ", en: "Unfulfilled" },
  f_assigned: { ar: "تم التعيين", en: "Assigned" },
  f_out: { ar: "خرج للتوصيل", en: "Out for delivery" },
  f_delivered: { ar: "تم التسليم", en: "Delivered" },
  f_returned: { ar: "مرتجع", en: "Returned" },

  cod: { ar: "عند الاستلام", en: "COD" },
  card: { ar: "بطاقة", en: "Card" },
  wallet: { ar: "محفظة", en: "Wallet" },

  filter_all: { ar: "الكل", en: "All" },
  export: { ar: "تصدير", en: "Export" },
  add_product: { ar: "إضافة منتج", en: "Add product" },
  reply: { ar: "رد", en: "Reply" },
  type_message: { ar: "اكتب رسالة…", en: "Type a message…" },

  // Couriers
  courier_cash: { ar: "نقدية محصّلة", en: "Cash collected" },
  courier_pending: { ar: "بانتظار التحصيل", en: "Pending collection" },
  active_deliveries: { ar: "توصيلات نشطة", en: "Active deliveries" },
  reconcile: { ar: "تسوية النقدية", en: "Reconcile cash" },

  // Marketing
  campaigns: { ar: "الحملات", en: "Campaigns" },
  abandoned_carts: { ar: "السلات المتروكة", en: "Abandoned carts" },
  whatsapp_broadcast: { ar: "رسالة واتساب جماعية", en: "WhatsApp broadcast" },
  quiet_hours: { ar: "ساعات الهدوء فعّالة (٩ص–٩م القاهرة)", en: "Quiet hours on (9am–9pm Cairo)" },

  in_stock: { ar: "متوفر", en: "In stock" },
  low_stock: { ar: "مخزون منخفض", en: "Low" },
  out_stock: { ar: "نفد", en: "Out" },
  unread: { ar: "غير مقروء", en: "Unread" },
} as const;

export type DictKey = keyof typeof dict;

type Ctx = { lang: Lang; dir: "rtl" | "ltr"; t: (k: DictKey) => string; toggle: () => void };

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    const stored = (typeof window !== "undefined" &&
      window.localStorage.getItem("lang")) as Lang | null;
    if (stored === "ar" || stored === "en") setLang(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    window.localStorage.setItem("lang", lang);
  }, [lang]);

  const value: Ctx = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t: (k) => dict[k][lang],
    toggle: () => setLang((l) => (l === "ar" ? "en" : "ar")),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used inside <LangProvider>");
  return ctx;
}

/** Format a number as Egyptian Pounds, locale-aware. */
export function egp(amount: number, lang: Lang = "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function num(n: number, lang: Lang = "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(n);
}
