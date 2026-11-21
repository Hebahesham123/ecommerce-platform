import "server-only";
import { aiComplete } from "@/lib/ai";

/**
 * AI SEO + copy generation for the admin editors.
 *
 * Every function returns null when AI is off or on any error, so a "Generate"
 * button simply does nothing (and shows a hint) rather than failing. Output
 * follows the admin's current language.
 */

export type ContentKind = "product" | "collection" | "blog" | "page";

type MetaInput = {
  kind: ContentKind;
  title?: string;
  context?: string;
  lang: "ar" | "en";
};

type CopyInput = MetaInput & {
  /** Extra guidance for what to write (e.g. "a 1–2 sentence excerpt"). */
  instructions?: string;
};

const KIND_LABEL: Record<ContentKind, string> = {
  product: "product",
  collection: "collection",
  blog: "blog article",
  page: "store page",
};

function langName(lang: "ar" | "en"): string {
  return lang === "ar" ? "Arabic" : "English";
}

function clip(s: string | undefined, max: number): string {
  const v = (s ?? "").trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

/**
 * A search-engine title (~60 chars) and meta description (~155 chars) for the
 * given item, in the admin's language. Returns null when AI is unavailable.
 */
export async function generateSeoMeta(
  input: MetaInput,
): Promise<{ title: string; description: string } | null> {
  const prompt =
    `Write SEO metadata for a ${KIND_LABEL[input.kind]} in an online store.\n` +
    `Write it in ${langName(input.lang)}.\n` +
    (input.title ? `Name/title: ${clip(input.title, 200)}\n` : "") +
    (input.context ? `Context: ${clip(input.context, 1500)}\n` : "") +
    `\nReturn JSON exactly like {"title":"…","description":"…"} where "title" is ` +
    `a compelling page title (about 60 characters) and "description" is a meta ` +
    `description (about 155 characters). No quotes around the whole object's values beyond JSON.`;
  const out = await aiComplete({
    system: "You are an SEO copywriter. Output only the requested JSON.",
    prompt,
    json: true,
    maxTokens: 400,
  });
  if (!out) return null;
  try {
    const parsed = JSON.parse(out) as { title?: unknown; description?: unknown };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    if (!title && !description) return null;
    return { title, description };
  } catch {
    return null;
  }
}

/**
 * A block of marketing copy (product/collection description, blog excerpt, …)
 * in the admin's language. Returns null when AI is unavailable.
 */
export async function generateCopy(input: CopyInput): Promise<string | null> {
  const prompt =
    `Write ${input.instructions ? input.instructions : `an engaging ${KIND_LABEL[input.kind]} description`} ` +
    `for an online store.\n` +
    `Write it in ${langName(input.lang)}.\n` +
    (input.title ? `Name/title: ${clip(input.title, 200)}\n` : "") +
    (input.context ? `Context: ${clip(input.context, 1500)}\n` : "") +
    `\nReturn only the text itself — no title, no labels, no markdown fences.`;
  const out = await aiComplete({
    system: "You are a concise, persuasive e-commerce copywriter.",
    prompt,
    maxTokens: 700,
  });
  return out ? out.trim() : null;
}
