"use client";

import { useI18n, egp, num } from "@/lib/i18n";
import { TRIGGER_LABELS, type NudgeTrigger } from "@/lib/nudge";
import type { NudgeResults } from "./actions";
import { Card } from "@/components/ui";
import { KpiRow, StatTile, Select } from "@/components/dashboard-ui";
import { IcAlert, IcEye, IcCash, IcOrders, IcUp } from "@/components/icons";

/**
 * Whether the popup earned the discount it gave away.
 *
 * The headline number is deliberately net, not "conversions": a popup that
 * recovers 10,000 by handing out 11,000 in discounts is a loss, and a page
 * that only counted claims would call it a success.
 */
export function NudgeResultsView({
  data,
  days,
  onDays,
  loading,
}: {
  data: NudgeResults | null;
  days: number;
  onDays: (d: number) => void;
  loading: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  if (loading) {
    return <div className="p-10 text-center text-sm text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;
  }
  if (!data) return null;

  const net = data.recovered - data.givenAway;
  const claimRate = data.shown > 0 ? Math.round((data.claimed / data.shown) * 100) : 0;
  const convRate = data.claimed > 0 ? Math.round((data.converted / data.claimed) * 100) : 0;
  const maxTrigger = Math.max(1, ...data.byTrigger.map((t) => t.count));
  const maxPath = Math.max(1, ...data.topPaths.map((p) => p.count));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {ar
            ? `آخر ${num(days, lang)} يوماً`
            : `Last ${days} days`}
        </p>
        <div className="w-40">
          <Select value={String(days)} onChange={(v) => onDays(Number(v))}>
            <option value="7">{ar ? "٧ أيام" : "7 days"}</option>
            <option value="30">{ar ? "٣٠ يوماً" : "30 days"}</option>
            <option value="90">{ar ? "٩٠ يوماً" : "90 days"}</option>
          </Select>
        </div>
      </div>

      <KpiRow cols={4}>
        <StatTile
          icon={IcAlert}
          label={ar ? "تردد مرصود" : "Hesitations caught"}
          value={num(data.hesitations, lang)}
          accent="amber"
          sub={
            data.medianDwellSeconds
              ? ar
                ? `الوسيط ${num(data.medianDwellSeconds, lang)} ثانية`
                : `median ${data.medianDwellSeconds}s on page`
              : undefined
          }
        />
        <StatTile
          icon={IcEye}
          label={ar ? "ظهر للعميل" : "Popups shown"}
          value={num(data.shown, lang)}
          accent="sky"
          sub={ar ? `${num(data.dismissed, lang)} رُفض` : `${data.dismissed} dismissed`}
        />
        <StatTile
          icon={IcCash}
          label={ar ? "أخذ الكود" : "Codes claimed"}
          value={num(data.claimed, lang)}
          accent="violet"
          sub={ar ? `${claimRate}٪ ممن رآه` : `${claimRate}% of those shown`}
        />
        <StatTile
          icon={IcOrders}
          label={ar ? "أتم الشراء" : "Orders that followed"}
          value={num(data.converted, lang)}
          accent="emerald"
          sub={ar ? `${convRate}٪ ممن أخذ الكود` : `${convRate}% of claims`}
        />
      </KpiRow>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink">
          {ar ? "هل غطّى الخصم نفسه؟" : "Did the discount pay for itself?"}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "مبيعات مسترجعة" : "Revenue recovered"}
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">
              {egp(data.recovered, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "قيمة الخصم" : "Discount given away"}
            </div>
            <div className="mt-1 text-2xl font-bold text-rose-600">
              −{egp(data.givenAway, lang)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {ar ? "الصافي" : "Net"}
            </div>
            <div
              className={`mt-1 flex items-center gap-1.5 text-2xl font-bold ${
                net >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {net >= 0 && <IcUp className="h-5 w-5" />}
              {egp(net, lang)}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          {ar
            ? "يُحتسب فقط للطلبات التي جاءت من عميل رأى الإعلان واستخدم كوده."
            : "Counted only for orders from a shopper who was shown the popup and used its code."}
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-ink">
            {ar ? "ما الذي كشف التردد" : "What gave them away"}
          </h3>
          {data.byTrigger.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{ar ? "لا بيانات بعد" : "Nothing yet"}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.byTrigger.map((t) => (
                <li key={t.trigger}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink">
                      {TRIGGER_LABELS[t.trigger as NudgeTrigger]?.[lang] ?? t.trigger}
                    </span>
                    <span className="font-semibold text-ink">{num(t.count, lang)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-page">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(t.count / maxTrigger) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-ink">
            {ar ? "أين يتوقف العملاء" : "Where people stall"}
          </h3>
          {data.topPaths.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">{ar ? "لا بيانات بعد" : "Nothing yet"}</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {data.topPaths.map((p) => (
                <li key={p.path} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink" dir="ltr" title={p.path}>
                    {p.path}
                  </span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-page">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(p.count / maxPath) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-end text-sm font-semibold text-ink">
                    {num(p.count, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.contacts.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-ink">
            {ar ? "بيانات تواصل جُمعت" : "Contacts captured"}
          </h3>
          <ul className="mt-3 divide-y divide-line">
            {data.contacts.map((c, i) => (
              <li key={`${c.contact}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink" dir="ltr">{c.contact}</span>
                {c.code && <span className="text-xs text-ink-soft" dir="ltr">{c.code}</span>}
                <span className="text-xs text-ink-soft">
                  {new Date(c.at).toLocaleDateString(ar ? "ar-EG" : "en-GB")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
