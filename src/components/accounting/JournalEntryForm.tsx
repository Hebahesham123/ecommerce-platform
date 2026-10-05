"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEntity } from "@/components/accounting/EntityContext";
import { useAccounts, useProjects } from "@/lib/accounting/data";
import { getEntry, saveEntry } from "@/app/(admin)/accounting/actions";
import { fmtMoney, todayISO } from "@/lib/accounting/format";
import { Button, Input, Select, Card, Field, Badge, Spinner } from "@/components/accounting/ui";

interface LineState {
  account_id: string;
  project_id: string;
  debit: string;
  credit: string;
  description: string;
}

const EMPTY_LINE: LineState = {
  account_id: "",
  project_id: "",
  debit: "",
  credit: "",
  description: "",
};

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function JournalEntryForm({ entryId }: { entryId?: string }) {
  const router = useRouter();
  const { entity } = useEntity();
  const entityId = entity?.id ?? null;
  const currency = entity?.currency ?? "EGP";
  const { accounts, loading: accountsLoading } = useAccounts(entityId);
  const { projects, loading: projectsLoading } = useProjects(entityId);

  const [date, setDate] = useState<string>(todayISO());
  const [description, setDescription] = useState("");
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<LineState[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  const [loadingEntry, setLoadingEntry] = useState<boolean>(!!entryId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postableAccounts = useMemo(
    () => accounts.filter((a) => a.is_postable && a.type === "account"),
    [accounts]
  );

  // Load existing entry when editing
  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    (async () => {
      setLoadingEntry(true);
      setError(null);
      const res = await getEntry(entryId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error ?? "تعذّر تحميل القيد");
        setLoadingEntry(false);
        return;
      }
      const { entry: e, lines: ls } = res.data;
      setDate(e.date?.slice(0, 10) ?? todayISO());
      setDescription(e.description ?? "");
      setRefNo(e.ref_no ?? "");
      setLines(
        ls.length
          ? ls.map((l) => ({
              account_id: l.account_id ?? "",
              project_id: l.project_id ?? "",
              debit: l.debit ? String(l.debit) : "",
              credit: l.credit ? String(l.credit) : "",
              description: l.description ?? "",
            }))
          : [{ ...EMPTY_LINE }, { ...EMPTY_LINE }]
      );
      setLoadingEntry(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function setDebit(idx: number, value: string) {
    // typing a debit zeroes the credit
    updateLine(idx, { debit: value, credit: num(value) !== 0 ? "" : lines[idx].credit });
  }

  function setCredit(idx: number, value: string) {
    updateLine(idx, { credit: value, debit: num(value) !== 0 ? "" : lines[idx].debit });
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + num(l.debit), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + num(l.credit), 0), [lines]);
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) <= 0.005;

  // a "non-empty" line is one with an account or an amount
  const nonEmptyLines = useMemo(
    () => lines.filter((l) => l.account_id || num(l.debit) !== 0 || num(l.credit) !== 0),
    [lines]
  );
  const everyNonEmptyHasAccount = nonEmptyLines.every((l) => !!l.account_id);
  const hasTotal = totalDebit > 0 || totalCredit > 0;

  const canSave =
    !!entityId &&
    balanced &&
    hasTotal &&
    nonEmptyLines.length > 0 &&
    everyNonEmptyHasAccount &&
    !saving;

  async function handleSave() {
    if (!entityId || !canSave) return;
    setSaving(true);
    setError(null);

    const payloadLines = nonEmptyLines.map((l, i) => ({
      account_id: l.account_id,
      project_id: l.project_id || null,
      debit: num(l.debit),
      credit: num(l.credit),
      description: l.description.trim() || null,
      line_no: i,
    }));

    const res = await saveEntry({
      id: entryId ?? null,
      entity_id: entityId,
      date,
      description: description.trim() || null,
      ref_no: refNo.trim() || null,
      lines: payloadLines,
    });

    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }

    router.push("/accounting/journal");
  }

  if (!entity) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-500">الرجاء اختيار منشأة أولاً.</p>
      </Card>
    );
  }

  if (loadingEntry || accountsLoading || projectsLoading) {
    return <Spinner />;
  }

  return (
    <div dir="rtl" className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="التاريخ">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </Field>
          <Field label="المرجع">
            <Input
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="اختياري"
            />
          </Field>
          <Field label="البيان">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف القيد"
            />
          </Field>
        </div>
      </Card>

      <Card title="سطور القيد">
        <div className="overflow-auto">
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>الحساب</th>
                <th style={{ minWidth: 140 }}>المشروع</th>
                <th style={{ minWidth: 120 }}>مدين</th>
                <th style={{ minWidth: 120 }}>دائن</th>
                <th style={{ minWidth: 160 }}>بيان</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td>
                    <Select
                      value={l.account_id}
                      onChange={(e) => updateLine(idx, { account_id: e.target.value })}
                    >
                      <option value="">— اختر حساب —</option>
                      {postableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Select
                      value={l.project_id}
                      onChange={(e) => updateLine(idx, { project_id: e.target.value })}
                    >
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      value={l.debit}
                      onChange={(e) => setDebit(idx, e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      value={l.credit}
                      onChange={(e) => setCredit(idx, e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <Input
                      value={l.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      placeholder="بيان السطر"
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 1}
                      type="button"
                    >
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="text-left" colSpan={2}>
                  الإجمالي
                </td>
                <td className="num">{fmtMoney(totalDebit, currency)}</td>
                <td className="num">{fmtMoney(totalCredit, currency)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={addLine} type="button">
            + إضافة سطر
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              الفرق: <span className="num font-semibold">{fmtMoney(diff, currency)}</span>
            </span>
            {hasTotal && balanced ? (
              <Badge color="green">متوازن ✓</Badge>
            ) : (
              <Badge color="red">غير متوازن</Badge>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/accounting/journal")} disabled={saving} type="button">
          إلغاء
        </Button>
        <Button onClick={handleSave} disabled={!canSave} type="button">
          {saving ? "جارٍ الحفظ…" : "حفظ القيد"}
        </Button>
      </div>
    </div>
  );
}
