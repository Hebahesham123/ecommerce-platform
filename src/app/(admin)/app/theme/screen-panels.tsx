"use client";

import { TabIcon } from "@/components/app-tab-icons";
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
              <span className="grid w-5 shrink-0 place-items-center text-ink-muted">
                <TabIcon tab={tab.key} className="h-4 w-4" />
              </span>
              <input
                value={tab.label}
                onChange={(e) =>
                  onChange(tabs.map((t) => (t.key === tab.key ? { ...t, label: e.target.value } : t)))
                }
                placeholder={ar ? TAB_DEFAULTS[tab.key].ar : TAB_DEFAULTS[tab.key].en}
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs text-ink outline-none focus:border-brand-600"
              />
              {/* The same list of places the home sections carry, so a tab
                  can be moved in one go rather than one step at a time. */}
              <select
                value={i}
                onChange={(e) => {
                  const to = Number(e.target.value);
                  if (to === i) return;
                  const next = [...tabs];
                  const [moved] = next.splice(i, 1);
                  next.splice(to, 0, moved);
                  onChange(next);
                }}
                title={ar ? "انقلي التبويب إلى مكان" : "Move this tab to a place"}
                aria-label={ar ? "ترتيب التبويب" : "Tab position"}
                className="h-7 w-[4.2rem] shrink-0 rounded-lg border border-line bg-surface px-1 text-[11px] font-medium text-ink-muted"
              >
                {tabs.map((t, n) => (
                  <option key={t.key} value={n}>
                    {n === i
                      ? (ar ? "مكان " : "No. ") + (n + 1)
                      : n + 1 + " · " + (t.label || (ar ? TAB_DEFAULTS[t.key].ar : TAB_DEFAULTS[t.key].en))}
                  </option>
                ))}
              </select>
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

/** A heading between groups of settings. */
function Section({ title }: { title: string }) {
  return (
    <div className="mb-0.5 mt-3 border-t border-line pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft first:mt-0 first:border-0 first:pt-0">
      {title}
    </div>
  );
}

function Num({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} type="range">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className={input}
      />
    </Field>
  );
}

