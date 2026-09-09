"use client";

import { useEffect, useState } from "react";
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
  /**
   * The signed-in shopper first name, when the surface drawing this knows it.
   * Only the live-now offer uses it, and it degrades to an unnamed greeting,
   * so nothing here has to go and fetch an account it does not otherwise need.
   */
  shopperName?: string | null;
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
}: {
  src: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`overflow-hidden rounded-xl bg-slate-100 ${className}`} style={style}>
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

    case "live_now": {
      const people = itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl));
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

    case "product_reasons": {
      const picks = itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl));
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
      const sessions = itemsOf(block).filter((i) => str(i.title) || str(i.imageUrl));
      if (!sessions.length) {
        return <Placeholder ar={ar} label={ar ? "لا مواعيد بعد" : "Nothing scheduled yet"} />;
      }
      return (
        <ComingUpLive block={block} items={sessions} data={data} ar={ar} accent={accent} handlers={handlers} />
      );
    }

    case "countdown_deals": {
      const deals = itemsOf(block).filter((i) => str(i.price) || str(i.imageUrl));
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

  const size = int(s.avatarSize, 56);
  // Zero is a real answer here — it means no ring at all — so this one cannot
  // go through int(), which treats zero as "unset".
  const rawRing = Number(s.ringWidth);
  const ringW = Number.isFinite(rawRing) && rawRing >= 0 ? rawRing : 2;
  const shape = str(s.avatarShape, "circle");
  const photoRadius = shape === "square" ? 4 : shape === "rounded" ? Math.round(size * 0.28) : 9999;
  const nameSize = int(s.nameSize, 10);
  const viewersSize = int(s.viewersSize, 9);
  const bannerRadius = int(s.bannerRadius, 16);
  const offerTitleSize = int(s.offerTitleSize, 13);
  const offerTextSize = int(s.offerTextSize, 11);
  const cell = Math.max(size + 12, 56);

  const go = opener(data, handlers);

  return (
    <section>
      {title && <Heading title={title} ar={ar} accent={accent} />}

      {people.length > 0 && (
        <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
          {people.map((person) => {
            const borrowed = inherit(person, data);
            const name = str(person.name, borrowed.title);
            const viewers = str(person.viewers);
            return (
              <button
                key={person.id}
                onClick={() => go(str(person.url), str(person.handle))}
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
                  {liveLabel && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-px text-[8px] font-bold uppercase tracking-wide"
                      style={{
                        background: badgeBg,
                        color: badgeFg,
                        borderRadius: 4,
                        bottom: -6,
                      }}
                    >
                      {liveLabel}
                    </span>
                  )}
                </span>
                {name && (
                  <span
                    className="mt-2 w-full truncate text-center font-semibold text-slate-800"
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
              onClick={() => go(str(s.replaysUrl), str(s.replaysHandle))}
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

      {offerOn && (offerTitle || offerText) && (
        <button
          onClick={() => go(str(s.offerUrl), str(s.offerHandle))}
          className="mt-3 flex w-full items-center gap-3 px-4 py-3 text-start"
          style={{ background: offerBg, borderRadius: bannerRadius }}
        >
          <span className="min-w-0 flex-1">
            {offerTitle && (
              <span
                className="block truncate font-bold"
                style={{ color: offerFg, fontSize: offerTitleSize }}
              >
                {offerTitle}
              </span>
            )}
            {offerText && (
              <span
                className="mt-0.5 block truncate"
                style={{ color: offerFg, opacity: 0.85, fontSize: offerTextSize }}
              >
                {offerText}
              </span>
            )}
          </span>
          <span
            className="shrink-0 px-2.5 py-1.5 font-mono font-bold tabular-nums"
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
 * A typed link wins over a collection: it is the more specific thing to have
 * filled in. Shared so every section answers the question the same way.
 */
function opener(data: HomeData, handlers: HomeHandlers) {
  return (url: string, handle: string) => {
    if (url) {
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const target = data.collections.find((c) => c.handle === handle);
    if (target) handlers.onOpenCollection?.(target.handle, target.title);
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

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      <div
        className="mt-2 space-y-3 border border-slate-200 p-3"
        style={{ background: cardBg, borderRadius: radius }}
      >
        {items.map((item) => {
          const borrowed = inherit(item, data);
          return (
            <div key={item.id} className="flex items-center gap-3">
              <Thumb src={borrowed.image} className="h-12 w-12 shrink-0" style={{ borderRadius: 10 }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-bold text-slate-900">
                  {str(item.title, borrowed.title)}
                </div>
                {str(item.when) && (
                  <div className="truncate text-[11px] text-slate-500">{str(item.when)}</div>
                )}
              </div>
              {remind && (
                <button
                  onClick={() => go(str(item.url), str(item.handle))}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
                  style={{ background: accent }}
                >
                  {remind}
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
  const radius = int(s.radius, 14);
  const badgeBg = str(s.badgeBg, accent);
  const showTimer = s.showTimer !== false;
  const showClaimed = s.showClaimed !== false;

  return (
    <section>
      <div className="flex items-end justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-bold text-slate-900">{str(s.title)}</h3>
        {showTimer && (
          <span className="flex shrink-0 items-center gap-1">
            {parts.map((part, i) => (
              <span
                key={i}
                className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white"
                style={{ background: accent }}
              >
                {part}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const borrowed = inherit(item, data);
          const claimed = str(item.claimed);
          const pct = Math.max(0, Math.min(100, parseInt(claimed, 10) || 0));
          return (
            <button
              key={item.id}
              onClick={() => go(str(item.url), str(item.handle))}
              className="w-[132px] shrink-0 overflow-hidden border border-slate-200 bg-white text-start"
              style={{ borderRadius: radius }}
            >
              <span className="relative block">
                <Thumb src={borrowed.image} className="h-[104px] w-full" style={{ borderRadius: 0 }} />
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
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(str(item.url), str(item.handle))}
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
            <h3 className="truncate text-sm font-bold text-slate-900">{str(s.title)}</h3>
          )}
          {str(s.subtitle) && (
            <p className="truncate text-[11px] text-slate-500">{str(s.subtitle)}</p>
          )}
        </div>
        {str(s.seeAllLabel) && (
          <button
            onClick={() => go(str(s.seeAllUrl), str(s.seeAllHandle))}
            className="shrink-0 text-xs font-semibold"
            style={{ color: accent }}
          >
            {str(s.seeAllLabel)} ›
          </button>
        )}
      </div>
      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(str(item.url), str(item.handle))}
            className="w-[136px] shrink-0 p-3 text-start"
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

  return (
    <section>
      {str(s.title) && <Heading title={str(s.title)} ar={ar} accent={accent} />}
      {str(s.subtitle) && <p className="text-[11px] text-slate-500">{str(s.subtitle)}</p>}
      <div
        className="mt-2 border border-slate-200 p-3"
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

        <div className="mt-3 space-y-2">
          {items.map((item) => {
            const months = Math.max(1, parseInt(str(item.months), 10) || 1);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
              >
                <span className="w-14 shrink-0 truncate text-[11px] font-semibold text-slate-700">
                  {str(item.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold" style={{ color: accent }}>
                    {cur} {nf(Math.round(price / months))}
                    <span className="text-[10px] font-medium text-slate-500"> / {ar ? "شهر" : "month"}</span>
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {months} {ar ? "شهور" : "months"}
                  </span>
                </span>
                {str(item.badge) && (
                  <span
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
      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const colour = str(item.color, accent);
          return (
            <div
              key={item.id}
              className="flex w-[136px] shrink-0 flex-col gap-1 border border-dashed p-3"
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
                  onClick={() => go(str(item.url), str(item.handle))}
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
}: {
  title: string;
  subtitle: string;
  seeAll: string;
  onSeeAll: () => void;
  accent: string;
}) {
  if (!title && !subtitle && !seeAll) return null;
  return (
    <div className="flex items-end justify-between gap-2">
      <div className="min-w-0">
        {title && <h3 className="truncate text-sm font-bold text-slate-900">{title}</h3>}
        {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {seeAll && (
        <button onClick={onSeeAll} className="shrink-0 text-xs font-semibold" style={{ color: accent }}>
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

  return (
    <section>
      <RowHead
        title={str(s.title)}
        subtitle={str(s.subtitle)}
        seeAll={str(s.seeAllLabel)}
        onSeeAll={() => go(str(s.seeAllUrl), str(s.seeAllHandle))}
        accent={accent}
      />
      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const borrowed = inherit(item, data);
          return (
            <div
              key={item.id}
              className="flex w-[150px] shrink-0 flex-col overflow-hidden border border-slate-200 bg-white"
              style={{ borderRadius: radius }}
            >
              <button onClick={() => go(str(item.url), str(item.handle))} className="relative block">
                <Thumb src={borrowed.image} className="h-[120px] w-full" style={{ borderRadius: 0 }} />
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
                    onClick={() => go(str(item.url), str(item.handle))}
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
  const size = int(s.size, 64);
  const showLabel = s.showLabel !== false;
  const showNote = s.showNote !== false;
  const cell = Math.max(size + 14, 56);

  return (
    <section>
      <RowHead
        title={str(s.title)}
        subtitle={str(s.subtitle)}
        seeAll={str(s.seeAllLabel)}
        onSeeAll={() => go(str(s.seeAllUrl), str(s.seeAllHandle))}
        accent={accent}
      />
      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => {
          const borrowed = inherit(item, data);
          return (
            <button
              key={item.id}
              onClick={() => go(str(item.url), str(item.handle))}
              className="flex shrink-0 flex-col items-center"
              style={{ width: cell }}
            >
              <Thumb
                src={borrowed.image}
                className="border border-slate-200"
                style={{ width: size, height: size, borderRadius: 9999 }}
              />
              {showNote && str(item.note) && (
                <span className="mt-1.5 w-full truncate text-center text-[11px] font-bold" style={{ color: accent }}>
                  {str(item.note)}
                </span>
              )}
              {showLabel && (
                <span className="w-full truncate text-center text-[10px] text-slate-500">
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
      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => go(str(item.url), str(item.handle))}
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
          onClick={() => go(str(s.url), str(s.handle))}
          className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
          style={{ background: accent }}
        >
          {button}
        </button>
      )}
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
    case "product_reasons":
      return itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl)).length === 0;
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
      return itemsOf(block).filter((i) => str(i.title) || str(i.imageUrl)).length === 0;
    case "countdown_deals":
      return itemsOf(block).filter((i) => str(i.price) || str(i.imageUrl)).length === 0;
    case "info_rows":
      return itemsOf(block).filter((i) => str(i.title)).length === 0;
    case "live_now": {
      const anyone = itemsOf(block).filter((i) => str(i.name) || str(i.imageUrl)).length > 0;
      const offer = s.offerEnabled !== false && Boolean(str(s.offerTitle) || str(s.offerText));
      return !anyone && !offer;
    }
    default:
      return false;
  }
}
