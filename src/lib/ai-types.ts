/**
 * Provider-agnostic AI config shape + defaults — pure, client-safe (no server
 * imports). The admin settings card and the server-only client both import from
 * here, mirroring the seo-types.ts vs seo-settings.ts split.
 *
 * API KEYS ARE NEVER STORED HERE. Only the provider and an optional model
 * override live in the database; the keys are read from the environment
 * (ANTHROPIC_API_KEY / OPENAI_API_KEY) at call time.
 */
export type AiProvider = "anthropic" | "openai";

export type AiConfig = {
  provider: AiProvider;
  /** Optional model override. Empty string means "use the built-in default". */
  model: string;
};

export const DEFAULT_AI: AiConfig = { provider: "anthropic", model: "" };

/** Coerce whatever is stored (possibly partial / wrong types) into a full, safe config. */
export function normalizeAi(raw: unknown): AiConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const provider: AiProvider = o.provider === "openai" ? "openai" : "anthropic";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  return { provider, model };
}
