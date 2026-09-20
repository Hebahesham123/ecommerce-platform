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
import { DataTable, type Column } from "@/components/data-table";
import { Card, Badge } from "@/components/ui";
import { summaryLine } from "@/components/discount-summary";
import { Pagination, usePagination } from "@/components/dashboard-ui";
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

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${tab}|${q}` });

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

  // Ranked by use: the code or title names the card, its state and how many
  // times it has been used sit on the face, the rest waits behind a tap.
  const columns: Column<(typeof pg.items)[number]>[] = [
    {
      key: "title",
      header: t("col_title"),
      rank: "title",
      cell: (d) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-ink">
            {d.method === "code" ? d.code || d.title : d.title}
          </span>
          <span className="block truncate text-xs font-normal text-ink-soft">{summaryLine(d, lang)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("col_status"),
      rank: "primary",
      cell: (d) => <Badge className={statusTone[d.status]}>{t(statusKey[d.status])}</Badge>,
    },
    {
      key: "used",
      header: t("col_used"),
      rank: "primary",
      align: "end",
      cell: (d) => (
        <span className="font-medium text-ink">
          {num(d.usedCount, lang)} <span className="font-normal text-ink-soft">{t("col_used")}</span>
        </span>
      ),
    },
    {
      key: "method",
      header: t("col_method"),
      rank: "secondary",
      cell: (d) => <span className="text-ink-muted">{t(methodKey[d.method])}</span>,
    },
    {
      key: "eligibility",
      header: t("col_eligibility"),
      rank: "secondary",
      cell: (d) => (
        <span className="text-ink-muted">{d.eligibility === "all" ? t("elig_all") : t("elig_customers")}</span>
      ),
      hideBelow: "lg",
    },
    {
      key: "type",
      header: t("col_type"),
      rank: "secondary",
      cell: (d) => <span className="text-ink-muted">{t(typeKey[d.discountType])}</span>,
      hideBelow: "lg",
    },
    {
      key: "combinations",
      header: t("col_combinations"),
      rank: "secondary",
      cell: (d) => <CombinationDots d={d} />,
      hideBelow: "xl",
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (d) => (
        <span className="flex items-center justify-end gap-1">
          {d.status === "draft" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActivate(d.id);
              }}
              className="btn-ghost h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
            >
              {t("activate")}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(d.id);
            }}
            className="btn-ghost h-8 px-2 text-xs text-rose-600 hover:bg-rose-50"
          >
            {t("delete")}
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("nav_discounts")}
        subtitle={t("discounts_subtitle")}
        actions={
          <button className="btn-outline h-10" onClick={exportCsv}>
            {t("export")}
          </button>
        }
        primary={{
          label: t("create_discount"),
          href: "/discounts/new",
          icon: <IcPlus className="h-4 w-4" />,
        }}
      />

      {error === "not_configured" && (
        <Card className="mb-4 flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card">
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
              className="h-9 w-56 rounded-xl border border-line bg-surface-page ps-9 pe-3 text-sm outline-none focus:border-brand-600 focus:bg-surface"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-12 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : (
          <DataTable
            flush
            rows={pg.items}
            columns={columns}
            getKey={(d) => d.id}
            onRowClick={(d) => router.push(`/discounts/${d.id}`)}
            empty={
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-page text-ink-muted">
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
            }
          />
        )}

        {!loading && <Pagination {...pg} />}
      </Card>
    </>
  );
}
