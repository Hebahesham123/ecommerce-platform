"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card, SectionHeader, Badge } from "@/components/ui";
import { KpiRow, StatTile } from "@/components/dashboard-ui";
import {
  IcCash,
  IcChevron,
  IcEye,
  IcOrders,
  IcSearch,
  IcWhatsApp,
  IcProducts,
  IcDiscount,
  IcMobile,
  IcDesktop,
  IcX,
  IcStar,
  IcGlobe,
} from "@/components/icons";
import { getCustomerProfile, type CustomerProfile, type TimelineItem } from "../tracking-actions";
import { ExclusiveOffers } from "./exclusive-offers";

/**
 * One customer: who she is, what she looks at, what she left in her basket.
 *
 * Built for the question "what would make her buy", so the parts that answer
 * it — the basket she walked away from and the products she keeps returning
 * to — come before the full history.
 */

function ago(iso: string, ar: boolean): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(ar ? "ar-EG" : "en", { numeric: "auto" });
  if (s < 60) return rtf.format(-Math.round(s), "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("20") ? digits : "2" + digits.replace(/^0/, "")}`;
}

const CHANNEL: Record<string, { en: string; ar: string }> = {
  web: { en: "Website", ar: "الموقع" },
  shop: { en: "Shop theme", ar: "المتجر" },
  app: { en: "App", ar: "التطبيق" },
};

function describe(e: TimelineItem, ar: boolean): { icon: React.ReactNode; tone: string; text: string } {
  const what = e.productName ?? "";
  switch (e.kind) {
    case "product_view":
      return { icon: <IcEye className="h-4 w-4" />, tone: "bg-sky-500/10 text-sky-600", text: ar ? `شاهدت ${what}` : `Viewed ${what}` };
    case "add_to_cart":
      return { icon: <IcPlusCart />, tone: "bg-emerald-500/10 text-emerald-600", text: ar ? `أضافت ${what} للسلة` : `Added ${what} to cart` };
    case "remove_from_cart":
      return { icon: <IcX className="h-4 w-4" />, tone: "bg-rose-500/10 text-rose-600", text: ar ? `أزالت ${what} من السلة` : `Removed ${what} from cart` };
    case "checkout_start":
      return { icon: <IcCash className="h-4 w-4" />, tone: "bg-amber-500/10 text-amber-600", text: ar ? "وصلت لصفحة الدفع" : "Started checkout" };
    case "order":
      return {
        icon: <IcOrders className="h-4 w-4" />,
        tone: "bg-violet-500/10 text-violet-600",
        text: ar ? `طلبت #${String(e.meta.orderNumber ?? "")}` : `Placed order #${String(e.meta.orderNumber ?? "")}`,
      };
    case "search":
      return { icon: <IcSearch className="h-4 w-4" />, tone: "bg-slate-500/10 text-slate-600", text: (ar ? "بحثت عن " : "Searched for ") + `“${String(e.meta.term ?? "")}”` };
    case "collection_view":
      return { icon: <IcProducts className="h-4 w-4" />, tone: "bg-slate-500/10 text-slate-600", text: (ar ? "تصفحت " : "Browsed ") + (what || String(e.meta.handle ?? "")) };
    case "offer_shown":
      return { icon: <IcDiscount className="h-4 w-4" />, tone: "bg-pink-500/10 text-pink-600", text: ar ? "ظهر لها عرض" : "Was shown an offer" };
    case "offer_claimed":
      return { icon: <IcStar className="h-4 w-4" />, tone: "bg-pink-500/10 text-pink-600", text: ar ? "أخذت العرض" : "Claimed an offer" };
    default:
      return { icon: <IcGlobe className="h-4 w-4" />, tone: "bg-slate-500/5 text-ink-soft", text: (ar ? "فتحت " : "Opened ") + (e.path ?? "/") };
  }
}

function IcPlusCart() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0M12 12v5M9.5 14.5h5" />
    </svg>
  );
}