/** A colour: the swatch to pick with, and the code to paste. Empty means the default. */
function Color({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} type="color">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={fallback} className={input} dir="ltr" />
      </div>
    </Field>
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
    const set = (patch: Partial<ScreenSettings["collection"]>) => onChange("collection", patch);
    return (
      <div className="pt-1">
        <Section title={ar ? "البانر العلوي" : "Top banner"} />
        <Field label={ar ? "إظهار البانر" : "Show the banner"} type="checkbox">
          <Toggle on={s.showHero} onChange={(v) => set({ showHero: v })} ar={ar} />
        </Field>
        {s.showHero && (
          <>
            <Field label={ar ? "السطر الصغير فوق الاسم" : "Small line above the name"} type="text">
              <Text value={s.heroKicker} onChange={(v) => set({ heroKicker: v })} placeholder="Summer 2026 · New arrivals" />
            </Field>
            <Field
              label={ar ? "السطر تحت الاسم" : "Line under the name"}
              type="text"
              hint={ar ? "فارغ = عدد القطع وأشهر الماركات في القسم تلقائياً." : "Empty writes the number of pieces and the top brands in the collection."}
            >
              <Text value={s.heroSubtitle} onChange={(v) => set({ heroSubtitle: v })} placeholder="326+ pieces · Chanel · Gucci" />
            </Field>
            <Color label={ar ? "لون البانر (البداية)" : "Banner colour (start)"} value={s.heroFrom} fallback="#1c1410" onChange={(v) => set({ heroFrom: v })} />
            <Color label={ar ? "لون البانر (النهاية)" : "Banner colour (end)"} value={s.heroTo} fallback="#3d2619" onChange={(v) => set({ heroTo: v })} />
            <Color label={ar ? "لون السطر الصغير" : "Small line colour"} value={s.heroAccent} fallback="#d08159" onChange={(v) => set({ heroAccent: v })} />
          </>
        )}

        <Section title={ar ? "التصفح" : "Browsing"} />
        <Field label={ar ? "شريط الماركات" : "Brand chips"} type="checkbox" hint={ar ? "صف أسماء الماركات في القسم — ضغطة تعرض ماركة واحدة." : "A row of the collection's brands — one tap shows just that brand."}>
          <Toggle on={s.showBrandChips} onChange={(v) => set({ showBrandChips: v })} ar={ar} />
        </Field>
        <Field label={ar ? "زر التصفية" : "Filters button"} type="checkbox" hint={ar ? "الماركة والسعر والمتوفّر والخصومات — تتم على الخادم لتشمل القسم كله." : "Brand, price, in stock and on sale — done by the shop, so they cover the whole collection."}>
          <Toggle on={s.showFilters} onChange={(v) => set({ showFilters: v })} ar={ar} />
        </Field>
        <Field label={ar ? "قائمة الترتيب" : "Sort menu"} type="checkbox">
          <Toggle on={s.showSort} onChange={(v) => set({ showSort: v })} ar={ar} />
        </Field>
        <Field label={ar ? "الترتيب الافتراضي" : "Default order"} type="select">
          <select value={s.sortDefault} onChange={(e) => set({ sortDefault: e.target.value })} className={input}>
            <option value="manual">{ar ? "مميّز (ترتيبك)" : "Featured (your order)"}</option>
            <option value="newest">{ar ? "الأحدث" : "Newest"}</option>
            <option value="price-ascending">{ar ? "السعر: الأقل" : "Price: low to high"}</option>
            <option value="price-descending">{ar ? "السعر: الأعلى" : "Price: high to low"}</option>
            <option value="title-ascending">{ar ? "أبجدياً" : "A–Z"}</option>
          </select>
        </Field>
        <Field label={ar ? "زر الشبكة / الصورة الكبيرة" : "Grid / large picture switch"} type="checkbox">
          <Toggle on={s.showLayoutToggle} onChange={(v) => set({ showLayoutToggle: v })} ar={ar} />
        </Field>
        <Field label={ar ? "عدد الأعمدة" : "Columns"} type="select">
          <select value={s.columns} onChange={(e) => set({ columns: Number(e.target.value) as 2 | 3 })} className={input}>
            <option value={2}>{ar ? "عمودان" : "Two"}</option>
            <option value={3}>{ar ? "ثلاثة" : "Three"}</option>
          </select>
        </Field>
        <Num label={ar ? "منتجات في كل تحميل" : "Products per load"} value={s.pageSize} min={6} max={60} onChange={(v) => set({ pageSize: v })} />

        <Section title={ar ? "بطاقة المنتج" : "Product card"} />
        <Field label={ar ? "شارة الخصم" : "Discount badge"} type="checkbox">
          <Toggle on={s.showBadge} onChange={(v) => set({ showBadge: v })} ar={ar} />
        </Field>
        <Field label={ar ? "زر المفضّلة" : "Heart"} type="checkbox">
          <Toggle on={s.showWishlist} onChange={(v) => set({ showWishlist: v })} ar={ar} />
        </Field>
        <Field label={ar ? "اسم الماركة" : "Brand name"} type="checkbox">
          <Toggle on={s.showVendor} onChange={(v) => set({ showVendor: v })} ar={ar} />
        </Field>
        <Field label={ar ? "النجمة والتقييم" : "Star and rating"} type="checkbox">
          <Toggle on={s.showRating} onChange={(v) => set({ showRating: v })} ar={ar} />
        </Field>
        {s.showRating && (
          <Field label={ar ? "نص التقييم" : "Rating text"} type="text">
            <Text value={s.ratingText} onChange={(v) => set({ ratingText: v })} placeholder="5" />
          </Field>
        )}
        <Field label={ar ? "زر + للإضافة السريعة" : "Quick add (+) button"} type="checkbox" hint={ar ? "يضيف مباشرة إن كان للمنتج مقاس واحد، ويفتحه إن كان له مقاسات." : "Adds straight away when a product has one option, opens it when there is a size to pick."}>
          <Toggle on={s.showQuickAdd} onChange={(v) => set({ showQuickAdd: v })} ar={ar} />
        </Field>
        <Num label={ar ? "أسطر الاسم" : "Name lines"} value={s.nameLines} min={1} max={3} onChange={(v) => set({ nameLines: v })} />

        <Section title={ar ? "الألوان" : "Colours"} />
        <Color label={ar ? "خلفية الصفحة" : "Page background"} value={s.pageBg} fallback="#f8f5f0" onChange={(v) => set({ pageBg: v })} />
        <Color label={ar ? "خلفية معلومات البطاقة" : "Card info background"} value={s.cardBg} fallback="#f3ece4" onChange={(v) => set({ cardBg: v })} />
        <Color label={ar ? "لون السعر والشارة" : "Price & badge colour"} value={s.priceColor} fallback="#b0603e" onChange={(v) => set({ priceColor: v })} />
        <Color label={ar ? "لون النص" : "Text colour"} value={s.inkColor} fallback="#211a15" onChange={(v) => set({ inkColor: v })} />
        <Color label={ar ? "لون الحدود" : "Border colour"} value={s.lineColor} fallback="#eadfd2" onChange={(v) => set({ lineColor: v })} />
      </div>
    );
  }

  if (screen === "product") {
    const s = screens.product;
    const set = (patch: Partial<ScreenSettings["product"]>) => onChange("product", patch);
    return (
      <div className="pt-1">
        <Section title={ar ? "الصور" : "Pictures"} />
        <Field label={ar ? "الصور المصغّرة" : "Thumbnails"} type="checkbox">
          <Toggle on={s.showThumbs} onChange={(v) => set({ showThumbs: v })} ar={ar} />
        </Field>
        <Field label={ar ? "شارة الخصم" : "Discount badge"} type="checkbox">
          <Toggle on={s.showBadge} onChange={(v) => set({ showBadge: v })} ar={ar} />
        </Field>
        <Field label={ar ? "زر المفضّلة" : "Heart"} type="checkbox">
          <Toggle on={s.showWishlist} onChange={(v) => set({ showWishlist: v })} ar={ar} />
        </Field>

        <Section title={ar ? "الاسم والتقييم" : "Name & rating"} />
        <Field label={ar ? "مسار التنقل" : "Breadcrumb"} type="checkbox">
          <Toggle on={s.showBreadcrumb} onChange={(v) => set({ showBreadcrumb: v })} ar={ar} />
        </Field>
        <Field label={ar ? "شارة التقييم" : "Rating chip"} type="checkbox">
          <Toggle on={s.showRating} onChange={(v) => set({ showRating: v })} ar={ar} />
        </Field>
        <Field label={ar ? "التقييم" : "Score"} type="text">
          <Text value={s.ratingValue} onChange={(v) => set({ ratingValue: v })} placeholder="4.9" />
        </Field>
        <Field label={ar ? "عدد المراجعات" : "Number of reviews"} type="text">
          <Text value={s.reviewCount} onChange={(v) => set({ reviewCount: v })} placeholder="1,627" />
        </Field>
        <Field label={ar ? "الكلمة بعد العدد" : "Word after the number"} type="text">
          <Text value={s.reviewsWord} onChange={(v) => set({ reviewsWord: v })} placeholder="reviews" />
        </Field>
        <Field label={ar ? "كلمة التوثيق" : "Verified word"} type="text">
          <Text value={s.verifiedLabel} onChange={(v) => set({ verifiedLabel: v })} placeholder="Verified" />
        </Field>

        <Section title={ar ? "السعر والتقسيط" : "Price & instalments"} />
        <Field label={ar ? "شارة «وفّري»" : "“Save” pill"} type="checkbox">
          <Toggle on={s.showSave} onChange={(v) => set({ showSave: v })} ar={ar} />
        </Field>
        {s.showSave && (
          <Field label={ar ? "كلمة «وفّري»" : "Its word"} type="text">
            <Text value={s.saveLabel} onChange={(v) => set({ saveLabel: v })} placeholder={ar ? "وفّري" : "Save"} />
          </Field>
        )}
        <Field label={ar ? "شريط التقسيط" : "Instalments strip"} type="checkbox">
          <Toggle on={s.showInstalments} onChange={(v) => set({ showInstalments: v })} ar={ar} />
        </Field>
        {s.showInstalments && (
          <>
            <Field label={ar ? "عنوانه" : "Its title"} type="text">
              <Text value={s.instalmentsTitle} onChange={(v) => set({ instalmentsTitle: v })} placeholder={ar ? "التقسيط" : "Installments"} />
            </Field>
            <Num label={ar ? "عدد الشهور" : "Months"} value={s.instalmentMonths} min={1} max={60} onChange={(v) => set({ instalmentMonths: v })} />
            <Field label={ar ? "الجهات (افصلي بـ ·)" : "Providers (separate with ·)"} type="text">
              <Text value={s.instalmentProviders} onChange={(v) => set({ instalmentProviders: v })} placeholder="TRU · valU · Sympl" />
            </Field>
          </>
        )}

        <Section title={ar ? "الشراء" : "Buying"} />
        <Field label={ar ? "المقاسات والخيارات" : "Sizes & options"} type="checkbox">
          <Toggle on={s.showVariants} onChange={(v) => set({ showVariants: v })} ar={ar} />
        </Field>
        <Field label={ar ? "اختيار الكمية" : "Quantity picker"} type="checkbox">
          <Toggle on={s.showQuantity} onChange={(v) => set({ showQuantity: v })} ar={ar} />
        </Field>
        <Field label={ar ? "زر الإضافة" : "Add button"} type="text">
          <Text value={s.addLabel} onChange={(v) => set({ addLabel: v })} placeholder={ar ? "أضيفي للسلة" : "Add to cart"} />
        </Field>
        <Field label={ar ? "نص النفاد" : "Sold out"} type="text">
          <Text value={s.soldOutLabel} onChange={(v) => set({ soldOutLabel: v })} placeholder={ar ? "نفد" : "Sold out"} />
        </Field>
        <Field label={ar ? "زر «اشتري الآن»" : "“Buy now” button"} type="checkbox" hint={ar ? "يضيف القطعة ويذهب مباشرة للسلة." : "Adds the piece and goes straight to the basket."}>
          <Toggle on={s.showBuyNow} onChange={(v) => set({ showBuyNow: v })} ar={ar} />
        </Field>
        {s.showBuyNow && (
          <Field label={ar ? "نصه" : "Its text"} type="text">
            <Text value={s.buyNowLabel} onChange={(v) => set({ buyNowLabel: v })} placeholder={ar ? "اشتري الآن" : "Buy now"} />
          </Field>
        )}

        <Section title={ar ? "تشجيع الشراء" : "Nudges"} />
        <Field label={ar ? "«يشاهدن الآن»" : "“Viewing right now”"} type="checkbox" hint={ar ? "رقم ثابت لكل منتج بين الحدّين، يتغيّر قليلاً أثناء المشاهدة." : "A steady number per product between the two limits, drifting a little while the shopper looks."}>
          <Toggle on={s.showViewers} onChange={(v) => set({ showViewers: v })} ar={ar} />
        </Field>
        {s.showViewers && (
          <>
            <Num label={ar ? "أقل عدد" : "Fewest"} value={s.viewersMin} min={1} max={500} onChange={(v) => set({ viewersMin: v })} />
            <Num label={ar ? "أكبر عدد" : "Most"} value={s.viewersMax} min={1} max={500} onChange={(v) => set({ viewersMax: v })} />
            <Field label={ar ? "النص ({n} = العدد)" : "Text ({n} = the number)"} type="text">
              <Text value={s.viewersText} onChange={(v) => set({ viewersText: v })} placeholder="{n} people are viewing this right now" />
            </Field>
          </>
        )}
        <Field
          label={ar ? "تنبيه الكمية القليلة" : "Low stock warning"}
          type="checkbox"
          hint={ar ? "«باقي ٣» يدفع للشراء، لكنه يكشف مخزونك للمنافسين." : "Showing “3 left” nudges people to buy, and tells your competitors what you hold."}
        >
          <Toggle on={s.showStock} onChange={(v) => set({ showStock: v })} ar={ar} />
        </Field>
        {s.showStock && (
          <>
            <Num label={ar ? "يظهر عند بقاء هذا العدد أو أقل" : "Shows when this many or fewer are left"} value={s.lowStockAt} min={1} max={50} onChange={(v) => set({ lowStockAt: v })} />
            <Field label={ar ? "النص ({n} = الباقي)" : "Text ({n} = how many are left)"} type="text">
              <Text value={s.lowStockText} onChange={(v) => set({ lowStockText: v })} placeholder="Only {n} left in stock — order soon!" />
            </Field>
          </>
        )}
        <Field label={ar ? "الوعود الثلاثة" : "Three promises"} type="checkbox">
          <Toggle on={s.showPerks} onChange={(v) => set({ showPerks: v })} ar={ar} />
        </Field>
        {s.showPerks && (
          <>
            <Field label="🚚" type="text"><Text value={s.perk1} onChange={(v) => set({ perk1: v })} placeholder="" /></Field>
            <Field label="↩️" type="text"><Text value={s.perk2} onChange={(v) => set({ perk2: v })} placeholder="" /></Field>
            <Field label="✦" type="text"><Text value={s.perk3} onChange={(v) => set({ perk3: v })} placeholder="" /></Field>
          </>
        )}

        <Section title={ar ? "التفاصيل" : "Details"} />
        <Field label={ar ? "الوصف" : "Description"} type="checkbox">
          <Toggle on={s.showDescription} onChange={(v) => set({ showDescription: v })} ar={ar} />
        </Field>
        <Field label={ar ? "عنوان الوصف" : "Description title"} type="text">
          <Text value={s.descriptionTitle} onChange={(v) => set({ descriptionTitle: v })} placeholder={ar ? "الوصف" : "Description"} />
        </Field>
        <Field label={ar ? "عنوان التوصيل" : "Delivery title"} type="text">
          <Text value={s.shippingTitle} onChange={(v) => set({ shippingTitle: v })} placeholder={ar ? "التوصيل والاسترجاع" : "Delivery & returns"} />
        </Field>
        <Field label={ar ? "نص التوصيل (فارغ = يُخفى)" : "Delivery text (empty hides it)"} type="text">
          <textarea value={s.shippingText} onChange={(e) => set({ shippingText: e.target.value })} rows={3} className={`${input} h-auto py-2`} />
        </Field>

        <Section title={ar ? "التقييمات والمقترحات" : "Reviews & suggestions"} />
        <Field label={ar ? "بطاقة التقييمات الداكنة" : "Dark reviews card"} type="checkbox">
          <Toggle on={s.showReviewsCard} onChange={(v) => set({ showReviewsCard: v })} ar={ar} />
        </Field>
        {s.showReviewsCard && (
          <>
            <Field label={ar ? "السطر الصغير" : "Small line"} type="text"><Text value={s.reviewsKicker} onChange={(v) => set({ reviewsKicker: v })} placeholder="Customer reviews" /></Field>
            <Field label={ar ? "العنوان" : "Heading"} type="text"><Text value={s.reviewsHeading} onChange={(v) => set({ reviewsHeading: v })} placeholder="What They're" /></Field>
            <Field label={ar ? "الجزء المائل" : "Italic part"} type="text"><Text value={s.reviewsItalic} onChange={(v) => set({ reviewsItalic: v })} placeholder="Saying" /></Field>
            <Field label={ar ? "نص الزر" : "Button text"} type="text"><Text value={s.reviewsButton} onChange={(v) => set({ reviewsButton: v })} placeholder="Read all reviews" /></Field>
          </>
        )}
        <Field label={ar ? "مقترحات من نفس الماركة" : "More from the same brand"} type="checkbox">
          <Toggle on={s.showRelated} onChange={(v) => set({ showRelated: v })} ar={ar} />
        </Field>
        {s.showRelated && (
          <>
            <Field label={ar ? "السطر الصغير" : "Small line"} type="text"><Text value={s.relatedKicker} onChange={(v) => set({ relatedKicker: v })} placeholder="You may also like" /></Field>
            <Field label={ar ? "العنوان" : "Heading"} type="text"><Text value={s.relatedTitle} onChange={(v) => set({ relatedTitle: v })} placeholder="Complete the look" /></Field>
          </>
        )}

        <Section title={ar ? "الألوان" : "Colours"} />
        <Color label={ar ? "خلفية الصفحة" : "Page background"} value={s.pageBg} fallback="#f8f5f0" onChange={(v) => set({ pageBg: v })} />
        <Color label={ar ? "لون السعر والزر" : "Price & button colour"} value={s.accentColor} fallback="#9d6540" onChange={(v) => set({ accentColor: v })} />
        <Color label={ar ? "لون النص" : "Text colour"} value={s.inkColor} fallback="#211a15" onChange={(v) => set({ inkColor: v })} />
        <Color label={ar ? "لون النص الخفيف" : "Soft text colour"} value={s.mutedColor} fallback="#74685e" onChange={(v) => set({ mutedColor: v })} />
        <Color label={ar ? "اللون الداكن (اشتري الآن والتقييمات)" : "Dark colour (Buy now & reviews)"} value={s.darkColor} fallback="#211a15" onChange={(v) => set({ darkColor: v })} />
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
