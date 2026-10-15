"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, Badge } from "@/components/ui";
import { KpiRow, StatTile } from "@/components/dashboard-ui";
import { IcBell, IcEye, IcMobile, IcSend, IcTrash, IcX } from "@/components/icons";
import { ImageUpload, LinkPicker, type LinkValue } from "@/components/pickers";
import type { AppNotification } from "@/lib/app-notifications";
import {
  audienceSizeAction,
  collectionsAction,
  deleteNotificationAction,
  listNotificationsAction,
  sendNotificationAction,
  type CollectionOption,
} from "./actions";

/**
 * App notifications: a message written here goes into the bell inside the
 * app, and pops up on the phone of everyone it is for who allowed pop-ups.
 *
 * The numbers are the real ones: "delivered" is installs whose bell it is in,
 * "popped up" is phones the push service accepted it for, "opened" is installs
 * that tapped it.
 */

const input =
  "h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

const TITLE_MAX = 65;
const BODY_MAX = 240;

const AUDIENCES: { key: string; en: string; ar: string; hint: { en: string; ar: string } }[] = [
  { key: "all", en: "Everyone with the app", ar: "كل من لديه التطبيق", hint: { en: "Every phone the app is installed on.", ar: "كل جهاز مثبت عليه التطبيق." } },
  { key: "signed_in", en: "Signed-in customers", ar: "العملاء المسجلون", hint: { en: "Phones where a customer has signed in.", ar: "الأجهزة التي سجّل فيها عميل دخوله." } },
  { key: "buyers", en: "Customers who ordered", ar: "عملاء طلبوا من قبل", hint: { en: "Signed-in customers with at least one order.", ar: "عملاء مسجلون لديهم طلب واحد على الأقل." } },
  { key: "cart", en: "Left items in the cart", ar: "تركوا منتجات في السلة", hint: { en: "Something in the cart in the last 14 days, and no order since.", ar: "منتجات في السلة خلال آخر ١٤ يوماً دون طلب بعدها." } },
  { key: "phones", en: "Specific phone numbers", ar: "أرقام محددة", hint: { en: "Only these customers, on phones where they signed in.", ar: "هؤلاء العملاء فقط، على الأجهزة التي سجلوا فيها." } },
];

