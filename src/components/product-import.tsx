"use client";

import { useMemo, useRef, useState } from "react";
import { useI18n, num } from "@/lib/i18n";
import {
  IMPORT_FIELDS,
  autoMap,
  importStats,
  prepareRows,
  type ImportRow,
  type Mapping,
} from "@/lib/product-import";
import type { Location } from "@/lib/inventory";
import { importInventoryRows, type ImportSummary } from "@/app/(admin)/products/import-actions";
import { Card } from "@/components/ui";
import { IcX, IcUpload, IcAlert, IcFile } from "@/components/icons";

type Step = "upload" | "map" | "done";

export function ProductImport({
  locations,
  onClose,
  onImported,
}: {
  locations: Location[];
  onClose: () => void;
  onImported: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [updateExisting, setUpdateExisting] = useState(true);
  /** Multi-variant exports leave the product name blank after the first row. */
  const [fillDown, setFillDown] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      // Loaded on demand so the parser never ships in the initial bundle.
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error(ar ? "الملف لا يحتوي على ورقة" : "The file has no sheet");

      // header:1 keeps the header row as data so columns can be re-mapped.
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: false,
      });
      const head = (rows[0] ?? []).map((h) => String(h ?? ""));
      if (!head.length) throw new Error(ar ? "لا توجد عناوين أعمدة" : "No column headers found");

      setFileName(file.name);
      setHeaders(head);
      setRaw(rows.slice(1));
      setMapping(autoMap(head));
      setStep("map");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const prepared = useMemo(
    () => prepareRows(raw, mapping, { fillDown }),
    [raw, mapping, fillDown],
  );
  const stats = useMemo(() => importStats(prepared.rows), [prepared.rows]);
  const missingRequired = IMPORT_FIELDS.filter(
    (f) => f.required && mapping[f.field] == null,
  );

  async function onImport() {
    setBusy(true);
    setError(null);
    const res = await importInventoryRows(prepared.rows as ImportRow[], {
      locationId: locationId || null,
      updateExisting,
    });
    setBusy(false);
    if (res.ok) {
      setSummary(res.data);
      setStep("done");
      onImported();
    } else {
      setError(res.error === "not_configured" ? (ar ? "Supabase غير متصل" : "Supabase is not connected") : res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-ink/50 backdrop-blur-sm">
      <div className="ms-auto flex h-full w-full max-w-3xl flex-col bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">
              {ar ? "استيراد المنتجات" : "Import products"}
            </h2>
            <p className="truncate text-xs text-ink-soft">
              {fileName || (ar ? "من ملف Excel أو CSV" : "From an Excel or CSV file")}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && (
            <Card className="border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</Card>
          )}

          {/* ---- Step 1: pick a file ---------------------------------------- */}
          {step === "upload" && (
            <>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFile(f);
                }}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-line bg-surface p-10 text-center transition-colors hover:bg-surface-page"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <IcUpload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {busy
                    ? ar ? "جارٍ القراءة…" : "Reading…"
                    : ar ? "اسحب ملفك هنا أو اضغط للاختيار" : "Drop your file here, or click to choose"}
                </p>
                <p className="text-xs text-ink-soft">.xlsx · .xls · .csv</p>
              </div>
              <p className="text-xs text-ink-soft">
                {ar
                  ? "الصف الأول يجب أن يحتوي على أسماء الأعمدة. سنحاول مطابقتها تلقائياً ويمكنك تعديلها قبل الاستيراد."
                  : "The first row should hold your column names. They're matched automatically and you can correct them before anything is written."}
              </p>
            </>
          )}

          {/* ---- Step 2: map columns ---------------------------------------- */}
          {step === "map" && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={ar ? "صفوف" : "Rows"} value={num(raw.length, lang)} />
                <Stat label={ar ? "منتجات" : "Products"} value={num(stats.products, lang)} />
                <Stat label={ar ? "تنويعات" : "Variants"} value={num(stats.variants, lang)} />
                <Stat label={ar ? "بصور" : "With images"} value={num(stats.withImages, lang)} />
              </div>

              {missingRequired.length > 0 && (
                <Card className="flex items-start gap-2 bg-amber-50/60 p-3 text-sm text-amber-800">
                  <IcAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {ar ? "اربط هذه الأعمدة أولاً: " : "Map these columns first: "}
                    <strong>{missingRequired.map((f) => f.label).join(", ")}</strong>
                  </span>
                </Card>
              )}

              <div className="overflow-hidden rounded-xl border border-line">
                <div className="border-b border-line bg-surface-page px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {ar ? "ربط الأعمدة" : "Column mapping"}
                </div>
                <div className="divide-y divide-line">
                  {IMPORT_FIELDS.map((spec) => (
                    <div key={spec.field} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <div className="min-w-[140px] flex-1">
                        <div className="text-sm font-medium text-ink">
                          {spec.label}
                          {spec.required && <span className="ms-1 text-rose-500">*</span>}
                        </div>
                        {spec.hint && <div className="text-[11px] text-ink-soft">{spec.hint}</div>}
                      </div>
                      <select
                        value={mapping[spec.field] ?? ""}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [spec.field]: e.target.value === "" ? null : Number(e.target.value),
                          }))
                        }
                        className="h-9 min-w-[170px] rounded-xl border border-line bg-surface-page px-2.5 text-sm outline-none focus:border-brand-600"
                      >
                        <option value="">{ar ? "— تجاهل —" : "— Ignore —"}</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `${ar ? "عمود" : "Column"} ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* What the first rows will become */}
              {prepared.rows.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-line">
                  <div className="border-b border-line bg-surface-page px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {ar ? "معاينة" : "Preview"}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-page text-xs text-ink-soft">
                        <tr>
                          <th className="px-3 py-2 text-start">{ar ? "المنتج" : "Product"}</th>
                          <th className="px-3 py-2 text-start">{ar ? "تنويعة" : "Variant"}</th>
                          <th className="px-3 py-2 text-start">SKU</th>
                          <th className="px-3 py-2 text-start">{ar ? "السعر" : "Price"}</th>
                          <th className="px-3 py-2 text-start">{ar ? "الكمية" : "Qty"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {prepared.rows.slice(0, 6).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-ink">{r.productName}</td>
                            <td className="px-3 py-2 text-ink-muted">{r.variantTitle ?? "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs text-ink-muted">{r.sku ?? "—"}</td>
                            <td className={`px-3 py-2 ${r.price ? "text-ink" : "text-rose-600"}`}>
                              {r.price ?? (ar ? "بدون" : "none")}
                            </td>
                            <td className="px-3 py-2 text-ink-muted">{r.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* The single biggest reason rows go missing, so it sits above
                  the warnings rather than buried in options. */}
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-3">
                <input
                  type="checkbox"
                  checked={fillDown}
                  onChange={(e) => setFillDown(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line accent-brand-600"
                />
                <span className="text-sm">
                  <span className="font-medium text-ink">
                    {ar
                      ? "الصفوف بدون اسم تُكمل المنتج الذي فوقها"
                      : "Rows with no name continue the product above"}
                  </span>
                  <span className="block text-[11px] text-ink-soft">
                    {ar
                      ? "ملفات التصدير تكتب اسم المنتج في أول صف فقط وتترك بقية صفوف التنويعات فارغة. الاسم والفئة والماركة تُورَّث؛ الـ SKU والسعر والكمية لا."
                      : "Exports print the product name only on its first row and leave the variant rows blank. Name, category, vendor and tags are inherited — SKU, price and quantity never are."}
                  </span>
                  {prepared.filledDown > 0 && (
                    <span className="mt-1 block text-[11px] font-medium text-emerald-600">
                      {ar
                        ? `${num(prepared.filledDown, lang)} صف تم إنقاذها بهذا الخيار`
                        : `${num(prepared.filledDown, lang)} rows recovered by this`}
                    </span>
                  )}
                </span>
              </label>

              {(prepared.skipped.length > 0 || prepared.warnings.length > 0) && (
                <Card className="bg-amber-50/60 p-3 text-xs text-amber-800">
                  {prepared.skipped.length > 0 && (
                    <div className="mb-1">
                      <strong>
                        {num(prepared.skipped.length, lang)}{" "}
                        {ar ? "صف سيتم تجاهله" : "rows will be skipped"}
                      </strong>{" "}
                      — {prepared.skipped.slice(0, 3).map((s) => `#${s.row} ${s.problem}`).join("; ")}
                    </div>
                  )}
                  {prepared.warnings.length > 0 && (
                    <div>
                      <strong>
                        {num(prepared.warnings.length, lang)}{" "}
                        {ar ? "بدون سعر" : "without a price"}
                      </strong>{" "}
                      — {ar ? "ستُستورد لكنها لن تظهر في المتجر." : "imported, but hidden on the storefront."}
                    </div>
                  )}
                </Card>
              )}

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="h-4 w-4 rounded border-line accent-brand-600"
                  />
                  {ar ? "تحديث المنتجات المطابقة بالـ SKU" : "Update items whose SKU already exists"}
                </label>
                {locations.length > 0 && (
                  <label className="ms-auto flex items-center gap-2 text-sm text-ink-muted">
                    {ar ? "المخزون في" : "Stock at"}
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="h-9 rounded-xl border border-line bg-surface-page px-2.5 text-sm outline-none focus:border-brand-600"
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </>
          )}

          {/* ---- Step 3: result --------------------------------------------- */}
          {step === "done" && summary && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Stat label={ar ? "أُنشئت" : "Created"} value={num(summary.created, lang)} />
                <Stat label={ar ? "حُدّثت" : "Updated"} value={num(summary.updated, lang)} />
                <Stat label={ar ? "فشلت" : "Failed"} value={num(summary.failed, lang)} />
              </div>
              {summary.errors.length > 0 && (
                <Card className="border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {summary.errors.map((e, i) => (
                    <div key={i} className="font-mono">
                      {e}
                    </div>
                  ))}
                </Card>
              )}
              <Card className="flex items-center gap-3 p-3 text-sm">
                <IcFile className="h-4 w-4 shrink-0 text-ink-soft" />
                <span className="text-ink-muted">
                  {ar
                    ? "المنتجات التي لها سعر وحالة نشطة تظهر الآن في المتجر."
                    : "Products with a price and active status now appear on the storefront."}
                </span>
                <a className="btn-outline ms-auto h-8 px-3 text-xs" href="/shop" target="_blank" rel="noreferrer">
                  {ar ? "افتح المتجر" : "Open shop"}
                </a>
              </Card>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          {step === "map" && (
            <span className="text-xs text-ink-soft">
              {num(prepared.rows.length, lang)} {ar ? "صف جاهز" : "rows ready"}
            </span>
          )}
          <button className="btn-ghost ms-auto" onClick={onClose}>
            {step === "done" ? (ar ? "إغلاق" : "Close") : ar ? "إلغاء" : "Cancel"}
          </button>
          {step === "map" && (
            <button
              className="btn-primary disabled:opacity-60"
              onClick={onImport}
              disabled={busy || prepared.rows.length === 0 || missingRequired.length > 0}
            >
              {busy
                ? ar ? "جارٍ الاستيراد…" : "Importing…"
                : ar
                  ? `استيراد ${prepared.rows.length}`
                  : `Import ${prepared.rows.length}`}
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-page px-3 py-2">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
