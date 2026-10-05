"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { KpiRow, StatTile, StatusPill, Toolbar, SearchInput, Select, Pagination, usePagination } from "@/components/dashboard-ui";
import { Modal, Field, fieldClass } from "@/components/modal";
import { IcInbox, IcPlus, IcImage, IcVideo, IcEye, IcChat, IcClipboard, IcMail } from "@/components/icons";
import { REQUEST_STATUS, type CourierRequest, type RequestStatus, type RequestNote } from "@/lib/courier-ops";
import { listRequests, createRequest, updateRequestStatus, setRequestAssignee, addRequestNote, listRequestNotes } from "../actions";

const ASSIGNEES = ["Toka", "Marina", "Shrouq", "Mariam"];
const STATUS_ORDER: RequestStatus[] = ["pending", "process", "approved", "cancelled"];
const STATUS_ACCENT: Record<RequestStatus, "amber" | "sky" | "emerald" | "rose"> = {
  pending: "amber",
  process: "sky",
  approved: "emerald",
  cancelled: "rose",
};

export default function RequestsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<CourierRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const [media, setMedia] = useState<null | { url: string; type: "image" | "video" }>(null);
  const [notesFor, setNotesFor] = useState<CourierRequest | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listRequests();
    if (res.ok) setRows(res.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<RequestStatus, number> = { pending: 0, process: 0, approved: 0, cancelled: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.comment ?? "").toLowerCase().includes(q) ||
        (r.assignee ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  const pg = usePagination(filtered, { perPage: 20, resetKey: `${search}|${status}` });

  async function changeStatus(id: string, next: RequestStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    await updateRequestStatus(id, next);
  }
  async function changeAssignee(id: string, next: string) {
    const value = next || null;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, assignee: value } : r)));
    await setRequestAssignee(id, value);
  }

  return (
    <>
      <PageHeader
        title={ar ? "طلبات العملاء" : "Customer requests"}
        subtitle={ar ? "صندوق وارد الاستفسارات وطلبات العملاء" : "Inbox of customer inquiries & requests"}
        primary={{ label: ar ? "إضافة طلب" : "Add request", onClick: () => setShowCreate(true), icon: <IcPlus className="h-4 w-4" /> }}
      />

      <div className="mb-4">
        <KpiRow cols={4}>
          {STATUS_ORDER.map((st) => (
            <StatTile
              key={st}
              label={ar ? REQUEST_STATUS[st].ar : REQUEST_STATUS[st].en}
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
          <SearchInput value={search} onChange={setSearch} placeholder={ar ? "ابحث بالاسم، الهاتف، التعليق…" : "Search name, phone, comment…"} />
          <Select value={status} onChange={(v) => setStatus(v as RequestStatus | "all")}>
            <option value="all">{ar ? "كل الحالات" : "All statuses"}</option>
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>{ar ? REQUEST_STATUS[st].ar : REQUEST_STATUS[st].en}</option>
            ))}
          </Select>
          <span className="ms-auto text-sm text-ink-soft">{num(filtered.length, lang)} {ar ? "طلب" : "requests"}</span>
        </Toolbar>

        {loading ? (
          <div className="py-16 text-center text-sm text-ink-soft">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IcInbox className="h-6 w-6" /></span>
            <div className="font-semibold text-ink">{ar ? "لا توجد طلبات" : "No requests"}</div>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-1"><IcPlus className="h-4 w-4" /> {ar ? "إضافة طلب" : "Add request"}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs text-ink-soft">
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "العميل" : "Customer"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "التواصل" : "Contact"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الوسائط" : "Media"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{ar ? "المسؤول" : "Assignee"}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pg.items.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-surface-page/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{r.name}</div>
                      {r.comment && <div className="mt-0.5 max-w-[22rem] truncate text-xs text-ink-soft">{r.comment}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {r.phone && <div className="flex items-center gap-1.5 text-xs text-ink-muted" dir="ltr"><IcChat className="h-3.5 w-3.5 text-ink-soft" />{r.phone}</div>}
                      {r.email && <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft" dir="ltr"><IcMail className="h-3.5 w-3.5" />{r.email}</div>}
                      {!r.phone && !r.email && <span className="text-xs text-ink-soft">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.imageUrl && (
                          <button onClick={() => setMedia({ url: r.imageUrl!, type: "image" })} className="group relative h-10 w-10 overflow-hidden rounded-lg border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:opacity-80" />
                          </button>
                        )}
                        {r.videoUrl && (
                          <button onClick={() => setMedia({ url: r.videoUrl!, type: "video" })} className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-soft hover:text-ink">
                            <IcVideo className="h-5 w-5" />
                          </button>
                        )}
                        {!r.imageUrl && !r.videoUrl && <span className="text-xs text-ink-soft">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect value={r.status} onChange={(v) => changeStatus(r.id, v)} ar={ar} />
                    </td>
                    <td className="px-4 py-3">
                      <Select value={r.assignee ?? ""} onChange={(v) => changeAssignee(r.id, v)}>
                        <option value="">{ar ? "غير مُسند" : "Unassigned"}</option>
                        {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
                        {r.assignee && !ASSIGNEES.includes(r.assignee) && <option value={r.assignee}>{r.assignee}</option>}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setNotesFor(r)} title={ar ? "الملاحظات" : "Notes"} className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-surface-hover hover:text-ink"><IcClipboard className="h-4 w-4" /></button>
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

      {media && <MediaModal ar={ar} media={media} onClose={() => setMedia(null)} />}
      {notesFor && <NotesModal ar={ar} request={notesFor} onClose={() => setNotesFor(null)} />}
      {showCreate && <CreateRequestModal ar={ar} onClose={() => setShowCreate(false)} onSaved={async () => { setShowCreate(false); await load(); }} />}
    </>
  );
}

function StatusSelect({ value, onChange, ar }: { value: RequestStatus; onChange: (v: RequestStatus) => void; ar: boolean }) {
  const meta = REQUEST_STATUS[value];
  return (
    <div className="flex items-center gap-2">
      <StatusPill label={ar ? meta.ar : meta.en} tone={meta.tone} />
      <Select value={value} onChange={(v) => onChange(v as RequestStatus)}>
        {STATUS_ORDER.map((st) => <option key={st} value={st}>{ar ? REQUEST_STATUS[st].ar : REQUEST_STATUS[st].en}</option>)}
      </Select>
    </div>
  );
}

function MediaModal({ ar, media, onClose }: { ar: boolean; media: { url: string; type: "image" | "video" }; onClose: () => void }) {
  return (
    <Modal title={ar ? "المرفق" : "Attachment"} icon={media.type === "video" ? IcVideo : IcImage} size="xl" onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><a href={media.url} target="_blank" rel="noopener noreferrer" className="btn-outline h-9 px-4 text-sm"><IcEye className="h-4 w-4" /> {ar ? "فتح" : "Open"}</a><button onClick={onClose} className="btn-primary h-9 px-5 text-sm">{ar ? "إغلاق" : "Close"}</button></>}>
      {media.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" className="mx-auto max-h-[60vh] rounded-xl" />
      ) : (
        <video src={media.url} controls className="mx-auto max-h-[60vh] w-full rounded-xl" />
      )}
    </Modal>
  );
}

function NotesModal({ ar, request, onClose }: { ar: boolean; request: CourierRequest; onClose: () => void }) {
  const [notes, setNotes] = useState<RequestNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listRequestNotes(request.id);
    if (res.ok) setNotes(res.data);
    setLoading(false);
  }, [request.id]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addRequestNote(request.id, text);
    setBusy(false);
    if (res.ok) { setText(""); await load(); }
  }

  return (
    <Modal title={ar ? "ملاحظات الطلب" : "Request notes"} subtitle={request.name} icon={IcClipboard} size="lg" onClose={onClose} dir={ar ? "rtl" : "ltr"}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={ar ? "أضف ملاحظة…" : "Add a note…"} className={fieldClass} />
          <button onClick={add} disabled={busy || !text.trim()} className="btn-primary h-10 shrink-0 px-4 text-sm disabled:opacity-50">{ar ? "إضافة" : "Add"}</button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-ink-soft">…</div>
        ) : notes.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-soft">{ar ? "لا ملاحظات بعد" : "No notes yet"}</div>
        ) : (
          <ul className="space-y-2">
            {notes.map((nt) => (
              <li key={nt.id} className="rounded-xl border border-line bg-surface-page p-3">
                <div className="text-sm text-ink">{nt.note}</div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-soft">
                  <span>{nt.author ?? "—"}</span>
                  <span dir="ltr">{new Date(nt.createdAt).toLocaleString(ar ? "ar-EG" : "en-US")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function CreateRequestModal({ ar, onClose, onSaved }: { ar: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr(ar ? "الاسم مطلوب." : "Name is required."); return; }
    setBusy(true); setErr(null);
    const res = await createRequest({ name, email, phone, comment, imageUrl, videoUrl });
    setBusy(false);
    if (res.ok) onSaved();
    else setErr(res.error === "migration_missing" ? (ar ? "شغّلي ترحيل 0049." : "Run migration 0049.") : (ar ? "حدث خطأ." : "Something went wrong."));
  }

  return (
    <Modal title={ar ? "إضافة طلب" : "Add request"} subtitle={ar ? "سجّل استفسار أو طلب عميل يدوياً" : "Log a customer inquiry or request"} icon={IcInbox} size="lg" onClose={onClose} dir={ar ? "rtl" : "ltr"}
      footer={<><button onClick={onClose} className="btn-outline h-9 px-4 text-sm">{ar ? "إلغاء" : "Cancel"}</button><button onClick={save} disabled={busy} className="btn-primary h-9 px-5 text-sm disabled:opacity-50">{busy ? "…" : ar ? "حفظ" : "Save"}</button></>}>
      <div className="space-y-3">
        <Field label={ar ? "الاسم" : "Name"}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={ar ? "الهاتف" : "Phone"}><input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={fieldClass} /></Field>
          <Field label={ar ? "البريد" : "Email"}><input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={fieldClass} /></Field>
        </div>
        <Field label={ar ? "التعليق" : "Comment"}><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className={fieldClass} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={ar ? "رابط صورة" : "Image URL"}><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} dir="ltr" className={fieldClass} /></Field>
          <Field label={ar ? "رابط فيديو" : "Video URL"}><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} dir="ltr" className={fieldClass} /></Field>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}
