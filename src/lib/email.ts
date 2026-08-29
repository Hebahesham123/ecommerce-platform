// Email marketing model + renderer.
//
// Templates are made of stackable BLOCKS (logo, hero image, heading, text,
// button, product grid, divider, spacer, footer) — the Shopify-style building
// blocks. `renderEmailHtml` turns a template into a responsive, table-based HTML
// email with inline styles (the only thing email clients reliably support).
//
// Persistence is client-side (localStorage) for now so the whole feature works
// with zero setup; it is structured to lift into Supabase later untouched.

export type Align = "left" | "center" | "right";

export type EmailProduct = {
  title: string;
  price: string; // pre-formatted, e.g. "250 EGP"
  image: string;
  href: string;
};

export type EmailBlock =
  | { id: string; type: "logo"; src: string; width: number; align: Align }
  | { id: string; type: "image"; src: string; href: string; align: Align }
  | { id: string; type: "heading"; text: string; align: Align; size: number; color: string }
  | { id: string; type: "text"; text: string; align: Align; color: string }
  | { id: string; type: "button"; text: string; href: string; align: Align; bg: string; color: string }
  | { id: string; type: "divider"; color: string }
  | { id: string; type: "spacer"; height: number }
  | { id: string; type: "products"; heading: string; columns: 2 | 3; items: EmailProduct[] }
  | { id: string; type: "footer"; text: string; unsubscribe: boolean };

export type EmailBlockType = EmailBlock["type"];

export type EmailTheme = {
  pageBg: string; // outer canvas
  cardBg: string; // email body
  text: string;
  accent: string;
  fontFamily: string;
  width: number; // content width in px
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  theme: EmailTheme;
  blocks: EmailBlock[];
  updatedAt: number;
};

export const DEFAULT_THEME: EmailTheme = {
  pageBg: "#f3f4f6",
  cardBg: "#ffffff",
  text: "#1f2937",
  accent: "#111111",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  width: 600,
};

// ---- Merge tags -------------------------------------------------------------
export const MERGE_TAGS: { tag: string; label: string }[] = [
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{name}}", label: "Full name" },
  { tag: "{{shop_name}}", label: "Shop name" },
  { tag: "{{discount_code}}", label: "Discount code" },
  { tag: "{{order_count}}", label: "Order count" },
  { tag: "{{total_spent}}", label: "Total spent" },
  { tag: "{{unsubscribe_url}}", label: "Unsubscribe link" },
];

export type MergeContext = Record<string, string>;

export function applyMergeTags(text: string, ctx: MergeContext): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => {
    const v = ctx[String(key).toLowerCase()];
    return v == null ? m : v;
  });
}

/** Sample values so the editor preview reads like a real send. */
export const SAMPLE_CONTEXT: MergeContext = {
  first_name: "Mariam",
  name: "Mariam Hassan",
  shop_name: "BeautyBar",
  discount_code: "WELCOME10",
  order_count: "3",
  total_spent: "1,250 EGP",
  unsubscribe_url: "#",
};

// ---- HTML rendering ---------------------------------------------------------
const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

