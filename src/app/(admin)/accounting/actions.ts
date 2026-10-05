"use server";

import { randomUUID } from "node:crypto";
import { getServerSupabase } from "@/lib/supabase/server";
import type {
  Account,
  AccountType,
  Entity,
  JournalEntry,
  JournalLine,
  LedgerRow,
  Project,
  ReportCategory,
} from "@/lib/accounting/types";

// ---------------------------------------------------------------------------
// Result shape — every action returns one of these. `code` carries the
// Postgres error code (e.g. 23505 unique, 23503 FK) when the page needs it.
// ---------------------------------------------------------------------------
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

type PgLikeError = { message?: string; code?: string; details?: string } | null;

function fail(error: PgLikeError, fallback = "حدث خطأ غير متوقع"): { ok: false; error: string; code?: string } {
  if (!error) return { ok: false, error: fallback };
  return { ok: false, error: error.message || fallback, code: error.code };
}

function caught(e: unknown): { ok: false; error: string; code?: string } {
  if (e && typeof e === "object") {
    const o = e as { message?: string; code?: string };
    return { ok: false, error: o.message || "حدث خطأ غير متوقع", code: o.code };
  }
  return { ok: false, error: String(e) };
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------
export type EntityInput = {
  name: string;
  legal_name?: string | null;
  currency?: string | null;
  notes?: string | null;
  logo_url?: string | null;
};

export type AccountInput = {
  entity_id: string;
  code: string;
  name: string;
  type: AccountType;
  report_category: ReportCategory | null;
  parent_id?: string | null;
  group_name?: string | null;
  category_name?: string | null;
  is_postable: boolean;
  sort_order?: number;
};

export type AccountUpdate = {
  code: string;
  name: string;
  type: AccountType;
  report_category: ReportCategory | null;
  is_postable: boolean;
};

export type ProjectInput = {
  entity_id: string;
  name: string;
  code?: string | null;
  status: "active" | "closed";
  budget?: number | null;
  notes?: string | null;
};

export type ProjectUpdate = Omit<ProjectInput, "entity_id">;

export type SaveEntryLine = {
  account_id: string;
  project_id?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
  line_no: number;
};

export type SaveEntryPayload = {
  id?: string | null;
  entity_id: string;
  date: string;
  description?: string | null;
  ref_no?: string | null;
  lines: SaveEntryLine[];
};

// ---------------------------------------------------------------------------
// Paginated reader — allowlisted tables/views only, pages past the 1000 cap.
// ---------------------------------------------------------------------------
const READABLE = ["entities", "accounts", "projects", "journal_entries", "v_ledger"] as const;
type Readable = (typeof READABLE)[number];

async function fetchAllForEntity<T>(
  table: Readable,
  entityId: string,
  order?: { col: string; asc?: boolean },
): Promise<T[]> {
  const sb = getServerSupabase();
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = sb.from(table).select("*").eq("entity_id", entityId).range(from, from + pageSize - 1);
    if (order) q = q.order(order.col, { ascending: order.asc ?? true });
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data as unknown as T[]) ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// ===========================================================================
// ENTITIES
// ===========================================================================
export async function fetchEntities(): Promise<ActionResult<Entity[]>> {
  try {
    const { data, error } = await getServerSupabase()
      .from("entities")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) return fail(error);
    return { ok: true, data: (data as Entity[]) ?? [] };
  } catch (e) {
    return caught(e);
  }
}

export async function createEntity(input: EntityInput): Promise<ActionResult<Entity>> {
  try {
    const payload = {
      name: input.name.trim(),
      legal_name: input.legal_name?.trim() || null,
      currency: input.currency?.trim() || "EGP",
      notes: input.notes?.trim() || null,
      logo_url: input.logo_url || null,
    };
    const { data, error } = await getServerSupabase().from("entities").insert(payload).select("*").single();
    if (error) return fail(error);
    return { ok: true, data: data as Entity };
  } catch (e) {
    return caught(e);
  }
}

export async function updateEntity(id: string, input: EntityInput): Promise<ActionResult<Entity>> {
  try {
    const payload = {
      name: input.name.trim(),
      legal_name: input.legal_name?.trim() || null,
      currency: input.currency?.trim() || "EGP",
      notes: input.notes?.trim() || null,
      logo_url: input.logo_url || null,
    };
    const { data, error } = await getServerSupabase()
      .from("entities")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return fail(error);
    return { ok: true, data: data as Entity };
  } catch (e) {
    return caught(e);
  }
}

