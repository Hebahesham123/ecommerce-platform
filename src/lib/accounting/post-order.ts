import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Post a confirmed order payment into the double-entry books as a real,
 * balanced journal entry: Debit the cash/bank/card account that matches *how*
 * it was paid, Credit Sales. This is what makes the website's money show up in
 * Accounting "paid by what" — called on COD confirmation, Paymob card capture,
 * and admin collect/mark-paid.
 *
 * Best-effort: the books are a side-record, never the thing that fails a
 * payment. If the accounting schema (0046) isn't applied, or the chart isn't
 * seeded, it quietly does nothing.
 */

// Payment method → debit account code in the seeded chart of accounts:
//   101 خزينة (cash)   102 بنك (bank)   103 تحصيل البطاقات (card clearing)
const DEBIT_CODE_BY_METHOD: Record<string, string> = {
  card: "103",
  credit_card: "103",
  visa: "103",
  visa_machine: "103",
  mastercard: "103",
  paymob: "103",
  valu: "103",
  installments: "103",
  bank_transfer: "102",
  instapay: "102",
  wallet: "102",
  cod: "101",
  cash: "101",
  manual: "101",
  other: "101",
};

const SALES_CODE = "401";

export async function postOrderSaleToJournal(input: {
  method: string;
  amount: number;
  orderNumber?: string | null;
  note?: string;
}): Promise<string | null> {
  try {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const sb = getServerSupabase();

    // The books post to the default (first) entity.
    const { data: ent } = await sb.from("entities").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!ent) return null;
    const entityId = String(ent.id);

    const method = (input.method || "cod").toLowerCase();
    const debitCode = DEBIT_CODE_BY_METHOD[method] ?? "101";

    const { data: accs } = await sb
      .from("accounts")
      .select("id,code")
      .eq("entity_id", entityId)
      .in("code", [debitCode, SALES_CODE]);
    const byCode = new Map((accs ?? []).map((a: Record<string, unknown>) => [String(a.code), String(a.id)]));
    const debitId = byCode.get(debitCode);
    const creditId = byCode.get(SALES_CODE);
    if (!debitId || !creditId) return null; // chart not seeded — nothing to post to

    let entryNo = 1;
    try {
      const { data: rpc } = await sb.rpc("next_entry_no", { p_entity: entityId });
      if (rpc != null) entryNo = Number(rpc);
    } catch {
      /* fall back to 1; a unique(entity,entry_no) clash is caught below */
    }

    const ref = input.orderNumber ? `#${input.orderNumber}` : null;
    const { data: entry, error } = await sb
      .from("journal_entries")
      .insert({
        entity_id: entityId,
        entry_no: entryNo,
        date: new Date().toISOString().slice(0, 10),
        description: `${input.note || "تحصيل طلب"}${ref ? ` · ${ref}` : ""} (${method})`,
        ref_no: ref,
      })
      .select("id")
      .single();
    if (error || !entry) return null;

    const entryId = String(entry.id);
    await sb.from("journal_lines").insert([
      { entry_id: entryId, account_id: debitId, debit: amount, credit: 0, line_no: 0, description: "تحصيل" },
      { entry_id: entryId, account_id: creditId, debit: 0, credit: amount, line_no: 1, description: "مبيعات" },
    ]);
    return entryId;
  } catch {
    /* books posting is best-effort */
    return null;
  }
}

/**
 * Queue a confirmed payment as a PENDING accounting entry instead of posting it
 * straight to the books. The accountant reviews it on the Pending screen and
 * confirms (which posts the journal entry) or rejects it.
 */
export async function queuePendingEntry(input: {
  source: string;
  method: string;
  amount: number;
  orderNumber?: string | null;
  courierId?: string | null;
  note?: string;
}): Promise<void> {
  try {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    await getServerSupabase().from("pending_entries").insert({
      order_number: input.orderNumber ?? null,
      source: input.source || "payment",
      method: input.method || "cash",
      amount,
      courier_id: input.courierId ?? null,
      note: input.note ?? null,
      status: "pending",
    });
  } catch {
    /* queue is best-effort; never fails the payment */
  }
}
