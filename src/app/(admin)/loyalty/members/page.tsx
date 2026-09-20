"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar, Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/data-table";
import { Toolbar, SearchInput, Pagination, usePagination } from "@/components/dashboard-ui";
import { IcAlert, IcRefresh, IcSignature } from "@/components/icons";
import { listLoyaltyMembers, adjustMemberSignatures, type MemberRow } from "../actions";

const LEVEL_LABEL: Record<string, { ar: string; en: string; tone: string }> = {
  discovery: { ar: "الاكتشاف", en: "Discovery", tone: "bg-slate-100 text-slate-600" },
  curated: { ar: "المنتقاة", en: "Curated", tone: "bg-sky-50 text-sky-700" },
  insider: { ar: "من الداخل", en: "Insider", tone: "bg-violet-50 text-violet-700" },
  icon: { ar: "الأيقونة", en: "Icon", tone: "bg-amber-50 text-amber-700" },
  muse: { ar: "المُلهِمة", en: "Muse", tone: "bg-brand-50 text-brand-700" },
};

export default function LoyaltyMembersPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MemberRow | null>(null);

  async function load() {
    setLoading(true);
    const res = await listLoyaltyMembers();
    if (res.ok) {
      setRows(res.data);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.name ?? ""} ${r.phone}`.toLowerCase().includes(needle));
  }, [rows, q]);
  const pg = usePagination(filtered, { perPage: 25, resetKey: q });

  // Ranked by use: the member names the card, their level and balance sit on
  // its face, and lifetime signatures wait behind a tap.
  const columns: Column<(typeof pg.items)[number]>[] = [
    {
      key: "customer",
      header: ar ? "العميل" : "Customer",
      rank: "title",
      cell: (m) => (
        <span className="flex items-center gap-3">
          <span className="hidden sm:block">
            <Avatar name={m.name || m.phone} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{m.name || (ar ? "بدون اسم" : "No name")}</span>
            <span className="block text-xs font-normal text-ink-soft" dir="ltr">
              {m.phone}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "level",
      header: ar ? "المستوى" : "Level",
      rank: "primary",
      cell: (m) => {
        const lv = LEVEL_LABEL[m.level] ?? LEVEL_LABEL.discovery;
        return <Badge className={lv.tone}>{ar ? lv.ar : lv.en}</Badge>;
      },
    },
    {
      key: "balance",
      header: ar ? "الرصيد" : "Balance",
      rank: "primary",
      cell: (m) => <span className="font-medium text-ink">{num(m.balance, lang)} ✦</span>,
    },
    {
      key: "lifetime",
      header: ar ? "مدى الحياة" : "Lifetime",
      rank: "secondary",
      cell: (m) => <span className="text-ink-muted">{num(m.lifetimeEarned, lang)} ✦</span>,
    },
    {
      key: "adjust",
      header: "",
      align: "end",
      cell: (m) => (
        <button onClick={() => setEditing(m)} className="btn-outline h-8 px-2.5 text-xs">
          {ar ? "تعديل التواقيع" : "Adjust"}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={ar ? "أعضاء المجتمع" : "Society members"}
        subtitle={ar ? "أرصدة التواقيع والمستويات لكل عميل" : "Signature balances & levels per customer"}
        actions={<button className="btn-outline" onClick={load}><IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}</button>}
      />

      {error === "migration_missing" && (
        <Card className="mb-4 flex items-start gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-amber-600 shadow-card"><IcAlert className="h-4 w-4" /></span>
          <div className="text-sm text-amber-800">
            <div className="font-medium">{ar ? "شغّلي ترحيل قاعدة بيانات الولاء" : "Run the loyalty migration"}</div>
            <code className="mt-1 block font-mono text-xs">supabase/migrations/0027_loyalty.sql</code>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <Toolbar>
          <div className="w-full max-w-xs">
            <SearchInput value={q} onChange={setQ} placeholder={ar ? "ابحثي بالاسم أو الرقم…" : "Search name or phone…"} />
          </div>
          <span className="ms-auto text-xs text-ink-soft">{num(filtered.length, lang)}</span>
        </Toolbar>
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : (
          <DataTable
            flush
            rows={pg.items}
            columns={columns}
            getKey={(m) => m.phone}
            empty={ar ? "لا يوجد أعضاء بعد." : "No members yet."}
          />
        )}

        <Pagination {...pg} />
      </Card>

      {editing && <AdjustModal member={editing} ar={ar} onClose={() => setEditing(null)} onDone={load} />}
    </>
  );
}

function AdjustModal({ member, ar, onClose, onDone }: { member: MemberRow; ar: boolean; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) {
      setErr(ar ? "أدخلي رقماً غير صفري" : "Enter a non-zero amount");
      return;
    }
    setBusy(true);
    const res = await adjustMemberSignatures(member.phone, n, note);
    setBusy(false);
    if (res.ok) {
      onDone();
      onClose();
    } else setErr(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink"><IcSignature className="h-4 w-4" /> {ar ? "تعديل التواقيع" : "Adjust signatures"}</div>
        <p className="mb-3 text-xs text-ink-soft">{member.name || member.phone} · {num(member.balance, ar ? "ar" : "en")} ✦</p>
        <label className="mb-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "المقدار (سالب للخصم)" : "Amount (negative to deduct)"}</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^-\d]/g, ""))} placeholder="e.g. 100 or -50" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "السبب" : "Reason"}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "تعويض / حسن نية…" : "Goodwill / correction…"} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
        </label>
        {err && <p className="mb-2 text-xs text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline h-9 px-3 text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="btn-primary h-9 px-4 text-sm disabled:opacity-50">{busy ? "…" : ar ? "تطبيق" : "Apply"}</button>
        </div>
      </div>
    </div>
  );
}
