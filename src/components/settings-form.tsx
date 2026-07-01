"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSection, type Field, type ListSpec } from "@/lib/settings";
import { getSettings, updateSection } from "@/app/(admin)/settings/actions";
import { Card } from "@/components/ui";
import { IcPlus, IcTrash, IcAlert } from "@/components/icons";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100";

type Vals = Record<string, unknown>;

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { lang } = useI18n();
  if (field.type === "toggle") {
    return (
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded accent-brand-600"
        />
        <span className="text-sm text-ink">{field.label[lang]}</span>
      </label>
    );
  }
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{field.label[lang]}</label>
      {field.type === "textarea" ? (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`${inputCls} h-auto py-2`}
        />
      ) : field.type === "select" ? (
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label[lang]}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : field.type}
          value={(value as string | number) ?? ""}
          onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          placeholder={field.placeholder}
          className={inputCls}
          dir={field.type === "email" || field.type === "tel" || field.type === "number" ? "ltr" : undefined}
        />
      )}
      {field.help && <p className="mt-1 text-xs text-ink-soft">{field.help[lang]}</p>}
    </div>
  );
}

function ListEditor({
  spec,
  rows,
  onChange,
}: {
  spec: ListSpec;
  rows: Vals[];
  onChange: (rows: Vals[]) => void;
}) {
  const { lang } = useI18n();
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink">{spec.label[lang]}</div>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface-page p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {spec.itemFields.map((f) => (
                <div key={f.key} className={f.half === false ? "sm:col-span-2" : ""}>
                  <FieldInput
                    field={f}
                    value={row[f.key]}
                    onChange={(v) => {
                      const next = [...rows];
                      next[i] = { ...next[i], [f.key]: v };
                      onChange(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="btn-ghost mt-2 h-7 gap-1.5 px-2 text-xs text-rose-600 hover:bg-rose-50"
            >
              <IcTrash className="h-3.5 w-3.5" /> {lang === "ar" ? "حذف" : "Remove"}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, {}])}
        className="btn-outline mt-3 gap-1.5"
      >
        <IcPlus className="h-4 w-4" /> {spec.addLabel[lang]}
      </button>
    </div>
  );
}

export function SettingsForm({ sectionKey }: { sectionKey: string }) {
  const { t, lang } = useI18n();
  const section = getSection(sectionKey);
  const [vals, setVals] = useState<Vals>({});
  const [lists, setLists] = useState<Record<string, Vals[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((res) => {
      if (res.ok) {
        const data = (res.data[sectionKey] as Vals) ?? {};
        setVals(data);
        const lz: Record<string, Vals[]> = {};
        for (const l of section?.lists ?? []) lz[l.key] = Array.isArray(data[l.key]) ? (data[l.key] as Vals[]) : [];
        setLists(lz);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  if (!section) return <Card className="p-8 text-center text-sm text-ink-soft">Unknown section</Card>;

  async function save() {
    setSaving(true);
    setSaved(false);
    const payload: Vals = { ...vals };
    for (const l of section!.lists ?? []) payload[l.key] = lists[l.key] ?? [];
    const res = await updateSection(sectionKey, payload);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(res.error === "not_configured" ? t("supabase_missing") : res.error);
    }
  }

  const scalars = section.fields ?? [];
  const toggles = scalars.filter((f) => f.type === "toggle");
  const inputs = scalars.filter((f) => f.type !== "toggle");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink md:text-2xl">{section.label[lang]}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">{section.desc[lang]}</p>
      </div>

      {error === "not_configured" && (
        <Card className="flex items-center gap-3 bg-amber-50/60 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-card">
            <IcAlert className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-amber-800">{t("supabase_missing")}</span>
        </Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-sm text-ink-soft">{t("loading")}</Card>
      ) : (
        <>
          {inputs.length > 0 && (
            <Card className="p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {inputs.map((f) => (
                  <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
                    <FieldInput field={f} value={vals[f.key]} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {toggles.length > 0 && (
            <Card className="space-y-3 p-5">
              {toggles.map((f) => (
                <FieldInput key={f.key} field={f} value={vals[f.key]} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
              ))}
            </Card>
          )}

          {(section.lists ?? []).map((l) => (
            <Card key={l.key} className="p-5">
              <ListEditor spec={l} rows={lists[l.key] ?? []} onChange={(rows) => setLists((s) => ({ ...s, [l.key]: rows }))} />
            </Card>
          ))}

          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-emerald-600">{lang === "ar" ? "تم الحفظ" : "Saved"}</span>}
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
