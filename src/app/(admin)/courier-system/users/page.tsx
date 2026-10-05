"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";
import { KpiRow, StatTile, StatusPill, Toolbar, SearchInput, Select, Pagination, usePagination } from "@/components/dashboard-ui";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcCourier, IcCustomers, IcPlus, IcEdit, IcLocation } from "@/components/icons";
import type { Courier } from "@/lib/courier";
import { STAFF_ROLE, type StaffUser, type StaffRole } from "@/lib/courier-ops";
import { listCouriers, createCourier, updateCourier } from "../../couriers/actions";
import { listStaff, createStaff, updateStaff } from "../actions";

type Unified =
  | { kind: "courier"; id: string; name: string; phone: string; zone: string | null; active: boolean }
  | { kind: "staff"; id: string; name: string; phone: string | null; role: StaffRole; active: boolean };

const ROLE_ORDER: StaffRole[] = ["admin", "accountant", "warehouse", "manager"];

export default function UsersPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "courier" | "staff">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editC, setEditC] = useState<Courier | null>(null);
  const [editS, setEditS] = useState<StaffUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s] = await Promise.all([listCouriers(), listStaff()]);
    if (c.ok) setCouriers(c.data);
    if (s.ok) setStaff(s.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const unified = useMemo<Unified[]>(() => {
    const list: Unified[] = [
      ...couriers.map((c): Unified => ({ kind: "courier", id: c.id, name: c.name, phone: c.phone, zone: c.zone, active: c.active })),
      ...staff.map((s): Unified => ({ kind: "staff", id: s.id, name: s.name, phone: s.phone, role: s.role, active: s.active })),
    ];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [couriers, staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unified.filter((u) => {
      if (kind !== "all" && u.kind !== kind) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || (u.phone ?? "").toLowerCase().includes(q);
    });
  }, [unified, search, kind]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${search}|${kind}` });
  const activeCount = unified.filter((u) => u.active).length;

  async function toggleActive(u: Unified) {
    const next = !u.active;
    if (u.kind === "courier") {
      setCouriers((prev) => prev.map((c) => (c.id === u.id ? { ...c, active: next } : c)));
      await updateCourier(u.id, { active: next });
    } else {
      setStaff((prev) => prev.map((s) => (s.id === u.id ? { ...s, active: next } : s)));
      await updateStaff(u.id, { active: next });
    }
  }

  return (
    <>
      <PageHeader
        title={ar ? "المستخدمون" : "Users"}
        subtitle={ar ? "المندوبون وفريق العمل في مكان واحد" : "Couriers & back-office staff in one place"}
        primary={{ label: ar ? "إضافة مستخدم" : "Add user", onClick: () => setShowAdd(true), icon: <IcPlus className="h-4 w-4" /> }}
      />

      <div className="mb-4">
        <KpiRow cols={3}>
          <StatTile icon={IcCourier} label={ar ? "المندوبون" : "Couriers"} value={num(couriers.length, lang)} accent="brand" active={kind === "courier"} onClick={() => setKind((k) => (k === "courier" ? "all" : "courier"))} />
          <StatTile icon={IcCustomers} label={ar ? "الموظفون" : "Staff"} value={num(staff.length, lang)} accent="violet" active={kind === "staff"} onClick={() => setKind((k) => (k === "staff" ? "all" : "staff"))} />
          <StatTile icon={IcCustomers} label={ar ? "نشط" : "Active"} value={num(activeCount, lang)} accent="emerald" />
        </KpiRow>
      </div>

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={ar ? "ابحث بالاسم أو الهاتف…" : "Search name or phone…"} />
          <Select value={kind} onChange={(v) => setKind(v as "all" | "courier" | "staff")}>
            <option value="all">{ar ? "الكل" : "Everyone"}</option>
            <option value="courier">{ar ? "المندوبون" : "Couriers"}</option>
            <option value="staff">{ar ? "الموظفون" : "Staff"}</option>
          </Select>
          <span className="ms-auto text-sm text-ink-soft">{num(filtered.length, lang)} {ar ? "مستخدم" : "users"}</span>
        </Toolbar>

        {loading ? (
          <div className="py-16 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IcCustomers className="h-6 w-6" /></span>
            <div className="font-semibold text-ink">{ar ? "لا مستخدمين" : "No users"}</div>
            <button onClick={() => setShowAdd(true)} className="btn-primary mt-1"><IcPlus className="h-4 w-4" /> {ar ? "إضافة مستخدم" : "Add user"}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الاسم" : "Name"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الهاتف" : "Phone"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الدور" : "Role"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "نشط" : "Active"}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pg.items.map((u) => (
                  <tr key={`${u.kind}-${u.id}`} className="hover:bg-surface-page/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-ink">{u.name}</div>
                          {u.kind === "courier" && u.zone && <div className="flex items-center gap-1 text-xs text-ink-soft"><IcLocation className="h-3.5 w-3.5" />{u.zone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted" dir="ltr">{u.phone || "—"}</td>
                    <td className="px-4 py-3">
                      {u.kind === "courier"
                        ? <StatusPill label={ar ? "مندوب" : "Courier"} tone="info" />
                        : <StatusPill label={ar ? STAFF_ROLE[u.role].ar : STAFF_ROLE[u.role].en} tone={STAFF_ROLE[u.role].tone} />}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${u.active ? "bg-emerald-500" : "bg-slate-300"}`}
                        aria-pressed={u.active}
                        title={u.active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Off")}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${u.active ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => {
                            if (u.kind === "courier") setEditC(couriers.find((c) => c.id === u.id) ?? null);
                            else setEditS(staff.find((s) => s.id === u.id) ?? null);
                          }}
                          title={ar ? "تعديل" : "Edit"}
                          className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface-hover hover:text-ink"
                        >
                          <IcEdit className="h-4 w-4" />
                        </button>
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

      {showAdd && <AddUserModal ar={ar} onClose={() => setShowAdd(false)} onSaved={async () => { setShowAdd(false); await load(); }} />}
      {editC && <CourierEditModal ar={ar} courier={editC} onClose={() => setEditC(null)} onSaved={async () => { setEditC(null); await load(); }} />}
      {editS && <StaffEditModal ar={ar} staff={editS} onClose={() => setEditS(null)} onSaved={async () => { setEditS(null); await load(); }} />}
    </>
  );
}

