import "server-only";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Append one line to the Courier System audit log (courier_logs).
 *
 * Best-effort: it swallows every error and never throws, so a logging failure
 * (or an un-migrated database) can never break the courier action it decorates.
 */
export async function logCourierAction(input: {
  actor?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  orderNumber?: string;
  detail?: string;
}): Promise<void> {
  try {
    if (!isSupabaseConfigured()) return;
    await getServerSupabase().from("courier_logs").insert({
      actor: input.actor ?? "staff",
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      order_number: input.orderNumber ?? null,
      detail: input.detail ?? null,
    });
  } catch {
    /* the audit log must never fail the action it records */
  }
}