// Text blocks allow a couple of simple, safe formatting tags the editor emits.
function richText(s: string): string {
  return esc(s)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function pad(inner: string, px = 24): string {
  return `<tr><td style="padding:8px ${px}px">${inner}</td></tr>`;
}

function blockHtml(b: EmailBlock, theme: EmailTheme, ctx: MergeContext): string {
  switch (b.type) {
    case "logo":
      return pad(
        `<div style="text-align:${b.align}">${
          b.src
            ? `<img src="${esc(b.src)}" width="${b.width}" alt="logo" style="display:inline-block;max-width:100%;height:auto;border:0">`
            : `<div style="display:inline-block;color:#9ca3af;font:600 13px sans-serif;border:1px dashed #d1d5db;border-radius:8px;padding:14px 20px">Your logo</div>`
        }</div>`,
      );
    case "image": {
      const img = b.src
        ? `<img src="${esc(b.src)}" alt="" style="display:block;width:100%;max-width:${theme.width - 0}px;height:auto;border:0;border-radius:10px">`
        : `<div style="background:#eef1f4;border-radius:10px;padding:64px 0;text-align:center;color:#9ca3af;font:600 13px sans-serif">Image</div>`;
      const wrapped = b.href ? `<a href="${esc(applyMergeTags(b.href, ctx))}">${img}</a>` : img;
      return `<tr><td style="padding:8px 24px;text-align:${b.align}">${wrapped}</td></tr>`;
    }
    case "heading":
      return pad(
        `<h1 style="margin:0;font-family:${theme.fontFamily};font-size:${b.size}px;line-height:1.25;font-weight:700;color:${b.color};text-align:${b.align}">${richText(
          applyMergeTags(b.text, ctx),
        )}</h1>`,
      );
    case "text":
      return pad(
        `<div style="margin:0;font-family:${theme.fontFamily};font-size:16px;line-height:1.6;color:${b.color};text-align:${b.align}">${richText(
          applyMergeTags(b.text, ctx),
        )}</div>`,
      );
    case "button": {
      const href = esc(applyMergeTags(b.href || "#", ctx));
      return pad(
        `<div style="text-align:${b.align}"><a href="${href}" style="display:inline-block;background:${b.bg};color:${b.color};font-family:${theme.fontFamily};font-size:15px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:10px">${esc(
          applyMergeTags(b.text, ctx),
        )}</a></div>`,
      );
    }
    case "divider":
      return pad(`<div style="border-top:1px solid ${b.color};font-size:0;line-height:0">&nbsp;</div>`, 24);
    case "spacer":
      return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:0">&nbsp;</td></tr>`;
    case "products": {
      const cols = b.columns;
      const w = Math.floor(100 / cols);
      const cells =
        b.items.length === 0
          ? `<td style="padding:8px;color:#9ca3af;font:600 13px sans-serif;text-align:center">Add products to this block</td>`
          : b.items
              .map(
                (p) =>
                  `<td valign="top" width="${w}%" style="padding:8px">
<a href="${esc(p.href || "#")}" style="text-decoration:none;color:${theme.text}">
${p.image ? `<img src="${esc(p.image)}" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:10px">` : `<div style="background:#eef1f4;border-radius:10px;padding:44px 0"></div>`}
<div style="font-family:${theme.fontFamily};font-size:14px;font-weight:600;margin-top:8px">${esc(p.title)}</div>
<div style="font-family:${theme.fontFamily};font-size:14px;color:${theme.accent};font-weight:700;margin-top:2px">${esc(p.price)}</div>
</a></td>`,
              )
              .join("");
      // chunk into rows of `cols`
      const items = b.items.length ? b.items : [null];
      const rows: string[] = [];
      for (let i = 0; i < items.length; i += cols) {
        const slice = b.items.slice(i, i + cols);
        const rowCells = slice.length
          ? slice
              .map(
                (p) =>
                  `<td valign="top" width="${w}%" style="padding:8px">
<a href="${esc(p.href || "#")}" style="text-decoration:none;color:${theme.text}">
${p.image ? `<img src="${esc(p.image)}" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:10px">` : `<div style="background:#eef1f4;border-radius:10px;padding:44px 0"></div>`}
<div style="font-family:${theme.fontFamily};font-size:14px;font-weight:600;margin-top:8px">${esc(p.title)}</div>
<div style="font-family:${theme.fontFamily};font-size:14px;color:${theme.accent};font-weight:700;margin-top:2px">${esc(p.price)}</div>
</a></td>`,
              )
              .join("")
          : cells;
        rows.push(`<tr>${rowCells}</tr>`);
      }
      const head = b.heading
        ? `<div style="font-family:${theme.fontFamily};font-size:18px;font-weight:700;color:${theme.text};padding:0 8px 4px">${esc(
            applyMergeTags(b.heading, ctx),
          )}</div>`
        : "";
      return `<tr><td style="padding:8px 16px">${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.join(
        "",
      )}</table></td></tr>`;
    }
    case "footer":
      return `<tr><td style="padding:20px 24px;border-top:1px solid #eceef1;font-family:${theme.fontFamily};font-size:12px;line-height:1.6;color:#9ca3af;text-align:center">${richText(
        applyMergeTags(b.text, ctx),
      )}${
        b.unsubscribe
          ? `<div style="margin-top:8px"><a href="${esc(ctx.unsubscribe_url || "#")}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a></div>`
          : ""
      }</td></tr>`;
    default:
      return "";
  }
}

/** Render a template to a full, responsive HTML email document. */
export function renderEmailHtml(t: EmailTemplate, ctx: MergeContext = SAMPLE_CONTEXT): string {
  const theme = t.theme;
  const body = t.blocks.map((b) => blockHtml(b, theme, ctx)).join("");
  const preheader = t.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(applyMergeTags(t.preheader, ctx))}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(
    applyMergeTags(t.subject, ctx),
  )}</title></head>
<body style="margin:0;padding:0;background:${theme.pageBg}">${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.pageBg}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="${theme.width}" cellpadding="0" cellspacing="0" style="width:${theme.width}px;max-width:100%;background:${theme.cardBg};border-radius:16px;overflow:hidden">
${body}
</table>
</td></tr></table>
</body></html>`;
}

// ---- Block factory ----------------------------------------------------------
let seq = 0;
export function uid(): string {
  seq += 1;
  return `b${seq}_${Math.floor(performance.now?.() ?? 0)}`;
}

export function newBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "logo":
      return { id: uid(), type, src: "", width: 140, align: "center" };
    case "image":
      return { id: uid(), type, src: "", href: "", align: "center" };
    case "heading":
      return { id: uid(), type, text: "Your headline here", align: "center", size: 26, color: "#111111" };
    case "text":
      return { id: uid(), type, text: "Write your message here. Use **bold** and new lines freely.", align: "center", color: "#4b5563" };
    case "button":
      return { id: uid(), type, text: "Shop now", href: "https://", align: "center", bg: "#111111", color: "#ffffff" };
    case "divider":
      return { id: uid(), type, color: "#e5e7eb" };
    case "spacer":
      return { id: uid(), type, height: 24 };
    case "products":
      return { id: uid(), type, heading: "You may also like", columns: 3, items: [] };
    case "footer":
      return {
        id: uid(),
        type,
        text: "{{shop_name}} · Cairo, Egypt\nYou're receiving this because you shopped with us.",
        unsubscribe: true,
      };
  }
}

export const BLOCK_LABELS: Record<EmailBlockType, string> = {
  logo: "Logo",
  image: "Image",
  heading: "Heading",
  text: "Text",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  products: "Product grid",
  footer: "Footer",
};

// ---- Starter templates ------------------------------------------------------
function tpl(id: string, name: string, subject: string, preheader: string, blocks: EmailBlock[]): EmailTemplate {
  return { id, name, subject, preheader, theme: { ...DEFAULT_THEME }, blocks, updatedAt: 0 };
}
// Distributive omit so each union member keeps its own props (a plain
// Omit<Union, "id"> would collapse to just the shared keys).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
let s = 0;
const b = (block: DistributiveOmit<EmailBlock, "id">) => ({ ...block, id: `s${s++}` }) as EmailBlock;

export function starterTemplates(): EmailTemplate[] {
  s = 0;
  return [
    tpl("welcome", "Welcome", "Welcome to {{shop_name}} 🎉", "A little gift to get you started", [
      b({ type: "logo", src: "", width: 140, align: "center" }),
      b({ type: "heading", text: "Welcome, {{first_name}} 👋", align: "center", size: 26, color: "#111111" }),
      b({ type: "text", text: "Thanks for joining **{{shop_name}}**. Here's **10% off** your first order.", align: "center", color: "#4b5563" }),
      b({ type: "heading", text: "{{discount_code}}", align: "center", size: 22, color: "#111111" }),
      b({ type: "button", text: "Start shopping", href: "https://", align: "center", bg: "#111111", color: "#ffffff" }),
      b({ type: "footer", text: "{{shop_name}} · Cairo, Egypt", unsubscribe: true }),
    ]),
    tpl("sale", "Big sale", "Up to 50% off — today only", "Your favorites are on sale", [
      b({ type: "image", src: "", href: "https://", align: "center" }),
      b({ type: "heading", text: "The sale is on 🔥", align: "center", size: 28, color: "#111111" }),
      b({ type: "text", text: "Up to **50% off** across the store. Ends tonight.", align: "center", color: "#4b5563" }),
      b({ type: "button", text: "Shop the sale", href: "https://", align: "center", bg: "#e11d48", color: "#ffffff" }),
      b({ type: "products", heading: "Trending now", columns: 3, items: [] }),
      b({ type: "footer", text: "{{shop_name}}", unsubscribe: true }),
    ]),
    tpl("abandoned", "Abandoned cart", "You left something behind 🛒", "Complete your order before it sells out", [
      b({ type: "logo", src: "", width: 140, align: "center" }),
      b({ type: "heading", text: "Still thinking it over?", align: "center", size: 24, color: "#111111" }),
      b({ type: "text", text: "Your cart is waiting, {{first_name}}. Grab it before it's gone.", align: "center", color: "#4b5563" }),
      b({ type: "products", heading: "In your cart", columns: 2, items: [] }),
      b({ type: "button", text: "Finish checkout", href: "https://", align: "center", bg: "#111111", color: "#ffffff" }),
      b({ type: "footer", text: "{{shop_name}}", unsubscribe: true }),
    ]),
    tpl("vip", "VIP offer", "A thank-you, {{first_name}} 💜", "Because you're one of our best", [
      b({ type: "heading", text: "You're a VIP 💜", align: "center", size: 26, color: "#111111" }),
      b({ type: "text", text: "You've placed **{{order_count}}** orders with us. Here's an exclusive **15% off**.", align: "center", color: "#4b5563" }),
      b({ type: "heading", text: "{{discount_code}}", align: "center", size: 22, color: "#7c3aed" }),
      b({ type: "button", text: "Shop as a VIP", href: "https://", align: "center", bg: "#7c3aed", color: "#ffffff" }),
      b({ type: "footer", text: "{{shop_name}}", unsubscribe: true }),
    ]),
    tpl("newsletter", "Newsletter", "New in this week ✨", "Fresh arrivals just for you", [
      b({ type: "logo", src: "", width: 140, align: "center" }),
      b({ type: "heading", text: "New arrivals ✨", align: "center", size: 26, color: "#111111" }),
      b({ type: "text", text: "Hand-picked pieces we think you'll love.", align: "center", color: "#4b5563" }),
      b({ type: "products", heading: "", columns: 3, items: [] }),
      b({ type: "button", text: "See everything", href: "https://", align: "center", bg: "#111111", color: "#ffffff" }),
      b({ type: "footer", text: "{{shop_name}}", unsubscribe: true }),
    ]),
    tpl("blank", "Blank", "", "", [
      b({ type: "logo", src: "", width: 140, align: "center" }),
      b({ type: "text", text: "Start writing…", align: "center", color: "#4b5563" }),
      b({ type: "footer", text: "{{shop_name}}", unsubscribe: true }),
    ]),
  ];
}
