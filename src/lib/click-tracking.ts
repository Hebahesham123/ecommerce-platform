/**
 * Which presses are worth recording, what they are called, and which of them
 * matter.
 *
 * A press on a button or a link is recorded with its words (or its label for
 * screen readers), where it leads, and whether it is one of the presses that
 * move money or trust: the bag, buying, checkout, placing the order, paying,
 * a coupon, WhatsApp or a call, signing in, deleting or cancelling, returns.
 * A press inside a text field is never recorded, and nothing typed is ever
 * read — only which button was pressed.
 *
 * Shared by the website's beacon and the /shop theme's script (which embeds
 * the pattern below as text), so both call the same presses important.
 */

/** English and Arabic words on the presses that matter. */
// English as whole words (so a "Cardigan" link is not a "card"); Arabic as written,
// since a word boundary means nothing to JavaScript between Arabic letters.
export const IMPORTANT_PATTERN =
  "\\b(add to (cart|bag)|buy|checkout|check out|place order|order now|complete order|confirm|pay|pay now|payment|card|coupon|discount|promo|redeem|apply|whatsapp|call|phone|sign ?in|log ?in|sign ?up|register|create account|subscribe|remove|delete|cancel|return|returns|exchange|refund|wishlist|claim)\\b|" +
  "أضف|اضف|أضيفي|اضيفي|السلة|الحقيبة|اشتري|اشتر|شراء|اطلب|اطلبي|الدفع|ادفع|ادفعي|إتمام|اتمام|أكمل|اكمل|تأكيد|تاكيد|كوبون|كود|خصم|تطبيق|واتساب|اتصل|اتصلي|تسجيل|دخول|حساب|حذف|إزالة|ازالة|إلغاء|الغاء|استرجاع|استبدال|إرجاع|ارجاع|المفضلة|احصلي|استلمي";

const IMPORTANT = new RegExp(IMPORTANT_PATTERN, "i");

export function isImportant(label: string): boolean {
  return IMPORTANT.test(label);
}

/** The element a press belongs to, if it is a button or a link at all. */
export function pressedElement(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target : null;
  if (!el) return null;
  if (el.closest("input:not([type=submit]):not([type=button]), textarea, select, [contenteditable=true]")) return null;
  return el.closest<HTMLElement>("[data-track], a[href], button, [role=button], input[type=submit], input[type=button], summary, label[for]");
}

/** What a press is called: its own tag, its label, or its words — short and on one line. */
export function labelOf(el: HTMLElement): string {
  const named =
    el.getAttribute("data-track") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    (el instanceof HTMLInputElement ? el.value : "") ||
    el.innerText ||
    el.textContent ||
    "";
  const text = named.replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 80);
  // An icon with no words: say what kind of thing it was and where it goes.
  const href = el instanceof HTMLAnchorElement ? el.pathname : "";
  return href ? "link " + href : el.tagName.toLowerCase();
}

/** Where a link leads, as a path (or the other site's name); never its query. */
export function targetOf(el: HTMLElement): string | null {
  if (!(el instanceof HTMLAnchorElement) || !el.href) return null;
  try {
    const u = new URL(el.href);
    if (u.protocol === "tel:" || u.protocol === "mailto:") return u.protocol.slice(0, -1);
    return u.host === location.host ? u.pathname : u.host;
  } catch {
    return null;
  }
}
