"use client";

import { ALL_ROWS_CAP, type AppTheme, type Block } from "@/lib/app-theme";

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
      const image = str(s.imageUrl);
      const handle = str(s.handle);
      const heading = str(s.heading);
      const sub = str(s.subheading);
      const target = data.collections.find((c) => c.handle === handle);
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
      if (!data.collections.length) {
        return <Placeholder ar={ar} label={ar ? "لا توجد أقسام" : "No collections yet"} />;
      }
      return (
        <section>
          {title && <Heading title={title} ar={ar} accent={accent} />}
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {data.collections.map((c) => (
              <button
                key={c.handle}
                onClick={() => handlers.onOpenCollection?.(c.handle, c.title)}
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
              >
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
      return data.collections.length === 0;
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
    default:
      return false;
  }
}
