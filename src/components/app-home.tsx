"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ALL_ROWS_CAP,
  DEFAULT_SETTINGS,
  itemsOf,
  type AppTheme,
  type Block,
  type Item,
} from "@/lib/app-theme";

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
  /** The brand line above the title, when the store sets one. */
  vendor?: string | null;
  /** The only variant, when there is exactly one — see AppProductCard. */
  variantId?: string | null;
  variantCount?: number;
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

export type HomeLive = {
  id: string;
  title: string;
  hostName: string | null;
  coverUrl: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduledAt: string | null;
  peakViewers: number;
  href: string;
};

export type HomeData = {
  collections: HomeCollection[];
  /** Products by collection handle — two blocks on one collection cost one copy. */
  rows: Record<string, Card[]>;
  newArrivals: Card[];
  reviews: HomeReview[];
  /** The shop's real lives — on air first, then what is scheduled. */
  lives?: HomeLive[];
  /**
   * The signed-in shopper first name, when the surface drawing this knows it.
   * Only the live-now offer uses it, and it degrades to an unnamed greeting,
   * so nothing here has to go and fetch an account it does not otherwise need.
   */
  shopperName?: string | null;
  /**
   * What goes with the signed-in shopper's past orders. Left out entirely by
   * a surface with no shopper (the editor), which then draws a sample; an
   * empty list hides the section.
   */
  recommended?: {
    mode: "pairs" | "fallback" | "none";
    basedOn: string | null;
    products: Card[];
  } | null;
};

export type HomeHandlers = {
  onOpenCollection?: (handle: string, title: string) => void;
  onOpenProduct?: (id: string) => void;
  /** A place in the app itself: home, search, cart, orders, account. */
  onOpenScreen?: (screen: string) => void;
  /**
   * Add the single variant of a card to the cart. Only ever called for a
   * product that has exactly one; the card opens the product instead when
   * there is a choice to make. Leave it out and the card shows no add button,
   * which is what the theme editor wants — it is previewing a design, and a
   * cart it cannot fill is worse than no button at all.
   */
  onAddToCart?: (variantId: string, productId: string) => void;
  /**
   * Toggle the wishlist. Takes the whole card, not an id: the saved list is
   * rendered on a screen that never reloads the catalogue, so it has to keep
   * the name, price and image alongside the id.
   */
  onToggleWishlist?: (card: Card) => void;
  /** Product ids currently on the wishlist, so the heart can draw filled. */
  wishlist?: readonly string[];
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
 * A number of pixels where zero means zero.
 *
 * int() reads zero as "unset" so a merchant cannot accidentally collapse a
 * size to nothing. For a gap or a height, zero is exactly what somebody may
 * mean, so these read it literally.
 */
const px = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
};

/**
 * What a thing pointed at a collection looks like.
 *
 * Choosing a collection is already saying what the card is; making the
 * merchant then find and paste that collection's picture is asking them to
 * repeat themselves, and guarantees the two drift the day the collection gets
 * a new image. Their own image always wins when they set one.
 */
/**
 * Put the shopper name into a line the merchant wrote, or take the token out.
 *
 * The offer is addressed to someone by name, which is the whole point of it,
 * but the app also draws this screen before anyone has signed in. Leaving a
 * literal "{name}" on screen would be worse than not personalising at all, so
 * an unknown name drops the token and the comma that followed it and the line
 * simply starts one word later.
 */
function personalise(template: string, name?: string | null): string {
  const first = String(name ?? "").trim().split(" ")[0] ?? "";
  if (first) return template.split("{name}").join(first);
  let out = template.split("{name}").join("").trim();
  // A possessive reads as "'s profile" once the name is gone, so the
  // apostrophe leaves with it rather than dangling at the front of the line.
  if (out.startsWith("'s ") || out.startsWith("’s ")) out = out.slice(3).trim();
  if (out === "'s" || out === "’s") out = "";
  while (out.startsWith(",") || out.startsWith("،")) out = out.slice(1).trim();
  return out ? out[0].toUpperCase() + out.slice(1) : "";
}

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

function Thumb({
  src,
  className = "",
  style,
  fit = "cover",
  blend,
}: {
  src: string | null;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Multiply the photo onto the card's photo colour.
   *
   * Only for product shots. A white background and a light grey one land in
   * the same place once they are multiplied onto the same colour, which is
   * what stops a row of cards looking like it was assembled from three
   * different shops. A photograph meant to fill its frame - a banner, a
   * lookbook picture - is left alone, because there is no background in it to
   * reconcile.
   */
  blend?: boolean;
  /**
   * "cover" crops the picture to fill the box, "contain" fits all of it in.
   *
   * It belongs on the picture rather than on the box around it, which is
   * why it is a prop: a style passed in from outside lands on the box and
   * the picture goes on cropping regardless.
   */
  fit?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl ${blend ? "" : "bg-slate-100 "}${className}`}
      style={blend ? { background: "var(--app-photo-bg, #ece8e3)", ...style } : style}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}${
            blend ? " app-photo-blend" : ""
          }`}
        />
      )}
    </div>
  );
}

/**
 * The first few words of a name, and a sign that there were more.
 *
 * Trimming by words rather than by width means the break lands between two
 * words instead of through the middle of one, so what is left still reads as
 * language: "Louis Vuitton Pochette…" rather than "Louis Vuitton Poche…".
 */
/**
 * The name, minus the brand that is already printed above it.
 *
 * "LOUIS VUITTON" over "Louis Vuitton Pochette Voyage" means the three words
 * the card can show are two words of brand and one of product. Dropping the
 * repeat buys back the whole line: "Pochette Voyage Taiga…".
 */
export function withoutVendor(name: string, vendor?: string | null): string {
  const v = (vendor ?? "").trim();
  const n = String(name ?? "").trim();
  if (!v || !n.toLowerCase().startsWith(v.toLowerCase())) return n;
  // Unless the name is only the brand, in which case it is all there is.
  return n.slice(v.length).trim() || n;
}

export function shortName(name: string, words: number): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= words) return parts.join(" ");
  return parts.slice(0, words).join(" ") + "…";
}

/**
 * One product, everywhere a product is drawn.
 *
 * Every product block on the home screen renders through here, so the card is
 * designed once. The parts are in the order a shopper reads them: the photo,
 * what it saves you, who made it, what it is, what it costs.
 *
 * The heart and the add button are drawn only when the surface passed a
 * handler for them. The theme editor passes neither — it is previewing a
 * layout, and a button that cannot do its job is worse than no button.
 */
/**
 * The handler bundle every Tile needs, unpacked once.
 *
 * Four call sites drawing the same card should not each spell out the same
 * four props. A surface that passed no cart or wishlist handler gets undefined
 * through to Tile, which then draws neither button.
 */
/**
 * What every product card on the screen agrees on.
 *
 * A card is drawn from six different blocks, so threading two settings through
 * six call sites would mean six chances to forget one and one card in the app
 * that quietly disagrees with the rest. The home screen puts them here once.
 */
const CardStyle = createContext({
  nameWords: DEFAULT_SETTINGS.cardNameWords,
  photoBg: DEFAULT_SETTINGS.cardPhotoBg,
});

function tileProps(handlers: HomeHandlers, productId: string) {
  return {
    onOpen: handlers.onOpenProduct,
    onAdd: handlers.onAddToCart,
    onWish: handlers.onToggleWishlist,
    wished: handlers.wishlist?.includes(productId) ?? false,
  };
}

