"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";
import { KpiRow, StatTile, StatusPill } from "@/components/dashboard-ui";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcCourier, IcCash, IcOrders, IcAlert, IcLocation, IcPlus, IcEdit, IcChevron } from "@/components/icons";
import { SHIPMENT_STATUS, type Courier, type Shipment } from "@/lib/courier";
import {
  listCouriers,
  courierCashSummary,
  listShipments,
  createCourier,
  updateCourier,
  settleCourier,
  type CourierCash,
} from "./actions";

export function CouriersPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [cash, setCash] = useState<CourierCash[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "new" | { edit: Courier }>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, cc, sh] = await Promise.all([listCouriers(), courierCashSummary(), listShipments()]);
    if (c.ok) setCouriers(c.data);
    if (cc.ok) setCash(cc.data);
    if (sh.ok) setShipments(sh.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cashById = useMemo(() => new Map(cash.map((c) => [c.courierId, c])), [cash]);
  const pending = useMemo(() => shipments.filter((s) => s.reportedStatus), [shipments]);

  const totalActive = cash.reduce((s, c) => s + c.active, 0);
  const totalCollected = cash.reduce((s, c) => s + c.cashCollected, 0);
  const totalPending = cash.reduce((s, c) => s + c.cashPending, 0);

  async function settle(courierId: string) {
    const res = await settleCourier(courierId);
    if (res.ok) { setFlash(`${ar ? "تمت تسوية" : "Settled"} ${egp(res.data.settled, lang)}`); await load(); }
  }

  return (
    <>
      <PageHeader
        title={t("nav_couriers")}
        subtitle={ar ? "التعيين، تأكيد المندوبين وتسوية النقدية" : "Assign, confirm couriers & reconcile COD cash"}
        primary={{ label: ar ? "مندوب جديد" : "New courier", onClick: () => setModal("new") }}
      />

      {flash && <div className="mb-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{flash}</div>}

      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile icon={IcCourier} label={ar ? "المندوبون" : "Couriers"} value={num(couriers.length, lang)} accent="brand" />
          <StatTile icon={IcOrders} label={t("active_deliveries")} value={num(totalActive, lang)} accent="sky" />
          <StatTile icon={IcCash} label={ar ? "نقدية مُسوّاة" : "Cash settled"} value={egp(totalCollected, lang)} accent="emerald" />
          <StatTile icon={IcAlert} label={ar ? "نقدية بالعُهدة" : "Cash in hand"} value={egp(totalPending, lang)} accent="amber" />
        </KpiRow>
      </div>

      {/* Pending courier reports to confirm */}
      {pending.length > 0 && (
        <Card className="mb-4 overflow-hidden border-amber-200">
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            <IcAlert className="h-4 w-4" /> {ar ? "تقارير بانتظار التأكيد" : "Reports awaiting confirmation"} · {num(pending.length, lang)}
          </div>
          <ul className="divide-y divide-line">
            {pending.map((s) => {
              const st = SHIPMENT_STATUS[s.reportedStatus as keyof typeof SHIPMENT_STATUS] ?? SHIPMENT_STATUS.assigned;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-ink">#{s.orderNumber}</span>
                    <span className="text-sm text-ink-muted">{s.courierName}</span>
                    <StatusPill label={ar ? st.ar : st.en} tone={st.tone} />
                    {s.reportedStatus === "delivered" && <span className="text-sm text-emerald-700">{egp(s.reportedCash ?? 0, lang)}</span>}
                  </div>
                  <Link href={`/orders/${s.orderNumber}`} className="btn-primary h-8 px-3 text-xs">
                    {ar ? "مراجعة وتأكيد" : "Review & confirm"} <IcChevron className={`h-3.5 w-3.5 ${ar ? "rotate-180" : ""}`} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Couriers grid */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold text-ink">{ar ? "المندوبون" : "Couriers"}</span>
          <span className="text-xs text-ink-soft">{ar ? "رابط البوابة" : "Portal"}: <code dir="ltr" className="rounded bg-surface-page px-1.5 py-0.5">/courier</code></span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : couriers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IcCourier className="h-6 w-6" /></span>
            <div className="font-semibold text-ink">{ar ? "لا يوجد مندوبون بعد" : "No couriers yet"}</div>
            <button onClick={() => setModal("new")} className="btn-primary mt-1"><IcPlus className="h-4 w-4" /> {ar ? "أضف مندوباً" : "Add a courier"}</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {couriers.map((c) => {
              const cc = cashById.get(c.id);
              return (
                <div key={c.id} className="group rounded-2xl border border-line p-4 transition-shadow hover:shadow-pop">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-semibold text-ink">{c.name}</span>
                          {!c.active && <StatusPill label={ar ? "موقوف" : "Off"} tone="neutral" />}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-ink-soft">
                          {c.zone ? <><IcLocation className="h-3.5 w-3.5" /><span className="truncate">{c.zone}</span></> : <span dir="ltr">{c.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setModal({ edit: c })} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface-hover hover:text-ink"><IcEdit className="h-4 w-4" /></button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                    <span className="badge bg-sky-50 text-sky-700">{num(cc?.active ?? 0, lang)} {t("active_deliveries")}</span>
                    <span>{num(cc?.delivered ?? 0, lang)} {ar ? "مُسلَّم" : "delivered"}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-amber-50 p-2.5">
                      <div className="text-[11px] font-medium text-amber-700">{ar ? "بالعُهدة" : "In hand"}</div>
                      <div className="mt-0.5 truncate text-sm font-bold text-amber-800">{egp(cc?.cashPending ?? 0, lang)}</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-2.5">
                      <div className="text-[11px] font-medium text-emerald-700">{ar ? "مُسوّاة" : "Settled"}</div>
                      <div className="mt-0.5 truncate text-sm font-bold text-emerald-800">{egp(cc?.cashCollected ?? 0, lang)}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => settle(c.id)}
                    disabled={!cc || cc.cashPending <= 0}
                    className="btn-outline mt-4 h-9 w-full gap-1.5 text-xs disabled:opacity-40"
                  >
                    <IcCash className="h-3.5 w-3.5" /> {ar ? "تسوية النقدية" : "Settle cash"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {modal && (
        <CourierModal
          ar={ar}
          courier={typeof modal === "object" ? modal.edit : null}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await load(); }}
        />
      )}
    </>
  );
}

function CourierModal({ ar, courier, onClose, onSaved }: { ar: boolean; courier: Courier | null; onClose: () => void; onSaved: () => void }) {
  const editing = !!courier;
  const [name, setName] = useState(courier?.name ?? "");
  const [phone, setPhone] = useState(courier?.phone ?? "");
  const [zone, setZone] = useState(courier?.zone ?? "");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(courier?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const errText = (code: string) => ({
    name_phone_required: ar ? "الاسم والهاتف مطلوبان." : "Name and phone are required.",
    pin_too_short: ar ? "الرقم السري 4 أرقام على الأقل." : "PIN must be at least 4 digits.",
    phone_taken: ar ? "هذا الهاتف مستخدم بالفعل." : "That phone is already used.",
    migration_missing: ar ? "شغّلي ترحيل 0045." : "Run migration 0045.",
  }[code] ?? (ar ? "حدث خطأ." : "Something went wrong."));

  async function save() {
    setBusy(true); setErr(null);
    const res = editing
      ? await updateCourier(courier!.id, { name, zone, active, pin: pin || undefined })
      : await createCourier({ name, phone, zone, pin });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr(errText(res.error));
  }

  return (
    <Modal
      title={editing ? (ar ? "تعديل مندوب" : "Edit courier") : (ar ? "مندوب جديد" : "New courier")}
      subtitle={ar ? "يدخل المندوب بالهاتف والرقم السري على /courier" : "Couriers sign in with phone + PIN at /courier"}
      icon={IcCourier}
      onClose={onClose}
      dir={ar ? "rtl" : "ltr"}
      footer={
        <>
          <button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={ar ? "الاسم" : "Name"}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} /></Field>
        <Field label={ar ? "الهاتف" : "Phone"} hint={editing ? (ar ? "لا يمكن تغيير الهاتف" : "Phone can't be changed") : undefined}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={editing} dir="ltr" className={`${fieldClass} disabled:opacity-60`} />
        </Field>
        <Field label={ar ? "المنطقة" : "Zone"}><input value={zone} onChange={(e) => setZone(e.target.value)} className={fieldClass} /></Field>
        <Field label={editing ? (ar ? "رقم سري جديد (اختياري)" : "New PIN (optional)") : (ar ? "الرقم السري" : "PIN")} hint={ar ? "4 أرقام على الأقل" : "at least 4 digits"}>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" dir="ltr" className={fieldClass} />
        </Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {ar ? "نشط" : "Active"}
          </label>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}
