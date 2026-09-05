"use client";

import { useSyncExternalStore } from "react";

/**
 * The preview app's only way of talking to the store.
 *
 * Deliberately nothing but `fetch` against /api/storefront — no server
 * actions, no imports from the storefront's own code. That restriction is the
 * whole point: this screen can only do what a real mobile app could do, so if
 * something works here it works there, and if it breaks here it would have
 * broken there too.
 *
 * Every call is recorded. A test client that fails silently teaches you
 * nothing, so the log is a first-class part of the thing rather than a
 * developer-tools afterthought.
 */

const BASE = "/api/storefront";
const TOKEN_KEY = "app_preview_token";
const PHONE_KEY = "app_preview_phone";

export type LogEntry = {
  id: number;
  method: string;
  path: string;
  status: number;
  ms: number;
  ok: boolean;
  error?: string;
  at: string;
};

let log: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((l) => l());
}

export function useApiLog(): LogEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => log,
    () => log,
  );
}

export function clearLog() {
  log = [];
  publish();
}

// ---- The token, which is the whole of "being signed in" --------------------
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null, phone?: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      if (phone) localStorage.setItem(PHONE_KEY, phone);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PHONE_KEY);
    }
  } catch {
    /* private browsing — the session just won't survive a reload */
  }
}

export function getPhone(): string | null {
  try {
    return localStorage.getItem(PHONE_KEY);
  } catch {
    return null;
  }
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { form?: FormData },
): Promise<ApiResult<T>> {
  const started = performance.now();
  const headers: Record<string, string> = {
    // This header is what makes everything done here land in the dashboard's
    // App section rather than being counted as website traffic.
    "x-store-channel": "app",
  };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  // FormData sets its own multipart boundary — setting content-type breaks it.
  if (body !== undefined && !opts?.form) headers["content-type"] = "application/json";

  let status = 0;
  let error: string | undefined;
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: opts?.form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      cache: "no-store",
    });
    status = res.status;
    const json = (await res.json().catch(() => null)) as
      | { ok: boolean; data?: T; error?: string }
      | null;

    if (!json) {
      error = "bad_response";
      return { ok: false, error, status };
    }
    if (!json.ok) {
      error = json.error ?? "unknown_error";
      return { ok: false, error, status };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    error = (e as Error).message;
    return { ok: false, error, status: 0 };
  } finally {
    log = [
      {
        id: nextId++,
        method,
        path,
        status,
        ms: Math.round(performance.now() - started),
        ok: !error,
        error,
        at: new Date().toLocaleTimeString(),
      },
      ...log,
    ].slice(0, 60);
    publish();
  }
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  postForm: <T,>(path: string, form: FormData) => request<T>("POST", path, undefined, { form }),
};

// ---- What the routes actually hand back ------------------------------------
export type Variant = {
  id: string;
  variantTitle: string | null;
  sku: string | null;
  price: number | null;
  available: number;
};
export type Product = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  images: string[];
  category: string | null;
  priceMin: number | null;
  priceMax: number | null;
  available: number;
  variants: Variant[];
};
export type Collection = { handle: string; name: string; count: number; image: string | null };
export type PricedLine = {
  itemId: string;
  productName: string;
  variantTitle: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  maxAvailable: number;
  adjusted: boolean;
};
export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  itemCount: number;
  removed: string[];
};
export type AccountOrder = {
  orderNumber: string;
  total: number;
  createdAt: string;
  lifecycle: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};
export type Account = {
  phone: string;
  name: string | null;
  email: string | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  orders: AccountOrder[];
};
export type ReturnableLine = {
  orderItemId: string;
  productName: string;
  variantTitle: string | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  returnable: number;
};
export type ReturnableOrder = {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  windowExpiresAt: string;
  total: number;
  lines: ReturnableLine[];
};
export type MyRequest = {
  reference: string;
  kind: string;
  status: string;
  orderNumber: string;
  refundAmount: number;
  extraAmount: number;
  createdAt: string;
};