function errText(code: string, ar: boolean) {
  return ({
    name_phone_required: ar ? "الاسم والهاتف مطلوبان." : "Name and phone are required.",
    name_required: ar ? "الاسم مطلوب." : "Name is required.",
    pin_too_short: ar ? "الرقم السري 4 أرقام على الأقل." : "PIN must be at least 4 digits.",
    phone_taken: ar ? "هذا الهاتف مستخدم بالفعل." : "That phone is already used.",
    migration_missing: ar ? "شغّلي ترحيل 0049/0045." : "Run migrations 0045 & 0049.",
  } as Record<string, string>)[code] ?? (ar ? "حدث خطأ." : "Something went wrong.");
}

function AddUserModal({ ar, onClose, onSaved }: { ar: boolean; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<"courier" | "staff">("courier");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<StaffRole>("manager");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = kind === "courier"
      ? await createCourier({ name, phone, zone, pin })
      : await createStaff({ name, phone, role });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr(errText(res.error, ar));
  }

  return (
    <Modal title={ar ? "إضافة مستخدم" : "Add user"} subtitle={ar ? "مندوب يدخل عبر /courier أو موظف مكتبي" : "A courier (signs in at /courier) or a staff member"} icon={IcPlus} size="lg" onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button><button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-page p-1">
          {(["courier", "staff"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${kind === k ? "bg-brand text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {k === "courier" ? (ar ? "مندوب" : "Courier") : (ar ? "موظف" : "Staff")}
            </button>
          ))}
        </div>
        <Field label={ar ? "الاسم" : "Name"}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} /></Field>
        <Field label={ar ? "الهاتف" : "Phone"}><input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={fieldClass} /></Field>
        {kind === "courier" ? (
          <>
            <Field label={ar ? "المنطقة" : "Zone"}><input value={zone} onChange={(e) => setZone(e.target.value)} className={fieldClass} /></Field>
            <Field label={ar ? "الرقم السري" : "PIN"} hint={ar ? "4 أرقام على الأقل" : "at least 4 digits"}>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" dir="ltr" className={fieldClass} />
            </Field>
          </>
        ) : (
          <Field label={ar ? "الدور" : "Role"}>
            <Select value={role} onChange={(v) => setRole(v as StaffRole)}>
              {ROLE_ORDER.map((r) => <option key={r} value={r}>{ar ? STAFF_ROLE[r].ar : STAFF_ROLE[r].en}</option>)}
            </Select>
          </Field>
        )}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

function CourierEditModal({ ar, courier, onClose, onSaved }: { ar: boolean; courier: Courier; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(courier.name);
  const [zone, setZone] = useState(courier.zone ?? "");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(courier.active);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateCourier(courier.id, { name, zone, active, pin: pin || undefined });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr(errText(res.error, ar));
  }

  return (
    <Modal title={ar ? "تعديل مندوب" : "Edit courier"} subtitle={courier.phone} icon={IcCourier} onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button><button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button></>}>
      <div className="space-y-3">
        <Field label={ar ? "الاسم" : "Name"}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} /></Field>
        <Field label={ar ? "الهاتف" : "Phone"} hint={ar ? "لا يمكن تغيير الهاتف" : "Phone can't be changed"}><input value={courier.phone} disabled dir="ltr" className={`${fieldClass} disabled:opacity-60`} /></Field>
        <Field label={ar ? "المنطقة" : "Zone"}><input value={zone} onChange={(e) => setZone(e.target.value)} className={fieldClass} /></Field>
        <Field label={ar ? "رقم سري جديد (اختياري)" : "New PIN (optional)"} hint={ar ? "4 أرقام على الأقل" : "at least 4 digits"}>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" dir="ltr" className={fieldClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {ar ? "نشط" : "Active"}</label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

function StaffEditModal({ ar, staff, onClose, onSaved }: { ar: boolean; staff: StaffUser; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [role, setRole] = useState<StaffRole>(staff.role);
  const [active, setActive] = useState(staff.active);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await updateStaff(staff.id, { name, phone, role, active });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr(errText(res.error, ar));
  }

  return (
    <Modal title={ar ? "تعديل موظف" : "Edit staff"} icon={IcCustomers} onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button><button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button></>}>
      <div className="space-y-3">
        <Field label={ar ? "الاسم" : "Name"}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} /></Field>
        <Field label={ar ? "الهاتف" : "Phone"}><input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={fieldClass} /></Field>
        <Field label={ar ? "الدور" : "Role"}>
          <Select value={role} onChange={(v) => setRole(v as StaffRole)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ar ? STAFF_ROLE[r].ar : STAFF_ROLE[r].en}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {ar ? "نشط" : "Active"}</label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}