export async function deleteEntity(id: string): Promise<ActionResult> {
  try {
    const { error } = await getServerSupabase().from("entities").delete().eq("id", id);
    if (error) return fail(error);
    return { ok: true, data: null };
  } catch (e) {
    return caught(e);
  }
}

/** Upload a data-URL image to the `entity-images` bucket; returns the public URL. */
export async function uploadEntityImage(dataUrl: string, filename: string): Promise<ActionResult<string>> {
  try {
    const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
    if (!m) return { ok: false, error: "صيغة الصورة غير صالحة" };
    const contentType = m[1] || "image/png";
    const bytes = Buffer.from(m[2], "base64");
    const safeName = (filename || "logo").replace(/[^\w.-]+/g, "_");
    const path = `logos/${randomUUID()}-${safeName}`;
    const sb = getServerSupabase();
    const { error: upErr } = await sb.storage.from("entity-images").upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (upErr) return fail(upErr as PgLikeError, "فشل رفع الصورة");
    const { data } = sb.storage.from("entity-images").getPublicUrl(path);
    return { ok: true, data: data.publicUrl };
  } catch (e) {
    return caught(e);
  }
}

// ===========================================================================
// ACCOUNTS
// ===========================================================================
export async function listAccounts(entityId: string): Promise<ActionResult<Account[]>> {
  try {
    const rows = await fetchAllForEntity<Account>("accounts", entityId, { col: "code" });
    return { ok: true, data: rows };
  } catch (e) {
    return caught(e);
  }
}

export async function createAccount(input: AccountInput): Promise<ActionResult<Account>> {
  try {
    const { data, error } = await getServerSupabase()
      .from("accounts")
      .insert({
        entity_id: input.entity_id,
        code: input.code,
        name: input.name,
        type: input.type,
        report_category: input.report_category,
        parent_id: input.parent_id ?? null,
        group_name: input.group_name ?? null,
        category_name: input.category_name ?? null,
        is_postable: input.is_postable,
        sort_order: input.sort_order ?? 0,
      })
      .select("*")
      .single();
    if (error) return fail(error);
    return { ok: true, data: data as Account };
  } catch (e) {
    return caught(e);
  }
}

