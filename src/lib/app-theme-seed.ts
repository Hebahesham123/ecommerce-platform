import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  DEFAULT_SCREENS,
  DEFAULT_SETTINGS,
  DEFAULT_TABS,
  itemId,
  type AppSettings,
  type AppTheme,
  type Block,
  type BlockType,
  type Item,
} from "@/lib/app-theme";

/**
 * The app's starting point: the website's own home page.
 *
 * A blank app theme is a worse default than it looks. The merchant has already
 * decided what belongs on their front page, in what order, under what
 * headings, pointing at which collections — and asking them to rebuild all of
 * that from an empty list is asking them to do a job they have already done.
 *
 * So the default is read from the published Liquid theme's templates/index.json
 * and translated section by section. Not rendered — translated: a Shopify
 * section is markup and CSS, and what survives the trip to an app is the
 * decision inside it. "A rail of the new-arrivals collection called New
 * Arrivals" survives. Its corner radius does not.
 *
 * This runs only when nothing has been saved. The moment the merchant presses
 * Save, their arrangement is the theme and the website stops being consulted —
 * otherwise an edit on one side would silently undo an edit on the other.
 */

type Raw = Record<string, unknown>;

const str = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const num = (v: unknown, fallback: number): number =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Math.trunc(Number(v)) : fallback;

