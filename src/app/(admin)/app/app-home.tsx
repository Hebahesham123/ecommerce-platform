"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useI18n, egp, num } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { StatusPill } from "@/components/dashboard-ui";
import { IcMobile, IcMeta, IcAlert, IcRefresh, IcClipboard, IcCode } from "@/components/icons";
import { AXIS_STROKE, useAxisTick, useChartColors } from "@/lib/chart-theme";
import { getAppOverview, type AppOverview } from "./actions";

/**
 * The app's own front page.
 *
 * Every headline figure is shown beside the store's, because the only useful
 * question about a new channel is not "how much did it sell?" but "how much of
 * the business is it?" — and those two questions have very different answers
 * in a month where the app took nine orders out of ten and a month where it
 * took nine out of nine hundred.
 */

function Share({ part, whole }: { part: number; whole: number }) {
  const { lang } = useI18n();
  const pct = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return (
    <span className="text-xs font-medium text-ink-soft">
      {num(pct, lang)}% {lang === "ar" ? "من المتجر" : "of the store"}
    </span>
  );
}

function Tile({
  label,
  value,
  part,
  whole,
  hint,
}: {
  label: string;
  value: string;
  part?: number;
  whole?: number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{value}</div>
      {part !== undefined && whole !== undefined ? (
        <div className="mt-1">
          <Share part={part} whole={whole} />
        </div>
      ) : hint ? (
        <div className="mt-1 text-xs text-ink-soft">{hint}</div>
      ) : null}
    </Card>
  );
}

