/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { createClient } from "@supabase/supabase-js";

let cached: any = null;
export function chatBrowserConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CHAT_SUPABASE_URL && process.env.NEXT_PUBLIC_CHAT_SUPABASE_ANON_KEY,
  );
}
/** Anon client for realtime subscriptions on chat.* (returns null if unconfigured). */
export function getChatBrowserClient(): any {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_CHAT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_CHAT_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, { db: { schema: "chat" } });
  return cached;
}