/** `shopify://collections/summer-2027` → `summer-2027`. Anything else → "". */
function handleOf(...candidates: unknown[]): string {
  for (const c of candidates) {
    const v = str(c, 300);
    if (!v) continue;
    const m = /^shopify:\/\/collections\/([^/?#]+)/.exec(v) ?? /^\/collections\/([^/?#]+)/.exec(v);
    if (m) return decodeURIComponent(m[1]).toLowerCase();
    // A bare handle, which several sections store instead of a URL.
    if (/^[a-z0-9][a-z0-9-]*$/i.test(v)) return v.toLowerCase();
  }
  return "";
}

/**
 * Images are the one thing that cannot come across.
 *
 * The theme refers to them as `shopify://shop_images/…`, which is a pointer
 * into the Shopify account the theme was exported from. This platform has no
 * such account and the files are not in the bundle, so the reference resolves
 * to nothing — on the website as much as here. Better an empty image the
 * editor flags than a broken URL baked into the app.
 */
function imageOf(v: unknown): string {
  const s = str(v, 500);
  return /^https?:\/\//i.test(s) ? s : "";
}

/** Two half-headings — "Bags" + "& Clutches" — are one heading to an app. */
const joined = (...parts: unknown[]) =>
  parts.map((p) => str(p)).filter(Boolean).join(" ").trim();

function blockId(): string {
  return `b-${Math.random().toString(36).slice(2, 8)}`;
}

function blocksOf(section: Raw): Raw[] {
  const order = Array.isArray(section.block_order)
    ? (section.block_order as string[])
    : Object.keys((section.blocks as Raw) ?? {});
  const all = (section.blocks as Record<string, Raw>) ?? {};
  return order.map((id) => all[id]).filter(Boolean);
}
const settingsOf = (r: Raw): Raw => ((r.settings as Raw) ?? {}) as Raw;

/** One theme section → one app block, or null when nothing survives the trip. */
function translate(type: string, section: Raw): Block | null {
  const s = settingsOf(section);
  const kids = blocksOf(section).map(settingsOf);
  const make = (t: BlockType, settings: Raw): Block => ({ id: blockId(), type: t, settings });
  const items = (list: Item[]): Item[] => list.filter(Boolean).slice(0, 12);

  switch (type) {
    case "hero-banner":
    case "slideshow":
    case "image-banner":
      return make("hero", {
        items: items(
          kids.map((k) => ({
            id: itemId(),
            imageUrl: imageOf(k.image),
            kicker: str(k.kicker),
            heading: str(k.heading),
            subheading: str(k.subheading),
            handle: handleOf(k.link, k.button_link, k.cta_link),
          })),
        ),
      });

    case "offer-ticker-bar":
    case "announcement-bar":
      return make("promo_bar", {
        lead: joined(s.offer_lead, s.offer_label),
        rest: str(s.offer_rest),
        code: str(s.discount_code, 40),
      });

    case "category-circles":
    case "shop-by-category":
    case "collection-list":
      return make("categories", {
        title: joined(s.heading, s.heading_italic),
        style: type === "category-circles" ? "circles" : "tiles",
        items: items(
          kids.map((k) => ({
            id: itemId(),
            handle: handleOf(k.collection, k.link, k.custom_link),
            label: str(k.custom_label) || str(k.label),
            emoji: str(k.emoji, 8),
            imageUrl: imageOf(k.image),
          })),
        ),
      });

    case "product-rail":
      return make("collection_tabs", {
        kicker: str(s.kicker),
        title: joined(s.heading, s.heading_italic),
        limit: Math.min(num(s.products_shown, 8), 12),
        items: items(
          kids.map((k) => ({
            id: itemId(),
            handle: handleOf(k.collection, k.link),
            label: str(k.label),
            emoji: str(k.emoji, 8),
          })),
        ),
      });

    case "price-tiers":
      return make("tiers", {
        title: joined(s.heading, s.heading_italic),
        items: items(
          kids.map((k) => ({
            id: itemId(),
            prefix: str(k.prefix, 20),
            amount: joined(k.currency, k.amount),
            label: str(k.label),
            handle: handleOf(k.collection, k.custom_link),
          })),
        ),
      });

    case "her-him-split":
      return make("split", {
        title: joined(s.word_1, s.divider_mark, s.word_2),
        items: items(
          kids.map((k) => ({
            id: itemId(),
            imageUrl: imageOf(k.image),
            label: str(k.label),
            buttonLabel: str(k.btn_label),
            handle: handleOf(k.collection, k.link),
          })),
        ),
      });

    case "shop-by-palette":
    case "style-timeline":
    case "summer":
    case "multicolumn":
      return make("cards", {
        kicker: str(s.kicker),
        title: joined(s.heading, s.heading_italic),
        items: items(
          kids.map((k) => ({
            id: itemId(),
            imageUrl: imageOf(k.image),
            title: str(k.title) || str(k.label),
            subtitle: str(k.line1) || str(k.subtitle) || str(k.description),
            handle: handleOf(k.collection, k.link, k.custom_link),
          })),
        ),
      });

    case "trust-badges-bar":
      return make("trust_badges", {
        items: items(
          kids.map((k) => ({
            id: itemId(),
            emoji: str(k.emoji, 8),
            title: str(k.title),
            subtitle: str(k.sub) || str(k.subtitle),
          })),
        ),
      });

    case "customer-review":
    case "testimonials":
      return make("reviews", {
        title: joined(s.heading, s.heading_italic) || "What customers say",
        limit: 6,
      });

    case "curatedsunny-days":
    case "installment-banner":
    case "details-zoom":
    case "image-with-text":
      return make("banner", {
        imageUrl: imageOf(s.image),
        heading: joined(s.title_line1, s.title_em, s.title_line2) || joined(s.heading, s.heading_italic),
        subheading: str(s.subtitle) || str(s.subtext),
        handle: handleOf(s.cta_url, s.cta_link, s.button_link, s.collection),
      });

    case "featured-collection":
      return make("collection_row", {
        handle: handleOf(s.collection),
        title: joined(s.heading, s.heading_italic),
        limit: Math.min(num(s.products_to_show, 8), 12),
      });

    case "rich-text":
      return make("text", {
        heading: joined(s.heading, s.heading_italic),
        body: str(s.subtext) || str(s.intro),
      });

    default: {
      // Not every section has an app equivalent, but many unfamiliar ones are
      // still "a collection under a heading" — the commonest shape there is.
      const handle = handleOf(s.collection);
      if (handle) {
        return make("collection_row", {
          handle,
          title: joined(s.heading, s.heading_italic),
          limit: Math.min(num(s.product_limit ?? s.products_shown, 8), 12),
        });
      }
      return null;
    }
  }
}

/**
 * The accent colour, taken from the theme rather than guessed.
 *
 * Sections carry their palette in their own settings — `accent_color`,
 * `caramel`, `gold` — so the colour that appears most often across the home
 * page is the one the shop is actually built around.
 */
function accentOf(sections: Raw[]): string {
  const counts = new Map<string, number>();
  for (const section of sections) {
    for (const [key, value] of Object.entries(settingsOf(section))) {
      if (!/accent|caramel|gold|brand|primary/i.test(key)) continue;
      const v = str(value, 9).toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(v)) continue;
      // Near-white and near-black are chrome, not an accent.
      if (["#ffffff", "#fffdfa", "#000000", "#211a15"].includes(v)) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? DEFAULT_SETTINGS.accent;
}

const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Read the live theme's home page and translate it.
 *
 * Returns null when there is no theme, no home template, or nothing in it that
 * an app can show — in which case the caller falls back to the plain default
 * rather than an empty screen.
 */
export async function seedFromWebsite(shopName?: string): Promise<AppTheme | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getServerSupabase();
    const { data: themes } = await supabase
      .from("themes")
      .select("id,storage_path,is_current,updated_at")
      .order("updated_at", { ascending: false });
    if (!themes?.length) return null;

    const live = themes.find((t: Raw) => t.is_current) ?? themes[0];
    const prefix = str((live as Raw).storage_path, 200) || String((live as Raw).id);

    const file = await supabase.storage.from("themes").download(`${prefix}/templates/index.json`);
    if (file.error || !file.data) return null;

    const parsed = JSON.parse(stripComments(await file.data.text())) as {
      order?: string[];
      sections?: Record<string, Raw>;
    };
    const all = parsed.sections ?? {};
    const order = Array.isArray(parsed.order) ? parsed.order : Object.keys(all);

    const raws: Raw[] = [];
    const blocks: Block[] = [];
    for (const id of order) {
      const section = all[id];
      if (!section) continue;
      raws.push(section);
      const block = translate(str(section.type, 80), section);
      if (block) blocks.push(block);
    }
    if (!blocks.length) return null;

    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      storeName: str(shopName, 60) || DEFAULT_SETTINGS.storeName,
      accent: accentOf(raws),
    };
    // Tabs and the other screens start at their defaults — the website has
    // no equivalent to translate, and a shop that wants different wording says
    // so in the editor.
    return { settings, blocks, tabs: DEFAULT_TABS, screens: DEFAULT_SCREENS };
  } catch {
    // A theme we cannot read is not a reason to have no app.
    return null;
  }
}