export async function updateAccount(id: string, input: AccountUpdate): Promise<ActionResult<Account>> {
  try {
    const { data, error } = await getServerSupabase()
      .from("accounts")
      .update({
        code: input.code,
        name: input.name,
        type: input.type,
        report_category: input.report_category,
        is_postable: input.is_postable,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return fail(error);
    return { ok: true, data: data as Account };
  } catch (e) {
    return caught(e);
  }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  try {
    const { error } = await getServerSupabase().from("accounts").delete().eq("id", id);
    if (error) return fail(error); // 23503 (FK, used in entries) surfaced via code
    return { ok: true, data: null };
  } catch (e) {
    return caught(e);
  }
}

// ===========================================================================
// PROJECTS
// ===========================================================================
export async function listProjects(entityId: string): Promise<ActionResult<Project[]>> {
  try {
    const rows = await fetchAllForEntity<Project>("projects", entityId, { col: "name" });
    return { ok: true, data: rows };
  } catch (e) {
    return caught(e);
  }
}

export async function createProject(input: ProjectInput): Promise<ActionResult<Project>> {
  try {
    const { data, error } = await getServerSupabase()
      .from("projects")
      .insert({
        entity_id: input.entity_id,
        name: input.name,
        code: input.code ?? null,
        status: input.status,
        budget: input.budget ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) return fail(error);
    return { ok: true, data: data as Project };
  } catch (e) {
    return caught(e);
  }
}

export async function updateProject(id: string, input: ProjectUpdate): Promise<ActionResult<Project>> {
  try {
    const { data, error } = await getServerSupabase()
      .from("projects")
      .update({
        name: input.name,
        code: input.code ?? null,
        status: input.status,
        budget: input.budget ?? null,
        notes: input.notes ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return fail(error);
    return { ok: true, data: data as Project };
  } catch (e) {
    return caught(e);
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const { error } = await getServerSupabase().from("projects").delete().eq("id", id);
    if (error) return fail(error);
    return { ok: true, data: null };
  } catch (e) {
    return caught(e);
  }
}

// ===========================================================================
// JOURNAL ENTRIES
// ===========================================================================
export async function listEntries(entityId: string): Promise<ActionResult<JournalEntry[]>> {
  try {
    const rows = await fetchAllForEntity<JournalEntry>("journal_entries", entityId, {
      col: "entry_no",
      asc: false,
    });
    return { ok: true, data: rows };
  } catch (e) {
    return caught(e);
  }
}

export async function getEntry(
  id: string,
): Promise<ActionResult<{ entry: JournalEntry; lines: JournalLine[] }>> {
  try {
    const sb = getServerSupabase();
    const { data: entry, error: entryErr } = await sb
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .single();
    if (entryErr) return fail(entryErr, "تعذّر تحميل القيد");
    const { data: lines, error: linesErr } = await sb
      .from("journal_lines")
      .select("*")
      .eq("entry_id", id)
      .order("line_no", { ascending: true });
    if (linesErr) return fail(linesErr);
    return { ok: true, data: { entry: entry as JournalEntry, lines: (lines as JournalLine[]) ?? [] } };
  } catch (e) {
    return caught(e);
  }
}

export async function saveEntry(payload: SaveEntryPayload): Promise<ActionResult<{ id: string }>> {
  try {
    const lines = payload.lines ?? [];
    if (lines.length === 0) return { ok: false, error: "لا توجد سطور في القيد" };

    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      return { ok: false, error: "القيد غير متوازن (مجموع المدين لا يساوي مجموع الدائن)" };
    }

    const sb = getServerSupabase();
    const header = {
      date: payload.date,
      description: payload.description?.trim() || null,
      ref_no: payload.ref_no?.trim() || null,
    };
    const normalizedLines = lines.map((l, i) => ({
      account_id: l.account_id,
      project_id: l.project_id || null,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description?.trim() || null,
      line_no: l.line_no ?? i,
    }));

    if (payload.id) {
      // UPDATE: header, then replace lines.
      const { error: updErr } = await sb.from("journal_entries").update(header).eq("id", payload.id);
      if (updErr) return fail(updErr);
      const { error: delErr } = await sb.from("journal_lines").delete().eq("entry_id", payload.id);
      if (delErr) return fail(delErr);
      const { error: insErr } = await sb
        .from("journal_lines")
        .insert(normalizedLines.map((l) => ({ ...l, entry_id: payload.id })));
      if (insErr) return fail(insErr);
      return { ok: true, data: { id: payload.id } };
    }

    // CREATE: next entry_no (rpc, fallback max+1), insert header + lines.
    let entryNo: number | null = null;
    const { data: rpcData, error: rpcErr } = await sb.rpc("next_entry_no", { p_entity: payload.entity_id });
    if (!rpcErr && rpcData != null) {
      entryNo = Number(rpcData);
    } else {
      const { data: maxRow } = await sb
        .from("journal_entries")
        .select("entry_no")
        .eq("entity_id", payload.entity_id)
        .order("entry_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      entryNo = ((maxRow as { entry_no: number } | null)?.entry_no ?? 0) + 1;
    }

    const { data: inserted, error: insHeadErr } = await sb
      .from("journal_entries")
      .insert({ entity_id: payload.entity_id, entry_no: entryNo, ...header })
      .select("id")
      .single();
    if (insHeadErr) return fail(insHeadErr);

    const newId = (inserted as { id: string }).id;
    const { error: insLinesErr } = await sb
      .from("journal_lines")
      .insert(normalizedLines.map((l) => ({ ...l, entry_id: newId })));
    if (insLinesErr) return fail(insLinesErr);
    return { ok: true, data: { id: newId } };
  } catch (e) {
    return caught(e);
  }
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  try {
    const { error } = await getServerSupabase().from("journal_entries").delete().eq("id", id);
    if (error) return fail(error);
    return { ok: true, data: null };
  } catch (e) {
    return caught(e);
  }
}

// ===========================================================================
// LEDGER (reporting view)
// ===========================================================================
export async function getLedger(entityId: string): Promise<ActionResult<LedgerRow[]>> {
  try {
    const rows = await fetchAllForEntity<LedgerRow>("v_ledger", entityId);
    return { ok: true, data: rows };
  } catch (e) {
    return caught(e);
  }
}
