"use client";

import {
  SCREEN_LABELS,
  TAB_DEFAULTS,
  type ScreenKey,
  type ScreenSettings,
  type Tab,
} from "@/lib/app-theme";
import { IcUp, IcDown } from "@/components/icons";

/**
 * The settings for every screen that is not the home page.
 *
 * Home is blocks the merchant arranges; these are screens the app already
 * knows how to draw, where what varies is the wording and which optional parts
 * appear. Nobody reorders a checkout, so they get fields rather than a block
 * list — pretending otherwise would be a worse lie than a shorter panel.
 *
 * Every text field is allowed to be empty, and empty means "use the app's own
 * wording in the shopper's language". That is why the placeholders show what
 * will actually appear rather than sitting blank.
 */

const input =
  "h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:bg-surface";

export function Field({
  label,
  type,
  hint,
  children,
}: {
  label: string;
  type: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="badge bg-slate-100 text-[10px] text-ink-soft">{type}</span>
      </div>
      {children}
      {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{hint}</p>}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  ar,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  ar: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
        on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-muted"
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded border ${
          on ? "border-emerald-600 bg-emerald-600" : "border-line bg-surface"
        }`}
      />
      {on ? (ar ? "مُفعّل" : "On") : ar ? "متوقّف" : "Off"}
    </button>
  );
}

function Text({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={input}
    />
  );
}

/** The bottom bar: which tabs appear, what they are called, in what order. */
export function TabsPanel({
  tabs,
  ar,
  onChange,
}: {
  tabs: Tab[];
  ar: boolean;
  onChange: (tabs: Tab[]) => void;
}) {
  const visible = tabs.filter((t) => t.visible).length;

  function move(i: number, by: 1 | -1) {
    const j = i + by;
    if (j < 0 || j >= tabs.length) return;
    const next = [...tabs];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-1.5 pt-2">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        {ar
          ? "الترتيب هنا هو ترتيب الأزرار أسفل الشاشة. اتركي الاسم فارغاً ليستخدم التطبيق كلمته بلغة العميل."
          : "The order here is the order along the bottom of the screen. Leave a name empty and the app uses its own word, in the shopper's language."}
      </p>
      <ul className="space-y-1">
        {tabs.map((tab, i) => (
          <li key={tab.key} className="rounded-xl border border-line bg-surface-page p-2">
            <div className="flex items-center gap-1.5">
              <span className="w-5 text-center text-base leading-none">
                {TAB_DEFAULTS[tab.key].icon}
              </span>
              <input
                value={tab.label}
                onChange={(e) =>
                  onChange(tabs.map((t) => (t.key === tab.key ? { ...t, label: e.target.value } : t)))
                }
                placeholder={ar ? TAB_DEFAULTS[tab.key].ar : TAB_DEFAULTS[tab.key].en}
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-600"
              />
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="btn-ghost h-7 w-7 shrink-0 p-0 disabled:opacity-30"
                aria-label={ar ? "لليسار" : "Move left"}
              >
                <IcUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === tabs.length - 1}
                className="btn-ghost h-7 w-7 shrink-0 p-0 disabled:opacity-30"
                aria-label={ar ? "لليمين" : "Move right"}
              >
                <IcDown className="h-3 w-3" />
              </button>
              <button
                onClick={() =>
                  onChange(
                    tabs.map((t) => (t.key === tab.key ? { ...t, visible: !t.visible } : t)),
                  )
                }
                disabled={tab.visible && visible <= 1}
                title={
                  tab.visible && visible <= 1
                    ? ar
                      ? "لا يمكن إخفاء آخر تبويب"
                      : "The last tab can't be hidden"
                    : undefined
                }
                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold transition disabled:opacity-40 ${
                  tab.visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-ink-soft"
                }`}
              >
                {tab.visible ? (ar ? "ظاهر" : "shown") : ar ? "مخفي" : "hidden"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One screen's settings. */
export function ScreenPanel({
  screen,
  screens,
  ar,
  onChange,
}: {
  screen: ScreenKey;
  screens: ScreenSettings;
  ar: boolean;
  onChange: <K extends ScreenKey>(key: K, patch: Partial<ScreenSettings[K]>) => void;
}) {
  if (screen === "collection") {
    const s = screens.collection;
    return (
      <div className="pt-1">
        <Field label={ar ? "عدد الأعمدة" : "Columns"} type="select">
          <select
            value={s.columns}
            onChange={(e) => onChange("collection", { columns: Number(e.target.value) as 2 | 3 })}
            className={input}
          >
            <option value={2}>{ar ? "عمودان" : "Two"}</option>
            <option value={3}>{ar ? "ثلاثة" : "Three"}</option>
          </select>
        </Field>
        <Field
          label={ar ? "أزرار الترتيب" : "Sort buttons"}
          type="checkbox"
          hint={
            ar
              ? "الترتيب يتم على الخادم، فالعميل يرتّب القسم كله لا ما ظهر منه فقط."
              : "Sorting happens on the server, so the shopper sorts the whole collection rather than the page they happen to be looking at."
          }
        >
          <Toggle on={s.showSort} onChange={(v) => onChange("collection", { showSort: v })} ar={ar} />
        </Field>
      </div>
    );
  }

  if (screen === "product") {
    const s = screens.product;
    return (
      <div className="pt-1">
        <Field label={ar ? "زر الإضافة" : "Add button"} type="text">
          <Text
            value={s.addLabel}
            onChange={(v) => onChange("product", { addLabel: v })}
            placeholder={ar ? "أضيفي للسلة" : "Add to cart"}
          />
        </Field>
        <Field label={ar ? "نص النفاد" : "Sold out"} type="text">
          <Text
            value={s.soldOutLabel}
            onChange={(v) => onChange("product", { soldOutLabel: v })}
            placeholder={ar ? "نفد" : "Sold out"}
          />
        </Field>
        <Field label={ar ? "الوصف" : "Description"} type="checkbox">
          <Toggle
            on={s.showDescription}
            onChange={(v) => onChange("product", { showDescription: v })}
            ar={ar}
          />
        </Field>
        <Field
          label={ar ? "الكمية المتاحة" : "Show stock"}
          type="checkbox"
          hint={
            ar
              ? "«باقي ٣» يدفع للشراء، لكنه يكشف مخزونك للمنافسين."
              : "Showing “3 left” nudges people to buy, and tells your competitors what you hold."
          }
        >
          <Toggle on={s.showStock} onChange={(v) => onChange("product", { showStock: v })} ar={ar} />
        </Field>
      </div>
    );
  }

  if (screen === "cart") {
    const s = screens.cart;
    return (
      <div className="pt-1">
        <Field label={ar ? "السلة الفارغة" : "Empty cart"} type="text">
          <Text
            value={s.emptyText}
            onChange={(v) => onChange("cart", { emptyText: v })}
            placeholder={ar ? "السلة فارغة" : "The basket is empty"}
          />
        </Field>
        <Field label={ar ? "كلمة الإجمالي" : "Total label"} type="text">
          <Text
            value={s.totalLabel}
            onChange={(v) => onChange("cart", { totalLabel: v })}
            placeholder={ar ? "الإجمالي" : "Total"}
          />
        </Field>
        <Field label={ar ? "زر الدفع" : "Checkout button"} type="text">
          <Text
            value={s.checkoutLabel}
            onChange={(v) => onChange("cart", { checkoutLabel: v })}
            placeholder={ar ? "إتمام الطلب" : "Checkout"}
          />
        </Field>
        <Field
          label={ar ? "خانة كود الخصم" : "Discount code box"}
          type="checkbox"
          hint={
            ar
              ? "أخفيها إن لم تكوني تستخدمين أكواداً — خانة فارغة تجعل العميل يبحث عن كود لا وجود له."
              : "Hide it if you don't run codes. An empty box sends people off to hunt for one that doesn't exist."
          }
        >
          <Toggle on={s.showCoupon} onChange={(v) => onChange("cart", { showCoupon: v })} ar={ar} />
        </Field>
        {s.showCoupon && (
          <Field label={ar ? "نص الخانة" : "Its placeholder"} type="text">
            <Text
              value={s.couponLabel}
              onChange={(v) => onChange("cart", { couponLabel: v })}
              placeholder={ar ? "كود الخصم" : "Discount code"}
            />
          </Field>
        )}
      </div>
    );
  }

  if (screen === "checkout") {
    const s = screens.checkout;
    return (
      <div className="pt-1">
        <Field label={ar ? "العنوان" : "Title"} type="text">
          <Text
            value={s.title}
            onChange={(v) => onChange("checkout", { title: v })}
            placeholder={ar ? "الدفع عند الاستلام" : "Cash on delivery"}
          />
        </Field>
        <Field label={ar ? "ملاحظة" : "Note"} type="text">
          <Text
            value={s.note}
            onChange={(v) => onChange("checkout", { note: v })}
            placeholder={ar ? "تدفعين عند وصول الطلب" : "You pay when the order arrives"}
          />
        </Field>
        <Field label={ar ? "زر التأكيد" : "Place order button"} type="text">
          <Text
            value={s.placeLabel}
            onChange={(v) => onChange("checkout", { placeLabel: v })}
            placeholder={ar ? "تأكيد الطلب" : "Place the order"}
          />
        </Field>
        <Field
          label={ar ? "اسألي عن البريد" : "Ask for an email"}
          type="checkbox"
          hint={
            ar
              ? "اختياري دائماً — الرقم هو الحساب."
              : "Always optional — the phone number is the account."
          }
        >
          <Toggle on={s.askEmail} onChange={(v) => onChange("checkout", { askEmail: v })} ar={ar} />
        </Field>
        <Field label={ar ? "خانة الملاحظات" : "Order note box"} type="checkbox">
          <Toggle on={s.askNote} onChange={(v) => onChange("checkout", { askNote: v })} ar={ar} />
        </Field>
        <p className="mt-2 rounded-xl bg-sky-50 p-2.5 text-[11px] leading-relaxed text-sky-900">
          {ar
            ? "الاسم والرقم والمحافظة والمدينة والعنوان مطلوبة دائماً — الطلب لا يمكن توصيله بدونها، والخادم يرفضه."
            : "Name, phone, governorate, city and address are always asked. An order can't be delivered without them, and the server refuses one that arrives incomplete."}
        </p>
      </div>
    );
  }

  const s = screens.account;
  return (
    <div className="pt-1">
      <Field label={ar ? "قبل تسجيل الدخول" : "Signed out"} type="text">
        <Text
          value={s.signedOutText}
          onChange={(v) => onChange("account", { signedOutText: v })}
          placeholder={ar ? "سجّلي الدخول برقم الموبايل" : "Sign in with your phone number"}
        />
      </Field>
      {(
        [
          ["showReturns", "returnsLabel", ar ? "الاسترجاع والاستبدال" : "Returns & exchanges"],
          ["showRequests", "requestsLabel", ar ? "اسألينا" : "Ask us a question"],
          ["showReviews", "reviewsLabel", ar ? "التقييمات" : "Reviews"],
        ] as const
      ).map(([showKey, labelKey, fallback]) => (
        <div key={showKey} className="border-t border-line pt-1.5">
          <Field label={fallback} type="checkbox">
            <Toggle
              on={s[showKey]}
              onChange={(v) => onChange("account", { [showKey]: v } as Partial<ScreenSettings["account"]>)}
              ar={ar}
            />
          </Field>
          {s[showKey] && (
            <Field label={ar ? "الاسم" : "Its label"} type="text">
              <Text
                value={s[labelKey]}
                onChange={(v) =>
                  onChange("account", { [labelKey]: v } as Partial<ScreenSettings["account"]>)
                }
                placeholder={fallback}
              />
            </Field>
          )}
        </div>
      ))}
    </div>
  );
}

export { SCREEN_LABELS };
