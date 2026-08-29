"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { KpiRow, StatTile } from "@/components/dashboard-ui";
import { IcInbox, IcCustomers, IcSend, IcCopy, IcX, IcUp } from "@/components/icons";
import {
  starterTemplates,
  renderEmailHtml,
  SAMPLE_CONTEXT,
  type EmailTemplate,
} from "@/lib/email";
import {
  filterAudience,
  FIELD_LABELS,
  type AudienceCustomer,
  type Segment,
  type SegmentRule,
  type RuleField,
} from "@/lib/segments";
import { useTemplates, useSegments, useCampaigns, type Campaign } from "@/lib/email-store";
import { listEmailAudience } from "./audience-actions";

type Tab = "campaigns" | "templates" | "audiences";

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "t" + Date.now() + Math.floor(Math.random() * 1e6);
  }
}

export default function EmailPage() {
  return (
    <Suspense fallback={null}>
      <EmailInner />
    </Suspense>
  );
}

function EmailInner() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const search = useSearchParams();
  const initialTab = (search.get("tab") as Tab) || "campaigns";
  const [tab, setTab] = useState<Tab>(["campaigns", "templates", "audiences"].includes(initialTab) ? initialTab : "campaigns");

  const [audience, setAudience] = useState<AudienceCustomer[]>([]);
  const [audienceLoaded, setAudienceLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const res = await listEmailAudience();
      if (res.ok) setAudience(res.data);
      setAudienceLoaded(true);
    })();
  }, []);

  const emailable = audience.filter((c) => c.email).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "campaigns", label: ar ? "الحملات" : "Campaigns" },
    { id: "templates", label: ar ? "القوالب" : "Templates" },
    { id: "audiences", label: ar ? "الجماهير" : "Audiences" },
  ];

  return (
    <>
      <PageHeader
        title={ar ? "التسويق بالبريد" : "Email marketing"}
        subtitle={ar ? "قوالب وشرائح وحملات بريدية" : "Templates, segments & email campaigns"}
      />

      <div className="mb-4">
        <KpiRow cols={3}>
          <StatTile icon={IcCustomers} label={ar ? "عملاء" : "Customers"} value={num(audience.length, lang)} accent="brand" />
          <StatTile icon={IcInbox} label={ar ? "لديهم بريد" : "Reachable by email"} value={num(emailable, lang)} accent="sky" />
          <StatTile icon={IcSend} label={ar ? "قابل للإرسال" : "Provider"} value={ar ? "غير مُفعّل" : "Not connected"} accent="amber" />
        </KpiRow>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === tb.id ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "templates" && <TemplatesTab ar={ar} />}
      {tab === "audiences" && <AudiencesTab ar={ar} audience={audience} loaded={audienceLoaded} />}
      {tab === "campaigns" && <CampaignsTab ar={ar} audience={audience} />}
    </>
  );
}

