"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import {
  emptyCollection,
  matchesRule,
  ruleTypeKey,
  type Collection,
} from "@/lib/collections";
import type { InventoryItem } from "@/lib/inventory";
import { listInventory } from "../inventory/actions";
import {
  listCollections,
  deleteCollection,
  setCollectionPublished,
  reorderCollections,
} from "./actions";
import {
  CollectionEditor,
  groupPickerProducts,
  type PickerProduct,
} from "./collection-editor";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { KpiStrip, SearchInput, Toolbar } from "@/components/dashboard-ui";
import {
  IcPlus,
  IcCollection,
  IcImage,
  IcTrash,
  IcAlert,
  IcLink,
  IcEye,
} from "@/components/icons";

export default function CollectionsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Collection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const [cols, inv] = await Promise.all([listCollections(), listInventory()]);
    if (cols.ok) {
      setCollections(cols.data);
      setError(null);
    } else {
      setError(cols.error);
    }
    if (inv.ok) setItems(inv.data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const catalog: PickerProduct[] = useMemo(() => groupPickerProducts(items), [items]);
  const byName = useMemo(() => new Map(catalog.map((p) => [p.productName, p])), [catalog]);

  /** How many products a collection actually resolves to right now. */
  function countFor(c: Collection): number {
    if (c.ruleType === "manual")
      return c.products.filter((p) => byName.has(p.productName)).length;
    return catalog.filter((p) => matchesRule(p, c.ruleType, c.ruleValue)).length;
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return collections;
    return collections.filter((c) =>
      `${c.title} ${c.handle} ${c.ruleValue ?? ""}`.toLowerCase().includes(needle),
    );
  }, [collections, q]);

  const kpis = useMemo(() => {
    const published = collections.filter((c) => c.isPublished).length;
    const automatic = collections.filter((c) => c.ruleType !== "manual").length;
    const grouped = new Set(
      collections.flatMap((c) =>
        c.ruleType === "manual" ? c.products.map((p) => p.productName) : [],
      ),
    ).size;
    return [
      { label: t("coll_kpi_total"), value: num(collections.length, lang) },
      { label: t("coll_kpi_published"), value: num(published, lang) },
      { label: t("coll_kpi_automatic"), value: num(automatic, lang) },
      { label: t("coll_kpi_grouped"), value: num(grouped, lang) },
    ];
  }, [collections, t, lang]);

  async function onDelete(c: Collection) {
    if (!window.confirm(ar ? `حذف "${c.title}"؟` : `Delete "${c.title}"?`)) return;
    setBusyId(c.id);
    const res = await deleteCollection(c.id);
    setBusyId(null);
    if (res.ok) setCollections((cur) => cur.filter((x) => x.id !== c.id));
    else setError(res.error);
  }

  async function onTogglePublished(c: Collection) {
    setBusyId(c.id);
    const next = !c.isPublished;
    const res = await setCollectionPublished(c.id, next);
    setBusyId(null);
    if (res.ok)
      setCollections((cur) =>
        cur.map((x) => (x.id === c.id ? { ...x, isPublished: next } : x)),
      );
  }

  async function onMove(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= collections.length) return;
    const next = [...collections];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setCollections(next);
    await reorderCollections(next.map((c) => c.id));
  }

  function onSaved(saved: Collection) {
    setCollections((cur) => {
      const exists = cur.some((c) => c.id === saved.id);
      return exists ? cur.map((c) => (c.id === saved.id ? saved : c)) : [...cur, saved];
    });
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title={t("nav_collections")}
        subtitle={t("collections_subtitle")}
        actions={
          <button
            className="btn-primary"
            onClick={() => setEditing(emptyCollection())}
            disabled={error === "migration_missing" || error === "not_configured"}
          >
            <IcPlus className="h-4 w-4" /> {t("coll_new")}
          </button>
        }
      />

      {error === "migration_missing" ? (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">{t("coll_migration_needed")}</div>
            <code className="mt-1 block font-mono text-xs">
              supabase/migrations/0010_collections.sql
            </code>
          </div>
        </Card>
      ) : error === "not_configured" ? (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">{t("supabase_missing")}</span>
        </Card>
      ) : error ? (
        <Card className="mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
      ) : null}

      {!error && <KpiStrip segments={kpis} />}

      <Card className="mt-4 overflow-hidden">
        <Toolbar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder={ar ? "ابحث في التصنيفات…" : "Search collections…"}
          />
          <a
            className="btn-ghost h-9 px-3 text-xs"
            href="/shop/collections"
            target="_blank"
            rel="noreferrer"
          >
            <IcLink className="h-3.5 w-3.5" /> {t("coll_view_in_theme")}
          </a>
        </Toolbar>

        {loading ? (
          <div className="p-12 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <IcCollection className="h-6 w-6" />
            </span>
            <div>
              <div className="font-semibold text-ink">{t("coll_empty")}</div>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">{t("coll_empty_hint")}</p>
            </div>
            {!error && (
              <button className="btn-primary mt-1" onClick={() => setEditing(emptyCollection())}>
                <IcPlus className="h-4 w-4" /> {t("coll_new")}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {shown.map((c, i) => {
              const count = countFor(c);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                >
                  <div className="flex flex-col text-ink-soft">
                    <button
                      className="leading-none hover:text-ink disabled:opacity-30"
                      onClick={() => onMove(i, -1)}
                      disabled={i === 0 || Boolean(q)}
                      title={ar ? "لأعلى" : "Move up"}
                    >
                      ↑
                    </button>
                    <button
                      className="leading-none hover:text-ink disabled:opacity-30"
                      onClick={() => onMove(i, 1)}
                      disabled={i === shown.length - 1 || Boolean(q)}
                      title={ar ? "لأسفل" : "Move down"}
                    >
                      ↓
                    </button>
                  </div>

                  <button
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-page text-ink-soft"
                    onClick={() => setEditing(c)}
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <IcCollection className="h-5 w-5" />
                    )}
                  </button>

                  <button className="min-w-0 flex-1 text-start" onClick={() => setEditing(c)}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{c.title}</span>
                      <Badge className={c.ruleType === "manual" ? "bg-slate-100 text-slate-600" : "bg-sky-50 text-sky-700"}>
                        {t(ruleTypeKey[c.ruleType])}
                      </Badge>
                    </div>
                    <div className="truncate font-mono text-xs text-ink-soft">
                      /collections/{c.handle}
                      {c.ruleValue ? ` · ${c.ruleValue}` : ""}
                    </div>
                  </button>

                  <div className="hidden shrink-0 text-end sm:block">
                    <div className="text-sm font-semibold text-ink">{num(count, lang)}</div>
                    <div className="text-xs text-ink-soft">{t("coll_products_in")}</div>
                  </div>

                  <button
                    onClick={() => onTogglePublished(c)}
                    disabled={busyId === c.id}
                    className={`badge shrink-0 transition-colors ${
                      c.isPublished
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {c.isPublished ? t("coll_published") : t("coll_hidden")}
                  </button>

                  <a
                    className="btn-ghost h-8 shrink-0 px-2"
                    href={`/shop/collections/${encodeURIComponent(c.handle)}`}
                    target="_blank"
                    rel="noreferrer"
                    title={t("preview")}
                  >
                    <IcEye className="h-4 w-4" />
                  </a>
                  <button
                    className="btn-ghost h-8 shrink-0 px-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    onClick={() => onDelete(c)}
                    disabled={busyId === c.id}
                  >
                    <IcTrash className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {collections.length === 0 && !loading && !error && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
          <IcImage className="h-3.5 w-3.5" />
          {t("coll_fallback_note")}
        </p>
      )}

      {editing && (
        <CollectionEditor
          collection={editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
