"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, num } from "@/lib/i18n";
import {
  type Discount,
  type DiscountStatus,
  statusKey,
  statusTone,
  methodKey,
  typeKey,
} from "@/lib/discounts";
import { listDiscounts, deleteDiscount, setDiscountStatus } from "./actions";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { summaryLine } from "@/components/discount-summary";
import { IcSearch, IcPlus, IcDiscount, IcAlert } from "@/components/icons";

type Tab = "all" | "active" | "scheduled" | "expired";

function CombinationDots({ d }: { d: Discount }) {
  const items = [
    { on: d.combineProduct, c: "bg-violet-400" },
    { on: d.combineOrder, c: "bg-sky-400" },
    { on: d.combineShipping, c: "bg-emerald-400" },
  ];
  return (
    <span className="inline-flex items-center gap-1">
      {items.map((it, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${it.on ? it.c : "bg-slate-200"}`}
        />
      ))}
    </span>
  );
}

export default function DiscountsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const res = await listDiscounts();
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("filter_all") },
    { key: "active", label: t("ds_active") },
    { key: "scheduled", label: t("ds_scheduled") },
    { key: "expired", label: t("ds_expired") },
  ];

  const filtered = useMemo(() => {
    return rows.filter((d) => {
      if (tab !== "all" && d.status !== (tab as DiscountStatus)) return false;
      if (q) {
        const hay = `${d.title} ${d.code ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, tab, q]);

  async function onDelete(id: string) {
    if (!window.confirm(t("delete_confirm"))) return;
    const res = await deleteDiscount(id);
    if (res.ok) setRows((r) => r.filter((d) => d.id !== id));
  }

  async function onActivate(id: string) {
    const res = await setDiscountStatus(id, "active");
    if (res.ok)
      setRows((r) =>
        r.map((d) => (d.id === id ? { ...d, status: "active" } : d)),
      );
  }

  function exportCsv() {
    const header = ["title", "code", "method", "type", "status", "used"];
    const lines = filtered.map((d) =>
      [d.title, d.code ?? "", d.method, d.discountType, d.status, d.usedCount]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title={t("nav_discounts")}
        subtitle={t("discounts_subtitle")}
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv}>
              {t("export")}
            </button>
            <Link href="/discounts/new" className="btn-primary">
              <IcPlus className="h-4 w-4" /> {t("create_discount")}
            </Link>
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
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((f) => (
              <button
                key={f.key}
                onClick={() => setTab(f.key)}
                className={`badge gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  tab === f.key
                    ? "bg-ink text-white"
                    : "bg-surface-page text-ink-muted hover:bg-surface-hover"
                }`}
              >
                {f.label}
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
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-xs text-ink-soft">
                <th className="px-5 py-3 text-start font-medium">{t("col_title")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_status")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_method")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_eligibility")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_type")}</th>
                <th className="px-3 py-3 text-start font-medium">{t("col_combinations")}</th>
                <th className="px-3 py-3 text-end font-medium">{t("col_used")}</th>
                <th className="px-5 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-t border-line transition-colors hover:bg-surface-page"
                  onClick={() => router.push(`/discounts/${d.id}`)}
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-ink">
                      {d.method === "code" ? d.code || d.title : d.title}
                    </div>
                    <div className="text-xs text-ink-soft">{summaryLine(d, lang)}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge className={statusTone[d.status]}>
                      {t(statusKey[d.status])}
                    </Badge>
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">{t(methodKey[d.method])}</td>
                  <td className="px-3 py-3.5 text-ink-muted">
                    {d.eligibility === "all" ? t("elig_all") : t("elig_customers")}
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">{t(typeKey[d.discountType])}</td>
                  <td className="px-3 py-3.5">
                    <CombinationDots d={d} />
                  </td>
                  <td className="px-3 py-3.5 text-end font-medium text-ink">
                    {num(d.usedCount, lang)}
                  </td>
                  <td
                    className="px-5 py-3.5 text-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {d.status === "draft" && (
                        <button
                          onClick={() => onActivate(d.id)}
                          className="btn-ghost h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                        >
                          {t("activate")}
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(d.id)}
                        className="btn-ghost h-8 px-2 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* States */}
          {loading && (
            <div className="py-12 text-center text-sm text-ink-soft">{t("loading")}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IcDiscount className="h-6 w-6" />
              </span>
              <div>
                <div className="font-semibold text-ink">{t("no_discounts")}</div>
                <p className="mt-1 text-sm text-ink-soft">{t("no_discounts_hint")}</p>
              </div>
              <Link href="/discounts/new" className="btn-primary mt-1">
                <IcPlus className="h-4 w-4" /> {t("create_discount")}
              </Link>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
