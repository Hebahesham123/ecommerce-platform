"use client";

import { useEffect, useRef, useState } from "react";
import { aiStatus } from "@/app/(admin)/ai/actions";

/**
 * A small reusable "✨ Generate with AI" button.
 *
 * It runs a caller-supplied action (`run`) and hands the result back through
 * `onResult`. It checks `aiStatus()` once on mount and, when no AI key is set,
 * disables itself with a tooltip hinting which env var to set — so every editor
 * gets the same graceful "set an AI key" behaviour for free.
 */
export function AiGenerateButton<T>({
  run,
  onResult,
  label,
  ar = false,
  disabled = false,
  disabledHint,
  className = "",
}: {
  /** Performs the AI action; resolves null when AI returned nothing. */
  run: () => Promise<T | null>;
  /** Receives a non-null result so the caller can apply it to its form. */
  onResult: (result: T) => void;
  /** Override the button label. */
  label?: string;
  /** Admin language — the default label and hints follow it. */
  ar?: boolean;
  /** An extra, caller-controlled disabled state (e.g. a required field is empty). */
  disabled?: boolean;
  /** Tooltip explaining the caller-controlled disabled state. */
  disabledHint?: string;
  className?: string;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    aiStatus()
      .then((s) => {
        if (!alive.current) return;
        setEnabled(s.enabled);
        setProvider(s.provider);
      })
      .catch(() => {
        if (alive.current) setEnabled(false);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  const aiOff = enabled === false;
  const envVar = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const off = aiOff || disabled;

  async function click() {
    if (off || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await run();
      if (res == null) setError(true);
      else onResult(res);
    } catch {
      setError(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  const defaultLabel = ar ? "✨ أنشئ بالذكاء الاصطناعي" : "✨ Generate with AI";
  const tip = aiOff
    ? ar
      ? `أضف مفتاح ذكاء اصطناعي في الخادم (${envVar}) لتفعيل هذه الميزة`
      : `Set an AI key (${envVar}) to enable this`
    : disabled
      ? disabledHint
      : error
        ? ar
          ? "تعذّر الإنشاء، حاول مرة أخرى"
          : "Could not generate — try again"
        : undefined;

  return (
    <button
      type="button"
      onClick={click}
      disabled={off || busy}
      title={tip}
      aria-label={defaultLabel}
      className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-brand-500 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-muted ${className}`}
    >
      {busy ? (ar ? "جارٍ…" : "…") : (label ?? defaultLabel)}
      {error && !busy && <span className="text-rose-500">!</span>}
    </button>
  );
}
