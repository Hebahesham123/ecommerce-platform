/**
 * Courier + shipment shapes, shared by the admin screens, the order page and
 * the courier portal. Pure types and labels — no server imports.
 */

export type Courier = {
  id: string;
  name: string;
  phone: string;
  zone: string | null;
  active: boolean;
  createdAt: string;
};

export type ShipmentStatus = "assigned" | "out_for_delivery" | "delivered" | "partial" | "failed" | "returned";
export type ReportStatus = "out_for_delivery" | "delivered" | "partial" | "failed" | "returned";

export type Shipment = {
  id: string;
  orderId: string;
  orderNumber: string;
  courierId: string | null;
  courierName: string | null;
  fee: number;
  status: ShipmentStatus;
  cashCollected: number;
  collectedMethod: string | null;
  proofUrl: string | null;
  reportedStatus: ReportStatus | null;
  reportedCash: number | null;
  reportedMethod: string | null;
  reportedNote: string | null;
  reportedProofUrl: string | null;
  reportedAt: string | null;
  confirmedAt: string | null;
  settledAt: string | null;
  assignedAt: string;
  /** Joined from the order, for the courier's own list. */
  orderTotal?: number;
  customerName?: string;
  address?: string | null;
  city?: string | null;
  governorate?: string | null;
  phone?: string | null;
};

export type AccountingEntry = {
  id: string;
  orderNumber: string | null;
  type: string;
  method: string | null;
  amount: number;
  courierId: string | null;
  courierName?: string | null;
  courierFee: number;
  net: number;
  note: string | null;
  createdAt: string;
};

export const SHIPMENT_STATUS: Record<ShipmentStatus, { ar: string; en: string; tone: "neutral" | "info" | "success" | "warning" | "critical" }> = {
  assigned: { ar: "تم التعيين", en: "Assigned", tone: "neutral" },
  out_for_delivery: { ar: "في الطريق", en: "Out for delivery", tone: "info" },
  delivered: { ar: "تم التسليم", en: "Delivered", tone: "success" },
  partial: { ar: "تسليم جزئي", en: "Partial", tone: "warning" },
  failed: { ar: "فشل التسليم", en: "Failed", tone: "critical" },
  returned: { ar: "مرتجع", en: "Returned", tone: "warning" },
};

export const REPORT_OPTIONS: { value: ReportStatus; ar: string; en: string }[] = [
  { value: "delivered", ar: "تم التسليم", en: "Delivered" },
  { value: "partial", ar: "تسليم جزئي", en: "Partial" },
  { value: "out_for_delivery", ar: "في الطريق", en: "Out for delivery" },
  { value: "failed", ar: "فشل التسليم", en: "Failed" },
  { value: "returned", ar: "مرتجع", en: "Returned" },
];

/** How cash/payment was collected on delivery — the channels the shop uses. */
export const COLLECTION_METHODS: { value: string; ar: string; en: string }[] = [
  { value: "cash", ar: "كاش", en: "Cash" },
  { value: "visa", ar: "فيزا", en: "Visa" },
  { value: "visa_machine", ar: "ماكينة فيزا", en: "Visa machine" },
  { value: "wallet", ar: "محفظة", en: "Wallet" },
  { value: "valu", ar: "فاليو", en: "ValU" },
  { value: "installments", ar: "تقسيط", en: "Installments" },
];

export function collectionMethodLabel(value: string | null | undefined, ar: boolean): string {
  const m = COLLECTION_METHODS.find((x) => x.value === value);
  return m ? (ar ? m.ar : m.en) : value || (ar ? "غير محدد" : "—");
}
