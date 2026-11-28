import "server-only";

import { headers } from "next/headers";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * The record of dangerous things staff do: refunds, discounts, gift cards,
 * order edits (security plan step 3.4). Rows go to `admin_audit`, which is
 * append-only — see migration 0065.
 *
 * OBSERVE FIRST, ENFORCE LATER
 *
 * A failed audit write does not fail the action by default. It is logged
 * loudly and the refund still happens. That is the wrong end state — an
 * action nobody can account for should not be allowed — but it is the right
 * order of operations: the app deploys minutes before a migration is applied
 * by hand, and a fail-closed audit would take refunds down in that window for
 * no security gain. Set AUDIT_ENFORCE=true once 0065 is applied everywhere
 * and writeAudit throws instead, which the callers surface as an error.
 *
 * This is the same shape as the inbox gate: watch, then enforce.
 */

export type AuditEntry = {
  /** A stable key: "order.edit", "order.customer_edit", "order.refund". */
  action: string;
  /** What it was done to, in the merchant's terms — usually the order number. */
  subject?: string | null;
  /** One line a person can read without decoding the json. */
  summary?: string | null;
  /** Only the fields that moved, not a dump of the row. */
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
};

/**
 * Who is doing this, as far as we can honestly tell.
 *
 * Caddy sets X-Admin-User from the dashboard password, stripping anything the
 * client sent (security step 1.1). Until that is live the header can be
 * forged — but the dashboard has no login at all yet, so it grants nobody
 * anything they could not already do, and recording the claim is better than
 * recording nothing. Null means "we do not know", which is the truth today
 * and stays the truth for anything reached another way.
 */
export async function currentActor(): Promise<string | null> {
  try {
    const h = await headers();
    const raw = (h.get("x-admin-user") ?? "").trim();
    return raw ? raw.slice(0, 120) : null;
  } catch {
    // Outside a request (a cron, a script): there is no actor to name.
    return null;
  }
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const enforce = process.env.AUDIT_ENFORCE === "true";

  if (!isSupabaseConfigured()) {
    if (enforce) throw new Error("audit_unavailable");
    return;
  }

  try {
    const actor = await currentActor();
    const { error } = await getServerSupabase().from("admin_audit").insert({
      actor,
      action: entry.action.slice(0, 120),
      subject: entry.subject ? String(entry.subject).slice(0, 200) : null,
      summary: entry.summary ? String(entry.summary).slice(0, 1000) : null,
      before_data: entry.before ?? null,
      after_data: entry.after ?? null,
      meta: entry.meta ?? {},
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    const why = (e as Error).message;
    // Loud on purpose: this is the line that says the record is incomplete.
    console.error(
      "[audit] FAILED to record a dangerous action",
      JSON.stringify({ action: entry.action, subject: entry.subject ?? null, why }),
    );
    if (enforce) throw new Error("audit_unavailable");
  }
}