function when(iso: string | null, ar: boolean) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** How it will look on a phone's lock screen. */
function PhonePreview({ title, body, image, ar }: { title: string; body: string; image: string; ar: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2rem] bg-gradient-to-b from-[#3a2a20] to-[#1d1511] p-3 pt-10 shadow-lg">
      <div className="mb-6 text-center text-3xl font-light text-white/90">9:41</div>
      <div className="rounded-2xl bg-white/85 p-3 backdrop-blur" dir="auto">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-black/50">
          <span className="grid h-4 w-4 place-items-center rounded bg-[#8a5a2b] text-[8px] font-bold text-white">B</span>
          BeautyBar · {ar ? "الآن" : "now"}
        </div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-black">{title || (ar ? "العنوان" : "Title")}</div>
            <div className="line-clamp-3 text-[12px] leading-snug text-black/80">{body || (ar ? "نص الإشعار" : "Your message")}</div>
          </div>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppNotificationsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [list, setList] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState<LinkValue>({});
  const [audience, setAudience] = useState("all");
  const [phones, setPhones] = useState("");
  const [size, setSize] = useState<{ installs: number; popups: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function load() {
    const res = await listNotificationsAction();
    if (res.ok) {
      setList(res.data);
      setError(null);
    } else {
      setList([]);
      setError(res.error);
    }
  }

  useEffect(() => {
    load();
    collectionsAction().then(setCollections);
  }, []);

  // Who it will reach, counted again whenever the audience changes.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setSize(null);
    const t = setTimeout(async () => {
      const res = await audienceSizeAction(audience, phones);
      if (live && res.ok) setSize(res.data);
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, audience, phones]);

  const totals = useMemo(() => {
    const sent = (list ?? []).filter((n) => n.status === "sent");
    const delivered = sent.reduce((s, n) => s + n.recipients, 0);
    const opened = sent.reduce((s, n) => s + n.opened, 0);
    return { sent: sent.length, delivered, opened, rate: delivered ? Math.round((opened / delivered) * 100) : 0 };
  }, [list]);

  function reset() {
    setTitle("");
    setBody("");
    setImage("");
    setLink({});
    setAudience("all");
    setPhones("");
    setConfirm(false);
  }

  async function send() {
    setSending(true);
    setNotice(null);
    const res = await sendNotificationAction({ title, body, imageUrl: image, link, audience, phones });
    setSending(false);
    setConfirm(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    const n = res.data;
    setNotice(
      ar
        ? `أُرسل: وصل إلى ${num(n.recipients, lang)} جهاز، وظهر كتنبيه على ${num(n.pushed, lang)} هاتف.`
        : `Sent: delivered to ${num(n.recipients, lang)} installs, popped up on ${num(n.pushed, lang)} phones.`,
    );
    reset();
    setOpen(false);
    load();
  }

  async function remove(n: AppNotification) {
    if (!window.confirm(ar ? "حذف هذا الإشعار من السجل ومن جرس التطبيق عند الجميع؟" : "Delete this notification from the history and from everyone's bell?")) return;
    await deleteNotificationAction(n.id);
    load();
  }

  const errorText = (e: string) =>
    e === "migration_missing"
      ? ar
        ? "شغّلي ملف قاعدة البيانات 0056_app_notifications.sql في Supabase ثم حدّثي الصفحة."
        : "Run the database file 0056_app_notifications.sql in Supabase, then refresh this page."
      : e === "title_required"
        ? ar
          ? "اكتبي عنواناً للإشعار."
          : "Write a title for the notification."
        : e === "phones_required"
          ? ar
            ? "أضيفي رقم هاتف واحداً على الأقل."
            : "Add at least one phone number."
          : e;

  const canSend = title.trim().length > 0 && (audience !== "phones" || phones.trim().length > 0) && !sending;
  const hint = AUDIENCES.find((a) => a.key === audience)?.hint;

  return (
    <>
      <PageHeader
        title={ar ? "إشعارات التطبيق" : "App notifications"}
        subtitle={ar ? "رسائل تظهر في جرس التطبيق وتنبيهات على الهاتف" : "Messages in the app's bell, and pop-ups on the phone"}
        primary={{ label: ar ? "إشعار جديد" : "New notification", onClick: () => setOpen(true), icon: <IcBell className="h-4 w-4" /> }}
      />

      <div className="mb-4">
        <KpiRow cols={3}>
          <StatTile icon={IcSend} label={ar ? "إشعارات مرسلة" : "Sent"} value={num(totals.sent, lang)} accent="brand" />
          <StatTile icon={IcMobile} label={ar ? "مرات الوصول" : "Delivered"} value={num(totals.delivered, lang)} accent="sky" />
          <StatTile
            icon={IcEye}
            label={ar ? "فُتحت" : "Opened"}
            value={num(totals.opened, lang)}
            sub={totals.delivered ? `${num(totals.rate, lang)}%` : undefined}
            accent="emerald"
          />
        </KpiRow>
      </div>

      {error && <Card className="mb-4 p-4 text-sm text-rose-600">{errorText(error)}</Card>}
      {notice && <Card className="mb-4 p-4 text-sm text-emerald-700">{notice}</Card>}

      {open && (
        <Card className="mb-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{ar ? "إشعار جديد" : "New notification"}</h3>
            {!sending && (
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setOpen(false)} aria-label="Close">
                <IcX className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <label className="block">
                <span className="flex justify-between text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? "العنوان" : "Title"}
                  <span className="font-normal normal-case">{title.length}/{TITLE_MAX}</span>
                </span>
                <input
                  className={`${input} mt-1.5`}
                  maxLength={TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={ar ? "مثلاً: خصم ٢٠٪ على الحقائب اليوم فقط" : "e.g. 20% off bags, today only"}
                  dir="auto"
                />
              </label>

              <label className="block">
                <span className="flex justify-between text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? "النص" : "Message"}
                  <span className="font-normal normal-case">{body.length}/{BODY_MAX}</span>
                </span>
                <textarea
                  className={`${input} mt-1.5 h-24 resize-none py-2`}
                  maxLength={BODY_MAX}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={ar ? "اكتبي الرسالة كما ستظهر لها" : "Write it as she'll read it"}
                  dir="auto"
                />
              </label>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{ar ? "صورة (اختياري)" : "Image (optional)"}</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <input className={input} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
                  <ImageUpload ar={ar} onUploaded={setImage} />
                  {image && (
                    <button className="btn-ghost h-9 w-9 p-0" onClick={() => setImage("")} aria-label="Remove image">
                      <IcX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{ar ? "اللمس يفتح" : "A tap opens"}</span>
                <div className="mt-1.5">
                  <LinkPicker value={link} onChange={setLink} collections={collections} input={input} ar={ar} />
                </div>
                <span className="mt-1 block text-xs text-ink-soft">
                  {ar ? "بدون اختيار، يفتح التطبيق على جرس الإشعارات." : "With nothing chosen, the app opens on the notifications bell."}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{ar ? "إلى" : "Send to"}</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => setAudience(a.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        audience === a.key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-muted hover:text-ink"
                      }`}
                    >
                      {ar ? a.ar : a.en}
                    </button>
                  ))}
                </div>
                {hint && <span className="mt-1.5 block text-xs text-ink-soft">{ar ? hint.ar : hint.en}</span>}
                {audience === "phones" && (
                  <textarea
                    className={`${input} mt-2 h-24 resize-none py-2 font-mono`}
                    value={phones}
                    onChange={(e) => setPhones(e.target.value)}
                    placeholder={ar ? "رقم في كل سطر\n01xxxxxxxxx" : "One number per line\n01xxxxxxxxx"}
                  />
                )}
                <div className="mt-2 text-sm text-ink">
                  {size === null ? (
                    <span className="text-ink-soft">{ar ? "جارٍ الحساب…" : "Counting…"}</span>
                  ) : (
                    <>
                      {ar ? "يصل إلى " : "Reaches "}
                      <b>{num(size.installs, lang)}</b>
                      {ar ? " جهاز، ويظهر كتنبيه على " : " installs, and pops up on "}
                      <b>{num(size.popups, lang)}</b>
                      {ar ? " هاتف سمح بالتنبيهات." : " phones that allowed notifications."}
                    </>
                  )}
                </div>
              </div>

              {confirm ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <span className="flex-1">
                    {ar
                      ? `سيُرسل الآن إلى ${num(size?.installs ?? 0, lang)} جهاز ولا يمكن التراجع. متأكدة؟`
                      : `This goes out now to ${num(size?.installs ?? 0, lang)} installs and can't be unsent. Send it?`}
                  </span>
                  <button className="btn-primary h-9 px-4" disabled={sending} onClick={send}>
                    {sending ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "نعم، أرسلي" : "Yes, send"}
                  </button>
                  {!sending && (
                    <button className="btn-ghost h-9 px-3" onClick={() => setConfirm(false)}>
                      {ar ? "إلغاء" : "Cancel"}
                    </button>
                  )}
                </div>
              ) : (
                <button className="btn-primary h-10 gap-2 px-5" disabled={!canSend || !size?.installs} onClick={() => setConfirm(true)}>
                  <IcSend className="h-4 w-4" /> {ar ? "إرسال" : "Send"}
                </button>
              )}
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-soft">{ar ? "معاينة" : "Preview"}</span>
              <PhonePreview title={title} body={body} image={image} ar={ar} />
            </div>
          </div>
        </Card>
      )}

      {list === null ? (
        <Card className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-soft">
          {ar ? "لم تُرسلي إشعارات بعد." : "No notifications sent yet."}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-semibold">{ar ? "الإشعار" : "Notification"}</th>
                <th className="px-4 py-3 text-start font-semibold">{ar ? "إلى" : "To"}</th>
                <th className="px-4 py-3 text-end font-semibold">{ar ? "وصل" : "Delivered"}</th>
                <th className="px-4 py-3 text-end font-semibold">{ar ? "تنبيه" : "Popped up"}</th>
                <th className="px-4 py-3 text-end font-semibold">{ar ? "فُتح" : "Opened"}</th>
                <th className="px-4 py-3 text-start font-semibold">{ar ? "أُرسل" : "Sent"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((n) => {
                const aud = AUDIENCES.find((a) => a.key === n.audience);
                return (
                  <tr key={n.id} className="border-b border-line last:border-0">
                    <td className="max-w-[320px] px-4 py-3">
                      <div className="flex items-center gap-3">
                        {n.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={n.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                        )}
                        <div className="min-w-0" dir="auto">
                          <div className="truncate font-medium text-ink">{n.title}</div>
                          <div className="truncate text-xs text-ink-soft">{n.body}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {aud ? (ar ? aud.ar : aud.en) : n.audience}
                      {n.audience === "phones" ? ` (${num(n.audiencePhones.length, lang)})` : ""}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{num(n.recipients, lang)}</td>
                    <td className="px-4 py-3 text-end tabular-nums" title={n.error ?? undefined}>
                      {num(n.pushed, lang)}
                      {n.pushFailed > 0 && <span className="ms-1 text-xs text-rose-500">(−{num(n.pushFailed, lang)})</span>}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {num(n.opened, lang)}
                      {n.recipients > 0 && <span className="ms-1 text-xs text-ink-soft">{num(Math.round((n.opened / n.recipients) * 100), lang)}%</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {n.status === "sent" ? (
                        when(n.sentAt, ar)
                      ) : n.status === "failed" ? (
                        <Badge className="bg-rose-50 text-rose-700">{ar ? "فشل" : "Failed"}</Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-700">{ar ? "جارٍ الإرسال" : "Sending"}</Badge>
                      )}
                    </td>
                    <td className="px-2 py-3 text-end">
                      <button className="btn-ghost h-8 w-8 p-0 text-rose-600" onClick={() => remove(n)} aria-label="Delete">
                        <IcTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
