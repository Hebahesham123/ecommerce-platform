import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side database client using the service-role key.
 * NEVER import this into a client component — the key bypasses RLS.
 *
 * Which database:
 *   DATABASE_API_URL / DATABASE_API_KEY   the self-hosted database (PostgREST), when set
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   Supabase, otherwise
 *
 * The self-hosted database has its own names on purpose: setting them moves ONLY the data.
 * Files (src/lib/storage.ts), live-chat realtime (src/lib/supabase/client.ts) and the signing of
 * sign-ins (store-session, courier-session, api/token) keep reading the Supabase settings, so
 * nothing else changes and nobody is signed out.
 */
let cached: SupabaseClient | null = null;

function dbUrl(): string | undefined {
  return process.env.DATABASE_API_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}
function dbKey(): string | undefined {
  return process.env.DATABASE_API_URL ? process.env.DATABASE_API_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = dbUrl();
  const serviceKey = dbKey();

  if (!url || !serviceKey) {
    throw new Error(
      process.env.DATABASE_API_URL
        ? "DATABASE_API_URL is set but DATABASE_API_KEY is missing"
        : "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(dbUrl() && dbKey());
}
