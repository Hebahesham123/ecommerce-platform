"use client";

import { useState } from "react";
import { ALL_ROWS_CAP, itemsOf, type AppTheme, type Block, type Item } from "@/lib/app-theme";

/**
 * The app's home screen, drawn from a theme.
 *
 * One component, used twice: the editor previews the draft you are typing, and
 * the preview app renders what is saved. That is the only way a live preview
 * is worth anything — two implementations of "what this block looks like"
 * disagree the week after they are written, and then the editor is showing you
 * a picture of an app that does not exist.
 *
 * It is deliberately dumb: given a theme and a bag of data, it draws. It
 * fetches nothing and knows nothing about where either came from.
 */

export type Card = {
  id: string;
  handle: string;
  name: string;
  image: string | null;
  priceMin: number | null;
  compareAt: number | null;
};

export type HomeCollection = {
  handle: string;
  title: string;
  image: string | null;
  productCount: number;
};

export type HomeReview = {
  id: string;
  name: string;
  productRating: number | null;
  comment: string | null;
};

export type HomeData = {
  collections: HomeCollection[];
  /** Products by collection handle — two blocks on one collection cost one copy. */
  rows: Record<string, Card[]>;
  newArrivals: Card[];
  reviews: HomeReview[];
};

export type HomeHandlers = {
  onOpenCollection?: (handle: string, title: string) => void;
  onOpenProduct?: (id: string) => void;
};

const money = (v: number | null, ar: boolean) =>
  v == null
    ? "—"
    : `${new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(v)} ${
        ar ? "ج.م" : "EGP"
      }`;

const str = (v: unknown, fallback = "") => (typeof v === "string" && v ? v : fallback);
const int = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
};

/**
 * What a thing pointed at a collection looks like.
 *
 * Choosing a collection is already saying what the card is; making the
 * merchant then find and paste that collection's picture is asking them to
 * repeat themselves, and guarantees the two drift the day the collection gets
 * a new image. Their own image always wins when they set one.
 */
function inherit(item: Item, data: HomeData): { image: string | null; title: string } {
  const own = str(item.imageUrl);
  const named = str(item.title) || str(item.label);
  const handle = str(item.handle);
  const collection = handle ? data.collections.find((c) => c.handle === handle) : undefined;
  return {
    image: own || collection?.image || null,
    title: named || collection?.title || "",
  };
}

