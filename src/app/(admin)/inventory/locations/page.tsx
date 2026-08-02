"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { type Location, emptyLocation } from "@/lib/inventory";
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  setDefaultLocation,
  setLocationActive,
} from "../actions";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import {
  IcPlus,
  IcLocation,
  IcAlert,
  IcX,
  IcInventory,
} from "@/components/icons";

export default function LocationsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);

  async function load() {
    setLoading(true);
    const res = await listLocations();
    if (res.ok) {
      setRows(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onDelete(l: Location) {
    if (!window.confirm(t("delete_location_confirm"))) return;
    const res = await deleteLocation(l.id);
    if (res.ok) setRows((r) => r.filter((x) => x.id !== l.id));
    else if (res.error === "last_location")
      window.alert(
        t("no_locations_hint"), // reuse: at least one location must remain
      );
  }

  async function onDefault(l: Location) {
    const res = await setDefaultLocation(l.id);
    if (res.ok)
      setRows((r) => r.map((x) => ({ ...x, isDefault: x.id === l.id })));
  }

  async function onToggleActive(l: Location) {
    const res = await setLocationActive(l.id, !l.isActive);
    if (res.ok)
      setRows((r) =>
        r.map((x) => (x.id === l.id ? { ...x, isActive: !x.isActive } : x)),
      );
  }

  return (
    <>
      <PageHeader
        title={t("nav_locations")}
        subtitle={t("locations_subtitle")}
        actions={
          <>
            <Link href="/inventory" className="btn-outline">
              <IcInventory className="h-4 w-4" /> {t("nav_inventory")}
            </Link>
            <button
              className="btn-primary"
              onClick={() => setEditing(emptyLocation())}
            >
              <IcPlus className="h-4 w-4" /> {t("add_location")}
            </button>
          </>
        }
      />

      {error === "not_configured" && (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">
            {t("supabase_missing")}
          </span>
        </Card>
      )}

      {loading ? (
        <Card className="py-12 text-center text-sm text-ink-soft">
          {t("loading")}
        </Card>
      ) : rows.length === 0 && error !== "not_configured" ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <IcLocation className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">{t("no_locations")}</div>
            <p className="mt-1 text-sm text-ink-soft">{t("no_locations_hint")}</p>
          </div>
          <button
            className="btn-primary mt-1"
            onClick={() => setEditing(emptyLocation())}
          >
            <IcPlus className="h-4 w-4" /> {t("add_location")}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <IcLocation className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink">{l.name}</h3>
                      {l.isDefault && (
                        <Badge className="bg-brand-50 text-brand-700">
                          {t("loc_default")}
                        </Badge>
                      )}
                      <Badge
                        className={
                          l.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }
                      >
                        {l.isActive ? t("loc_active") : t("loc_inactive")}
                      </Badge>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-ink-soft">
                      {l.code && <div dir="ltr">{l.code}</div>}
                      <div>
                        {[l.address, l.city, l.governorate]
                          .filter(Boolean)
                          .join("، ") || "—"}
                      </div>
                      {l.phone && <div dir="ltr">{l.phone}</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                <button
                  onClick={() => setEditing(l)}
                  className="btn-ghost h-8 px-2.5 text-xs"
                >
                  {t("rename")}
                </button>
                {!l.isDefault && (
                  <button
                    onClick={() => onDefault(l)}
                    className="btn-ghost h-8 px-2.5 text-xs text-brand-700 hover:bg-brand-50"
                  >
                    {t("loc_set_default")}
                  </button>
                )}
                <button
                  onClick={() => onToggleActive(l)}
                  className="btn-ghost h-8 px-2.5 text-xs"
                >
                  {l.isActive ? t("loc_deactivate") : t("loc_activate")}
                </button>
                {!l.isDefault && (
                  <button
                    onClick={() => onDelete(l)}
                    className="btn-ghost ms-auto h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    {t("delete")}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <LocationDrawer
          location={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function LocationDrawer({
  location,
  onClose,
  onSaved,
}: {
  location: Location;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const isNew = !location.id;
  const [draft, setDraft] = useState<Location>(location);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof Location>(k: K, v: Location[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    if (!draft.name.trim()) {
      setErr("name_required");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = isNew
      ? await createLocation(draft)
      : await updateLocation(draft.id, draft);
    if (!res.ok) {
      setErr(res.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">
            {isNew ? t("new_location") : t("edit_location")}
          </h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">
              {t("fld_loc_name")}
            </span>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className="inp"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">
                {t("fld_loc_code")}
              </span>
              <input
                value={draft.code ?? ""}
                onChange={(e) => set("code", e.target.value)}
                className="inp"
                dir="ltr"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">
                {t("fld_phone")}
              </span>
              <input
                value={draft.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                className="inp"
                dir="ltr"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-muted">
              {t("fld_address")}
            </span>
            <input
              value={draft.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              className="inp"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">
                {t("fld_city")}
              </span>
              <input
                value={draft.city ?? ""}
                onChange={(e) => set("city", e.target.value)}
                className="inp"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">
                {t("fld_governorate")}
              </span>
              <input
                value={draft.governorate ?? ""}
                onChange={(e) => set("governorate", e.target.value)}
                className="inp"
              />
            </label>
          </div>

          <label className="flex items-center gap-2.5 pt-1 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.fulfillsOnlineOrders}
              onChange={(e) => set("fulfillsOnlineOrders", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            {t("loc_fulfills")}
          </label>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            {t("loc_active")}
          </label>

          {err && (
            <p className="text-sm text-rose-600">
              {err === "name_required"
                ? lang === "ar"
                  ? "اسم الموقع مطلوب"
                  : "Location name is required"
                : err === "not_configured"
                  ? t("supabase_missing")
                  : err}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
          <button onClick={onClose} className="btn-outline">
            {t("cancel")}
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
