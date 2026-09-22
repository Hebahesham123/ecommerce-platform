"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { updateSection } from "../../settings/actions";
import type { Copy, PageCopySpec } from "@/lib/page-copy";

/**
 * The wording of one page, in both languages, beside the page itself.
 *
 * Every box is empty by default and shows the page's own wording as its
 * placeholder, so a merchant can see what they are about to replace and
 * clearing a box puts it back. Nothing here can leave a page blank.
 */
export function CopyForm({
  spec,
  saved,
  onSaved,
}: {
  spec: PageCopySpec;
  saved: Copy;
  /** Reloads the preview, so the change is visible without a refresh. */
  onSaved: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [draft, setDraft] = useState<Copy>(saved);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"ok" | string | null>(null);

  const dirty = spec.fields.some((f) =>
    (["ar", "en"] as const).some(
      (l) => (draft[`${f.key}_${l}`] ?? "") !== (saved[`${f.key}_${l}`] ?? ""),
    ),
  );

  async function save() {
    setBusy(true);
    setDone(null);
    // Empty boxes are dropped rather than stored as "": an absent key is what
    // "use the page's own wording" means everywhere else.
    const clean: Copy = {};
    for (const [k, v] of Object.entries(draft)) {
      const t = (v ?? "").trim();
      if (t) clean[k] = t;
    }
    const res = await updateSection(spec.section, clean);
    setBusy(false);
    if (res.ok) {
      setDone("ok");
      onSaved();
    } else {
      setDone(res.error);
    }
  }

  return (
    <div className="card p-4">
      <h2 className="section-title mb-1">{ar ? "النصوص" : "Wording"}</h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-muted">
        {ar
          ? "اتركي أي خانة فارغة لتبقى الكلمات الأصلية."
          : "Leave a box empty to keep the page's own words."}
        {spec.hint && (
          <span className="mt-1 block">{ar ? spec.hint.ar : spec.hint.en}</span>
        )}
      </p>

      <div className="space-y-3">
        {spec.fields.map((field) => (
          <div key={field.key}>
            <div className="mb-1 text-xs font-medium text-ink">
              {ar ? field.label.ar : field.label.en}
            </div>
            <div className="space-y-1.5">
              {(["en", "ar"] as const).map((l) => {
                const key = `${field.key}_${l}`;
                const common = {
                  value: draft[key] ?? "",
                  placeholder: field.fallback[l],
                  dir: l === "ar" ? ("rtl" as const) : ("ltr" as const),
                  onChange: (e: { target: { value: string } }) =>
                    setDraft((d) => ({ ...d, [key]: e.target.value })),
                };
                return (
                  <div key={l} className="flex items-start gap-2">
                    <span className="mt-2 w-5 shrink-0 text-[10px] font-semibold uppercase text-ink-soft">
                      {l}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea {...common} rows={2} className="inp min-w-0 flex-1 resize-y" />
                    ) : (
                      <input {...common} className="inp min-w-0 flex-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={busy || !dirty}
        className="btn-primary mt-4 w-full justify-center disabled:opacity-50"
      >
        {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "حفظ" : "Save"}
      </button>

      {done === "ok" && (
        <p className="mt-2 text-center text-xs font-medium text-emerald-600">
          {ar ? "تم الحفظ — المعاينة محدَّثة" : "Saved — the preview is up to date"}
        </p>
      )}
      {done && done !== "ok" && (
        <p className="mt-2 text-center text-xs font-medium text-rose-600">{done}</p>
      )}
    </div>
  );
}
