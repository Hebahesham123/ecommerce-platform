import type { DictKey } from "./i18n";

// ---- Three-axis order state (critical for a COD market) ----
export type Lifecycle =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "completed"
  | "cancelled";
export type Payment = "pending" | "authorized" | "paid" | "refunded";
export type Fulfillment =
  | "unfulfilled"
  | "assigned"
  | "out"
  | "delivered"
  | "returned";
export type PayMethod = "cod" | "card" | "wallet";

export type Order = {
  id: string;
  customer: string;
  phone: string;
  governorate: string;
  total: number;
  method: PayMethod;
  lifecycle: Lifecycle;
  payment: Payment;
  fulfillment: Fulfillment;
  courier?: string;
  date: string;
  flag?: "fake_cod" | "return" | "unpaid_delivered";
};

const lifecycleKey: Record<Lifecycle, DictKey> = {
  placed: "s_placed",
  confirmed: "s_confirmed",
  packed: "s_packed",
  shipped: "s_shipped",
  completed: "s_completed",
  cancelled: "s_cancelled",
};
const paymentKey: Record<Payment, DictKey> = {
  pending: "p_pending",
  authorized: "p_authorized",
  paid: "p_paid",
  refunded: "p_refunded",
};
const fulfillmentKey: Record<Fulfillment, DictKey> = {
  unfulfilled: "f_unfulfilled",
  assigned: "f_assigned",
  out: "f_out",
  delivered: "f_delivered",
  returned: "f_returned",
};
const methodKey: Record<PayMethod, DictKey> = {
  cod: "cod",
  card: "card",
  wallet: "wallet",
};

export const labels = { lifecycleKey, paymentKey, fulfillmentKey, methodKey };

// Tailwind classes per status (tone-mapped, soft backgrounds)
export const tone = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-sky-50 text-sky-700",
  violet: "bg-violet-50 text-violet-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

export const lifecycleTone: Record<Lifecycle, string> = {
  placed: tone.slate,
  confirmed: tone.blue,
  packed: tone.violet,
  shipped: tone.violet,
  completed: tone.green,
  cancelled: tone.rose,
};
export const paymentTone: Record<Payment, string> = {
  pending: tone.amber,
  authorized: tone.blue,
  paid: tone.green,
  refunded: tone.slate,
};
export const fulfillmentTone: Record<Fulfillment, string> = {
  unfulfilled: tone.slate,
  assigned: tone.blue,
  out: tone.amber,
  delivered: tone.green,
  returned: tone.rose,
};

/**
 * There is no demo order list any more.
 *
 * Ten invented orders used to sit here and get appended to the real ones, so
 * the orders page, its revenue and the whole customers page read as fiction
 * once the store went live. Both now read store_orders and nothing else. The
 * Order type stays: it is the shape a real order is mapped into.
 */

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  variants: number;
  sold: number;
};

export const products: Product[] = [
  { id: "p1", name: "فستان كتان صيفي", sku: "DR-LIN-01", category: "فساتين", price: 850, stock: 42, variants: 9, sold: 128 },
  { id: "p2", name: "بلوزة حرير", sku: "TP-SLK-04", category: "بلوزات", price: 540, stock: 8, variants: 6, sold: 96 },
  { id: "p3", name: "بنطلون واسع", sku: "PT-WID-02", category: "بناطيل", price: 690, stock: 0, variants: 8, sold: 84 },
  { id: "p4", name: "جاكيت دنيم", sku: "JK-DNM-03", category: "جاكيتات", price: 1200, stock: 23, variants: 5, sold: 61 },
  { id: "p5", name: "تنورة ميدي", sku: "SK-MID-07", category: "تنانير", price: 480, stock: 5, variants: 7, sold: 73 },
  { id: "p6", name: "عباية مطرزة", sku: "AB-EMB-09", category: "عبايات", price: 1650, stock: 31, variants: 4, sold: 54 },
];

export type Courier = {
  id: string;
  name: string;
  zone: string;
  active: number;
  delivered: number;
  cashCollected: number;
  cashPending: number;
};

export const couriers: Courier[] = [
  { id: "c1", name: "كريم", zone: "القاهرة الكبرى", active: 6, delivered: 312, cashCollected: 18400, cashPending: 2160 },
  { id: "c2", name: "محمود", zone: "الجيزة", active: 4, delivered: 207, cashCollected: 11200, cashPending: 970 },
  { id: "c3", name: "سيد", zone: "الإسكندرية", active: 5, delivered: 184, cashCollected: 9650, cashPending: 1240 },
  { id: "c4", name: "Bosta", zone: "محافظات أخرى", active: 9, delivered: 421, cashCollected: 26800, cashPending: 3400 },
];

export type Conversation = {
  id: string;
  name: string;
  channel: "whatsapp" | "chat";
  last: string;
  time: string;
  unread: number;
  online?: boolean;
};

export const conversations: Conversation[] = [
  { id: "v1", name: "منى عبد الله", channel: "whatsapp", last: "طلبي #1042 وصل فين؟", time: "10:24", unread: 2, online: true },
  { id: "v2", name: "زائر #8821", channel: "chat", last: "عايزة أعرف مقاس M بيجي إزاي", time: "10:18", unread: 1, online: true },
  { id: "v3", name: "ياسمين فؤاد", channel: "whatsapp", last: "ممكن أبدّل المقاس؟", time: "09:51", unread: 0 },
  { id: "v4", name: "أحمد سمير", channel: "whatsapp", last: "تمام، شكراً ليكم 🌸", time: "09:30", unread: 0 },
  { id: "v5", name: "زائر #8814", channel: "chat", last: "في خصم على الفساتين؟", time: "09:12", unread: 0 },
];

export const sampleThread = [
  { from: "them" as const, text: "السلام عليكم، طلبي #1042 وصل فين؟", time: "10:20" },
  { from: "me" as const, text: "وعليكم السلام 🌸 طلبك خرج للتوصيل مع المندوب كريم، هيوصلك النهاردة بإذن الله.", time: "10:22" },
  { from: "them" as const, text: "تمام، ممكن أعرف معاد تقريبي؟", time: "10:23" },
  { from: "them" as const, text: "أنا في مدينة نصر", time: "10:24" },
];

// 7-day sales series for the overview chart
export const salesSeries = [
  { day: "السبت", dayEn: "Sat", sales: 9200, orders: 21 },
  { day: "الأحد", dayEn: "Sun", sales: 11800, orders: 27 },
  { day: "الإثنين", dayEn: "Mon", sales: 8600, orders: 19 },
  { day: "الثلاثاء", dayEn: "Tue", sales: 13400, orders: 31 },
  { day: "الأربعاء", dayEn: "Wed", sales: 12100, orders: 28 },
  { day: "الخميس", dayEn: "Thu", sales: 15600, orders: 36 },
  { day: "الجمعة", dayEn: "Fri", sales: 13900, orders: 33 },
];

export const statusBreakdown = [
  { key: "f_out", value: 18, tone: "#f59e0b" },
  { key: "f_delivered", value: 42, tone: "#10b981" },
  { key: "f_assigned", value: 12, tone: "#0ea5e9" },
  { key: "f_unfulfilled", value: 9, tone: "#94a3b8" },
  { key: "f_returned", value: 4, tone: "#f43f5e" },
] as const;
