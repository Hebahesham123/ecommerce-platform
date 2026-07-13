"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n, num } from "@/lib/i18n";
import {
  type InventoryItem,
  type Location,
  stockStatus,
  stockStatusKey,
  stockStatusTone,
  totalAvailable,
  totalCommitted,
  levelAt,
  emptyItem,
} from "@/lib/inventory";
import {
  listInventory,
  listLocations,
  setLevel,
  createItem,
  updateItem,
  deleteItem,
} from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import {
  IcSearch,
  IcPlus,
  IcInventory,
  IcAlert,
  IcLocation,
  IcX,
  IcTrash,
} from "@/components/icons";

export default function InventoryPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState<string>("all"); // "all" | locationId
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<InventoryItem | null>(null);

  async function load() {
    setLoading(true);
    const [inv, locs] = await Promise.all([listInventory(), listLocations()]);
    if (inv.ok) {
      setItems(inv.data);
      setError(null);
    } else {
      setError(inv.error);
    }
    if (locs.ok) setLocations(locs.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) =>
      `${i.productName} ${i.variantTitle ?? ""} ${i.sku ?? ""} ${i.category ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [items, q]);

  const singleLoc = loc !== "all";

  // Optimistic patch of one level in local state after a save.
  function patchLevel(
    itemId: string,
    locationId: string,
    fields: Partial<{ onHand: number; committed: number; incoming: number }>,
  ) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const existing = it.levels.find((l) => l.locationId === locationId);
        const base = existing ?? {
          locationId,
          onHand: 0,
          committed: 0,
          incoming: 0,
          available: 0,
        };
        const merged = { ...base, ...fields };
        merged.available = merged.onHand - merged.committed;
        const levels = existing
          ? it.levels.map((l) => (l.locationId === locationId ? merged : l))
          : [...it.levels, merged];
        return { ...it, levels };
      }),
    );
  }

  async function onDelete(item: InventoryItem) {
    if (!window.confirm(t("delete_item_confirm"))) return;
    const res = await deleteItem(item.id);
    if (res.ok) setItems((r) => r.filter((i) => i.id !== item.id));
  }

  return (
    <>
      <PageHeader
        title={t("nav_inventory")}
        subtitle={t("inventory_subtitle")}
        actions={
          <>
            <Link href="/inventory/locations" className="btn-outline">
              <IcLocation className="h-4 w-4" /> {t("nav_locations")}
            </Link>
            <button
              className="btn-primary"
              onClick={() => setDrawer(emptyItem())}
            >
              <IcPlus className="h-4 w-4" /> {t("add_item")}
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

      <Card className="overflow-hidden">
        {/* Toolbar: location selector + search */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setLoc("all")}
              className={`badge gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                loc === "all"
                  ? "bg-ink text-white"
                  : "bg-surface-page text-ink-muted hover:bg-surface-hover"
              }`}
            >
              {t("all_locations")}
            </button>
            {locations.map((l) => (
              <button
                key={l.id}
                onClick={() => setLoc(l.id)}
                className={`badge gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  loc === l.id
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                <IcLocation className="h-3.5 w-3.5" />
                {l.name}
                {l.isDefault && loc !== l.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                )}
              </button>
            ))}
          </div>
          <div className="relative ms-auto">
            <IcSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              className="h-9 w-56 rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_product")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_sku")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_incoming")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_committed")}</th>
                <th className="px-3 py-3 text-end font-medium">
                  {singleLoc ? t("col_on_hand") : t("col_available")}
                </th>
                <th className="px-3 py-3 text-center font-medium">{t("col_status")}</th>
                <th className="px-5 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const lvl = singleLoc ? levelAt(item, loc) : null;
                const available = singleLoc ? lvl!.available : totalAvailable(item);
                const committed = singleLoc ? lvl!.committed : totalCommitted(item);
                const incoming = singleLoc
                  ? lvl!.incoming
                  : item.levels.reduce((s, l) => s + l.incoming, 0);
                const status = stockStatus(available);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-line transition-colors hover:bg-surface-page"
                  >
                    <td
                      className="cursor-pointer px-5 py-3.5"
                      onClick={() => setDrawer(item)}
                    >
                      <div className="font-semibold text-ink">{item.productName}</div>
                      {(item.variantTitle || item.category) && (
                        <div className="text-xs text-ink-soft">
                          {item.variantTitle || item.category}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-ink-muted" dir="ltr">
                      {item.sku || "—"}
                    </td>
                    <td className="px-3 py-3.5 text-end text-ink-muted">
                      {num(incoming, lang)}
                    </td>
                    <td className="px-3 py-3.5 text-end text-ink-muted">
                      {num(committed, lang)}
                    </td>
                    <td className="px-3 py-3.5 text-end">
                      {singleLoc ? (
                        <EditableQty
                          value={lvl!.onHand}
                          onSave={async (v) => {
                            patchLevel(item.id, loc, { onHand: v });
                            await setLevel(item.id, loc, { onHand: v });
                          }}
                        />
                      ) : (
                        <span className="font-semibold text-ink">
                          {num(available, lang)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Badge className={stockStatusTone[status]}>
                        {t(stockStatusKey[status])}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <button
                        onClick={() => onDelete(item)}
                        className="btn-ghost h-8 px-2 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <IcTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="py-12 text-center text-sm text-ink-soft">{t("loading")}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcInventory className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">{t("no_inventory")}</div>
                <p className="mt-1 text-sm text-ink-soft">{t("no_inventory_hint")}</p>
              </div>
              <button
                className="btn-primary mt-1"
                onClick={() => setDrawer(emptyItem())}
              >
                <IcPlus className="h-4 w-4" /> {t("add_item")}
              </button>
            </div>
          )}
        </div>
      </Card>

      {drawer && (
        <ItemDrawer
          item={drawer}
          locations={locations}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            load();
          }}
        />
      )}
    </>
  );
}