// ---- Templates --------------------------------------------------------------
function TemplatesTab({ ar }: { ar: boolean }) {
  const router = useRouter();
  const [templates, setTemplates] = useTemplates();
  const [picking, setPicking] = useState(false);

  function createFrom(starterId: string) {
    const starter = starterTemplates().find((t) => t.id === starterId) ?? starterTemplates()[0];
    const id = uuid();
    const t: EmailTemplate = { ...starter, id, name: `${starter.name} copy`, updatedAt: Date.now() };
    setTemplates((prev) => [t, ...prev]);
    setPicking(false);
    router.push(`/email/editor/${id}`);
  }
  function duplicate(t: EmailTemplate) {
    const copy = { ...t, id: uuid(), name: `${t.name} copy`, updatedAt: Date.now() };
    setTemplates((prev) => [copy, ...prev]);
  }
  function remove(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{ar ? "قوالب البريد" : "Email templates"}</h3>
        <button onClick={() => setPicking((p) => !p)} className="btn-primary h-9 px-3 text-sm">
          + {ar ? "قالب جديد" : "New template"}
        </button>
      </div>

      {picking && (
        <div className="mb-4 rounded-xl border border-line bg-surface-page p-3">
          <div className="mb-2 text-xs font-medium text-ink-muted">{ar ? "ابدأ من قالب جاهز" : "Start from a ready template"}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {starterTemplates().map((s) => (
              <button
                key={s.id}
                onClick={() => createFrom(s.id)}
                className="rounded-xl border border-line bg-surface p-3 text-start hover:border-brand-600"
              >
                <div className="text-sm font-semibold text-ink">{s.name}</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{s.subject || (ar ? "بدون موضوع" : "No subject")}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">{ar ? "لا توجد قوالب بعد." : "No templates yet."}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="overflow-hidden rounded-xl border border-line">
              <button onClick={() => router.push(`/email/editor/${t.id}`)} className="block w-full bg-surface-page" aria-label="Edit">
                <span className="block h-40 overflow-hidden">
                  <iframe
                    title={t.name}
                    srcDoc={renderEmailHtml(t, SAMPLE_CONTEXT)}
                    tabIndex={-1}
                    className="pointer-events-none h-[400px] w-[250%] origin-top-left scale-[0.4] border-0 bg-white"
                  />
                </span>
              </button>
              <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{t.name}</div>
                  <div className="truncate text-xs text-ink-soft">{t.subject || (ar ? "بدون موضوع" : "No subject")}</div>
                </div>
                <button onClick={() => router.push(`/email/editor/${t.id}`)} className="btn-outline h-8 px-2 text-xs">{ar ? "تعديل" : "Edit"}</button>
                <button onClick={() => duplicate(t)} className="btn-ghost h-8 w-8 p-0 text-ink-muted" aria-label="Duplicate"><IcCopy className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(t.id)} className="btn-ghost h-8 w-8 p-0 text-rose-500" aria-label="Delete"><IcX className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---- Audiences / Segments ---------------------------------------------------
const FIELDS: RuleField[] = ["totalSpent", "ordersCount", "lastOrderDays", "governorate", "hasEmail"];

function AudiencesTab({ ar, audience, loaded }: { ar: boolean; audience: AudienceCustomer[]; loaded: boolean }) {
  const [segments, setSegments] = useSegments();
  const [activeId, setActiveId] = useState<string>("__all");

  const active = segments.find((s) => s.id === activeId) ?? null;
  const matched = useMemo(() => {
    if (activeId === "__all") return audience;
    return active ? filterAudience(audience, active) : audience;
  }, [audience, active, activeId]);
  const emailable = matched.filter((c) => c.email).length;

  function saveSegment(seg: Segment) {
    setSegments((prev) => {
      const i = prev.findIndex((s) => s.id === seg.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = seg;
        return copy;
      }
      return [seg, ...prev];
    });
    setActiveId(seg.id);
  }
  function removeSegment(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId("__all");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      {/* left: segment list + builder */}
      <div className="space-y-3">
        <Card className="p-2">
          <button
            onClick={() => setActiveId("__all")}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${activeId === "__all" ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-hover"}`}
          >
            <span>{ar ? "كل العملاء" : "All customers"}</span>
            <span className="text-xs">{num(audience.length, ar ? "ar" : "en")}</span>
          </button>
          {segments.map((s) => {
            const count = filterAudience(audience, s).length;
            return (
              <div key={s.id} className={`group flex items-center gap-1 rounded-lg px-1 ${activeId === s.id ? "bg-brand-50" : "hover:bg-surface-hover"}`}>
                <button onClick={() => setActiveId(s.id)} className={`flex flex-1 items-center justify-between px-2 py-2 text-start text-sm ${activeId === s.id ? "text-brand-700" : "text-ink-muted"}`}>
                  <span className="min-w-0 truncate">{s.name}</span>
                  <span className="text-xs">{num(count, ar ? "ar" : "en")}</span>
                </button>
                <button onClick={() => removeSegment(s.id)} className="px-1 text-rose-400 opacity-0 group-hover:opacity-100" aria-label="Delete"><IcX className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
        </Card>

        <SegmentBuilder ar={ar} audience={audience} onSave={saveSegment} editing={active} />
      </div>

      {/* right: matched customers */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="text-sm font-semibold text-ink">{active ? active.name : ar ? "كل العملاء" : "All customers"}</div>
          <Badge className="bg-sky-50 text-sky-700">{num(matched.length, ar ? "ar" : "en")} {ar ? "مطابق" : "matched"}</Badge>
          <Badge className="bg-emerald-50 text-emerald-700">{num(emailable, ar ? "ar" : "en")} {ar ? "لديهم بريد" : "with email"}</Badge>
        </div>
        <div className="max-h-[520px] overflow-auto">
          {!loaded ? (
            <p className="p-8 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</p>
          ) : matched.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-soft">{ar ? "لا يوجد عملاء مطابقون" : "No matching customers"}</p>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="px-4 py-2 text-start font-medium">{ar ? "العميل" : "Customer"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "البريد" : "Email"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "طلبات" : "Orders"}</th>
                  <th className="px-3 py-2 text-start font-medium">{ar ? "الإنفاق" : "Spent"}</th>
                </tr>
              </thead>
              <tbody>
                {matched.slice(0, 500).map((c) => (
                  <tr key={c.phone} className="border-b border-line last:border-0 hover:bg-surface-page">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="text-xs text-ink-soft" dir="ltr">{c.phone}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted" dir="ltr">
                      {c.email ?? <span className="text-ink-soft">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-ink">{num(c.ordersCount, ar ? "ar" : "en")}</td>
                    <td className="px-3 py-2.5 font-medium text-ink">{num(c.totalSpent, ar ? "ar" : "en")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function SegmentBuilder({
  ar,
  audience,
  onSave,
  editing,
}: {
  ar: boolean;
  audience: AudienceCustomer[];
  onSave: (s: Segment) => void;
  editing: Segment | null;
}) {
  const [name, setName] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [rules, setRules] = useState<SegmentRule[]>([{ field: "totalSpent", op: "gte", value: 500 }]);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setMatch(editing.match);
      setRules(editing.rules.length ? editing.rules : [{ field: "totalSpent", op: "gte", value: 0 }]);
    }
  }, [editing]);

  const preview = filterAudience(audience, { match, rules });

  function setRule(i: number, patch: Partial<SegmentRule>) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function save() {
    const seg: Segment = {
      id: editing ? editing.id : uuid(),
      name: name.trim() || (ar ? "شريحة جديدة" : "New segment"),
      match,
      rules,
      updatedAt: Date.now(),
    };
    onSave(seg);
    if (!editing) {
      setName("");
      setRules([{ field: "totalSpent", op: "gte", value: 500 }]);
    }
  }

  return (
    <Card className="p-3">
      <div className="mb-2 text-sm font-semibold text-ink">{editing ? (ar ? "تعديل الشريحة" : "Edit segment") : ar ? "شريحة مخصّصة" : "Build a segment"}</div>
      <input
        className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600"
        placeholder={ar ? "اسم الشريحة" : "Segment name"}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
        {ar ? "طابق" : "Match"}
        <select value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
          <option value="all">{ar ? "كل" : "all"}</option>
          <option value="any">{ar ? "أي" : "any"}</option>
        </select>
        {ar ? "الشروط" : "of the rules"}
      </div>

      <div className="space-y-2">
        {rules.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select value={r.field} onChange={(e) => setRule(i, { field: e.target.value as RuleField })} className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs">
              {FIELDS.map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
            {r.field === "hasEmail" ? (
              <select value={String(r.value)} onChange={(e) => setRule(i, { op: "is", value: e.target.value === "true" })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs">
                <option value="true">{ar ? "نعم" : "yes"}</option>
                <option value="false">{ar ? "لا" : "no"}</option>
              </select>
            ) : r.field === "governorate" ? (
              <input value={String(r.value)} onChange={(e) => setRule(i, { op: "is", value: e.target.value })} placeholder={ar ? "المحافظة" : "e.g. Cairo"} className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs" />
            ) : (
              <>
                <select value={r.op} onChange={(e) => setRule(i, { op: e.target.value as "gte" | "lte" })} className="rounded-lg border border-line bg-surface px-1.5 py-1.5 text-xs">
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                </select>
                <input type="number" value={Number(r.value)} onChange={(e) => setRule(i, { value: Number(e.target.value) || 0 })} className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs" />
              </>
            )}
            <button onClick={() => setRules((prev) => prev.filter((_, idx) => idx !== i))} className="px-1 text-rose-400" aria-label="Remove"><IcX className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      <button onClick={() => setRules((prev) => [...prev, { field: "ordersCount", op: "gte", value: 1 }])} className="btn-ghost mt-2 h-7 px-2 text-xs text-brand-600">+ {ar ? "شرط" : "Add rule"}</button>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-xs text-ink-muted">{num(preview.length, ar ? "ar" : "en")} {ar ? "مطابق" : "match"}</span>
        <button onClick={save} className="btn-primary h-8 px-3 text-xs">{editing ? (ar ? "تحديث" : "Update") : ar ? "حفظ الشريحة" : "Save segment"}</button>
      </div>
    </Card>
  );
}

// ---- Campaigns --------------------------------------------------------------
function CampaignsTab({ ar, audience }: { ar: boolean; audience: AudienceCustomer[] }) {
  const [campaigns, setCampaigns] = useCampaigns();
  const [templates] = useTemplates();
  const [segments] = useSegments();
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [segmentId, setSegmentId] = useState("__all");
  const [preview, setPreview] = useState<EmailTemplate | null>(null);

  const seg = segments.find((s) => s.id === segmentId) ?? null;
  const recipients = segmentId === "__all" ? audience : seg ? filterAudience(audience, seg) : audience;
  const emailable = recipients.filter((c) => c.email).length;

  function resetForm() {
    setName(""); setSubject(""); setTemplateId(""); setSegmentId("__all");
  }
  function send(status: "draft" | "sent") {
    const tpl = templates.find((t) => t.id === templateId);
    const c: Campaign = {
      id: uuid(),
      name: name.trim() || (ar ? "حملة بدون اسم" : "Untitled campaign"),
      subject: subject.trim() || tpl?.subject || "",
      templateId: templateId || null,
      segmentId: segmentId === "__all" ? null : segmentId,
      status,
      recipients: status === "sent" ? emailable : 0,
      sentAt: status === "sent" ? Date.now() : null,
      createdAt: Date.now(),
    };
    setCampaigns((prev) => [c, ...prev]);
    setCreating(false);
    resetForm();
  }

  const templateOf = (id: string | null) => templates.find((t) => t.id === id);
  const segName = (id: string | null) => (id ? segments.find((s) => s.id === id)?.name ?? "—" : ar ? "كل العملاء" : "All customers");

  return (
    <>
      {creating && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{ar ? "حملة جديدة" : "New campaign"}</h3>
            <button onClick={() => setCreating(false)} className="btn-ghost h-8 w-8 p-0 text-ink-muted"><IcX className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "اسم الحملة" : "Campaign name"}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "الموضوع" : "Subject"}</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={templateOf(templateId)?.subject || ""} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-600" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "القالب" : "Template"}</span>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <option value="">{ar ? "اختر قالباً" : "Choose a template"}</option>
                {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted">{ar ? "الشريحة" : "Audience"}</span>
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <option value="__all">{ar ? "كل العملاء" : "All customers"}</option>
                {segments.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface-page p-3">
            <Badge className="bg-emerald-50 text-emerald-700">{num(emailable, ar ? "ar" : "en")} {ar ? "مستلم بالبريد" : "email recipients"}</Badge>
            <span className="text-xs text-ink-soft">{ar ? `من ${num(recipients.length, "ar")} في الشريحة` : `of ${recipients.length} in this audience`}</span>
            {templateId && (
              <button onClick={() => setPreview(templateOf(templateId) ?? null)} className="btn-outline ms-auto h-8 px-3 text-xs">{ar ? "معاينة" : "Preview"}</button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={() => send("draft")} className="btn-outline h-9 px-3 text-sm">{ar ? "حفظ كمسودة" : "Save draft"}</button>
            <button
              onClick={() => send("sent")}
              disabled={!templateId || emailable === 0}
              className="btn-primary h-9 gap-1.5 px-4 text-sm disabled:opacity-40"
              title={emailable === 0 ? (ar ? "لا يوجد مستلمون بالبريد" : "No email recipients") : ""}
            >
              <IcSend className="h-4 w-4" /> {ar ? "إرسال" : "Send"}
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-soft">
            {ar
              ? "الإرسال معطّل حتى تربط مزوّد بريد (Resend/SMTP). حتى ذلك الحين تُسجَّل الحملة كمُرسلة للتتبّع."
              : "Sending is stubbed until an email provider (Resend/SMTP) is connected. Until then the campaign is recorded as sent for tracking."}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">{ar ? "الحملات" : "Campaigns"}</h3>
          {!creating && (
            <button onClick={() => setCreating(true)} className="btn-primary h-9 px-3 text-sm">+ {ar ? "حملة جديدة" : "New campaign"}</button>
          )}
        </div>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IcInbox className="h-6 w-6" /></span>
            <div>
              <div className="font-semibold text-ink">{ar ? "لا توجد حملات بعد" : "No campaigns yet"}</div>
              <p className="mt-1 text-sm text-ink-soft">{ar ? "أنشئ قالباً ثم أرسل حملتك الأولى." : "Create a template, then send your first campaign."}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">{ar ? "الحملة" : "Campaign"}</th>
                  <th className="px-3 py-3 text-start font-medium">{ar ? "الشريحة" : "Audience"}</th>
                  <th className="px-3 py-3 text-start font-medium">{ar ? "القالب" : "Template"}</th>
                  <th className="px-3 py-3 text-start font-medium">{ar ? "مستلمون" : "Recipients"}</th>
                  <th className="px-3 py-3 text-start font-medium">{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-page">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{c.name}</div>
                      <div className="truncate text-xs text-ink-soft">{c.subject}</div>
                    </td>
                    <td className="px-3 py-3 text-ink-muted">{segName(c.segmentId)}</td>
                    <td className="px-3 py-3 text-ink-muted">{templateOf(c.templateId)?.name ?? "—"}</td>
                    <td className="px-3 py-3 text-ink">{num(c.recipients, ar ? "ar" : "en")}</td>
                    <td className="px-3 py-3">
                      {c.status === "sent" ? (
                        <Badge className="bg-emerald-50 text-emerald-700"><IcUp className="h-3 w-3" /> {ar ? "مُرسلة" : "Sent"}</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600">{ar ? "مسودة" : "Draft"}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreview(null)}>
          <div className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <span className="text-sm font-semibold text-ink">{preview.name}</span>
              <button onClick={() => setPreview(null)} className="btn-ghost h-8 w-8 p-0"><IcX className="h-4 w-4" /></button>
            </div>
            <iframe title="preview" srcDoc={renderEmailHtml(preview, SAMPLE_CONTEXT)} className="flex-1 border-0 bg-white" />
          </div>
        </div>
      )}
    </>
  );
}
