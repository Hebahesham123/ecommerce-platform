/**
 * Shapes + bilingual labels for the native Courier System suite (requests
 * inbox, warehouse intake, audit log, staff directory). Pure types and label
 * maps — no server imports, so client components can import it freely.
 */

type Tone = "neutral" | "info" | "success" | "warning" | "attention" | "critical";

// ---- Requests ---------------------------------------------------------------
export type RequestStatus = "pending" | "process" | "approved" | "cancelled";

export type CourierRequest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  comment: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  status: RequestStatus;
  assignee: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RequestNote = {
  id: string;
  requestId: string;
  note: string;
  author: string | null;
  createdAt: string;
};

export const REQUEST_STATUS: Record<RequestStatus, { ar: string; en: string; tone: Tone }> = {
  pending: { ar: "قيد الانتظار", en: "Pending", tone: "warning" },
  process: { ar: "قيد المعالجة", en: "In process", tone: "info" },
  approved: { ar: "تمت الموافقة", en: "Approved", tone: "success" },
  cancelled: { ar: "ملغى", en: "Cancelled", tone: "critical" },
};

// ---- Warehouse --------------------------------------------------------------
export type WarehouseSource = "returned" | "failed" | "other";
export type WarehouseCondition = "good" | "damaged" | "unknown";
export type WarehouseStatus = "in_warehouse" | "restocked" | "needs_repair" | "scrapped";

export type WarehouseItem = {
  id: string;
  orderNumber: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  source: WarehouseSource;
  condition: WarehouseCondition;
  status: WarehouseStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export const WAREHOUSE_SOURCE: Record<WarehouseSource, { ar: string; en: string }> = {
  returned: { ar: "مرتجع", en: "Returned" },
  failed: { ar: "فشل التسليم", en: "Failed delivery" },
  other: { ar: "أخرى", en: "Other" },
};

export const WAREHOUSE_CONDITION: Record<WarehouseCondition, { ar: string; en: string; tone: Tone }> = {
  good: { ar: "سليم", en: "Good", tone: "success" },
  damaged: { ar: "تالف", en: "Damaged", tone: "critical" },
  unknown: { ar: "غير محدد", en: "Unknown", tone: "neutral" },
};

export const WAREHOUSE_STATUS: Record<WarehouseStatus, { ar: string; en: string; tone: Tone }> = {
  in_warehouse: { ar: "في المستودع", en: "In warehouse", tone: "info" },
  restocked: { ar: "أُعيد للمخزون", en: "Restocked", tone: "success" },
  needs_repair: { ar: "يحتاج إصلاح", en: "Needs repair", tone: "warning" },
  scrapped: { ar: "تالف نهائياً", en: "Scrapped", tone: "critical" },
};

// ---- Audit log --------------------------------------------------------------
export type CourierLog = {
  id: string;
  actor: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  orderNumber: string | null;
  detail: string | null;
  createdAt: string;
};

/** Friendly bilingual label for an audit action code. */
export const LOG_ACTION: Record<string, { ar: string; en: string; tone: Tone }> = {
  assign: { ar: "تعيين مندوب", en: "Assign", tone: "info" },
  confirm_report: { ar: "تأكيد تقرير", en: "Confirm report", tone: "success" },
  shipment_fees: { ar: "رسوم ووسوم", en: "Fees & tags", tone: "info" },
  settle: { ar: "تسوية نقدية", en: "Settle cash", tone: "success" },
  courier_create: { ar: "إضافة مندوب", en: "New courier", tone: "neutral" },
  courier_update: { ar: "تعديل مندوب", en: "Edit courier", tone: "neutral" },
  courier_report: { ar: "تقرير مندوب", en: "Courier report", tone: "warning" },
  request_create: { ar: "طلب جديد", en: "New request", tone: "neutral" },
  request_status: { ar: "حالة طلب", en: "Request status", tone: "info" },
  request_assign: { ar: "إسناد طلب", en: "Assign request", tone: "info" },
  warehouse_intake: { ar: "إدخال مستودع", en: "Warehouse intake", tone: "warning" },
  warehouse_update: { ar: "تعديل مستودع", en: "Warehouse edit", tone: "neutral" },
  staff_create: { ar: "إضافة موظف", en: "New staff", tone: "neutral" },
  staff_update: { ar: "تعديل موظف", en: "Edit staff", tone: "neutral" },
};

export function logActionLabel(action: string, ar: boolean): string {
  const m = LOG_ACTION[action];
  return m ? (ar ? m.ar : m.en) : action;
}

// ---- Staff ------------------------------------------------------------------
export type StaffRole = "admin" | "accountant" | "warehouse" | "manager";

export type StaffUser = {
  id: string;
  name: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export const STAFF_ROLE: Record<StaffRole, { ar: string; en: string; tone: Tone }> = {
  admin: { ar: "مدير النظام", en: "Admin", tone: "critical" },
  accountant: { ar: "محاسب", en: "Accountant", tone: "info" },
  warehouse: { ar: "مستودع", en: "Warehouse", tone: "warning" },
  manager: { ar: "مدير", en: "Manager", tone: "neutral" },
};