// ---- Inline editable quantity ------------------------------------------------
function EditableQty({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setV(String(value));
  }, [value]);

  async function commit() {
    const n = Math.max(0, Math.round(Number(v) || 0));
    if (n === value) {
      setV(String(value));
      return;
    }
    setSaving(true);
    await onSave(n);
    setSaving(false);
  }

  return (
    <input
      type="number"
      min={0}
      value={v}
      disabled={saving}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="h-9 w-20 rounded-lg border border-line bg-white px-2 text-end text-sm font-semibold text-ink outline-none focus:border-brand-600 disabled:opacity-50"
    />
  );
}

// ---- Item drawer (details + per-location quantities) -------------------------
function ItemDrawer({
  item,
  locations,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  locations: Location[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useI18n();
  const isNew = !item.id;
  const [draft, setDraft] = useState<InventoryItem>(item);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof InventoryItem>(k: K, v: InventoryItem[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function levelFor(locationId: string) {
    return (
      draft.levels.find((l) => l.locationId === locationId) ?? {
        locationId,
        onHand: 0,
        committed: 0,
        incoming: 0,
        available: 0,
      }
    );
  }

  function setLevelField(locationId: string, onHand: number) {
    setDraft((d) => {
      const existing = d.levels.find((l) => l.locationId === locationId);
      const next = existing
        ? d.levels.map((l) =>
            l.locationId === locationId
              ? { ...l, onHand, available: onHand - l.committed }
              : l,
          )
        : [
            ...d.levels,
            { locationId, onHand, committed: 0, incoming: 0, available: onHand },
          ];
      return { ...d, levels: next };
    });
  }

  async function save() {
    if (!draft.productName.trim()) {
      setErr("name_required");
      return;
    }
    setSaving(true);
    setErr(null);
    if (isNew) {
      const res = await createItem(draft);
      if (!res.ok) {
        setErr(res.error);
        setSaving(false);
        return;
      }
    } else {
      const res = await updateItem(draft.id, draft);
      if (!res.ok) {
        setErr(res.error);
        setSaving(false);
        return;
      }
      // Persist any changed on-hand levels.
      for (const l of draft.levels) {
        const orig = item.levels.find((o) => o.locationId === l.locationId);
        if (!orig || orig.onHand !== l.onHand) {
          await setLevel(draft.id, l.locationId, { onHand: l.onHand });
        }
      }
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
            {isNew ? t("new_item") : t("edit_item")}
          </h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-3">
            <Field label={t("fld_product_name")}>
              <input
                value={draft.productName}
                onChange={(e) => set("productName", e.target.value)}
                className="inp"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fld_variant")}>
                <input
                  value={draft.variantTitle ?? ""}
                  onChange={(e) => set("variantTitle", e.target.value)}
                  className="inp"
                />
              </Field>
              <Field label={t("fld_category")}>
                <input
                  value={draft.category ?? ""}
                  onChange={(e) => set("category", e.target.value)}
                  className="inp"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fld_sku")}>
                <input
                  value={draft.sku ?? ""}
                  onChange={(e) => set("sku", e.target.value)}
                  className="inp"
                  dir="ltr"
                />
              </Field>
              <Field label={t("fld_barcode")}>
                <input
                  value={draft.barcode ?? ""}
                  onChange={(e) => set("barcode", e.target.value)}
                  className="inp"
                  dir="ltr"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("fld_price")}>
                <input
                  type="number"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    set("price", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="inp"
                />
              </Field>
              <Field label={t("fld_cost")}>
                <input
                  type="number"
                  value={draft.cost ?? ""}
                  onChange={(e) =>
                    set("cost", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="inp"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.tracked}
                onChange={(e) => set("tracked", e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              {t("fld_tracked")}
            </label>
          </div>

          {/* Quantities by location */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <IcLocation className="h-4 w-4 text-ink-soft" />
              {t("quantities_by_location")}
            </h3>
            {locations.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("no_locations")}</p>
            ) : (
              <div className="space-y-2">
                {locations.map((l) => {
                  const lv = levelFor(l.id);
                  return (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">
                          {l.name}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {t("col_available")}: {num(lv.onHand - lv.committed, lang)}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={lv.onHand}
                        onChange={(e) =>
                          setLevelField(l.id, Math.max(0, Number(e.target.value) || 0))
                        }
                        className="h-9 w-20 rounded-lg border border-line bg-white px-2 text-end text-sm font-semibold text-ink outline-none focus:border-brand-600"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {err && (
            <p className="text-sm text-rose-600">
              {err === "name_required"
                ? lang === "ar"
                  ? "اسم المنتج مطلوب"
                  : "Product name is required"
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