function Tile({
  card,
  ar,
  accent,
  wide,
  shape = "square",
  fit = "cover",
  fadeAfter,
  onOpen,
  onAdd,
  onWish,
  wished,
}: {
  card: Card;
  ar: boolean;
  accent: string;
  wide?: boolean;
  /** The picture's proportions: wide, square or tall. */
  shape?: string;
  /** "cover" crops to fill it, "contain" fits the whole picture inside. */
  fit?: string;
  /** Milliseconds to wait before arriving. Undefined means just be there. */
  fadeAfter?: number;
  onOpen?: (id: string) => void;
  onAdd?: (variantId: string, productId: string) => void;
  onWish?: (card: Card) => void;
  wished?: boolean;
}) {
  const was = card.compareAt;
  const now = card.priceMin;
  const onSale = was != null && now != null && was > now;
  // Rounded, because "-27.5%" reads like a rounding error rather than a deal.
  const off = onSale ? Math.round(((was - now) / was) * 100) : 0;

  // A product with one variant can go straight in. Anything with a choice --
  // a size, a colour -- opens instead, because guessing on the shopper's
  // behalf is how you earn a return.
  const single = card.variantId != null && (card.variantCount ?? 1) === 1;
  const canAdd = Boolean(onAdd);
  const { nameWords } = useContext(CardStyle);
  const ratio =
    shape === "wide" ? "aspect-[4/3]" : shape === "tall" ? "aspect-[3/4]" : "aspect-square";

  return (
    <div
      className={`${wide ? "w-40 shrink-0" : ""} relative overflow-hidden rounded-2xl border border-slate-200 bg-white ${
        fadeAfter === undefined ? "" : "app-fade-in"
      }`}
      style={fadeAfter === undefined ? undefined : { animationDelay: `${fadeAfter}ms` }}
    >
      <button onClick={() => onOpen?.(card.id)} className="block w-full text-start">
        <span className="relative block p-1.5">
          <Thumb src={card.image} className={`${ratio} rounded-xl`} fit={fit} blend />
          {off > 0 && (
            <span
              className="absolute bottom-1 start-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
              style={{ background: accent }}
            >
              −{off}%
            </span>
          )}
        </span>
        <span className={`block ps-2 pb-2 ${canAdd ? "pe-9" : "pe-2"}`}>
          {card.vendor && (
            <span className="block truncate text-[9px] font-bold uppercase tracking-[0.08em] text-slate-900">
              {card.vendor}
            </span>
          )}
          {/* One line. A name too long for it stops at a word, not mid-word. */}
          <span className="block truncate text-[11px] leading-snug text-slate-500">
            {shortName(withoutVendor(card.name, card.vendor), nameWords)}
          </span>
          {/* Was and now on one baseline: the saving reads as one thought, and
              the card keeps the line the second price used to take. */}
          <span className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[13px] font-bold" style={{ color: accent }}>
              {money(now, ar)}
            </span>
            {onSale && (
              <span className="text-[10px] text-slate-400 line-through">{money(was, ar)}</span>
            )}
          </span>
        </span>
      </button>

      {onWish && (
        <button
          onClick={() => onWish(card)}
          aria-pressed={wished}
          aria-label={ar ? "أضيفي إلى المفضلة" : "Add to wishlist"}
          className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill={wished ? accent : "none"}
            stroke={wished ? accent : "#94a3b8"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" />
          </svg>
        </button>
      )}

      {canAdd && (
        <button
          onClick={() => (single ? onAdd?.(card.variantId as string, card.id) : onOpen?.(card.id))}
          aria-label={
            single ? (ar ? "أضيفي إلى الحقيبة" : "Add to bag") : ar ? "اختاري المقاس" : "Choose a size"
          }
          className="absolute bottom-2 end-2 grid h-7 w-7 place-items-center rounded-full text-white shadow-sm"
          style={{ background: accent }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
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
      <h3 dir="auto" className="min-w-0 truncate text-[16px] font-bold tracking-tight text-slate-900">{title}</h3>
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
          <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "calc(var(--app-item-gap, 8px) * 0.67)" }}>
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
          <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
            {cards.map((c) => (
              <Tile key={c.id} card={c} ar={ar} accent={accent} wide {...tileProps(handlers, c.id)} />
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
                  <div className="mt-2 grid grid-cols-2" style={{ gap: "var(--app-item-gap, 8px)" }}>
                    {cards.map((card) => (
                      <Tile
                        key={card.id}
                        card={card}
                        ar={ar}
                        accent={accent}
                        {...tileProps(handlers, card.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
                    {cards.map((card) => (
                      <Tile
                        key={card.id}
                        card={card}
                        ar={ar}
                        accent={accent}
                        wide
                        {...tileProps(handlers, card.id)}
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
      return (
        <Hero
          slides={slides}
          accent={accent}
          onOpen={handlers.onOpenCollection}
          data={data}
          // Seconds between slides. Zero means it waits to be told.
          every={int(s.autoplaySeconds, 5)}
        />
      );
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

    case "live_now": {
      // Whoever is genuinely on air comes first, with the cover the host chose
      // when she created them — a row that advertises a live nobody can watch
      // costs more than an empty row does. Behind them stand the recordings
      // the merchant keeps here, so the row is never empty between shows:
      // this is the one section that is about the shop being a place rather
      // than a catalogue, and a place is never shut.
      const onAir = (data.lives ?? []).filter((l) => l.status === "live");
      const live = onAir.map((l) => ({
        id: l.id,
        name: l.hostName || l.title,
        imageUrl: l.coverUrl ?? "",
        viewers: l.peakViewers ? String(l.peakViewers) : "",
        url: l.href,
        onAir: true,
      }));
      const replays = itemsOf(block)
        .filter((i) => str(i.videoUrl) || str(i.imageUrl) || str(i.name))
        .map((i) => ({ ...i, onAir: false }));
      const people = [...live, ...replays];
      const offerOn = s.offerEnabled !== false;
      const offerTitle = personalise(str(s.offerTitle), data.shopperName);
      const offerText = str(s.offerText);
      const hasOffer = offerOn && Boolean(offerTitle || offerText);
      if (!people.length && !hasOffer) {
        return <Placeholder ar={ar} label={ar ? "لا أحد يبثّ بعد" : "Nobody live yet"} />;
      }
      return (
        <LiveNow
          block={block}
          people={people}
          data={data}
          ar={ar}
          accent={accent}
          handlers={handlers}
        />
      );
    }

    case "showcase": {
      if (!str(s.imageUrl) && !str(s.heading) && !str(s.handle)) {
        return <Placeholder ar={ar} label={ar ? "صورة بلا مصدر" : "No picture chosen yet"} />;
      }
      return <Showcase block={block} data={data} ar={ar} accent={accent} handlers={handlers} />;
    }

    case "style_profile": {
      const tags = itemsOf(block).filter((i) => str(i.label));
      if (!tags.length && !str(s.cardTitle)) {
        return <Placeholder ar={ar} label={ar ? "لا وسوم بعد" : "No tags yet"} />;
      }
      return (
        <StyleProfile block={block} items={tags} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "review_summary":
      if (!str(s.average) && !str(s.heading) && !str(s.headingItalic)) {
        return <Placeholder ar={ar} label={ar ? "ملخص بلا تقييم بعد" : "Summary with no score yet"} />;
      }
      return <ReviewSummary block={block} data={data} handlers={handlers} />;

    case "brand_timeline": {
      const brands = itemsOf(block).filter((i) => str(i.label) || str(i.title) || str(i.imageUrl));
      if (!brands.length) return <Placeholder ar={ar} label={ar ? "لا ماركات بعد" : "No brands yet"} />;
      return <BrandTimeline block={block} items={brands} data={data} handlers={handlers} />;
    }

    case "complete_look":
      return <CompleteLook block={block} data={data} ar={ar} accent={accent} handlers={handlers} />;

    case "promo_card": {
      if (!str(s.title) && !str(s.body)) {
        return <Placeholder ar={ar} label={ar ? "بطاقة بلا نص" : "Card with no wording yet"} />;
      }
      return <PromoCard block={block} data={data} ar={ar} accent={accent} handlers={handlers} />;
    }

    case "product_reasons": {
      const picks = itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl) || str(i.handle));
      if (!picks.length) return <Placeholder ar={ar} label={ar ? "لا مقترحات بعد" : "Nothing suggested yet"} />;
      return (
        <ProductReasons block={block} items={picks} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "circle_row": {
      const circles = itemsOf(block).filter((i) => str(i.imageUrl) || str(i.label) || str(i.handle));
      if (!circles.length) return <Placeholder ar={ar} label={ar ? "لا عناصر بعد" : "Nothing here yet"} />;
      return (
        <CircleRow block={block} items={circles} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "pick_colour": {
      const colours = itemsOf(block).filter((i) => str(i.color));
      if (colours.length && str(s.style) === "palette") {
        return <PalettePanel block={block} items={colours} data={data} handlers={handlers} />;
      }
      if (!colours.length) return <Placeholder ar={ar} label={ar ? "لا ألوان بعد" : "No colours yet"} />;
      return (
        <PickColour block={block} items={colours} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "price_drop": {
      if (!str(s.title) && !str(s.subtitle)) {
        return <Placeholder ar={ar} label={ar ? "تنبيه بلا نص" : "Alert with no wording yet"} />;
      }
      return (
        <PriceDrop block={block} items={itemsOf(block)} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "shipping_goal": {
      if (!str(s.title) && !str(s.subtitle)) {
        return <Placeholder ar={ar} label={ar ? "شريط بلا نص" : "Bar with no wording yet"} />;
      }
      return <ShippingGoal block={block} ar={ar} accent={accent} />;
    }

    case "payment_plans": {
      const plans = itemsOf(block).filter((i) => str(i.name) || str(i.headline));
      if (!plans.length) return <Placeholder ar={ar} label={ar ? "لا طرق دفع بعد" : "No plans yet"} />;
      return (
        <PaymentPlans block={block} items={plans} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "price_slider": {
      const plans = itemsOf(block).filter((i) => str(i.name) && str(i.months));
      if (!plans.length) return <Placeholder ar={ar} label={ar ? "لا خطط تقسيط بعد" : "No instalment plans yet"} />;
      return <PriceSlider block={block} items={plans} ar={ar} accent={accent} />;
    }

    case "offer_cards": {
      const offers = itemsOf(block).filter((i) => str(i.badge) || str(i.title));
      if (!offers.length) return <Placeholder ar={ar} label={ar ? "لا عروض بعد" : "No offers yet"} />;
      return (
        <OfferCards block={block} items={offers} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "coming_up_live": {
      const upcoming = (data.lives ?? [])
        .filter((l) => l.status === "scheduled")
        .sort((a, b) => String(a.scheduledAt ?? "").localeCompare(String(b.scheduledAt ?? "")));
      const sessions = upcoming.map((l) => ({
        id: l.id,
        title: l.title,
        imageUrl: l.coverUrl ?? "",
        when: l.scheduledAt
          ? new Date(l.scheduledAt).toLocaleString(ar ? "ar-EG" : "en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        url: l.href,
      }));
      if (!sessions.length) {
        return <Placeholder ar={ar} label={ar ? "لا مواعيد بعد" : "Nothing scheduled yet"} />;
      }
      return (
        <ComingUpLive block={block} items={sessions} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "countdown_deals": {
      const deals = itemsOf(block).filter((i) => str(i.price) || str(i.imageUrl) || str(i.handle));
      if (!deals.length) return <Placeholder ar={ar} label={ar ? "لا صفقات بعد" : "No deals yet"} />;
      return (
        <CountdownDeals block={block} items={deals} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "info_rows": {
      const rows = itemsOf(block).filter((i) => str(i.title));
      if (!rows.length) return <Placeholder ar={ar} label={ar ? "لا أسطر بعد" : "No rows yet"} />;
      return <InfoRows block={block} items={rows} data={data} ar={ar} accent={accent} handlers={handlers} />;
    }

    case "collection_tabs": {
      const tabs = itemsOf(block).filter((t) => str(t.handle));
      if (!tabs.length) return <Placeholder ar={ar} label={ar ? "لا توجد تبويبات" : "No tabs yet"} />;
      return (
        <Tabs
          title={str(s.title)}
          tabs={tabs}
          limit={int(s.limit, 8)}
          align={str(s.align, "left")}
          stretchTabs={s.stretchTabs === true}
          showLink={s.showLink !== false}
          imageShape={str(s.imageShape, "square")}
          imageFit={str(s.imageFit, "cover")}
          fade={s.fade === true}
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
          <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
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

    case "sale_seal":
      if (!str(s.bigText) && !str(s.tagline) && !str(s.imageUrl)) {
        return <Placeholder ar={ar} label={ar ? "بانر بلا محتوى" : "Banner with nothing in it yet"} />;
      }
      return <SaleSeal block={block} data={data} ar={ar} accent={accent} handlers={handlers} />;

    case "free_shipping":
      if (!str(s.title) && !str(s.subtitle)) {
        return <Placeholder ar={ar} label={ar ? "بانر بلا نص" : "Banner with no wording yet"} />;
      }
      return <FreeShipping block={block} data={data} ar={ar} accent={accent} handlers={handlers} />;

    case "moments": {
      const moments = itemsOf(block).filter((i) => str(i.imageUrl) || str(i.label));
      if (!moments.length) return <Placeholder ar={ar} label={ar ? "لا صور بعد" : "No pictures yet"} />;
      // The website's footwear edit: tall pictures with one word on each. The
      // word sits on the picture rather than under it, so the row reads as a
      // set of moments instead of a list of categories.
      const w = int(s.cardWidth, 150);
      const h = int(s.cardHeight, 210);
      const shape = int(s.radius, 14);
      const word = str(s.labelColor, "#ffffff");
      /**
       * How many fit across before anyone has to scroll.
       *
       * A row that scrolls hides whatever is past the edge, and what is past
       * the edge on a phone is most of it. Asking for a number instead of a
       * width lets the screen decide the width: the cards divide what there
       * is, keep their proportions, and the whole edit is visible at once.
       * Zero goes back to a scrolling row at the pixel size set below.
       */
      const across = int(s.perRow, 5);
      const grid = across >= 2;
      // The shape the merchant chose, kept as a ratio once the width is the
      // screen's to decide.
      const ratio = w > 0 && h > 0 ? w / h : 5 / 7;
      // Five across leaves about sixty pixels a card; a word set at thirteen
      // would not fit in it.
      const tight = across >= 5;
      return (
        <section>
          {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
          {str(s.subtitle) && (
            <p dir="auto" className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
              {str(s.subtitle)}
            </p>
          )}
          <div
            className={
              grid
                ? "mt-2 grid"
                : "-mx-4 mt-2 flex overflow-x-auto px-4 pb-1"
            }
            style={{
              gap: "calc(var(--app-item-gap, 8px) * 0.67)",
              ...(grid ? { gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` } : null),
            }}
          >
            {moments.map((m) => (
              <button
                key={m.id}
                onClick={() => opener(data, handlers)(m)}
                className={`relative overflow-hidden text-start ${grid ? "w-full" : "shrink-0"}`}
                style={
                  grid
                    ? { aspectRatio: String(ratio), borderRadius: shape }
                    : { width: w, height: h, borderRadius: shape }
                }
              >
                {str(m.imageUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={str(m.imageUrl)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ objectPosition: str(m.focal) || "50% 30%" }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-slate-200" />
                )}
                {/* The shade the word sits on. Half the card was right at two
                    hundred pixels tall and is a slab at ninety, so it shrinks
                    with the card and leans darker where the word actually is. */}
                <div
                  aria-hidden
                  className={`absolute inset-x-0 bottom-0 ${tight ? "h-[42%]" : "h-1/2"}`}
                  style={{
                    background: tight
                      ? "linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.26) 55%, rgba(0,0,0,0) 100%)"
                      : "linear-gradient(to top, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0) 100%)",
                  }}
                />
                {str(m.label) && (
                  <span
                    dir="auto"
                    className={`absolute truncate font-semibold ${
                      tight ? "bottom-1.5 start-1.5 end-1.5 text-[9px]" : "bottom-2.5 start-3 end-3 text-[13px]"
                    }`}
                    style={{ color: word }}
                  >
                    {str(m.label)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      );
    }

    case "tiers": {
      const tiers = itemsOf(block);
      if (!tiers.length) return <Placeholder ar={ar} label={ar ? "لا توجد فئات" : "No tiers yet"} />;
      // The website prices things in a serif and labels them in small caps.
      // A price set in the same bold sans as everything else reads as a number
      // in a form, which is the opposite of what a price tier is selling.
      const cardBg = str(s.cardBg) || "#fffaf3";
      const line = str(s.lineColor) || "#e7d8c4";
      const ink = str(s.inkColor) || "#2b1b10";
      const muted = str(s.mutedColor) || "#8a6e57";
      return (
        <section>
          <Heading title={str(s.title)} ar={ar} accent={accent} />
          <div className="mt-2 grid grid-cols-2" style={{ gap: "calc(var(--app-item-gap, 8px) * 0.67)" }}>
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => str(t.handle) && handlers.onOpenCollection?.(str(t.handle), str(t.label))}
                className="rounded-2xl border p-3.5 text-start"
                style={{ background: cardBg, borderColor: line }}
              >
                {str(t.prefix) && (
                  <div
                    dir="auto"
                    className="text-[9px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: muted }}
                  >
                    {str(t.prefix)}
                  </div>
                )}
                <div
                  dir="auto"
                  className="app-display mt-1 text-[19px] font-bold leading-none"
                  style={{ color: ink }}
                >
                  {str(t.amount)}
                </div>
                <div className="mt-2 h-px w-6" style={{ background: accent }} />
                <div dir="auto" className="mt-2 truncate text-[11px]" style={{ color: muted }}>
                  {str(t.label)}
                </div>
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
          <div className="mt-2 grid grid-cols-2" style={{ gap: "calc(var(--app-item-gap, 8px) * 0.67)" }}>
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
        <div className="-mx-4 flex overflow-x-auto px-4" style={{ gap: "calc(var(--app-item-gap, 8px) * 0.67)" }}>
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
          <RowHead
            title={str(s.ratingLabel) || str(s.title, ar ? "آراء العملاء" : "What customers say")}
            subtitle={str(s.subtitle)}
            seeAll={str(s.seeAllLabel)}
            onSeeAll={() => opener(data, handlers)(s, "seeAll")}
            accent={accent}
          />
          <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
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
          {heading && <h3 className="text-[16px] font-bold tracking-tight text-slate-900">{heading}</h3>}
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
  every = 5,
}: {
  slides: Item[];
  accent: string;
  data: HomeData;
  onOpen?: (handle: string, title: string) => void;
  /** Seconds each slide is held before the next one. Zero stands still. */
  every?: number;
}) {
  const [at, setAt] = useState(0);

  /**
   * The slides move on by themselves.
   *
   * A second slide nobody scrolls to is a second slide nobody sees, and the
   * dots underneath are too small to read as an invitation. It stops the
   * moment a shopper picks a dot herself - the timer restarts from her
   * choice rather than yanking the carousel out from under her - and it does
   * not run at all for a single slide or for anyone who has asked their
   * phone to stop animating things.
   */
  useEffect(() => {
    if (every <= 0 || slides.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const t = setInterval(() => setAt((i) => (i + 1) % slides.length), every * 1000);
    return () => clearInterval(t);
  }, [every, slides.length, at]);
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
  tabs,
  limit,
  align,
  stretchTabs,
  showLink,
  imageShape,
  imageFit,
  fade,
  data,
  ar,
  accent,
  handlers,
}: {
  title: string;
  tabs: Item[];
  limit: number;
  /** Where the kicker and heading sit: left, centre or right. */
  align: string;
  /** Pills share the width equally instead of sitting at their own size. */
  stretchTabs: boolean;
  /** The link to the whole collection, beside the heading. */
  showLink: boolean;
  /** The shape of a product's picture: wide, square or tall. */
  imageShape: string;
  /** "cover" crops to fill the shape, "contain" fits the whole thing in. */
  imageFit: string;
  /** Cards arrive rather than appear. */
  fade: boolean;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const [at, setAt] = useState(0);
  const active = tabs[Math.min(at, tabs.length - 1)];
  const handle = str(active.handle);
  const products = (data.rows[handle] ?? []).slice(0, limit);

  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-end" : "text-start";

  return (
    <section className={alignClass}>
      <Heading
        title={title}
        onSeeAll={
          showLink
            ? () => handlers.onOpenCollection?.(handle, str(active.label))
            : undefined
        }
        ar={ar}
        accent={accent}
      />
      <div
        className={`-mx-4 mt-2 flex px-4 pb-1 ${
          stretchTabs ? "" : "overflow-x-auto"
        }`}
        style={{ gap: "calc(var(--app-item-gap, 8px) * 0.5)" }}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setAt(i)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
              stretchTabs ? "min-w-0 flex-1 truncate" : "shrink-0"
            }`}
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
        <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1 text-start" style={{ gap: "var(--app-item-gap, 8px)" }}>
          {products.map((p, i) => (
            <Tile
              key={p.id}
              card={p}
              ar={ar}
              accent={accent}
              wide
              shape={imageShape}
              fit={imageFit}
              // Each card a little after the one before it, so the row
              // arrives as a row rather than all at once.
              fadeAfter={fade ? i * 70 : undefined}
              {...tileProps(handlers, p.id)}
            />
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
/** mm:ss, counting down. Stops at zero rather than going negative. */
function useCountdown(minutes: number): string {
  const total = Math.max(0, Math.trunc(minutes * 60));
  const [left, setLeft] = useState(total);
  // Restart whenever the merchant changes the length, so the editor shows the
  // new duration immediately instead of finishing the old one first.
  useEffect(() => setLeft(total), [total]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  return String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
}

/**
 * Who is live now, and the offer that belongs to this shopper alone.
 *
 * One block rather than two because it reads as one thing on the screen: the
 * row draws people in, the offer underneath is what it draws them into. A
 * merchant who wants only the row turns the offer off, and vice versa.
 */
/**
 * A recording, played where it was tapped.
 *
 * Three kinds of link arrive here and all three have to work, because a
 * merchant pastes whatever their recording lives behind: a file the browser
 * can play, a YouTube or Vimeo page, or something else entirely. The first
 * two play in place; the third opens where it lives, which is better than a
 * black rectangle and an apology.
 */
function playerFor(url: string): { kind: "video" | "embed" | "away"; src: string } {
  const clean = url.trim();
  if (/\.(mp4|webm|ogg|m3u8|mov)(\?|$)/i.test(clean)) return { kind: "video", src: clean };
  const yt = clean.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return { kind: "embed", src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0` };
  const vi = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vi) return { kind: "embed", src: `https://player.vimeo.com/video/${vi[1]}?autoplay=1` };
  return { kind: "away", src: clean };
}

function ReplayPlayer({
  url,
  title,
  ar,
  onClose,
}: {
  url: string;
  title: string;
  ar: boolean;
  onClose: () => void;
}) {
  const player = playerFor(url);
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/70" onClick={onClose}>
      <div
        className="relative w-full overflow-hidden rounded-t-2xl bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">{title}</span>
          <button
            onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-white"
          >
            ✕
          </button>
        </div>
        {player.kind === "video" ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={player.src} controls autoPlay playsInline className="block aspect-[9/16] w-full bg-black" />
        ) : player.kind === "embed" ? (
          <iframe
            src={player.src}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="block aspect-video w-full border-0 bg-black"
          />
        ) : (
          <div className="p-5 text-center">
            <p className="text-[12px] leading-relaxed text-white/80">
              {ar
                ? "هذا التسجيل محفوظ خارج التطبيق."
                : "This recording lives outside the app."}
            </p>
            <a
              href={player.src}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-[12px] font-bold text-slate-900"
            >
              {ar ? "مشاهدة" : "Watch it"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveNow({
  block,
  people,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  people: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const title = str(s.title);
  const liveLabel = str(s.liveLabel, ar ? "مباشر" : "LIVE");
  const replayBadge = str(s.replayBadge, ar ? "مسجّل" : "Replay");
  // The recording a shopper asked to watch, if any.
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);
  const showReplays = s.showReplays !== false;
  const replaysLabel = str(s.replaysLabel, ar ? "المسجّلة" : "Replays");
  const offerOn = s.offerEnabled !== false;
  const offerTitle = personalise(str(s.offerTitle), data.shopperName);
  const offerText = str(s.offerText);
  const timer = useCountdown(int(s.offerMinutes, 10));

  // An empty colour means "follow the brand", so a store that changes its
  // accent takes this section with it instead of stranding a hex that somebody
  // typed once and forgot.
  const ringColor = str(s.ringColor, accent);
  const badgeBg = str(s.badgeBg, "#e11d48");
  const badgeFg = str(s.badgeTextColor, "#ffffff");
  const offerBg = str(s.offerBg, accent);
  const offerFg = str(s.offerTextColor, "#ffffff");
  const timerBg = str(s.timerBg, "rgba(255,255,255,0.22)");
  const timerFg = str(s.timerTextColor, "#ffffff");

  const size = int(s.avatarSize, 64);
  // Zero is a real answer here — it means no ring at all — so this one cannot
  // go through int(), which treats zero as "unset".
  const rawRing = Number(s.ringWidth);
  const ringW = Number.isFinite(rawRing) && rawRing >= 0 ? rawRing : 2;
  const shape = str(s.avatarShape, "circle");
  const photoRadius = shape === "square" ? 4 : shape === "rounded" ? Math.round(size * 0.28) : 9999;
  const nameSize = int(s.nameSize, 10);
  const viewersSize = int(s.viewersSize, 9);
  const bannerRadius = int(s.bannerRadius, 16);
  // The gap above the banner and the banner's own height. Zero is a real
  // answer for both - "right under the circles", and "however tall its
  // wording makes it" - so neither can go through int(), which reads zero
  // as unset.
  const offerGap = px(s.offerGap, 12);
  const offerHeight = px(s.offerHeight, 0);
  const offerTitleSize = int(s.offerTitleSize, 13);
  const offerTextSize = int(s.offerTextSize, 11);
  const cell = Math.max(size + 12, 56);

  const go = opener(data, handlers);

  return (
    <section>
      {title && <Heading title={title} ar={ar} accent={accent} />}

      {people.length > 0 && (
        // No heading above it means no gap above it either: the row was
        // leaving room for a title this section does not have.
        <div
          className={`-mx-4 flex overflow-x-auto px-4 pb-0.5 ${title ? "mt-1.5" : "mt-0"}`}
          style={{ gap: "var(--app-item-gap, 8px)" }}
        >
          {people.map((person) => {
            const borrowed = inherit(person, data);
            const name = str(person.name, borrowed.title);
            const viewers = str(person.viewers);
            const onAir = person.onAir !== false;
            const video = str(person.videoUrl);
            return (
              <button
                key={person.id}
                onClick={() =>
                  video ? setPlaying({ url: video, title: name || replayBadge }) : go(person)
                }
                className="flex shrink-0 flex-col items-center"
                style={{ width: cell }}
              >
                <span className="relative block">
                  <span
                    className="block"
                    style={{
                      background: ringW > 0 ? ringColor : "transparent",
                      padding: ringW,
                      borderRadius: photoRadius + ringW,
                    }}
                  >
                    <Thumb
                      src={borrowed.image}
                      className="border-2 border-white"
                      style={{ width: size, height: size, borderRadius: photoRadius }}
                    />
                  </span>
                  {/* Red for what is happening now; quiet for what already
                      happened. A shopper should be able to tell from the
                      colour alone which one is worth interrupting herself for. */}
                  {(onAir ? liveLabel : replayBadge) && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-px text-[8px] font-bold uppercase tracking-wide"
                      style={{
                        background: onAir ? badgeBg : "#2b1b10",
                        color: badgeFg,
                        borderRadius: 4,
                        bottom: -6,
                      }}
                    >
                      {onAir ? liveLabel : replayBadge}
                    </span>
                  )}
                  {/* A recording says so before it is tapped. */}
                  {!onAir && video && (
                    <span
                      aria-hidden
                      className="absolute inset-0 grid place-items-center"
                      style={{ borderRadius: photoRadius }}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-black/45 text-[10px] text-white">
                        ▶
                      </span>
                    </span>
                  )}
                </span>
                {name && (
                  <span
                    className="mt-1.5 w-full truncate text-center font-semibold leading-tight text-slate-800"
                    style={{ fontSize: nameSize }}
                  >
                    {name}
                  </span>
                )}
                {viewers && (
                  <span
                    className="w-full truncate text-center text-slate-500"
                    style={{ fontSize: viewersSize }}
                  >
                    {viewers}
                  </span>
                )}
              </button>
            );
          })}

          {showReplays && (
            <button
              onClick={() => go(s, "replays")}
              className="flex shrink-0 flex-col items-center"
              style={{ width: cell }}
            >
              <span
                className="flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-slate-400"
                style={{ width: size, height: size, borderRadius: photoRadius, fontSize: Math.round(size / 3.5) }}
              >
                ▶
              </span>
              <span
                className="mt-2 w-full truncate text-center font-semibold text-slate-500"
                style={{ fontSize: nameSize }}
              >
                {replaysLabel}
              </span>
            </button>
          )}
        </div>
      )}

      {playing && (
        <ReplayPlayer
          url={playing.url}
          title={playing.title}
          ar={ar}
          onClose={() => setPlaying(null)}
        />
      )}

      {offerOn && (offerTitle || offerText) && (
        <button
          onClick={() => go(s, "offer")}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-start"
          style={{
            background: offerBg,
            borderRadius: bannerRadius,
            marginTop: offerGap,
            minHeight: offerHeight || undefined,
          }}
        >
          <span className="min-w-0 flex-1">
            {offerTitle && (
              <span
                className="block truncate font-bold leading-tight"
                style={{ color: offerFg, fontSize: offerTitleSize }}
              >
                {offerTitle}
              </span>
            )}
            {offerText && (
              <span
                className="block truncate leading-tight"
                style={{ color: offerFg, opacity: 0.85, fontSize: offerTextSize }}
              >
                {offerText}
              </span>
            )}
          </span>
          <span
            className="shrink-0 px-2 py-1 font-mono font-bold leading-tight tabular-nums"
            style={{ background: timerBg, color: timerFg, borderRadius: Math.min(bannerRadius, 10), fontSize: offerTitleSize }}
          >
            {timer}
          </span>
        </button>
      )}
    </section>
  );
}

/**
 * Where a tap goes.
 *
 * A link is four optional fields sitting on a section's settings or on one of
 * its items, and they are read in order of how specific they are: a typed web
 * address, then a product, then a place in the app, then a collection. One
 * rule, so every section in the editor offers the same choices and every tap
 * behaves the same way.
 *
 * `prefix` is for the second link a section sometimes has — a "see all" beside
 * its title reads seeAllUrl, seeAllProductId and so on.
 */
function opener(data: HomeData, handlers: HomeHandlers) {
  return (from: Record<string, unknown>, prefix?: string) => {
    const key = (name: string) =>
      prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;
    const url = str(from[key("url")]);
    if (url) {
      if (typeof window === "undefined") return;
      // Somewhere in this shop is a navigation; a popup can be blocked and
      // then the tap has simply done nothing.
      if (url.startsWith("/")) window.location.assign(url);
      else window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const productId = str(from[key("productId")]);
    if (productId) return handlers.onOpenProduct?.(productId);
    const screen = str(from[key("screen")]);
    if (screen) return handlers.onOpenScreen?.(screen);
    const handle = str(from[key("handle")]);
    if (!handle) return;
    // A collection that has since been renamed still opens, headed by its
    // handle, rather than the tap doing nothing at all.
    const target = data.collections.find((c) => c.handle === handle);
    handlers.onOpenCollection?.(handle, target?.title ?? handle);
  };
}

/** hh:mm:ss, counting down, as parts so each can sit in its own box. */
function useCountdownParts(minutes: number): [string, string, string] {
  const total = Math.max(0, Math.trunc(minutes * 60));
  const [left, setLeft] = useState(total);
  useEffect(() => setLeft(total), [total]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const two = (n: number) => String(n).padStart(2, "0");
  return [two(Math.floor(left / 3600)), two(Math.floor((left % 3600) / 60)), two(left % 60)];
}

/** The sessions coming up, each with a reminder. */
function ComingUpLive({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 16);
  const cardBg = str(s.cardBg, "#ffffff");
  const remind = str(s.remindLabel, ar ? "ذكّريني" : "Remind me");
  const reminded = str(s.remindedLabel, ar ? "تم التذكير" : "Reminder set");

  // "Remind me" sets a reminder - it does not leave the screen. The session
  // itself (its picture and name) is what opens the collection.
  const [set, setSet] = useState<string[]>([]);
  useEffect(() => {
    try {
      setSet(JSON.parse(localStorage.getItem("app_live_reminders") || "[]"));
    } catch {
      /* private browsing */
    }
  }, []);
  const toggle = (id: string) =>
    setSet((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem("app_live_reminders", JSON.stringify(next));
      } catch {
        /* private browsing */
      }
      return next;
    });

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      <div
        className="mt-2 flex flex-col border border-slate-200 p-3"
        style={{ background: cardBg, borderRadius: radius, gap: "var(--app-item-gap, 8px)" }}
      >
        {items.map((item) => {
          const borrowed = inherit(item, data);
          return (
            <div key={item.id} className="flex items-center gap-3">
              <button onClick={() => go(item)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                <Thumb src={borrowed.image} className="h-12 w-12 shrink-0" style={{ borderRadius: 10 }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-slate-900">
                    {str(item.title, borrowed.title)}
                  </span>
                  {str(item.when) && (
                    <span className="block truncate text-[11px] text-slate-500">{str(item.when)}</span>
                  )}
                </span>
              </button>
              {remind && (
                <button
                  onClick={() => toggle(item.id)}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition"
                  style={
                    set.includes(item.id)
                      ? { background: "#ffffff", borderColor: accent, color: accent }
                      : { background: accent, borderColor: accent, color: "#ffffff" }
                  }
                >
                  {set.includes(item.id) ? `✓ ${reminded}` : remind}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Offers on a clock, each showing how much of it has already gone. */
function CountdownDeals({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const parts = useCountdownParts(int(s.endsInMinutes, 135));
  const units = ar ? ["س", "د", "ث"] : ["H", "M", "S"];
  const radius = int(s.radius, 14);
  const badgeBg = str(s.badgeBg, accent);
  const showTimer = s.showTimer !== false;
  const showClaimed = s.showClaimed !== false;
  // A row where every card is the same size has no first among equals. Letting
  // one lead gives the eye somewhere to start.
  const featureFirst = s.featureFirst === true;

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[16px] font-bold tracking-tight text-slate-900">{str(s.title)}</h3>
        {showTimer && (
          // hh:mm:ss on its own is a row of numbers you have to decode. The
          // units under each box say what they are, and the live dot says the
          // clock is actually moving rather than a picture of a time.
          <span
            dir="ltr"
            className="flex shrink-0 items-center gap-1 rounded-full py-1 pe-2 ps-1.5"
            style={{ background: `${accent}14` }}
          >
            <span className="relative me-0.5 flex h-1.5 w-1.5 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: accent }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            </span>
            {parts.map((part, i) => (
              <span key={i} className="flex items-center">
                {i > 0 && (
                  <span
                    className="px-[3px] pb-1 text-[11px] font-bold leading-none opacity-40"
                    style={{ color: accent }}
                  >
                    :
                  </span>
                )}
                <span
                  className="flex flex-col items-center rounded-md px-1.5 py-1 leading-none text-white shadow-sm"
                  style={{ background: accent }}
                >
                  <span className="font-mono text-[12px] font-bold tabular-nums">{part}</span>
                  <span className="mt-[2px] text-[7px] font-semibold uppercase tracking-wide opacity-75">
                    {units[i]}
                  </span>
                </span>
              </span>
            ))}
          </span>
        )}
      </div>

      <div
        className="-mx-4 mt-2 flex items-stretch overflow-x-auto px-4 pb-1"
        style={{ gap: "var(--app-item-gap, 8px)" }}
      >
        {items.map((item, i) => {
          const lead = featureFirst && i === 0;
          const borrowed = inherit(item, data);
          const claimed = str(item.claimed);
          const pct = Math.max(0, Math.min(100, parseInt(claimed, 10) || 0));
          return (
            <button
              key={item.id}
              onClick={() => go(item)}
              className="flex shrink-0 flex-col overflow-hidden border border-slate-200 bg-white text-start"
              style={{ borderRadius: radius, width: lead ? 224 : 158 }}
            >
              {/* The picture takes whatever height the row settles on, so the
                  prices line up across it and a featured card leads by being
                  wider rather than by leaving a step behind it. */}
              <span className="relative block flex-1">
                <Thumb
                  src={borrowed.image}
                  className="h-full w-full"
                  style={{ borderRadius: 0, minHeight: lead ? 168 : 120 }}
                  blend
                />
                {str(item.badge) && (
                  <span
                    className="absolute start-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: badgeBg }}
                  >
                    {str(item.badge)}
                  </span>
                )}
              </span>
              <span className="block p-2">
                <span className="flex items-baseline gap-1">
                  <span className="text-[13px] font-bold" style={{ color: accent }}>
                    {str(item.price)}
                  </span>
                  {str(item.comparePrice) && (
                    <span className="text-[10px] text-slate-400 line-through">
                      {str(item.comparePrice)}
                    </span>
                  )}
                </span>
                {showClaimed && claimed && (
                  <span className="mt-1.5 block">
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, background: accent }}
                      />
                    </span>
                    <span className="mt-1 block text-[9px] text-slate-500">{claimed}</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Delivery, returns, ways to pay — an icon, two lines, a note on the end. */
function InfoRows({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 14);
  const cardBg = str(s.cardBg, "#ffffff");

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      <div className="mt-2 flex flex-col" style={{ gap: "calc(var(--app-item-gap, 8px) * 0.67)" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item)}
            className="flex w-full items-center gap-3 border border-slate-200 px-3 py-2.5 text-start"
            style={{ background: cardBg, borderRadius: radius }}
          >
            {str(item.emoji) && (
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base"
                style={{ background: `${accent}1f` }}
              >
                {str(item.emoji)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-slate-900">
                {str(item.title)}
              </span>
              {str(item.subtitle) && (
                <span className="block truncate text-[11px] text-slate-500">{str(item.subtitle)}</span>
              )}
            </span>
            {str(item.note) && (
              <span className="shrink-0 text-[11px] font-semibold" style={{ color: accent }}>
                {str(item.note)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

const nf = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

/** How far the basket is from free delivery. */
function ShippingGoal({ block, ar, accent }: { block: Block; ar: boolean; accent: string }) {
  const s = block.settings ?? {};
  const pct = Math.max(0, Math.min(100, int(s.percent, 100)));
  const radius = int(s.radius, 14);
  return (
    <section
      className="border border-slate-200 p-3"
      style={{ background: str(s.cardBg, "#ffffff"), borderRadius: radius }}
    >
      {str(s.title) && (
        <div className="text-[12px] font-bold text-slate-900">{str(s.title)}</div>
      )}
      {str(s.subtitle) && (
        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{str(s.subtitle)}</div>
      )}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: str(s.barColor, accent) }}
        />
      </div>
      {(str(s.startLabel) || str(s.endLabel)) && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>{str(s.startLabel)}</span>
          <span>{str(s.endLabel)}</span>
        </div>
      )}
    </section>
  );
}

/** Instalment and bank offers, each card in its own colour. */
function PaymentPlans({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 14);
  return (
    <section>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          {str(s.title) && (
            <h3 className="truncate text-[16px] font-bold tracking-tight text-slate-900">{str(s.title)}</h3>
          )}
          {str(s.subtitle) && (
            <p className="truncate text-[11px] text-slate-500">{str(s.subtitle)}</p>
          )}
        </div>
        {str(s.seeAllLabel) && (
          <button
            onClick={() => go(s, "seeAll")}
            className="shrink-0 text-xs font-semibold"
            style={{ color: accent }}
          >
            {str(s.seeAllLabel)} ›
          </button>
        )}
      </div>
      <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item)}
            className="w-[152px] shrink-0 p-3 text-start"
            style={{ background: str(item.color, accent), borderRadius: radius }}
          >
            {str(item.name) && (
              <span className="block text-[11px] font-semibold text-white/80">{str(item.name)}</span>
            )}
            {str(item.headline) && (
              <span className="mt-1 block text-[15px] font-bold leading-tight text-white">
                {str(item.headline)}
              </span>
            )}
            {str(item.note) && (
              <span className="mt-1 block text-[10px] leading-snug text-white/75">
                {str(item.note)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Move the slider, see what each provider charges a month. */
/**
 * A plan's perks, one chip each.
 *
 * Triple Zero is three promises - no interest, no down payment, no fees -
 * and a single badge can only carry one of them, so they are written on one
 * line and split on a middle dot, a comma or a bar.
 */
const perksOf = (item: Item): string[] =>
  str(item.perks)
    .split(/[·,|]/)
    .map((p) => p.trim())
    .filter(Boolean);

function PriceSlider({ block, items, ar, accent }: { block: Block; items: Item[]; ar: boolean; accent: string }) {
  const s = block.settings ?? {};
  const min = int(s.minPrice, 2999);
  const max = Math.max(min + 1, int(s.maxPrice, 16000));
  const [price, setPrice] = useState(Math.min(max, Math.max(min, int(s.startPrice, 7750))));
  // Follow the merchant while they are typing the range, or the handle sits
  // outside the track they just set.
  useEffect(() => {
    setPrice((p) => Math.min(max, Math.max(min, p)));
  }, [min, max]);
  const cur = str(s.currency, "EGP");
  const radius = int(s.radius, 14);

  /**
   * Which plan is being read, and the rest as marks under it.
   *
   * Three providers written out in full is three of everything - three
   * monthly figures, three terms, three sets of perks - and a shopper
   * comparing them has to hold two in her head while she reads the third.
   * One at a time, with the others as their own logos underneath, is the
   * same information in a third of the height and asks nothing of her
   * memory: tap a mark and it takes the place of the one above.
   */
  const [pick, setPick] = useState(0);
  const at = Math.min(pick, Math.max(0, items.length - 1));
  const lead = items[at];
  const rest = items.filter((_, i) => i !== at);

  /** What this plan costs a month at the price on the slider. */
  const perMonth = (item: Item) =>
    Math.round(price / Math.max(1, parseInt(str(item.months), 10) || 1));

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      {str(s.subtitle) && <p className="text-[11px] text-slate-500">{str(s.subtitle)}</p>}
      <div
        className="mt-2 border border-slate-200 p-2.5"
        style={{ background: str(s.cardBg, "#ffffff"), borderRadius: radius }}
      >
        {str(s.priceLabel) && (
          <div className="text-[11px] text-slate-500">{str(s.priceLabel)}</div>
        )}
        <div className="text-[20px] font-bold" style={{ color: accent }}>
          {cur} {nf(price)}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="mt-2 w-full"
          style={{ accentColor: accent }}
        />
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{cur} {nf(min)}</span>
          <span>{cur} {nf(max)}</span>
        </div>

        <div className="mt-2.5 flex flex-col" style={{ gap: "calc(var(--app-item-gap, 8px) * 0.67)" }}>
          {[lead].filter(Boolean).map((item) => {
            const months = Math.max(1, parseInt(str(item.months), 10) || 1);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
              >
                {/* The provider's own mark when there is one, its name until then. */}
                <span className="grid h-9 w-14 shrink-0 place-items-center">
                  {str(item.logo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={str(item.logo)}
                      alt={str(item.name)}
                      className="max-h-9 max-w-full object-contain"
                    />
                  ) : (
                    <span className="w-full truncate text-[11px] font-semibold text-slate-700">
                      {str(item.name)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold" style={{ color: accent }}>
                    {cur} {nf(Math.round(price / months))}
                    <span className="text-[10px] font-medium text-slate-500"> / {ar ? "شهر" : "month"}</span>
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {months} {ar ? "شهور" : "months"}
                  </span>
                  {perksOf(item).length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {perksOf(item).map((perk) => (
                        <span
                          key={perk}
                          dir="auto"
                          className="rounded-full px-1.5 py-px text-[9px] font-semibold"
                          style={{
                            background: `${str(item.color, accent)}14`,
                            color: str(item.color, accent),
                          }}
                        >
                          {perk}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                {str(item.badge) && (
                  <span
                    dir="auto"
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                    style={{
                      background: `${str(item.color, accent)}1f`,
                      color: str(item.color, accent),
                    }}
                  >
                    {str(item.badge)}
                  </span>
                )}
              </div>
            );
          })}

          {/* The others, as their own marks. Four to a row, which is as many
              as a phone can hold without the logos going illegible. */}
          {rest.length > 0 && (
            <div
              className="grid gap-1.5"
              style={{
                // Four to a row is the ceiling, not the target: two marks laid
                // out in four columns sit in the left half of the card looking
                // like two more are missing.
                gridTemplateColumns: `repeat(${Math.min(4, rest.length)}, minmax(0, 1fr))`,
              }}
            >
              {rest.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPick(items.indexOf(item))}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1.5 transition hover:border-slate-300 active:scale-[0.98]"
                  aria-label={str(item.name)}
                >
                  <span className="grid h-4 w-full place-items-center">
                    {str(item.logo) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={str(item.logo)}
                        alt={str(item.name)}
                        className="max-h-4 max-w-full object-contain"
                      />
                    ) : (
                      <span className="w-full truncate text-center text-[9px] font-bold text-slate-700">
                        {str(item.name)}
                      </span>
                    )}
                  </span>
                  <span className="block w-full truncate text-center text-[9px] font-semibold tabular-nums text-slate-500">
                    {nf(perMonth(item))}
                    <span className="font-medium">/{ar ? "ش" : "mo"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Offers the shopper can claim. */
function OfferCards({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 14);
  const claim = str(s.claimLabel, ar ? "احصلي عليه" : "Claim");
  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      {str(s.subtitle) && <p className="text-[11px] text-slate-500">{str(s.subtitle)}</p>}
      <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
        {items.map((item) => {
          const colour = str(item.color, accent);
          return (
            <div
              key={item.id}
              className="flex w-[152px] shrink-0 flex-col gap-1 border border-dashed p-3"
              style={{ borderColor: colour, background: `${colour}0f`, borderRadius: radius }}
            >
              {str(item.badge) && (
                <span className="text-[20px] font-bold leading-none" style={{ color: colour }}>
                  {str(item.badge)}
                </span>
              )}
              {str(item.title) && (
                <span className="text-[11px] font-bold text-slate-900">{str(item.title)}</span>
              )}
              {str(item.subtitle) && (
                <span className="text-[10px] leading-snug text-slate-500">{str(item.subtitle)}</span>
              )}
              {claim && (
                <button
                  onClick={() => go(item)}
                  className="mt-1 rounded-lg py-1.5 text-[11px] font-semibold text-white"
                  style={{ background: colour }}
                >
                  {claim}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A heading with an optional "see all" on the end. */
function RowHead({
  title,
  subtitle,
  seeAll,
  onSeeAll,
  accent,
  titleSize = 16,
  linkColor,
}: {
  title: string;
  subtitle: string;
  seeAll: string;
  onSeeAll: () => void;
  accent: string;
  /** Heading size in pixels. The link grows with it past the default. */
  titleSize?: number;
  /** The see-all link's colour. Empty follows the brand. */
  linkColor?: string;
}) {
  if (!title && !subtitle && !seeAll) return null;
  const linkSize = titleSize <= 16 ? 12 : Math.round(titleSize * 0.82);
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        {title && (
          <h3
            dir="auto"
            className="truncate font-bold tracking-tight text-slate-900"
            style={{ fontSize: titleSize }}
          >
            {title}
          </h3>
        )}
        {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {seeAll && (
        <button
          onClick={onSeeAll}
          className="shrink-0 font-bold"
          style={{ color: linkColor || accent, fontSize: linkSize }}
        >
          {seeAll} ›
        </button>
      )}
    </div>
  );
}

/** Products with the reason each one is being shown. */
function ProductReasons({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 14);
  const button = str(s.buttonLabel);
  const featureFirst = s.featureFirst === true;

  return (
    <section>
      <RowHead
        title={str(s.title)}
        subtitle={str(s.subtitle)}
        seeAll={str(s.seeAllLabel)}
        onSeeAll={() => go(s, "seeAll")}
        accent={accent}
      />
      <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
        {items.map((item, i) => {
          const lead = featureFirst && i === 0;
          const borrowed = inherit(item, data);
          return (
            <div
              key={item.id}
              className="flex shrink-0 flex-col overflow-hidden border border-slate-200 bg-white"
              style={{ borderRadius: radius, width: lead ? 236 : 166 }}
            >
              <button onClick={() => go(item)} className="relative block">
                <Thumb
                  src={borrowed.image}
                  className="w-full"
                  style={{ borderRadius: 0, height: lead ? 196 : 136 }}
                />
                {str(item.badge) && (
                  <span
                    className="absolute end-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: accent }}
                  >
                    {str(item.badge)}
                  </span>
                )}
              </button>
              <div className="flex flex-1 flex-col p-2">
                {str(item.reason) && (
                  <div className="truncate text-[9px] font-semibold" style={{ color: accent }}>
                    ◆ {str(item.reason)}
                  </div>
                )}
                <div className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-900">
                  {str(item.name, borrowed.title)}
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[12px] font-bold" style={{ color: accent }}>
                    {str(item.price)}
                  </span>
                  {str(item.comparePrice) && (
                    <span className="text-[10px] text-slate-400 line-through">
                      {str(item.comparePrice)}
                    </span>
                  )}
                </div>
                {(str(item.rating) || str(item.sold)) && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-slate-500">
                    {str(item.rating) && <span>★ {str(item.rating)}</span>}
                    {str(item.sold) && <span>{str(item.sold)}</span>}
                  </div>
                )}
                {button && (
                  <button
                    onClick={() => go(item)}
                    className="mt-2 rounded-lg py-1.5 text-[11px] font-semibold text-white"
                    style={{ background: accent }}
                  >
                    {button}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Round pictures with a label — Buy it again, or Shop by department. */
function CircleRow({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const size = int(s.size, 76);
  const showLabel = s.showLabel !== false;
  const showNote = s.showNote !== false;
  // A circle, a rounded tile the way noon draws its categories, or a square.
  const shape = str(s.shape, "circle");
  const tileRadius = shape === "square" ? 0 : shape === "rounded" ? int(s.radius, 22) : 9999;
  const labelSize = int(s.labelSize, 10);
  const labelColor = str(s.labelColor);
  const labelBold = s.labelBold === true;
  const bg = str(s.bg);
  // The cell is the tile plus a little air, and wide enough for its label.
  const cell = Math.max(size + 14, 56);

  return (
    <section
      className={bg ? "-mx-4 px-4 py-3" : undefined}
      style={bg ? { background: bg } : undefined}
    >
      <RowHead
        title={str(s.title)}
        subtitle={str(s.subtitle)}
        seeAll={str(s.seeAllLabel)}
        onSeeAll={() => go(s, "seeAll")}
        accent={accent}
        titleSize={int(s.titleSize, 16)}
        linkColor={str(s.linkColor)}
      />
      <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
        {items.map((item) => {
          const borrowed = inherit(item, data);
          return (
            <button
              key={item.id}
              onClick={() => go(item)}
              className="flex shrink-0 flex-col items-center"
              style={{ width: cell }}
            >
              <Thumb
                src={borrowed.image}
                className={shape === "circle" ? "border border-slate-200" : ""}
                style={{ width: size, height: size, borderRadius: tileRadius }}
              />
              {showNote && str(item.note) && (
                <span className="mt-1.5 w-full truncate text-center text-[11px] font-bold" style={{ color: accent }}>
                  {str(item.note)}
                </span>
              )}
              {showLabel && (
                <span
                  className={`mt-1.5 w-full truncate text-center ${labelBold ? "font-semibold" : ""} ${
                    labelColor ? "" : "text-slate-500"
                  }`}
                  style={{ fontSize: labelSize, color: labelColor || undefined }}
                >
                  {str(item.label, borrowed.title)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Colour circles, each opening its own collection. */
/**
 * Shop by palette - the website's section, card for card.
 *
 * A cream panel with a centred heading, a row of tall cards (a styled photo,
 * a colour swatch sitting on its edge, the edit's name, two short lines and a
 * "Shop now"), and a pill underneath pointing at everything. The same items
 * as the swatch look, so switching between the two loses nothing.
 */
function PalettePanel({
  block,
  items,
  data,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const ink = str(s.inkColor, "#211a15");
  const muted = str(s.mutedColor, "#74685e");
  const caramel = str(s.accentColor, "#9d6540");
  const line = str(s.lineColor, "#e0d4c4");
  const radius = int(s.radius, 12);
  const imageHeight = int(s.imageHeight, 104);
  const cardWidth = int(s.cardWidth, 0);
  const swatch = int(s.swatchSize, 22);
  const link = str(s.linkLabel, "Shop now");
  const pill = str(s.pillText) || str(s.pillCta);

  return (
    <section
      className="-mx-4 px-2 py-5"
      style={{ background: str(s.bg, "#f6f0e8"), color: ink }}
    >
      <div className="px-2 text-center">
        {str(s.eyebrow) && (
          <div
            dir="auto"
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: caramel }}
          >
            {str(s.eyebrow)}
          </div>
        )}
        {str(s.title) && (
          <h3
            dir="auto"
            className="app-display mt-1.5 font-normal leading-tight"
            style={{ fontSize: int(s.titleSize, 28), color: ink, fontFamily: 'var(--font-display), "Playfair Display", Georgia, serif' }}
          >
            {str(s.title)}
          </h3>
        )}
        {str(s.subtitle) && (
          <p dir="auto" className="mx-auto mt-2 max-w-[300px] text-[12px] leading-relaxed" style={{ color: muted }}>
            {str(s.subtitle)}
          </p>
        )}
      </div>

      <div
        className={cardWidth ? "-mx-2 mt-4 flex overflow-x-auto px-2 pb-1" : "mt-4 grid"}
        style={
          cardWidth
            ? { gap: 6 }
            : { gap: 5, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }
        }
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item)}
            className="flex shrink-0 flex-col overflow-hidden border text-center shadow-[0_2px_8px_rgba(33,26,21,0.06)]"
            style={{
              width: cardWidth || undefined,
              borderRadius: radius,
              background: str(s.cardBg, "#fffdfa"),
              borderColor: line,
            }}
          >
            <div className="relative w-full" style={{ height: imageHeight }}>
              {str(item.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={str(item.imageUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full" style={{ background: str(item.color, line) }} />
              )}
            </div>
            <span
              className="relative mx-auto block rounded-full"
              style={{
                width: swatch,
                height: swatch,
                marginTop: -Math.round(swatch / 2),
                background: str(item.color, line),
                boxShadow: "0 0 0 2px #fffdfa, 0 2px 6px rgba(0,0,0,0.18)",
              }}
            />
            <span className="flex flex-1 flex-col items-center px-1 pb-2 pt-1.5">
              {str(item.label) && (
                <span
                  dir="auto"
                  className="text-[8.5px] uppercase leading-tight tracking-[0.08em]"
                  style={{ color: ink, fontFamily: 'var(--font-display), "Playfair Display", Georgia, serif' }}
                >
                  {str(item.label)}
                </span>
              )}
              {(str(item.line1) || str(item.line2)) && (
                <span dir="auto" className="mt-1 text-[7.5px] leading-snug" style={{ color: muted }}>
                  {str(item.line1)}
                  {str(item.line1) && str(item.line2) && <br />}
                  {str(item.line2)}
                </span>
              )}
              {link && (
                <span
                  dir="auto"
                  className="mt-auto pt-1.5 text-[7px] font-bold uppercase tracking-[0.08em] underline underline-offset-2"
                  style={{ color: ink }}
                >
                  {link}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {pill && (
        <button
          onClick={() => go(s, "pill")}
          className="mx-2 mt-5 flex w-[calc(100%-1rem)] flex-col items-center gap-1 rounded-full border px-4 py-2.5"
          style={{ background: str(s.pillBg, "#f1e7d9"), borderColor: line }}
        >
          {str(s.pillText) && (
            <span dir="auto" className="text-[11px]" style={{ color: muted }}>
              <span style={{ color: caramel }}>✦</span> {str(s.pillText)}
            </span>
          )}
          {str(s.pillCta) && (
            <span dir="auto" className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ink }}>
              {str(s.pillCta)} →
            </span>
          )}
        </button>
      )}
    </section>
  );
}

function PickColour({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const size = int(s.size, 44);

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      {str(s.subtitle) && <p className="text-[11px] text-slate-500">{str(s.subtitle)}</p>}
      <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item)}
            className="flex shrink-0 flex-col items-center gap-1"
            style={{ width: size + 16 }}
          >
            <span
              className="block border border-slate-200"
              style={{ width: size, height: size, borderRadius: 9999, background: str(item.color, "#e2e8f0") }}
            />
            {str(item.label) && (
              <span className="w-full truncate text-center text-[10px] text-slate-600">
                {str(item.label)}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Saved pieces that have come down in price. */
function PriceDrop({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 14);
  const button = str(s.buttonLabel);

  return (
    <section
      className="flex items-center gap-3 border border-slate-200 p-3"
      style={{ background: str(s.cardBg, "#ffffff"), borderRadius: radius }}
    >
      {items.length > 0 && (
        <span className="flex shrink-0 -space-x-2">
          {items.slice(0, 3).map((item) => (
            <Thumb
              key={item.id}
              src={inherit(item, data).image}
              className="border-2 border-white"
              style={{ width: 30, height: 30, borderRadius: 8 }}
            />
          ))}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {str(s.title) && (
          <span className="block truncate text-[12px] font-bold text-slate-900">{str(s.title)}</span>
        )}
        {str(s.subtitle) && (
          <span className="block truncate text-[11px] text-slate-500">{str(s.subtitle)}</span>
        )}
      </span>
      {button && (
        <button
          onClick={() => go(s)}
          className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
          style={{ background: accent }}
        >
          {button}
        </button>
      )}
    </section>
  );
}

/** Tags describing the shopper's taste, each opening what matches it. */
function StyleProfile({
  block,
  items,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 14);
  const cardTitle = personalise(str(s.cardTitle), data.shopperName);
  // The Society's own colours, so the card a shopper's taste lives on belongs
  // to the same world as her level and her signatures rather than looking
  // like a settings panel that wandered onto the home screen.
  const plain = str(s.style) === "plain";
  const deep = str(s.deepFrom) || "#2b2119";
  const deepTo = str(s.deepTo) || "#43301f";
  const gold = str(s.gold) || "#e0b877";
  const onDeep = str(s.onDeep) || "#f0e6d8";
  const onDeepSoft = str(s.onDeepSoft) || "#c9b79f";
  const glyph = str(s.glyph, "✦");
  const kicker = str(s.kicker, "Your society");
  const opens = Boolean(str(s.handle) || str(s.screen) || str(s.url) || str(s.productId));

  if (plain) {
    return (
      <section>
        {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
        {str(s.subtitle) && <p className="text-[11px] text-slate-500">{str(s.subtitle)}</p>}
        <div
          className="mt-2 border border-slate-200 p-3"
          style={{ background: str(s.cardBg, "#ffffff"), borderRadius: radius }}
        >
          {cardTitle && <div className="text-[12px] font-bold text-slate-900">{cardTitle}</div>}
          {str(s.cardSubtitle) && (
            <div className="text-[11px] text-slate-500">{str(s.cardSubtitle)}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {items.map((item) => {
              const colour = str(item.color);
              return (
                <button
                  key={item.id}
                  onClick={() => go(item)}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    borderColor: colour || "#e2e8f0",
                    color: colour || "#475569",
                    background: colour ? `${colour}0f` : "#ffffff",
                  }}
                >
                  {str(item.label)}
                </button>
              );
            })}
          </div>
          {str(s.footNote) && (
            <div className="mt-2 text-[11px] text-slate-500">{str(s.footNote)}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      {str(s.subtitle) && <p className="text-[11px] text-slate-500">{str(s.subtitle)}</p>}
      <div
        className="relative mt-2 overflow-hidden border p-4"
        style={{
          background: `linear-gradient(135deg, ${deep} 0%, ${deep} 45%, ${deepTo} 100%)`,
          borderColor: `${gold}3d`,
          borderRadius: radius,
        }}
      >
        {/* The same faint gold wash the Society card wears. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full blur-2xl"
          style={{ background: gold, opacity: 0.16 }}
        />

        <button
          onClick={() => opens && go(s)}
          className={`relative flex w-full items-start gap-2 text-start ${opens ? "" : "cursor-default"}`}
        >
          <span className="min-w-0 flex-1">
            {kicker && (
              <span
                dir="auto"
                className="block text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ color: gold }}
              >
                {glyph ? `${glyph} ` : ""}
                {kicker}
              </span>
            )}
            {cardTitle && (
              <span
                dir="auto"
                className="app-display mt-1 block text-[17px] font-bold leading-tight"
                style={{ color: onDeep }}
              >
                {cardTitle}
              </span>
            )}
            {str(s.cardSubtitle) && (
              <span dir="auto" className="mt-0.5 block text-[11px]" style={{ color: onDeepSoft }}>
                {str(s.cardSubtitle)}
              </span>
            )}
          </span>
          {opens && (
            <span aria-hidden className="shrink-0 text-[13px]" style={{ color: gold }}>
              {ar ? "←" : "→"}
            </span>
          )}
        </button>

        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {items.map((item) => {
            const colour = str(item.color);
            return (
              <button
                key={item.id}
                onClick={() => go(item)}
                dir="auto"
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{
                  borderColor: colour ? `${colour}aa` : `${gold}59`,
                  color: colour || onDeep,
                  background: colour ? `${colour}1f` : `${gold}14`,
                }}
              >
                {str(item.label)}
              </button>
            );
          })}
        </div>

        {str(s.footNote) && (
          <div dir="auto" className="relative mt-3 text-[10px]" style={{ color: onDeepSoft }}>
            {str(s.footNote)}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A sale, stamped.
 *
 * The website opens its sale with a wax-seal of a thing: the number in the
 * middle, the shop's own words running round it, a picture beside it. It
 * works because a seal reads as *marked down by somebody*, where a red
 * rectangle reads as a computer doing it — and because the words turning
 * slowly are the only motion on a page of still cards.
 *
 * The letters are placed round the circle one at a time rather than drawn on
 * a path, because the phone has no SVG library to draw a path with and the
 * two have to look the same.
 */
function SealRing({
  text,
  size,
  colour,
  ar,
}: {
  text: string;
  size: number;
  colour: string;
  ar: boolean;
}) {
  // A dot between the phrases, and the whole thing repeated until it closes.
  const line = text.replace(/\s*·\s*/g, " · ").trim();
  const letters = `${line} · `.repeat(2).split("");
  const radius = size / 2 - 9;
  return (
    <span
      aria-hidden
      className="app-seal-turn pointer-events-none absolute inset-0 block"
      style={{ width: size, height: size }}
    >
      {letters.map((ch, i) => {
        const turn = (i / letters.length) * 360;
        return (
          <span
            key={i}
            className="absolute start-1/2 top-1/2 block text-[8px] font-bold uppercase"
            style={{
              color: colour,
              letterSpacing: "0.02em",
              transform: `translate(-50%, -50%) rotate(${turn}deg) translateY(-${radius}px)`,
            }}
          >
            {ch === " " ? "\u00a0" : ch}
          </span>
        );
      })}
    </span>
  );
}

function SaleSeal({
  block,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const stacked = str(s.layout) === "stacked";
  const bg = str(s.bg) || "#7a4b27";
  const bg2 = str(s.bg2) || accent;
  const ink = str(s.inkColor, "#ffffff");
  const ring = str(s.ringColor) || ink;
  const height = int(s.height, 230);
  const radius = int(s.radius, 18);
  const image = str(s.imageUrl);
  const badge = str(s.badge);
  const badgeBg = str(s.badgeBg) || "#2b1b10";
  const opens = Boolean(str(s.handle) || str(s.url) || str(s.productId) || str(s.screen));
  const seal = Math.min(150, Math.round(height * 0.62));

  const panel = (
    <span
      className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-3 py-4"
      style={{ background: `linear-gradient(150deg, ${bg} 0%, ${bg2} 100%)` }}
    >
      <span className="relative block" style={{ width: seal, height: seal }}>
        <SealRing text={str(s.ringText)} size={seal} colour={ring} ar={ar} />
        {/* The ring it sits in, and the number it is about. */}
        <span
          className="absolute inset-[13px] grid place-items-center rounded-full border"
          style={{ borderColor: `${ring}59` }}
        >
          <span className="flex flex-col items-center leading-none">
            {str(s.smallText) && (
              <span className="app-display text-[13px] italic" style={{ color: ring }}>
                {str(s.smallText)}
              </span>
            )}
            {str(s.bigText) && (
              <span className="app-display text-[30px] font-bold leading-none" style={{ color: ink }}>
                {str(s.bigText)}
              </span>
            )}
          </span>
        </span>
      </span>

      {str(s.tagline) && (
        <span dir="auto" className="block text-center text-[11px] leading-snug" style={{ color: ink, opacity: 0.9 }}>
          {str(s.tagline)}
        </span>
      )}
      {str(s.buttonLabel) && (
        <span
          dir="auto"
          className="mt-0.5 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ background: ink, color: bg }}
        >
          {str(s.buttonLabel)}
        </span>
      )}
    </span>
  );

  const picture = image ? (
    <span className={`relative block shrink-0 overflow-hidden ${stacked ? "w-full" : "w-[42%]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: str(s.focal) || "50% 50%" }}
      />
      {badge && (
        <span
          dir="auto"
          className="absolute end-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: badgeBg, color: str(s.badgeColor, "#ffffff") }}
        >
          {badge}
        </span>
      )}
    </span>
  ) : null;

  return (
    <section>
      <button
        onClick={() => opens && go(s)}
        className={`flex w-full overflow-hidden text-start ${stacked ? "flex-col" : ""} ${opens ? "" : "cursor-default"}`}
        style={{ borderRadius: radius, minHeight: stacked ? undefined : height }}
      >
        {stacked ? (
          <>
            <span className="flex w-full" style={{ minHeight: Math.round(height * 0.78) }}>
              {panel}
            </span>
            <span className="block w-full" style={{ height: Math.round(height * 0.55) }}>
              {picture}
            </span>
          </>
        ) : (
          <>
            {panel}
            {picture}
          </>
        )}
      </button>
    </section>
  );
}

/**
 * Free delivery, as airmail.
 *
 * The store already has a bar that counts a basket up to free delivery, which
 * is the right thing once there is a basket. This is the other half: the
 * promise, before anyone has put anything in one. Free shipping is the single
 * most persuasive thing most shops can say and it is usually set in the
 * smallest type on the page.
 *
 * So it is an envelope: cream paper, the striped border of an air-mail
 * envelope travelling slowly round the top and bottom edges, and the
 * threshold franked onto a postage stamp. It is the one section on the home
 * screen that is a thing rather than a card, which is the whole job - and it
 * is drawn with blocks of colour and a dashed border, so it costs nothing to
 * load and the phone can draw the same thing without a picture library.
 */
function FreeShipping({
  block,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const look = str(s.style) || "ribbon";
  const strip = look === "strip";
  // Cream paper, roast ink, caramel stripes. The old banner was a dark panel,
  // which put three dark sections in a row on the home screen; an envelope is
  // light by nature and gives the scroll somewhere to breathe.
  const paper = str(s.bg) || "#fffaf3";
  const ink = str(s.inkColor) || "#2b1b10";
  const air = str(s.dashColor) || accent;
  const air2 = str(s.bg2) || "#2b1b10";
  const radius = int(s.radius, 18);
  const height = int(s.height, 0);
  const opens = Boolean(str(s.handle) || str(s.url) || str(s.productId) || str(s.screen));

  /** The barber-pole border of an air-mail envelope, travelling. */
  const stripes = (
    <span
      aria-hidden
      className="app-air-stripes block h-[7px] w-full"
      style={{
        backgroundImage: `repeating-linear-gradient(115deg, ${air} 0 11px, ${paper} 11px 22px, ${air2} 22px 33px, ${paper} 33px 44px)`,
        backgroundSize: "44px 7px",
      }}
    />
  );

  // ---- a ticket, torn off ----------------------------------------------
  //
  // Seven ways of saying "free delivery" have gone past. What the best of them
  // got right was pricing it - a struck-through cost is the one piece of
  // commercial language everyone reads without being taught. What none of them
  // had was a shape. A banner is a rectangle with words in it and the eye has
  // learned to slide off rectangles; a ticket is an object, with a stub, a
  // perforation and a face value, and the eye stops on objects.
  //
  // The notches are the whole trick: two circles in the page's own colour,
  // half outside the card at each end of the perforation. They are what turns
  // a dashed line into something that was torn.
  if (look === "ticket") {
    const big = str(s.bigWord, ar ? "مجاني" : "FREE");
    const small = str(s.smallWord, ar ? "التوصيل" : "Delivery");
    const was = str(s.wasPrice);
    const body = str(s.bg) || "#2b1b10";
    const edge = str(s.bg2) || accent;
    const page = "var(--app-page, #f3ede5)";
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`relative flex w-full overflow-hidden text-start ${opens ? "" : "cursor-default"}`}
          style={{
            background: `linear-gradient(115deg, ${body} 0%, ${edge} 140%)`,
            borderRadius: radius,
            minHeight: height || undefined,
          }}
        >
          {/* The ticket proper. */}
          <span className={`min-w-0 flex-1 px-4 py-3 ${was ? "pe-3" : ""}`}>
            {str(s.kicker) && (
              <span
                dir="auto"
                className="block text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ color: air }}
              >
                {str(s.kicker)}
              </span>
            )}
            <span className="mt-1 flex items-end gap-2">
              <span
                dir="auto"
                className="app-display text-[30px] font-bold leading-none text-white"
              >
                {big}
              </span>
              <span
                dir="auto"
                className="pb-[3px] text-[12px] font-bold uppercase tracking-[0.16em] text-white/90"
              >
                {small}
              </span>
            </span>
            {str(s.subtitle) && (
              <span dir="auto" className="mt-1.5 block text-[11px] text-white/70">
                {str(s.subtitle)}
              </span>
            )}
          </span>

          {/* The stub, and what the ticket is worth. */}
          {was && (
            <span className="relative flex w-[92px] shrink-0 flex-col items-center justify-center px-2">
              {/* The tear. */}
              <span
                aria-hidden
                className="absolute inset-y-2 start-0 border-s border-dashed"
                style={{ borderColor: "rgba(255,255,255,0.45)" }}
              />
              <span
                aria-hidden
                className="absolute -top-2 start-0 h-4 w-4 -translate-x-1/2 rounded-full rtl:translate-x-1/2"
                style={{ background: page }}
              />
              <span
                aria-hidden
                className="absolute -bottom-2 start-0 h-4 w-4 -translate-x-1/2 rounded-full rtl:translate-x-1/2"
                style={{ background: page }}
              />
              {/* A struck price only does its work if it can be read first.
                  On a brown ticket the accent is too close to the ground to
                  carry either the label or the line through it. */}
              <span
                dir="auto"
                className="block text-[8px] font-bold uppercase tracking-[0.16em] text-white/55"
              >
                {str(s.wasLabel, ar ? "بدلاً من" : "was")}
              </span>
              <span
                dir="auto"
                className="mt-0.5 block text-[16px] font-bold text-white line-through decoration-2"
                style={{ textDecorationColor: "rgba(255,255,255,0.85)" }}
              >
                {was}
              </span>
            </span>
          )}
        </button>
        {str(s.note) && (
          <p dir="auto" className="mt-1.5 text-center text-[10px] text-slate-500">
            {str(s.note)}
          </p>
        )}
      </section>
    );
  }

  // ---- priced at nothing ----------------------------------------------
  //
  // Six ways of saying "free delivery" went past without landing, and the
  // thing they had in common is that they all described it. A shopper does
  // not read a description; she reads a price. So it is priced: what the
  // delivery would have cost, struck through, and nothing beside it - the
  // one piece of commercial language everybody already knows how to read.
  if (look === "bold") {
    const big = str(s.bigWord, ar ? "مجاني" : "FREE");
    const small = str(s.smallWord, ar ? "التوصيل" : "Delivery");
    const was = str(s.wasPrice);
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`relative flex w-full items-center gap-3 overflow-hidden px-4 py-3.5 text-start ${opens ? "" : "cursor-default"}`}
          style={{
            background: `linear-gradient(120deg, ${str(s.bg) || "#2b1b10"} 0%, ${str(s.bg2) || accent} 100%)`,
            borderRadius: radius,
            minHeight: height || undefined,
          }}
        >
          {/* The light. */}
          <span
            aria-hidden
            className="app-ship-shine pointer-events-none absolute inset-y-0 -start-1/3 w-1/3 block"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%)",
            }}
          />

          <span className="relative flex min-w-0 flex-1 items-end gap-2.5">
            <span
              dir="auto"
              className="app-display text-[42px] font-bold leading-none"
              style={{ color: "#ffffff" }}
            >
              {big}
            </span>
            <span className="min-w-0 pb-1">
              <span
                dir="auto"
                className="block text-[13px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#ffffff" }}
              >
                {small}
              </span>
              {str(s.subtitle) && (
                <span dir="auto" className="mt-0.5 block text-[11px] text-white/80">
                  {str(s.subtitle)}
                </span>
              )}
            </span>
          </span>

          {/* What it would have cost, crossed out: the saving, stated. */}
          {was && (
            <span
              className="relative shrink-0 rounded-xl px-2.5 py-1.5 text-center"
              style={{ background: "rgba(20,12,7,0.28)" }}
            >
              <span
                dir="auto"
                className="block text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ color: air }}
              >
                {str(s.wasLabel, ar ? "بدلاً من" : "was")}
              </span>
              <span
                dir="auto"
                className="mt-0.5 block text-[15px] font-bold text-white line-through decoration-2"
                style={{ textDecorationColor: air }}
              >
                {was}
              </span>
            </span>
          )}
        </button>
        {str(s.note) && (
          <p dir="auto" className="mt-1.5 text-center text-[10px] text-slate-500">
            {str(s.note)}
          </p>
        )}
      </section>
    );
  }

  // ---- a rule, not a banner --------------------------------------------
  //
  // Five designs in, the thing every one of them had in common was size: a
  // section-sized answer to a one-line promise. Free delivery is a fact a
  // shopper wants to know and then stop thinking about, like a price or a
  // size — so it is a line between two hairlines, the width of the page, and
  // it takes eight percent of the screen instead of a third.
  if (look === "rule") {
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`block w-full border-y py-3 text-center ${opens ? "" : "cursor-default"}`}
          style={{ borderColor: `${ink}1f` }}
        >
          <span className="flex items-center justify-center gap-2.5">
            <span aria-hidden className="text-[10px]" style={{ color: air }}>
              ✦
            </span>
            <span
              dir="auto"
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: ink }}
            >
              {str(s.title)}
            </span>
            <span aria-hidden className="text-[10px]" style={{ color: air }}>
              ✦
            </span>
          </span>
          {str(s.subtitle) && (
            <span
              dir="auto"
              className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: ink, opacity: 0.55 }}
            >
              {str(s.subtitle)}
            </span>
          )}
        </button>
      </section>
    );
  }

  // ---- over a photograph, like everything else that works here ----------
  if (look === "photo") {
    const shot = str(s.imageUrl);
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`relative -mx-4 block w-[calc(100%+2rem)] overflow-hidden text-start ${opens ? "" : "cursor-default"}`}
          style={{ height: int(s.height, 0) || 168 }}
        >
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shot}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: str(s.focal) || "50% 45%" }}
            />
          ) : (
            <span className="absolute inset-0 block" style={{ background: air }} />
          )}
          {/* Dark enough at the foot to read on, clear at the top so the
              photograph is still a photograph. */}
          <span
            aria-hidden
            className="absolute inset-0 block"
            style={{
              background:
                "linear-gradient(to top, rgba(20,12,7,0.78) 0%, rgba(20,12,7,0.35) 45%, rgba(20,12,7,0) 78%)",
            }}
          />
          <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4">
            <span className="min-w-0 flex-1">
              {str(s.kicker) && (
                <span
                  dir="auto"
                  className="block text-[9px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: "#e7c9a9" }}
                >
                  {str(s.kicker)}
                </span>
              )}
              {str(s.title) && (
                <span
                  dir="auto"
                  className="app-display mt-1 block text-[24px] font-bold leading-tight text-white"
                >
                  {str(s.title)}
                </span>
              )}
              {str(s.subtitle) && (
                <span dir="auto" className="mt-0.5 block text-[12px] text-white/85">
                  {str(s.subtitle)}
                </span>
              )}
            </span>
            {str(s.buttonLabel) && (
              <span
                dir="auto"
                className="shrink-0 rounded-full bg-white/95 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#2b1b10" }}
              >
                {str(s.buttonLabel)}
              </span>
            )}
          </span>
        </button>
      </section>
    );
  }

  // ---- the ribbon: one line of type crossing the screen -----------------
  if (look === "ribbon") {
    const line = [str(s.title), str(s.subtitle)].filter(Boolean).join(" ");
    const run = line || str(s.kicker);
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`-mx-4 flex w-[calc(100%+2rem)] items-center overflow-hidden py-3 ${opens ? "" : "cursor-default"}`}
          style={{ background: air }}
        >
          {/* Twice, so the second copy is already on screen when the first
              leaves and the line never appears to end. */}
          <span className="app-ribbon flex w-max shrink-0 items-center">
            {[0, 1].map((half) => (
              <span key={half} className="flex shrink-0 items-center">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} dir="auto" className="flex shrink-0 items-center">
                    <span
                      className="whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: paper }}
                    >
                      {run}
                    </span>
                    <span className="px-3 text-[11px]" style={{ color: paper, opacity: 0.7 }}>
                      ✦
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </span>
        </button>
      </section>
    );
  }

  // ---- the editorial line: no ornament at all ---------------------------
  if (look === "editorial") {
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`w-full px-4 py-6 text-center ${opens ? "" : "cursor-default"}`}
          style={{ background: paper, borderRadius: radius }}
        >
          {str(s.kicker) && (
            <span className="flex items-center justify-center gap-2.5">
              <span className="h-px w-8" style={{ background: `${ink}33` }} />
              <span
                dir="auto"
                className="text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ color: air }}
              >
                {str(s.kicker)}
              </span>
              <span className="h-px w-8" style={{ background: `${ink}33` }} />
            </span>
          )}
          {str(s.title) && (
            <span
              dir="auto"
              className="app-display mt-2 block text-[27px] font-bold leading-tight"
              style={{ color: ink }}
            >
              {str(s.title)}
            </span>
          )}
          {str(s.subtitle) && (
            <span
              dir="auto"
              className="mt-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: ink, opacity: 0.6 }}
            >
              {str(s.subtitle)}
            </span>
          )}
          {str(s.buttonLabel) && (
            <span
              dir="auto"
              className="mt-3 inline-block border-b pb-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: ink, borderColor: air }}
            >
              {str(s.buttonLabel)} {ar ? "←" : "→"}
            </span>
          )}
        </button>
      </section>
    );
  }

  if (strip) {
    return (
      <section>
        <button
          onClick={() => opens && go(s)}
          className={`flex w-full items-center gap-2.5 overflow-hidden px-3 py-2.5 text-start ${opens ? "" : "cursor-default"}`}
          style={{ background: paper, borderRadius: radius, minHeight: height || undefined, border: `1px solid ${air}33` }}
        >
          <span aria-hidden className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: air }} />
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate text-[12px] font-bold" style={{ color: ink }}>
              {str(s.title)}
            </span>
            {str(s.subtitle) && (
              <span dir="auto" className="block truncate text-[11px]" style={{ color: ink, opacity: 0.7 }}>
                {str(s.subtitle)}
              </span>
            )}
          </span>
          {opens && (
            <span aria-hidden className="shrink-0 text-[13px]" style={{ color: air }}>
              {ar ? "←" : "→"}
            </span>
          )}
        </button>
      </section>
    );
  }

  return (
    <section>
      <button
        onClick={() => opens && go(s)}
        className={`relative block w-full overflow-hidden text-start ${opens ? "" : "cursor-default"}`}
        style={{ background: paper, borderRadius: radius, minHeight: height || undefined }}
      >
        {stripes}

        <span className="flex items-center gap-3 px-4 py-4">
          <span className="min-w-0 flex-1">
            {str(s.kicker) && (
              <span
                dir="auto"
                className="block text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ color: air }}
              >
                ✦ {str(s.kicker)}
              </span>
            )}
            {str(s.title) && (
              <span
                dir="auto"
                className="app-display mt-1 block text-[26px] font-bold leading-tight"
                style={{ color: ink }}
              >
                {str(s.title)}
              </span>
            )}
            {str(s.subtitle) && (
              <span dir="auto" className="mt-0.5 block text-[12px]" style={{ color: ink, opacity: 0.72 }}>
                {str(s.subtitle)}
              </span>
            )}

            <span className="mt-3 flex flex-wrap items-center gap-2">
              {str(s.buttonLabel) && (
                <span
                  dir="auto"
                  className="rounded-full px-3.5 py-1.5 text-[12px] font-bold"
                  style={{ background: ink, color: paper }}
                >
                  {str(s.buttonLabel)} {ar ? "←" : "→"}
                </span>
              )}
              {str(s.note) && (
                <span dir="auto" className="text-[10px]" style={{ color: ink, opacity: 0.55 }}>
                  {str(s.note)}
                </span>
              )}
            </span>
          </span>

          {/* The stamp: what it costs to have it delivered, franked. */}
          {str(s.stampTop) || str(s.stampBig) || str(s.stampBottom) ? (
            <span
              className="app-air-stamp grid h-[78px] w-[62px] shrink-0 place-items-center rounded-[6px] border-2 border-dashed px-1 text-center"
              style={{ borderColor: `${air}88`, background: `${air}12` }}
            >
              <span className="block">
                {str(s.stampTop) && (
                  <span dir="auto" className="block text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: air }}>
                    {str(s.stampTop)}
                  </span>
                )}
                {str(s.stampBig) && (
                  <span dir="auto" className="app-display block text-[19px] font-bold leading-none" style={{ color: ink }}>
                    {str(s.stampBig)}
                  </span>
                )}
                {str(s.stampBottom) && (
                  <span dir="auto" className="mt-0.5 block text-[7px] font-bold uppercase tracking-[0.12em]" style={{ color: ink, opacity: 0.6 }}>
                    {str(s.stampBottom)}
                  </span>
                )}
              </span>
            </span>
          ) : null}
        </span>

        {stripes}
      </button>
    </section>
  );
}

/**
 * The mystery box as a banner: a night-sky gradient with a glowing gift box
 * whose lid floats open and lets a question mark out. Everything the shopper
 * reads - the tag, the price, what it is worth, how many are left - is the
 * merchant's, and a picture of the real box can stand in for the drawing.
 */
function PromoBanner({
  s,
  accent,
  onOpen,
}: {
  s: Record<string, unknown>;
  /** What the store is built around: the banner follows it unless told not to. */
  accent: string;
  onOpen: () => void;
}) {
  // Empty means "follow the brand", the way the live row's colours do. A
  // banner painted in somebody else's purple is the one section on the home
  // screen that looks like it was bought from another shop.
  const bg = str(s.bg) || "#2b1b10";
  const bg2 = str(s.bg2) || accent;
  const glow = str(s.glow) || "#e0b877";
  const ink = str(s.textColor, "#ffffff");
  const radius = int(s.radius, 20);
  const height = int(s.height, 0) || 196;
  const art = str(s.imageUrl);
  const sparkles = [
    { top: "8%", left: "10%", size: 14, delay: "0s" },
    { top: "22%", left: "82%", size: 10, delay: "0.6s" },
    { top: "62%", left: "4%", size: 9, delay: "1.1s" },
    { top: "4%", left: "58%", size: 8, delay: "1.6s" },
  ];

  return (
    <section
      onClick={onOpen}
      className="relative flex cursor-pointer overflow-hidden"
      style={{
        minHeight: height,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${bg} 0%, ${bg} 40%, ${bg2} 100%)`,
      }}
    >
      {/* Starlight dots and two soft glows give the night its depth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -end-10 h-56 w-56 rounded-full blur-2xl"
        style={{ background: glow, opacity: 0.22 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -start-12 -top-16 h-40 w-40 rounded-full blur-2xl"
        style={{ background: bg2, opacity: 0.5 }}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-4 pe-2 ps-4">
        {str(s.kicker) && (
          <span
            dir="auto"
            className="self-start rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
            style={{ color: glow, borderColor: `${glow}66`, background: `${glow}1f` }}
          >
            ✦ {str(s.kicker)}
          </span>
        )}
        {str(s.title) && (
          <div dir="auto" className="text-[22px] font-extrabold leading-tight" style={{ color: ink }}>
            {str(s.title)}
          </div>
        )}
        {str(s.body) && (
          <p dir="auto" className="line-clamp-3 text-[11px] leading-relaxed" style={{ color: ink, opacity: 0.78 }}>
            {str(s.body)}
          </p>
        )}
        {(str(s.price) || str(s.worth)) && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            {str(s.price) && (
              <span dir="auto" className="text-[15px] font-extrabold" style={{ color: glow }}>
                {str(s.price)}
              </span>
            )}
            {str(s.worth) && (
              <span dir="auto" className="text-[10px]" style={{ color: ink, opacity: 0.72 }}>
                {str(s.worth)}
              </span>
            )}
          </div>
        )}
        {(str(s.buttonLabel) || str(s.stockNote)) && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {str(s.buttonLabel) && (
              <span
                dir="auto"
                className="rounded-full px-3.5 py-1.5 text-[12px] font-bold shadow-lg"
                style={{ background: glow, color: bg, boxShadow: `0 6px 18px ${glow}55` }}
              >
                {/* The arrow follows the label's own script, not the app's. */}
                {str(s.buttonLabel)} {/[؀-ۿ]/.test(str(s.buttonLabel)) ? "←" : "→"}
              </span>
            )}
            {str(s.stockNote) && (
              <span dir="auto" className="text-[10px] font-semibold" style={{ color: ink, opacity: 0.8 }}>
                {str(s.stockNote)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 grid w-[44%] shrink-0 place-items-center py-3 pe-1">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            className="max-h-[150px] w-full object-contain"
            style={{ filter: `drop-shadow(0 10px 22px ${glow}66)` }}
          />
        ) : (
          <div aria-hidden className="relative h-[132px] w-[124px]">
            <div className="absolute inset-3 rounded-full blur-xl" style={{ background: glow, opacity: 0.45 }} />
            {/* Light escaping the box. */}
            <div
              className="app-mystery-rays absolute left-1/2 top-1 h-[104px] w-[104px] -ml-[52px] rounded-full"
              style={{
                background: `conic-gradient(from 0deg, transparent 0 8%, ${glow}66 10% 13%, transparent 15% 33%, ${glow}66 35% 38%, transparent 40% 58%, ${glow}66 60% 63%, transparent 65% 83%, ${glow}66 85% 88%, transparent 90%)`,
                WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 70%)",
                maskImage: "radial-gradient(circle, #000 20%, transparent 70%)",
              }}
            />
            {sparkles.map((p) => (
              <span
                key={p.top + p.left}
                className="app-mystery-twinkle absolute"
                style={{ top: p.top, left: p.left, fontSize: p.size, color: glow, animationDelay: p.delay }}
              >
                ✦
              </span>
            ))}
            {/* The question mark rising out of the box. */}
            <span
              className="app-mystery-float absolute left-1/2 top-[14px] -ml-[12px] w-6 text-center text-[36px] font-black leading-none"
              style={{ color: "#ffffff", textShadow: `0 0 14px ${glow}, 0 0 4px ${glow}` }}
            >
              ?
            </span>
            {/* The lid, lifted and tilted. */}
            <div className="app-mystery-lid absolute bottom-[62px] left-1/2 -ml-[48px] h-[18px] w-[96px]">
              <div
                className="h-full w-full rounded-md"
                style={{
                  background: `linear-gradient(180deg, rgba(255,255,255,0.35), rgba(0,0,0,0.18)), ${glow}`,
                  transform: "rotate(-9deg)",
                  boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
                }}
              >
                <div className="absolute inset-y-0 left-1/2 -ml-[7px] w-[14px]" style={{ background: bg2 }} />
                <div
                  className="absolute -top-[10px] left-1/2 -ml-[14px] h-[12px] w-[28px] rounded-t-full border-[4px] border-b-0"
                  style={{ borderColor: bg2 }}
                />
              </div>
            </div>
            {/* The box. */}
            <div
              className="absolute bottom-2 left-1/2 -ml-[42px] h-[56px] w-[84px] overflow-hidden rounded-b-lg rounded-t-sm"
              style={{
                background: `linear-gradient(160deg, rgba(255,255,255,0.3), rgba(0,0,0,0.28)), ${glow}`,
                boxShadow: `0 12px 24px rgba(0,0,0,0.35), inset 0 -8px 0 rgba(0,0,0,0.12)`,
              }}
            >
              <div className="absolute inset-y-0 left-1/2 -ml-[7px] w-[14px]" style={{ background: bg2 }} />
              <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: "rgba(0,0,0,0.25)" }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** A five-point star, the same drawing the website uses. */
function StarMark({ className, color }: { className: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M12 2l2.9 6.26 6.85.72-5.1 4.6 1.44 6.72L12 16.9l-6.09 3.4 1.44-6.72-5.1-4.6 6.85-.72z" />
    </svg>
  );
}

/**
 * Rating summary - the website's "What They're Saying".
 *
 * A heading with an italic second half, then one card: the average in large
 * serif figures with its stars, the count and a verified line, and a bar per
 * star that grows into place. The whole card and the button under it open the
 * reviews. Every figure is typed by the merchant, as on the website.
 */
function ReviewSummary({
  block,
  data,
  handlers,
}: {
  block: Block;
  data: HomeData;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const star = str(s.starColor, "#c9a227");
  const track = str(s.barTrack, "#e5dbcd");
  const brown = str(s.brownColor, "#684329");
  const caramel = str(s.accentColor, "#9d6540");
  const ink = str(s.inkColor, "#211a15");
  const muted = str(s.mutedColor, "#74685e");
  const line = "rgba(69,46,31,.13)";
  const serif = 'var(--font-display), "Cormorant Garamond", "Playfair Display", Georgia, serif';
  const average = str(s.average);
  const filled = Math.max(0, Math.min(5, Math.floor(Number(average) || 0)));
  const animate = s.animate !== false;
  const [grown, setGrown] = useState(!animate);
  useEffect(() => {
    if (!animate) return setGrown(true);
    setGrown(false);
    const t = setTimeout(() => setGrown(true), 150);
    return () => clearTimeout(t);
  }, [animate]);
  const pct = (n: number) => {
    const v = Number(s["pct" + n]);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  };
  const count = [str(s.reviewCount), str(s.reviewsWord)].filter(Boolean).join(" ");

  return (
    <section
      className={str(s.bg) ? "-mx-4 px-4 py-5" : ""}
      style={str(s.bg) ? { background: str(s.bg) } : undefined}
    >
      <div className="text-center">
        {str(s.eyebrow) && (
          <span
            dir="auto"
            className="inline-flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: brown }}
          >
            <span aria-hidden className="h-px w-[34px] opacity-50" style={{ background: caramel }} />
            {str(s.eyebrow)}
            <span aria-hidden className="h-px w-[34px] opacity-50" style={{ background: caramel }} />
          </span>
        )}
        {(str(s.heading) || str(s.headingItalic)) && (
          <h3
            dir="auto"
            className="app-display mt-3 text-[28px] font-semibold leading-tight tracking-tight"
            style={{ color: ink, fontFamily: serif }}
          >
            {str(s.heading)}{" "}
            {str(s.headingItalic) && (
              <em className="font-medium italic" style={{ color: caramel }}>
                {str(s.headingItalic)}
              </em>
            )}
          </h3>
        )}
      </div>

      <button
        dir="ltr"
        onClick={() => go(s)}
        className="mt-5 block w-full border px-[18px] py-[22px] text-left"
        style={{
          borderRadius: int(s.radius, 18),
          borderColor: line,
          background: `linear-gradient(160deg, ${str(s.panelFrom, "#fdf9f3")}, ${str(s.panelTo, "#f3e9db")})`,
        }}
      >
        <span className="flex flex-col items-center border-b pb-4 text-center" style={{ borderColor: line }}>
          {average && (
            <span className="font-semibold leading-none tracking-tight" style={{ fontSize: int(s.avgSize, 58), color: ink, fontFamily: serif }}>
              {average}
            </span>
          )}
          <span className="mt-2 inline-flex gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <StarMark key={i} className="h-4 w-4" color={i < filled ? star : track} />
            ))}
          </span>
          {count && (
            <span dir="auto" className="mt-2 text-[11.5px]" style={{ color: muted }}>
              {count}
            </span>
          )}
          {str(s.trustNote) && (
            <span
              dir="auto"
              className="mt-2.5 inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: caramel }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[11px] w-[11px]">
                <path d="M4 12l5 5L20 6" />
              </svg>
              {str(s.trustNote)}
            </span>
          )}
        </span>
        <span className="mt-4 flex flex-col gap-[7px]">
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n} className="flex items-center gap-2.5 px-1.5 py-1">
              <span className="w-2.5 text-[11.5px] font-semibold" style={{ color: ink }}>
                {n}
              </span>
              <StarMark className="h-3 w-3 shrink-0" color={star} />
              <span className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: track }}>
                <span
                  className="block h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(.19,1,.22,1)]"
                  style={{
                    width: grown ? `${pct(n)}%` : 0,
                    background: `linear-gradient(90deg, ${str(s.barFrom, "#c9a227")}, ${str(s.barTo, caramel)})`,
                  }}
                />
              </span>
              <span className="w-8 text-right text-[11px]" style={{ color: muted }}>
                {pct(n)}%
              </span>
            </span>
          ))}
        </span>
      </button>

      {str(s.buttonLabel) && (
        <div className="mt-5 text-center">
          <button
            dir="ltr"
            onClick={() => go(s)}
            className="inline-flex items-center gap-2 rounded-full px-[26px] py-[13px] text-[10.5px] font-bold uppercase tracking-[0.18em] text-white"
            style={{ background: brown }}
          >
            <span dir="auto">{str(s.buttonLabel)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Shop by brand - the website's brand timeline.
 *
 * A row of round logo marks joined by a hairline, the current one filled,
 * over one wide photo card at a time. The cards slide on their own every few
 * seconds with a thin bar filling underneath, a swipe or a tap on a mark takes
 * over, and tapping the card opens the brand.
 */
function BrandTimeline({
  block,
  items,
  data,
  handlers,
}: {
  block: Block;
  items: Item[];
  data: HomeData;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const [on, setOn] = useState(0);
  const [downX, setDownX] = useState<number | null>(null);
  // Once the shopper takes hold - a tap on a mark, a swipe - the cards stop
  // moving on their own, so the brand they chose is the one they tap.
  const [held, setHeld] = useState(false);
  const caramel = str(s.accentColor, "#9d6540");
  const brown = str(s.brownColor, "#684329");
  const ink = str(s.inkColor, "#211a15");
  const line = str(s.lineColor, "rgba(69,46,31,.16)");
  const radius = int(s.radius, 20);
  const height = int(s.cardHeight, 150);
  const overlay = Math.min(100, Math.max(0, Number.isFinite(Number(s.overlay)) && s.overlay !== "" ? Number(s.overlay) : 72)) / 100;
  const seconds = Number.isFinite(Number(s.autoplay)) ? Number(s.autoplay) : 3;
  const serif = 'var(--font-display), "Cormorant Garamond", "Playfair Display", Georgia, serif';
  const current = Math.min(on, items.length - 1);

  // A slide that is showing waits its turn, then hands over to the next.
  useEffect(() => {
    if (!(seconds > 0) || items.length < 2 || held) return;
    const t = setTimeout(() => setOn((i) => (i + 1) % items.length), seconds * 1000);
    return () => clearTimeout(t);
  }, [current, seconds, items.length, held]);

  const step = (by: number) => {
    setHeld(true);
    setOn((i) => (i + by + items.length) % items.length);
  };

  return (
    <section
      className={str(s.bg) ? "-mx-4 px-3 py-5" : ""}
      style={str(s.bg) ? { background: str(s.bg) } : undefined}
    >
      <div className="text-center">
        {str(s.eyebrow) && (
          <span
            dir="auto"
            className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: brown }}
          >
            <span aria-hidden className="h-px w-10" style={{ background: caramel }} />
            {str(s.eyebrow)}
          </span>
        )}
        {str(s.heading) && (
          <h3 dir="auto" className="app-display mt-2 text-[24px] font-semibold leading-none" style={{ color: ink, fontFamily: serif }}>
            {str(s.heading)}
          </h3>
        )}
        {str(s.intro) && (
          <p dir="auto" className="mx-auto mt-2 max-w-[300px] text-[11.5px] leading-relaxed text-slate-500">
            {str(s.intro)}
          </p>
        )}
      </div>

      {/* The marks. Laid out left to right like the website, whatever the app's direction. */}
      <div dir="ltr" className="relative mt-4 flex items-start justify-between">
        <span aria-hidden className="absolute left-[10%] right-[10%] top-5 h-px" style={{ background: line }} />
        {items.map((item, i) => {
          const active = i === current;
          return (
            <button
              key={item.id}
              onClick={() => {
                setHeld(true);
                setOn(i);
              }}
              className="relative flex flex-1 flex-col items-center gap-1.5"
              aria-label={str(item.label, str(item.title))}
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full border transition-all duration-500"
                style={{
                  background: active ? caramel : "#fffdfa",
                  borderColor: active ? caramel : line,
                  transform: active ? "scale(1.06)" : undefined,
                }}
              >
                <span
                  className="px-1 text-center text-[12px] font-semibold leading-none"
                  style={{ color: active ? "#ffffff" : brown, fontFamily: serif }}
                >
                  {str(item.logoText)}
                </span>
              </span>
              <span
                className="px-0.5 text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.12em]"
                style={{ color: active ? brown : ink }}
              >
                {str(item.label, str(item.title))}
              </span>
            </button>
          );
        })}
      </div>

      {/* The cards. */}
      <div
        dir="ltr"
        className="relative mt-4 w-full touch-pan-y overflow-hidden"
        style={{ borderRadius: radius }}
        onPointerDown={(e) => setDownX(e.clientX)}
        onPointerUp={(e) => {
          if (downX == null) return;
          const dx = e.clientX - downX;
          setDownX(null);
          if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
          else go(items[current]);
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(.19,1,.22,1)]"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="relative w-full shrink-0 cursor-pointer overflow-hidden"
              style={{ height, borderRadius: radius, background: "#b89d82" }}
            >
              {str(item.imageUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={str(item.imageUrl)}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                  style={{ objectPosition: str(item.focal, "50% 50%") }}
                />
              )}
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, rgba(28,18,12,${overlay}) 0%, rgba(28,18,12,${overlay * 0.47}) 46%, rgba(28,18,12,0.02) 74%)`,
                }}
              />
              <span className="absolute left-5 top-1/2 flex max-w-[78%] -translate-y-1/2 flex-col items-start text-white">
                <span className="text-[22px] font-semibold leading-none" style={{ fontFamily: serif }}>
                  {str(item.title, str(item.label))}
                </span>
                {str(item.description) && (
                  <span className="mt-1.5 text-[11.5px] leading-snug opacity-95">{str(item.description)}</span>
                )}
                {str(s.linkLabel) && (
                  <span className="relative mt-2 inline-flex items-center gap-2 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.14em]">
                    {str(s.linkLabel)}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    <span aria-hidden className="absolute bottom-0 left-0 h-px w-10 bg-white/65" />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        {seconds > 0 && items.length > 1 && !held && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 z-10 h-[3px] overflow-hidden bg-black/15">
            <span
              key={current}
              className="app-brand-progress block h-full w-full origin-left"
              style={{ background: caramel, animationDuration: `${seconds}s` }}
            />
          </span>
        )}
      </div>
    </section>
  );
}

/** "{product}" becomes the piece they bought; with no piece, the line goes. */
function withProduct(line: string, product: string | null | undefined): string {
  if (!line.includes("{product}")) return line;
  if (!product) return "";
  // Cut at a word, without an ellipsis: in a right-to-left app a trailing
  // "…" after English text is drawn at the start of the line.
  const short = product.length > 32 ? product.slice(0, 32).replace(/\s+\S*$/, "") : product;
  return line.split("{product}").join(short);
}

/**
 * Complete your look: what goes with the shopper's last purchases.
 *
 * The server does the matching - see lib/recommendations.ts. This only draws
 * what came back, titled by how it was found: a match says "Complete your
 * look", a shopper whose purchases fit no rule gets "Recommended for you".
 * Nothing came back means the section is not there at all.
 *
 * The editor has no shopper, so it draws a sample from the rules' own
 * collections and says so.
 */
function CompleteLook({
  block,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const limit = int(s.limit, 8);
  const recs = data.recommended;
  const sample = recs === undefined;

  let cards: Card[];
  if (sample) {
    const handles = itemsOf(block)
      .flatMap((i) => [i.to1, i.to2, i.to3])
      .map((h) => str(h).toLowerCase())
      .filter(Boolean);
    const pool = [
      ...handles.flatMap((h) => (data.rows[h] ?? []).slice(0, 3)),
      ...Object.values(data.rows).flat(),
      ...data.newArrivals,
    ];
    const seen = new Set<string>();
    cards = pool.filter((c) => !seen.has(c.id) && seen.add(c.id)).slice(0, limit);
  } else {
    cards = recs?.products ?? [];
  }
  if (!cards.length) {
    return <Placeholder ar={ar} label={ar ? "لا اقتراحات لهذه العميلة" : "Nothing to suggest for this shopper"} />;
  }

  const pairs = sample || recs?.mode !== "fallback";
  const title = pairs ? str(s.title, "Complete your look") : str(s.fallbackTitle, "Recommended for you");
  const subtitle = withProduct(
    pairs ? str(s.subtitle) : str(s.fallbackSubtitle),
    sample ? (ar ? "حقيبتك الأخيرة" : "last bag") : recs?.basedOn,
  );

  return (
    <section>
      {sample && (
        <div className="mb-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          {ar ? "معاينة — تظهر فقط لمن اشترت من قبل" : "Sample — only shoppers with past orders see this"}
        </div>
      )}
      <RowHead title={title} subtitle={subtitle} seeAll="" onSeeAll={() => {}} accent={accent} />
      <div className="-mx-4 mt-2 flex overflow-x-auto px-4 pb-1" style={{ gap: "var(--app-item-gap, 8px)" }}>
        {cards.map((card) => (
          <Tile key={card.id} card={card} ar={ar} accent={accent} wide {...tileProps(handlers, card.id)} />
        ))}
      </div>
    </section>
  );
}

/** A solid colour card with a heading, a line and a button. */
function PromoCard({
  block,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const radius = int(s.radius, 16);
  const ink = str(s.textColor, "#ffffff");
  const button = str(s.buttonLabel);

  if (str(s.style) === "banner") return <PromoBanner s={s} accent={accent} onOpen={() => go(s)} />;

  return (
    <section
      className="overflow-hidden"
      style={{ background: str(s.bg, accent), borderRadius: radius }}
    >
      {str(s.imageUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={str(s.imageUrl)} alt="" className="h-28 w-full object-cover" />
      )}
      <div className="p-4">
        {str(s.title) && (
          <div className="text-[15px] font-bold leading-snug" style={{ color: ink }}>
            {str(s.title)}
          </div>
        )}
        {str(s.body) && (
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: ink, opacity: 0.8 }}>
            {str(s.body)}
          </p>
        )}
        {button && (
          <button
            onClick={() => go(s)}
            className="mt-3 rounded-xl px-4 py-2 text-[12px] font-bold"
            style={{ background: ink, color: str(s.bg, accent) }}
          >
            {button}
          </button>
        )}
      </div>
    </section>
  );
}

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
  const cardStyle = useMemo(
    () => ({ nameWords: theme.settings.cardNameWords, photoBg: theme.settings.cardPhotoBg }),
    [theme.settings.cardNameWords, theme.settings.cardPhotoBg],
  );
  return (
    <CardStyle.Provider value={cardStyle}>
    <div
      className={`flex flex-col${theme.settings.titleFont === "serif" ? " app-serif" : ""}`}
      style={
        {
          gap: `${theme.settings.sectionGap}px`,
          "--app-section-gap": `${theme.settings.sectionGap}px`,
          "--app-item-gap": `${theme.settings.itemGap}px`,
          "--app-photo-bg": theme.settings.cardPhotoBg,
        } as React.CSSProperties
      }
    >
      {blocks.map((block) => {
        const rendered = (
          <BlockView block={block} theme={theme} data={data} ar={ar} handlers={handlers} />
        );
        if (!showPlaceholders && isPlaceholder(rendered)) return null;
        return (
          <SectionBand key={block.id} block={block} accent={theme.settings.accent}>
            {rendered}
          </SectionBand>
        );
      })}
      {blocks.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          {ar ? "الصفحة الرئيسية فارغة" : "The home screen is empty"}
        </p>
      )}
    </div>
    </CardStyle.Provider>
  );
}

/**
 * The rhythm between one section and the next.
 *
 * A page where every section is a heading over a row of same-sized cards on
 * the same background is legible and completely flat — it reads as a list
 * rather than something composed. A kicker gives a section a voice, and a band
 * lets one sit on its own colour so the scroll has somewhere to breathe and
 * something to land on.
 *
 * Both live here rather than in each renderer, so every section — the
 * twenty-eight that exist and whatever comes next — gets them for nothing.
 * Only bands that keep dark text readable are offered; inverting the text
 * inside each section is a different and much larger job.
 */
/**
 * One picture, edge to edge.
 *
 * A page of rows is a page of the same shape repeated; this is the thing that
 * interrupts it. It bleeds past the screen's padding on purpose, so it reads as
 * a moment rather than another card, and the wording sits on the image instead
 * of under it.
 */
function Showcase({
  block,
  data,
  ar,
  accent,
  handlers,
}: {
  block: Block;
  data: HomeData;
  ar: boolean;
  accent: string;
  handlers: HomeHandlers;
}) {
  const s = block.settings ?? {};
  const go = opener(data, handlers);
  const height = int(s.height, 360);
  const overlay = Math.max(0, Math.min(100, int(s.overlay, 45))) / 100;
  const ink = str(s.textColor, "#ffffff");
  const centred = str(s.align) === "center";
  const button = str(s.buttonLabel);
  // Its own picture, or the one belonging to whatever it opens.
  const target = data.collections.find((c) => c.handle === str(s.handle));
  const image = str(s.imageUrl) || target?.image || "";

  return (
    <section className="relative -mx-4 overflow-hidden" style={{ height }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-slate-200" />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${overlay}) 0%, rgba(0,0,0,${
            overlay * 0.35
          }) 45%, rgba(0,0,0,0) 80%)`,
        }}
      />
      <div
        className={`relative flex h-full flex-col px-5 pb-7 ${
          centred ? "items-center justify-center text-center" : "justify-end"
        }`}
      >
        {str(s.heading) && (
          <div className="app-display text-[26px] font-bold leading-tight" style={{ color: ink }}>
            {str(s.heading)}
          </div>
        )}
        {str(s.subheading) && (
          <div className="mt-1 text-[12px] leading-relaxed" style={{ color: ink, opacity: 0.85 }}>
            {str(s.subheading)}
          </div>
        )}
        {button && (
          <button
            onClick={() => go(s)}
            className="mt-3 self-start rounded-full px-4 py-2 text-[12px] font-bold"
            style={{ background: ink, color: str(s.imageUrl) ? "#191614" : accent, alignSelf: centred ? "center" : undefined }}
          >
            {button}
          </button>
        )}
      </div>
    </section>
  );
}

function SectionBand({
  block,
  accent,
  children,
}: {
  block: Block;
  accent: string;
  children: React.ReactNode;
}) {
  const s = block.settings ?? {};
  // Some sections wear their small line inside themselves — the mystery box as
  // a tag, the delivery banner between two rules — and drawing it above as
  // well says it twice.
  const ownsKicker =
    (block.type === "promo_card" && str(s.style) === "banner") || block.type === "free_shipping";
  const kicker = ownsKicker ? "" : str(s.kicker);
  const band = str(s.band);
  const washed = band === "tint" || band === "paper";

  // A band bleeds to the phone's edges, so the page's own padding is taken off
  // and put back inside it.
  const cls = washed
    ? "-mx-4 px-4"
    : band === "divider"
      ? "border-t border-slate-200"
      : "";
  const pad = washed
    ? { paddingTop: "var(--app-section-gap, 12px)", paddingBottom: "var(--app-section-gap, 12px)" }
    : band === "divider"
      ? { paddingTop: "var(--app-section-gap, 12px)" }
      : {};
  const style: React.CSSProperties = washed
    ? { background: band === "paper" ? "#ffffff" : `${accent}12`, ...pad }
    : pad;

  if (!kicker && !cls && band !== "divider") return <div>{children}</div>;
  return (
    <div className={cls} style={style}>
      {kicker && (
        <div
          className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {kicker}
        </div>
      )}
      {children}
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
    case "sale_seal":
      return !str(s.bigText) && !str(s.tagline) && !str(s.imageUrl);
    case "free_shipping":
      return !str(s.title) && !str(s.subtitle);
    // A hero, a card row and the footwear edit are made of items: they are
    // unfinished when they have none, not when they have no headline.
    case "hero":
    case "cards":
    case "moments":
      return itemsOf(block).filter((i) => str(i.imageUrl) || str(i.label)).length === 0;
    case "tiers":
    case "split":
    case "trust_badges":
      return itemsOf(block).length === 0;
    case "collection_tabs":
      return itemsOf(block).filter((t) => str(t.handle)).length === 0;
    case "promo_bar":
      return !str(s.lead) && !str(s.code);
    case "showcase":
      return !str(s.imageUrl) && !str(s.heading) && !str(s.handle);
    case "style_profile":
      return itemsOf(block).filter((i) => str(i.label)).length === 0 && !str(s.cardTitle);
    case "promo_card":
      return !str(s.title) && !str(s.body);
    // A shopper only sees it with something in it; guests never do.
    case "complete_look":
      return !data.recommended?.products.length;
    case "review_summary":
      return !str(s.average) && !str(s.heading) && !str(s.headingItalic);
    case "brand_timeline":
      return itemsOf(block).filter((i) => str(i.label) || str(i.title) || str(i.imageUrl)).length === 0;
    case "product_reasons":
      return itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl) || str(i.handle)).length === 0;
    case "circle_row":
      return itemsOf(block).filter((i) => str(i.imageUrl) || str(i.label) || str(i.handle)).length === 0;
    case "pick_colour":
      return itemsOf(block).filter((i) => str(i.color)).length === 0;
    case "price_drop":
      return !str(s.title) && !str(s.subtitle);
    case "shipping_goal":
      return !str(s.title) && !str(s.subtitle);
    case "payment_plans":
      return itemsOf(block).filter((i) => str(i.name) || str(i.headline)).length === 0;
    case "price_slider":
      return itemsOf(block).filter((i) => str(i.name) && str(i.months)).length === 0;
    case "offer_cards":
      return itemsOf(block).filter((i) => str(i.badge) || str(i.title)).length === 0;
    case "coming_up_live":
      return itemsOf(block).filter((i) => str(i.title) || str(i.imageUrl) || str(i.handle)).length === 0;
    case "countdown_deals":
      return itemsOf(block).filter((i) => str(i.price) || str(i.imageUrl) || str(i.handle)).length === 0;
    case "info_rows":
      return itemsOf(block).filter((i) => str(i.title)).length === 0;
    case "live_now": {
      const anyone = itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl) || str(i.handle)).length > 0;
      const offer = s.offerEnabled !== false && Boolean(str(s.offerTitle) || str(s.offerText));
      return !anyone && !offer;
    }
    default:
      return false;
  }
}
