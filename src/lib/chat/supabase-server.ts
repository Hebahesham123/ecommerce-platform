/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function chatConfigured(): boolean {
  return Boolean(process.env.CHAT_SUPABASE_URL && process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY);
}

let cached: any = null;
/** Service-role client for the WhatsApp orders/campaigns project (public schema). */
export function getChatServerClient(): any {
  if (cached) return cached;
  const url = process.env.CHAT_SUPABASE_URL;
  const key = process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("CHAT_SUPABASE_URL / CHAT_SUPABASE_SERVICE_ROLE_KEY not set");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