export default function CustomerPage({ params }: { params: Promise<{ phone: string }> }) {
  const { phone: raw } = use(params);
  const phone = decodeURIComponent(raw);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [data, setData] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPages, setShowPages] = useState(false);

  useEffect(() => {
    getCustomerProfile(phone).then((res) => (res.ok ? setData(res.data) : setError(res.error)));
  }, [phone]);

  const timeline = useMemo(
    () => (data ? data.timeline.filter((e) => showPages || e.kind !== "page") : []),
    [data, showPages],
  );

  if (error) {
    return (
      <Card className="p-6 text-sm text-ink-muted">
        {error === "migration_missing"
          ? ar
            ? "تتبع العملاء يحتاج تشغيل ملف قاعدة البيانات 0053_shopper_tracking.sql في Supabase."
            : "Customer tracking needs the database file 0053_shopper_tracking.sql run in Supabase."
          : error}
      </Card>
    );
  }
  if (!data) return <div className="py-16 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;

  const title = data.name || data.phone;
  const cart = data.carts[0];
  const viewCount = data.timeline.filter((e) => e.kind === "product_view").length;

  return (
    <>
      <Link href="/customers" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <IcChevron className="h-4 w-4 rotate-180 rtl:rotate-0" />
        {ar ? "العملاء" : "Customers"}
      </Link>

      <PageHeader
        title={title}
        subtitle={[data.phone, data.governorate, data.email].filter(Boolean).join(" · ")}
        actions={
          <a
            href={whatsappHref(data.phone)}
            target="_blank"
            rel="noreferrer"
            className="btn-outline gap-1.5 text-emerald-700"
          >
            <IcWhatsApp className="h-4 w-4" /> WhatsApp
          </a>
        }
      />

      <div className="mb-4">
        <KpiRow cols={4}>
          <StatTile icon={IcCash} label={ar ? "إجمالي الإنفاق" : "Total spent"} value={egp(data.totalSpent, lang)} accent="emerald" />
          <StatTile icon={IcOrders} label={ar ? "الطلبات" : "Orders"} value={num(data.orders.length, lang)} accent="brand" />
          <StatTile icon={IcEye} label={ar ? "منتجات شاهدتها" : "Product views"} value={num(viewCount, lang)} accent="sky" />
          <StatTile
            icon={data.devices.some((d) => d.channel === "app") ? IcMobile : IcDesktop}
            label={ar ? "آخر ظهور" : "Last seen"}
            value={data.lastSeen ? ago(data.lastSeen, ar) : ar ? "لم تُرَ بعد" : "Not seen yet"}
            sub={
              data.devices.length
                ? data.devices.map((d) => (ar ? CHANNEL[d.channel]?.ar : CHANNEL[d.channel]?.en) ?? d.channel).filter((v, i, a) => a.indexOf(v) === i).join(" · ")
                : undefined
            }
            accent="amber"
          />
        </KpiRow>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <ExclusiveOffers phone={data.phone} name={data.name} />

          {/* What she walked away from: the first thing worth acting on. */}
          <Card>
            <SectionHeader
              title={ar ? "في سلتها الآن" : "In her cart now"}
              action={cart ? <span className="text-xs text-ink-soft">{ago(cart.updatedAt, ar)}</span> : undefined}
            />
            <div className="px-5 pb-4">
              {cart ? (
                <>
                  <ul className="space-y-2">
                    {cart.items.map((l) => (
                      <li key={l.itemId} className="flex items-center gap-3">
                        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-page">
                          {l.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">{l.name}</span>
                          <span className="text-xs text-ink-soft">
                            {num(l.quantity, lang)} × {egp(l.price, lang)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink-muted">{ar ? "الإجمالي" : "Subtotal"}</span>
                    <span className="font-semibold text-ink">{egp(cart.subtotal, lang)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-soft">{ar ? "لا توجد سلة مفتوحة." : "No open cart."}</p>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title={ar ? "الأكثر مشاهدة" : "Keeps coming back to"} />
            <div className="px-5 pb-4">
              {data.mostViewed.length ? (
                <ul className="space-y-2">
                  {data.mostViewed.map((p) => (
                    <li key={p.productId} className="flex items-center gap-3">
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-page">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                      <Badge className="bg-sky-500/10 text-sky-700">
                        {num(p.views, lang)}× {ar ? "مشاهدة" : "views"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">{ar ? "لا توجد مشاهدات بعد." : "No product views yet."}</p>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title={ar ? "الطلبات" : "Orders"} />
            <div className="px-5 pb-4">
              {data.orders.length ? (
                <ul className="divide-y divide-line">
                  {data.orders.map((o) => (
                    <li key={o.number}>
                      <Link href={`/orders/${encodeURIComponent(o.number)}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span>
                          <span className="font-medium text-ink">#{o.number}</span>
                          <span className="ms-2 text-xs text-ink-soft">{new Date(o.createdAt).toLocaleDateString(ar ? "ar-EG" : "en-GB")}</span>
                        </span>
                        <span className="text-ink">{egp(o.total, lang)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">{ar ? "لم تطلب بعد." : "No orders yet."}</p>
              )}
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <SectionHeader
            title={ar ? "النشاط" : "Activity"}
            action={
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" checked={showPages} onChange={(e) => setShowPages(e.target.checked)} />
                {ar ? "إظهار كل الصفحات" : "Show every page"}
              </label>
            }
          />
          <div className="px-5 pb-5">
            {timeline.length ? (
              <ol className="relative space-y-3 border-s border-line ps-5">
                {timeline.map((e, i) => {
                  const d = describe(e, ar);
                  return (
                    <li key={i} className="relative">
                      <span className={`absolute -start-[1.95rem] top-0.5 grid h-6 w-6 place-items-center rounded-full ${d.tone}`}>{d.icon}</span>
                      <div className="flex items-start gap-3">
                        {e.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-ink">
                            {d.text}
                            {e.value != null && e.kind !== "product_view" && (
                              <span className="ms-1.5 text-ink-muted">· {egp(e.value, lang)}</span>
                            )}
                          </div>
                          <div className="text-xs text-ink-soft">
                            {ago(e.at, ar)} · {(ar ? CHANNEL[e.channel]?.ar : CHANNEL[e.channel]?.en) ?? e.channel}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-ink-soft">
                {ar
                  ? "لا يوجد نشاط مسجّل بعد. يبدأ التسجيل من أول زيارة لها بعد تسجيل الدخول أو الطلب."
                  : "No activity recorded yet. It starts from her first visit once she has signed in or ordered."}
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
