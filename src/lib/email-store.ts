"use client";

import { useCallback, useEffect, useState } from "react";
import { starterTemplates, type EmailTemplate } from "@/lib/email";
import { presetSegments, type Segment } from "@/lib/segments";

// Client-side persistence for the email feature. Kept in localStorage so the
// whole thing works with zero backend setup; the shapes match what a Supabase
// table would hold, so this lifts server-side later without touching the UI.

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  templateId: string | null;
  segmentId: string | null;
  status: "draft" | "sent";
  recipients: number;
  sentAt: number | null;
  createdAt: number;
};

const KEYS = {
  templates: "bb_email_templates",
  segments: "bb_email_segments",
  campaigns: "bb_email_campaigns",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** A localStorage-backed collection with a stable API and cross-tab sync. */
export function useLocalCollection<T>(key: string, seed: () => T): [T, (next: T | ((p: T) => T)) => void, boolean] {
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState<T>(seed);

  useEffect(() => {
    setValue(read<T>(key, seed()));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((p: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* quota / private mode — keep it in memory */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set, ready];
}

export function useTemplates() {
  return useLocalCollection<EmailTemplate[]>(KEYS.templates, () =>
    starterTemplates().map((t) => ({ ...t, updatedAt: Date.now() })),
  );
}

export function useSegments() {
  return useLocalCollection<Segment[]>(KEYS.segments, () =>
    presetSegments().map((s) => ({ ...s, updatedAt: Date.now() })),
  );
}

export function useCampaigns() {
  return useLocalCollection<Campaign[]>(KEYS.campaigns, () => []);
}

/** Read one template synchronously (for the editor route). */
export function readTemplate(id: string): EmailTemplate | null {
  const list = read<EmailTemplate[]>(KEYS.templates, []);
  return list.find((t) => t.id === id) ?? null;
}

export function writeTemplate(next: EmailTemplate): void {
  if (typeof window === "undefined") return;
  const list = read<EmailTemplate[]>(KEYS.templates, []);
  const i = list.findIndex((t) => t.id === next.id);
  if (i >= 0) list[i] = next;
  else list.push(next);
  try {
    window.localStorage.setItem(KEYS.templates, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
