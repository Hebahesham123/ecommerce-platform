import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { DEFAULT_AI, normalizeAi, type AiConfig, type AiProvider } from "@/lib/ai-types";

/**
 * Provider-agnostic AI client.
 *
 * Every function here is best-effort: it returns null (or false) rather than
 * throwing, so an AI call can never break a page, a search, or an order. When
 * no API key is set, the whole feature set simply reports "off" and callers
 * fall back to their existing keyword / rule-based behaviour.
 *
 * The provider and an optional model override are read from
 * `store_settings.data.ai` (cached 60s) and may be overridden by the
 * AI_PROVIDER / AI_MODEL env vars. API KEYS COME FROM THE ENVIRONMENT ONLY
 * (ANTHROPIC_API_KEY / OPENAI_API_KEY) and are never stored.
 */

// ---- Config (cached) --------------------------------------------------------
const AI_TTL_MS = 60_000;
let aiCache: { at: number; value: AiConfig } | null = null;

/** Forget the cached AI config (call after the admin save). */
export function invalidateAi(): void {
  aiCache = null;
}

async function readStoredAi(): Promise<AiConfig> {
  if (aiCache && Date.now() - aiCache.at < AI_TTL_MS) return aiCache.value;
  if (!isSupabaseConfigured()) {
    const value = normalizeAi(null);
    aiCache = { at: Date.now(), value };
    return value;
  }
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("store_settings")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    const raw = (data?.data as Record<string, unknown> | null)?.ai;
    const value = normalizeAi(raw);
    aiCache = { at: Date.now(), value };
    return value;
  } catch {
    return normalizeAi(null);
  }
}

/**
 * The provider/model in effect: the stored config, with optional env overrides
 * layered on top. Never reads or exposes an API key.
 */
export async function readAiConfig(): Promise<AiConfig> {
  const stored = await readStoredAi();
  const envProvider = process.env.AI_PROVIDER;
  const envModel = process.env.AI_MODEL;
  return normalizeAi({
    provider: envProvider ?? stored.provider,
    model: envModel ?? stored.model,
  });
}

function keyFor(provider: AiProvider): string | undefined {
  const v = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  return v && v.trim() ? v.trim() : undefined;
}

/** True when the selected provider's env key is present. Never throws. */
export async function aiEnabled(): Promise<boolean> {
  try {
    const cfg = await readAiConfig();
    return Boolean(keyFor(cfg.provider));
  } catch {
    return false;
  }
}

// ---- Model selection --------------------------------------------------------
// A cheap/fast model vs. a capable one. An explicit AiConfig.model always wins.
const FAST: Record<AiProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};
const CAPABLE: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini",
};

function pickModel(cfg: AiConfig, fast: boolean): string {
  if (cfg.model.trim()) return cfg.model.trim();
  return (fast ? FAST : CAPABLE)[cfg.provider];
}

// ---- Completion -------------------------------------------------------------
// A generous per-request ceiling: callers that need search latency wrap their
// own call with a much shorter timeout and fall back to keyword results.
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_TOKENS_CAP = 4096;

/** Pull the first balanced JSON object/array out of a model response. */
function extractJson(text: string): string {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) return t;
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  const end = t.lastIndexOf(close);
  if (end > start) return t.slice(start, end + 1);
  return t;
}

/** An AbortSignal that fires after `ms`, plus a cancel to clear the timer. */
function abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(id) };
}

async function callAnthropic(
  key: string,
  model: string,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
): Promise<string | null> {
  const { signal, cancel } = abortAfter(REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b?.type === "text")
      .map((b) => b?.text ?? "")
      .join("");
    return text || null;
  } finally {
    cancel();
  }
}

async function callOpenai(
  key: string,
  model: string,
  system: string | undefined,
  prompt: string,
  maxTokens: number,
): Promise<string | null> {
  const { signal, cancel } = abortAfter(REQUEST_TIMEOUT_MS);
  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return text || null;
  } finally {
    cancel();
  }
}

/**
 * One small completion. Returns the model's text, or null when AI is off or on
 * any error (never throws). With `json:true` the model is told to answer with
 * raw JSON only and the result is validated with JSON.parse (the extracted JSON
 * string is returned on success; the raw string is returned if it won't parse).
 */
export async function aiComplete(opts: {
  system?: string;
  prompt: string;
  json?: boolean;
  maxTokens?: number;
  fast?: boolean;
}): Promise<string | null> {
  const { prompt, json = false, fast = false } = opts;
  const maxTokens = Math.max(1, Math.min(opts.maxTokens ?? 1024, MAX_TOKENS_CAP));

  let cfg: AiConfig;
  try {
    cfg = await readAiConfig();
  } catch {
    return null;
  }
  const key = keyFor(cfg.provider);
  if (!key) return null;

  const model = pickModel(cfg, fast);
  const system = json
    ? `${opts.system ? `${opts.system}\n\n` : ""}Respond with raw JSON only — no prose, no code fences.`
    : opts.system;

  try {
    const text =
      cfg.provider === "openai"
        ? await callOpenai(key, model, system, prompt, maxTokens)
        : await callAnthropic(key, model, system, prompt, maxTokens);
    if (text == null) return null;
    if (json) {
      const extracted = extractJson(text);
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        return text;
      }
    }
    return text.trim();
  } catch {
    return null;
  }
}

export { DEFAULT_AI };
export type { AiConfig, AiProvider };
