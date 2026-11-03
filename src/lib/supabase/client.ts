"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used for live-stream chat realtime (broadcast + presence).
 *
 * Realtime needs a Supabase project, not the database itself. Optional overrides:
 *   NEXT_PUBLIC_REALTIME_SUPABASE_URL / NEXT_PUBLIC_REALTIME_SUPABASE_ANON_KEY
 * Default: NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY, which stay on Supabase even when the database
 * moves (that uses DATABASE_API_URL, see supabase/server.ts).
 */
let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_REALTIME_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_REALTIME_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createClient(url, anon);
  return cached;
}