export function AppHome() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const color = useChartColors();
  const tickInk = useAxisTick();

  const [data, setData] = useState<AppOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await getAppOverview();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  // Stacked, so the height is the store's whole day and the violet band is the
  // app's share of it — one picture answering both questions at once.
  const series = useMemo(
    () =>
      (data?.series ?? []).map((d) => ({
        date: d.date,
        app: d.app,
        web: Math.max(0, d.total - d.app),
      })),
    [data],
  );

  const fmtDay = (d: string) =>
    new Date(d).toLocaleDateString(ar ? "ar-EG" : "en-US", { month: "short", day: "numeric" });

  if (loading) {
    return (
      <>
        <PageHeader title={ar ? "التطبيق" : "App"} />
        <Card className="p-12 text-center text-sm text-ink-soft">{t("loading")}</Card>
      </>
    );
  }

  if (error === "migration_missing") {
    return (
      <>
        <PageHeader title={ar ? "التطبيق" : "App"} />
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <IcAlert className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">
              {ar ? "لم يتم تطبيق ترحيل قاعدة البيانات" : "Database migration not applied"}
            </div>
            <p className="mt-1 max-w-md text-sm text-ink-soft">
              {ar
                ? "شغّلي supabase/migrations/0022_channels.sql — بدونه لا يستطيع المتجر التفريق بين طلبات التطبيق والموقع."
                : "Run supabase/migrations/0022_channels.sql. Until it does, the store has no way to tell an app order from a website one, so everything here reads as zero."}
            </p>
          </div>
        </Card>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title={ar ? "التطبيق" : "App"} />
        <Card className="p-10 text-center text-sm text-rose-600">{error}</Card>
      </>
    );
  }

  const metaOn = data.meta.capiEnabled;

  return (
    <>
      <PageHeader
        title={ar ? "التطبيق" : "App"}
        subtitle={
          ar
            ? "كل ما يخص التطبيق في مكان واحد — مبيعاته ومرتجعاته وربطه بميتا"
            : "Everything the app does, on its own — its sales, its returns, its Meta connection"
        }
        actions={
          <button onClick={load} className="btn-outline h-9 px-3 text-sm">
            <IcRefresh className="h-4 w-4" /> {ar ? "تحديث" : "Refresh"}
          </button>
        }
      />

      {!data.live && (
        <Card className="mb-4 flex items-start gap-3 border-sky-200 bg-sky-50 p-4">
          <IcMobile className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div className="text-sm">
            <div className="font-semibold text-sky-900">
              {ar ? "لا توجد طلبات من التطبيق بعد" : "No app orders yet"}
            </div>
            <p className="mt-0.5 text-sky-800">
              {ar
                ? "المتجر جاهز لاستقبالها. صفحة الربط تشرح ما يحتاجه التطبيق للاتصال."
                : "The store is ready to take them. The Connect page has everything an app needs to start."}{" "}
              <Link href="/app/connect" className="font-medium underline">
                {ar ? "صفحة الربط" : "Connect"}
              </Link>
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={ar ? "مبيعات التطبيق (٣٠ يوماً)" : "App revenue (30 days)"}
          value={egp(data.revenue30.app, lang)}
          part={data.revenue30.app}
          whole={data.revenue30.total}
        />
        <Tile
          label={ar ? "طلبات التطبيق (٣٠ يوماً)" : "App orders (30 days)"}
          value={num(data.orders30.app, lang)}
          part={data.orders30.app}
          whole={data.orders30.total}
        />
        <Tile
          label={ar ? "متوسط الطلب" : "Average order"}
          value={egp(Math.round(data.averageOrder), lang)}
          hint={ar ? "من التطبيق فقط" : "App orders only"}
        />
        <Tile
          label={ar ? "عملاء التطبيق" : "App customers"}
          value={num(data.customers, lang)}
          hint={ar ? "أرقام مختلفة خلال ٣٠ يوماً" : "Distinct numbers in 30 days"}
        />
      </div>

      {/* ---- Orders a day, app inside the store's total ---- */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              {ar ? "الطلبات يومياً" : "Orders a day"}
            </h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              {ar
                ? "ارتفاع العمود هو طلبات المتجر كلها، والجزء البنفسجي نصيب التطبيق"
                : "The full height is the store's day; the violet band is the app's share of it"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: color("violet") }}
              />
              {ar ? "التطبيق" : "App"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: color("orange") }}
              />
              {ar ? "الموقع" : "Website"}
            </span>
          </div>
        </div>

        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color("violet")} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color("violet")} stopOpacity={0.18} />
                </linearGradient>
                <linearGradient id="webFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color("orange")} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color("orange")} stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={AXIS_STROKE} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tickLine={false}
                axisLine={false}
                // Six labels across thirty days. Left to itself Recharts draws a
                // tick per point and they overprint into a grey smear.
                interval={5}
                minTickGap={24}
                tick={{ fontSize: 11, fill: tickInk }}
              />
              <YAxis
                allowDecimals={false}
                width={28}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: tickInk }}
              />
              <Tooltip
                cursor={{ stroke: AXIS_STROKE, strokeWidth: 1 }}
                labelFormatter={(d) => fmtDay(String(d))}
                formatter={(v, key) => [
                  num(Number(v), lang),
                  key === "app" ? (ar ? "التطبيق" : "App") : ar ? "الموقع" : "Website",
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(148,148,168,0.25)",
                  fontSize: 12,
                }}
              />
              {/* App on top so its band starts at the axis and is easy to compare
                  day to day; the 2px stroke gives the two fills a visible edge. */}
              <Area
                type="monotone"
                dataKey="app"
                stackId="orders"
                stroke={color("violet")}
                strokeWidth={2}
                fill="url(#appFill)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="web"
                stackId="orders"
                stroke={color("orange")}
                strokeWidth={2}
                fill="url(#webFill)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* ---- Recent app orders ---- */}
        <Card className="p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-base font-semibold text-ink">
              {ar ? "أحدث طلبات التطبيق" : "Latest app orders"}
            </h2>
            <Link href="/app/orders" className="text-xs font-medium text-brand-600 hover:underline">
              {ar ? "عرض الكل" : "See all"}
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-soft">
              {ar ? "لا شيء بعد" : "Nothing yet"}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent.map((o) => (
                <li key={o.orderNumber} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="font-semibold text-ink" dir="ltr">
                    #{o.orderNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-muted">{o.customer || "—"}</span>
                  <StatusPill label={o.lifecycle} tone="neutral" />
                  <span className="font-semibold tabular-nums text-ink">{egp(o.total, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ---- What needs a person ---- */}
        <div className="space-y-3">
          <Link href="/app/returns" className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-hover">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <IcRefresh className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">
                  {ar ? "مرتجعات تنتظر الرد" : "Returns waiting"}
                </div>
                <div className="text-xs text-ink-soft">{ar ? "من التطبيق" : "From the app"}</div>
              </div>
              <span className="text-xl font-bold tabular-nums text-ink">
                {num(data.returnsWaiting, lang)}
              </span>
            </Card>
          </Link>

          <Link href="/app/requests" className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-hover">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <IcClipboard className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">
                  {ar ? "استفسارات مفتوحة" : "Open enquiries"}
                </div>
                <div className="text-xs text-ink-soft">{ar ? "من التطبيق" : "From the app"}</div>
              </div>
              <span className="text-xl font-bold tabular-nums text-ink">
                {num(data.requestsOpen, lang)}
              </span>
            </Card>
          </Link>

          <Link href="/channels/meta" className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-hover">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  metaOn ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-ink-muted"
                }`}
              >
                <IcMeta className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">
                  {ar ? "ميتا — مجموعة بيانات التطبيق" : "Meta — the app's dataset"}
                </div>
                <div className="truncate text-xs text-ink-soft" dir="ltr">
                  {data.meta.datasetId ??
                    (ar ? "لم تُربط بعد" : "Not connected yet")}
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  metaOn ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
            </Card>
          </Link>

          <Link href="/app/connect" className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-hover">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <IcCode className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">
                  {ar ? "ربط التطبيق" : "Connect an app"}
                </div>
                <div className="text-xs text-ink-soft">
                  {ar ? "العناوين والمفاتيح للمطوّر" : "Endpoints and auth for the developer"}
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}
