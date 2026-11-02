"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used for live-stream chat realtime (broadcast + presence).
 *
 * Realtime needs a Supabase project, not the database itself, so it has its own settings:
 *   NEXT_PUBLIC_REALTIME_SUPABASE_URL / NEXT_PUBLIC_REALTIME_SUPABASE_ANON_KEY
 * Once the database moves to the self-hosted server (NEXT_PUBLIC_SUPABASE_URL points there, and
 * it has no realtime), set these to a Supabase project. Default: the main Supabase settings.
 */
let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_REALTIME_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_REALTIME_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createClient(url, anon);
  return cached;
}
