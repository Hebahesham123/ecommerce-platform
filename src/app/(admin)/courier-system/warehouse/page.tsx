"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { KpiRow, StatTile, StatusPill, Toolbar, SearchInput, Select, Pagination, usePagination } from "@/components/dashboard-ui";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcInventory, IcPlus, IcEdit } from "@/components/icons";
import {
  WAREHOUSE_STATUS,
  WAREHOUSE_SOURCE,
  WAREHOUSE_CONDITION,
  type WarehouseItem,
  type WarehouseStatus,
  type WarehouseSource,
  type WarehouseCondition,
} from "@/lib/courier-ops";
import { listWarehouse, createWarehouseItem, updateWarehouseItem } from "../actions";

const STATUS_ORDER: WarehouseStatus[] = ["in_warehouse", "restocked", "needs_repair", "scrapped"];
const SOURCE_ORDER: WarehouseSource[] = ["returned", "failed", "other"];
const CONDITION_ORDER: WarehouseCondition[] = ["good", "damaged", "unknown"];
const STATUS_ACCENT: Record<WarehouseStatus, "sky" | "emerald" | "amber" | "rose"> = {
  in_warehouse: "sky",
  restocked: "emerald",
  needs_repair: "amber",
  scrapped: "rose",
};

export default function WarehousePage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WarehouseStatus | "all">("all");
  const [source, setSource] = useState<WarehouseSource | "all">("all");
  const [edit, setEdit] = useState<WarehouseItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listWarehouse();
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<WarehouseStatus, number> = { in_warehouse: 0, restocked: 0, needs_repair: 0, scrapped: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (source !== "all" && r.source !== source) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.orderNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status, source]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${search}|${status}|${source}` });

  async function setItemStatus(id: string, next: WarehouseStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    await updateWarehouseItem(id, { status: next });
  }

  return (
    <>
      <PageHeader
        title={ar ? "المستودع" : "Warehouse"}
        subtitle={ar ? "المرتجعات والطلبات الفاشلة والمخزون المستلم يدوياً" : "Returns, failed deliveries & manual stock intake"}
        primary={{ label: ar ? "إضافة عنصر" : "Add item", onClick: () => setShowCreate(true), icon: <IcPlus className="h-4 w-4" /> }}
      />

      <div className="mb-4">
        <KpiRow cols={4}>
          {STATUS_ORDER.map((st) => (
            <StatTile
              key={st}
              label={ar ? WAREHOUSE_STATUS[st].ar : WAREHOUSE_STATUS[st].en}
              value={num(counts[st], lang)}
              accent={STATUS_ACCENT[st]}
              active={status === st}
              onClick={() => setStatus((cur) => (cur === st ? "all" : st))}
            />
          ))}
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={ar ? "ابحث بالمنتج، SKU، رقم الطلب…" : "Search product, SKU, order #…"} />
          <Select value={status} onChange={(v) => setStatus(v as WarehouseStatus | "all")}>
            <option value="all">{ar ? "كل الحالات" : "All statuses"}</option>
            {STATUS_ORDER.map((st) => <option key={st} value={st}>{ar ? WAREHOUSE_STATUS[st].ar : WAREHOUSE_STATUS[st].en}</option>)}
          </Select>
          <Select value={source} onChange={(v) => setSource(v as WarehouseSource | "all")}>
            <option value="all">{ar ? "كل المصادر" : "All sources"}</option>
            {SOURCE_ORDER.map((sc) => <option key={sc} value={sc}>{ar ? WAREHOUSE_SOURCE[sc].ar : WAREHOUSE_SOURCE[sc].en}</option>)}
          </Select>
          <span className="ms-auto text-sm text-ink-soft">{num(filtered.length, lang)} {ar ? "عنصر" : "items"}</span>
        </Toolbar>

        {loading ? (
          <div className="py-16 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IcInventory className="h-6 w-6" /></span>
            <div className="font-semibold text-ink">{ar ? "المستودع فارغ" : "Warehouse is empty"}</div>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-1"><IcPlus className="h-4 w-4" /> {ar ? "إضافة عنصر" : "Add item"}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الطلب" : "Order #"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "المنتج" : "Product"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">SKU</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الكمية" : "Qty"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "المصدر" : "Source"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الحالة الفيزيائية" : "Condition"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pg.items.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-page/60">
                    <td className="px-4 py-3">{r.orderNumber ? <span className="font-semibold text-ink" dir="ltr">#{r.orderNumber}</span> : <span className="text-ink-soft">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[18rem] truncate font-medium text-ink">{r.productName}</div>
                      {r.note && <div className="mt-0.5 max-w-[18rem] truncate text-xs text-ink-soft">{r.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted" dir="ltr">{r.sku || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{num(r.quantity, lang)}</td>
                    <td className="px-4 py-3 text-ink-muted">{ar ? WAREHOUSE_SOURCE[r.source].ar : WAREHOUSE_SOURCE[r.source].en}</td>
                    <td className="px-4 py-3"><StatusPill label={ar ? WAREHOUSE_CONDITION[r.condition].ar : WAREHOUSE_CONDITION[r.condition].en} tone={WAREHOUSE_CONDITION[r.condition].tone} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusPill label={ar ? WAREHOUSE_STATUS[r.status].ar : WAREHOUSE_STATUS[r.status].en} tone={WAREHOUSE_STATUS[r.status].tone} />
                        <Select value={r.status} onChange={(v) => setItemStatus(r.id, v as WarehouseStatus)}>
                          {STATUS_ORDER.map((st) => <option key={st} value={st}>{ar ? WAREHOUSE_STATUS[st].ar : WAREHOUSE_STATUS[st].en}</option>)}
                        </Select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button onClick={() => setEdit(r)} title={ar ? "تعديل" : "Edit"} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface-hover hover:text-ink"><IcEdit className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...pg} />
      </Card>

      {edit && <EditItemModal ar={ar} item={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await load(); }} />}
      {showCreate && <CreateItemModal ar={ar} onClose={() => setShowCreate(false)} onSaved={async () => { setShowCreate(false); await load(); }} />}
    </>
  );
}

function EditItemModal({ ar, item, onClose, onSaved }: { ar: boolean; item: WarehouseItem; onClose: () => void; onSaved: () => void }) {
  const [condition, setCondition] = useState<WarehouseCondition>(item.condition);
  const [status, setStatus] = useState<WarehouseStatus>(item.status);
  const [note, setNote] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateWarehouseItem(item.id, { condition, status, note });
    setBusy(false);
    if (res.ok) onSaved();
  }

  return (
    <Modal title={ar ? "تعديل العنصر" : "Edit item"} subtitle={item.productName} icon={IcEdit} onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button><button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button></>}>
      <div className="space-y-3">
        <Field label={ar ? "الحالة" : "Status"}>
          <Select value={status} onChange={(v) => setStatus(v as WarehouseStatus)}>
            {STATUS_ORDER.map((st) => <option key={st} value={st}>{ar ? WAREHOUSE_STATUS[st].ar : WAREHOUSE_STATUS[st].en}</option>)}
          </Select>
        </Field>
        <Field label={ar ? "الحالة الفيزيائية" : "Condition"}>
          <Select value={condition} onChange={(v) => setCondition(v as WarehouseCondition)}>
            {CONDITION_ORDER.map((c) => <option key={c} value={c}>{ar ? WAREHOUSE_CONDITION[c].ar : WAREHOUSE_CONDITION[c].en}</option>)}
          </Select>
        </Field>
        <Field label={ar ? "ملاحظة" : "Note"}><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={fieldClass} /></Field>
      </div>
    </Modal>
  );
}

function CreateItemModal({ ar, onClose, onSaved }: { ar: boolean; onClose: () => void; onSaved: () => void }) {
  const [orderNumber, setOrderNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [source, setSource] = useState<WarehouseSource>("other");
  const [condition, setCondition] = useState<WarehouseCondition>("unknown");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!productName.trim()) { setErr(ar ? "اسم المنتج مطلوب." : "Product name is required."); return; }
    setBusy(true); setErr(null);
    const res = await createWarehouseItem({ orderNumber, productName, sku, quantity: Number(quantity) || 1, source, condition, note });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr(res.error === "migration_missing" ? (ar ? "شغّلي ترحيل 0049." : "Run migration 0049.") : (ar ? "حدث خطأ." : "Something went wrong."));
  }

  return (
    <Modal title={ar ? "إضافة عنصر للمستودع" : "Add warehouse item"} subtitle={ar ? "إدخال مخزون يدوي" : "Manual stock intake"} icon={IcInventory} size="lg" onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button><button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button></>}>
      <div className="space-y-3">
        <Field label={ar ? "اسم المنتج" : "Product name"}><input value={productName} onChange={(e) => setProductName(e.target.value)} className={fieldClass} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={ar ? "رقم الطلب (اختياري)" : "Order # (optional)"}><input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} dir="ltr" className={fieldClass} /></Field>
          <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value)} dir="ltr" className={fieldClass} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={ar ? "الكمية" : "Quantity"}><input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} inputMode="numeric" dir="ltr" className={fieldClass} /></Field>
          <Field label={ar ? "المصدر" : "Source"}>
            <Select value={source} onChange={(v) => setSource(v as WarehouseSource)}>
              {SOURCE_ORDER.map((sc) => <option key={sc} value={sc}>{ar ? WAREHOUSE_SOURCE[sc].ar : WAREHOUSE_SOURCE[sc].en}</option>)}
            </Select>
          </Field>
          <Field label={ar ? "الحالة الفيزيائية" : "Condition"}>
            <Select value={condition} onChange={(v) => setCondition(v as WarehouseCondition)}>
              {CONDITION_ORDER.map((c) => <option key={c} value={c}>{ar ? WAREHOUSE_CONDITION[c].ar : WAREHOUSE_CONDITION[c].en}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={ar ? "ملاحظة" : "Note"}><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldClass} /></Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}