function Thumb({ src, className = "" }: { src: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-slate-100 ${className}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function Tile({
  card,
  ar,
  accent,
  wide,
  onOpen,
}: {
  card: Card;
  ar: boolean;
  accent: string;
  wide?: boolean;
  onOpen?: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onOpen?.(card.id)}
      className={`${wide ? "w-32 shrink-0" : ""} overflow-hidden rounded-2xl border border-slate-200 bg-white text-start`}
    >
      <Thumb src={card.image} className="aspect-square rounded-none" />
      <div className="p-2">
        <div className="line-clamp-2 text-[11px] leading-snug text-slate-800">{card.name}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-bold" style={{ color: accent }}>
            {money(card.priceMin, ar)}
          </span>
          {card.compareAt != null && card.priceMin != null && card.compareAt > card.priceMin && (
            <span className="text-[10px] text-slate-400 line-through">
              {money(card.compareAt, ar)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Heading({
  title,
  onSeeAll,
  ar,
  accent,
}: {
  title: string;
  onSeeAll?: () => void;
  ar: boolean;
  accent: string;
}) {
  if (!title && !onSeeAll) return null;
  return (
    <div className="flex items-end justify-between gap-2">
      <h3 className="min-w-0 truncate text-sm font-bold text-slate-900">{title}</h3>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="shrink-0 text-xs font-semibold"
          style={{ color: accent }}
        >
          {ar ? "الكل" : "See all"}
        </button>
      )}
    </div>
  );
}

function BlockView({
  block,
  theme,
  data,
  ar,
  handlers,
}: {
  block: Block;
  theme: AppTheme;
  data: HomeData;
  ar: boolean;
  handlers: HomeHandlers;
}) {
  const accent = theme.settings.accent;
  const s = block.settings ?? {};

  switch (block.type) {
    case "banner": {
      const handle = str(s.handle);
      const target = data.collections.find((c) => c.handle === handle);
      const image = str(s.imageUrl) || target?.image || "";
      const heading = str(s.heading);
      const sub = str(s.subheading);
      if (!image && !heading) {
        return <Placeholder ar={ar} label={ar ? "بانر بلا صورة" : "Banner with no image yet"} />;
      }
      return (
        <button
          onClick={() => target && handlers.onOpenCollection?.(target.handle, target.title)}
          className="relative block w-full overflow-hidden rounded-2xl text-start"
        >
          <Thumb src={image} className="h-36 w-full rounded-2xl" />
          {(heading || sub) && (
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-3">
              {heading && <div className="text-base font-bold text-white">{heading}</div>}
              {sub && <div className="text-[11px] text-white/85">{sub}</div>}
            </div>
          )}
        </button>
      );
    }

    case "categories": {
      const title = str(s.title);
      // The merchant's own picks when they made some, each borrowing its
      // collection's picture and name; otherwise every collection.
      const picked = itemsOf(block).filter((i) => str(i.handle));
      const chips = picked.length
        ? picked.map((i) => {
            const { image, title: name } = inherit(i, data);
            return { handle: str(i.handle), title: name, image, emoji: str(i.emoji) };
          })
        : data.collections.map((c) => ({
            handle: c.handle,
            title: c.title,
            image: c.image,
            emoji: "",
          }));
      if (!chips.length) {
        return <Placeholder ar={ar} label={ar ? "لا توجد أقسام" : "No collections yet"} />;
      }
      return (
        <section>
          {title && <Heading title={title} ar={ar} accent={accent} />}
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {chips.map((c) => (
              <button
                key={c.handle}
                onClick={() => handlers.onOpenCollection?.(c.handle, c.title)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-300 bg-white ps-1.5 pe-3 py-1 text-xs font-medium text-slate-600"
              >
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : c.emoji ? (
                  <span className="text-sm">{c.emoji}</span>
                ) : null}
                {c.title}
              </button>
            ))}
          </div>
        </section>
      );
    }

    case "new_arrivals": {
      const cards = data.newArrivals.slice(0, int(s.limit, 12));
      if (!cards.length) return <Placeholder ar={ar} label={ar ? "لا توجد منتجات" : "No products"} />;
      return (
        <section>
          <Heading
            title={str(s.title, ar ? "وصل حديثاً" : "New arrivals")}
            ar={ar}
            accent={accent}
          />
          <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
            {cards.map((c) => (
              <Tile key={c.id} card={c} ar={ar} accent={accent} wide onOpen={handlers.onOpenProduct} />
            ))}
          </div>
        </section>
      );
    }

    case "collection_row":
    case "collection_grid": {
      const handle = str(s.handle).toLowerCase();
      const limit = int(s.limit, block.type === "collection_row" ? 8 : 6);
      const grid = block.type === "collection_grid";

      // No collection chosen means "every collection I have", in the order the
      // merchant set — the arrangement most stores would build by hand.
      const targets = handle
        ? data.collections.filter((c) => c.handle === handle)
        : // "Every collection" is capped the same way the API caps it, so the
          // editor cannot promise a row the app will never draw.
          data.collections.slice(0, ALL_ROWS_CAP);
      const shown = targets.filter((c) => (data.rows[c.handle] ?? []).length > 0);

      if (!shown.length) {
        return (
          <Placeholder
            ar={ar}
            label={
              handle
                ? ar ? "هذا القسم فارغ" : "That collection has nothing in it"
                : ar ? "لا توجد أقسام بمنتجات" : "No collection has products yet"
            }
          />
        );
      }

      return (
        <>
          {shown.map((c) => {
            const cards = (data.rows[c.handle] ?? []).slice(0, limit);
            return (
              <section key={c.handle}>
                <Heading
                  title={handle ? str(s.title, c.title) : c.title}
                  onSeeAll={() => handlers.onOpenCollection?.(c.handle, c.title)}
                  ar={ar}
                  accent={accent}
                />
                {grid ? (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {cards.map((card) => (
                      <Tile
                        key={card.id}
                        card={card}
                        ar={ar}
                        accent={accent}
                        onOpen={handlers.onOpenProduct}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
                    {cards.map((card) => (
                      <Tile
                        key={card.id}
                        card={card}
                        ar={ar}
                        accent={accent}
                        wide
                        onOpen={handlers.onOpenProduct}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      );
    }

    case "hero": {
      const slides = itemsOf(block);
      if (!slides.length) return <Placeholder ar={ar} label={ar ? "لا توجد شرائح" : "No slides yet"} />;
      return <Hero slides={slides} accent={accent} onOpen={handlers.onOpenCollection} data={data} />;
    }

    case "promo_bar": {
      const lead = str(s.lead);
      const code = str(s.code);
      if (!lead && !code) return <Placeholder ar={ar} label={ar ? "عرض فارغ" : "Empty offer"} />;
      return (
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
          style={{ background: `${accent}14` }}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold" style={{ color: accent }}>
              {lead}
            </div>
            {str(s.rest) && <div className="truncate text-[10px] text-slate-500">{str(s.rest)}</div>}
          </div>
          {code && (
            <span
              className="shrink-0 rounded-lg border border-dashed px-2 py-1 font-mono text-[11px] font-bold"
              style={{ borderColor: accent, color: accent }}
            >
              {code}
            </span>
          )}
        </div>
      );
    }

    case "collection_tabs": {
      const tabs = itemsOf(block).filter((t) => str(t.handle));
      if (!tabs.length) return <Placeholder ar={ar} label={ar ? "لا توجد تبويبات" : "No tabs yet"} />;
      return (
        <Tabs
          title={str(s.title)}
          kicker={str(s.kicker)}
          tabs={tabs}
          limit={int(s.limit, 8)}
          data={data}
          ar={ar}
          accent={accent}
          handlers={handlers}
        />
      );
    }

    case "cards": {
      const cards = itemsOf(block);
      if (!cards.length) return <Placeholder ar={ar} label={ar ? "لا توجد بطاقات" : "No cards yet"} />;
      return (
        <section>
          <Heading title={str(s.title)} ar={ar} accent={accent} />
          <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
            {cards.map((c) => {
              const { image, title } = inherit(c, data);
              return (
                <button
                  key={c.id}
                  onClick={() => str(c.handle) && handlers.onOpenCollection?.(str(c.handle), title)}
                  className="w-36 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-start"
                >
                  <Thumb src={image} className="aspect-[4/5] rounded-none" />
                  <div className="p-2">
                    <div className="truncate text-xs font-semibold text-slate-900">{title}</div>
                    {str(c.subtitle) && (
                      <div className="truncate text-[10px] text-slate-500">{str(c.subtitle)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    case "tiers": {
      const tiers = itemsOf(block);
      if (!tiers.length) return <Placeholder ar={ar} label={ar ? "لا توجد فئات" : "No tiers yet"} />;
      return (
        <section>
          <Heading title={str(s.title)} ar={ar} accent={accent} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => str(t.handle) && handlers.onOpenCollection?.(str(t.handle), str(t.label))}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-start"
              >
                {str(t.prefix) && (
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    {str(t.prefix)}
                  </div>
                )}
                <div className="text-sm font-bold" style={{ color: accent }}>
                  {str(t.amount)}
                </div>
                <div className="truncate text-[11px] text-slate-600">{str(t.label)}</div>
              </button>
            ))}
          </div>
        </section>
      );
    }

    case "split": {
      const panels = itemsOf(block).slice(0, 2);
      if (!panels.length) return <Placeholder ar={ar} label={ar ? "لا توجد لوحات" : "No panels yet"} />;
      return (
        <section>
          <Heading title={str(s.title)} ar={ar} accent={accent} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {panels.map((p) => {
              const { image, title } = inherit(p, data);
              return (
                <button
                  key={p.id}
                  onClick={() => str(p.handle) && handlers.onOpenCollection?.(str(p.handle), title)}
                  className="relative overflow-hidden rounded-2xl text-start"
                >
                  <Thumb src={image} className="aspect-[3/4] rounded-none" />
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/55 to-transparent p-2.5">
                    <div className="text-sm font-bold text-white">{title}</div>
                    {str(p.buttonLabel) && (
                      <div className="text-[10px] text-white/85">{str(p.buttonLabel)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    case "trust_badges": {
      const badges = itemsOf(block);
      if (!badges.length) return <Placeholder ar={ar} label={ar ? "لا توجد شارات" : "No badges yet"} />;
      return (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {badges.map((b) => (
            <div
              key={b.id}
              className="w-28 shrink-0 rounded-2xl border border-slate-200 bg-white p-2.5 text-center"
            >
              <div className="text-lg leading-none">{str(b.emoji) || "•"}</div>
              <div className="mt-1 truncate text-[11px] font-semibold text-slate-900">
                {str(b.title)}
              </div>
              <div className="truncate text-[10px] text-slate-500">{str(b.subtitle)}</div>
            </div>
          ))}
        </div>
      );
    }

    case "reviews": {
      const shown = data.reviews.slice(0, int(s.limit, 6));
      if (!shown.length) {
        return (
          <Placeholder
            ar={ar}
            label={ar ? "لم يتم اختيار تقييمات بعد" : "No reviews have been featured yet"}
          />
        );
      }
      return (
        <section>
          <Heading
            title={str(s.title, ar ? "آراء العملاء" : "What customers say")}
            ar={ar}
            accent={accent}
          />
          <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
            {shown.map((r) => (
              <div
                key={r.id}
                className="w-56 shrink-0 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">{r.name}</span>
                  {r.productRating != null && (
                    <span className="text-xs text-amber-500">{"★".repeat(r.productRating)}</span>
                  )}
                </div>
                {r.comment && (
                  <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-600">
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "text": {
      const heading = str(s.heading);
      const body = str(s.body);
      if (!heading && !body) {
        return <Placeholder ar={ar} label={ar ? "نص فارغ" : "Empty text block"} />;
      }
      return (
        <section className="rounded-2xl bg-slate-50 p-3.5">
          {heading && <h3 className="text-sm font-bold text-slate-900">{heading}</h3>}
          {body && <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>}
        </section>
      );
    }
  }
}

/** The hero, one slide at a time, with dots when there is more than one. */
function Hero({
  slides,
  accent,
  data,
  onOpen,
}: {
  slides: Item[];
  accent: string;
  data: HomeData;
  onOpen?: (handle: string, title: string) => void;
}) {
  const [at, setAt] = useState(0);
  const slide = slides[Math.min(at, slides.length - 1)];
  const handle = str(slide.handle);
  const collection = data.collections.find((c) => c.handle === handle);
  const title = collection?.title ?? str(slide.heading);
  // A slide with no picture of its own borrows the collection's.
  const image = str(slide.imageUrl) || collection?.image || null;

  return (
    <section>
      <button
        onClick={() => handle && onOpen?.(handle, title)}
        className="relative block w-full overflow-hidden rounded-2xl text-start"
      >
        <Thumb src={image} className="h-44 w-full rounded-2xl" />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-3">
          {str(slide.kicker) && (
            <div className="text-[10px] uppercase tracking-widest text-white/80">
              {str(slide.kicker)}
            </div>
          )}
          {str(slide.heading) && (
            <div className="text-lg font-bold text-white">{str(slide.heading)}</div>
          )}
          {str(slide.subheading) && (
            <div className="text-[11px] text-white/85">{str(slide.subheading)}</div>
          )}
        </div>
      </button>
      {slides.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {slides.map((sl, i) => (
            <button
              key={sl.id}
              onClick={() => setAt(i)}
              aria-label={`${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === at ? 16 : 6,
                background: i === at ? accent : "#cbd5e1",
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Collections as tabs, with the chosen one's products underneath. */
function Tabs({
  title,
  kicker,
  tabs,
  limit,
  data,
  ar,
  accent,
  handlers,
}: {
  title: string;
  kicker: string;
  tabs: Item[];
  limit: number;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const [at, setAt] = useState(0);
  const active = tabs[Math.min(at, tabs.length - 1)];
  const handle = str(active.handle);
  const products = (data.rows[handle] ?? []).slice(0, limit);

  return (
    <section>
      {kicker && <div className="text-[10px] uppercase tracking-wide text-slate-400">{kicker}</div>}
      <Heading
        title={title}
        onSeeAll={() => handlers.onOpenCollection?.(handle, str(active.label))}
        ar={ar}
        accent={accent}
      />
      <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setAt(i)}
            className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={
              i === at
                ? { background: accent, color: "#fff" }
                : { background: "#fff", color: "#475569", border: "1px solid #cbd5e1" }
            }
          >
            {str(t.emoji)} {str(t.label) || str(t.handle)}
          </button>
        ))}
      </div>
      {products.length ? (
        <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
          {products.map((p) => (
            <Tile key={p.id} card={p} ar={ar} accent={accent} wide onOpen={handlers.onOpenProduct} />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-[11px] text-slate-400">
          {ar ? "لا منتجات في هذا التبويب" : "Nothing in this tab"}
        </p>
      )}
    </section>
  );
}

/**
 * A block the merchant has added but not finished.
 *
 * Shown only in the editor. The app skips these entirely — an unfinished block
 * is the merchant's business, not the shopper's, and a grey box saying "banner
 * with no image" on a live home screen is worse than one fewer banner.
 */
function Placeholder({ ar, label }: { ar: boolean; label: string }) {
  return (
    <div
      data-placeholder
      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[11px] text-slate-400"
    >
      {label}
      <div className="mt-0.5 text-[10px]">
        {ar ? "لن يظهر هذا في التطبيق" : "This won't show in the app"}
      </div>
    </div>
  );
}

export function AppHome({
  theme,
  data,
  ar,
  handlers = {},
  showPlaceholders = false,
}: {
  theme: AppTheme;
  data: HomeData;
  ar: boolean;
  handlers?: HomeHandlers;
  /** The editor wants to see unfinished blocks; a shopper does not. */
  showPlaceholders?: boolean;
}) {
  const blocks = theme.blocks ?? [];
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        const rendered = (
          <BlockView block={block} theme={theme} data={data} ar={ar} handlers={handlers} />
        );
        if (!showPlaceholders && isPlaceholder(rendered)) return null;
        return <div key={block.id}>{rendered}</div>;
      })}
      {blocks.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          {ar ? "الصفحة الرئيسية فارغة" : "The home screen is empty"}
        </p>
      )}
    </div>
  );
}

/** True when a block rendered as the "not finished yet" box. */
function isPlaceholder(node: React.ReactElement): boolean {
  const props = node.props as { block?: Block; data?: HomeData; theme?: AppTheme };
  const block = props.block;
  if (!block) return false;
  const s = block.settings ?? {};
  const data = props.data;
  if (!data) return false;

  switch (block.type) {
    case "banner":
      return !str(s.imageUrl) && !str(s.heading);
    case "categories":
      return itemsOf(block).filter((i) => str(i.handle)).length === 0 && data.collections.length === 0;
    case "new_arrivals":
      return data.newArrivals.length === 0;
    case "reviews":
      return data.reviews.length === 0;
    case "text":
      return !str(s.heading) && !str(s.body);
    case "collection_row":
    case "collection_grid": {
      const handle = str(s.handle).toLowerCase();
      const targets = handle
        ? data.collections.filter((c) => c.handle === handle)
        : data.collections.slice(0, ALL_ROWS_CAP);
      return !targets.some((c) => (data.rows[c.handle] ?? []).length > 0);
    }
    case "hero":
    case "cards":
    case "tiers":
    case "split":
    case "trust_badges":
      return itemsOf(block).length === 0;
    case "collection_tabs":
      return itemsOf(block).filter((t) => str(t.handle)).length === 0;
    case "promo_bar":
      return !str(s.lead) && !str(s.code);
    default:
      return false;
  }
}
