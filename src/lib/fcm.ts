import "server-only";
import { createSign } from "node:crypto";

/**
 * Sending to phones straight through Firebase Cloud Messaging (the HTTP v1 API).
 *
 * Firebase is reached with the project's service account: the JSON key made
 * in Firebase → Project settings → Service accounts → "Generate new private
 * key", stored whole in FIREBASE_SERVICE_ACCOUNT (as it is, or base64'd so it
 * fits on one line). From it a short-lived access token is signed here and
 * kept for most of its hour.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

function account(): ServiceAccount | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text) as Partial<ServiceAccount>;
    if (!j.project_id || !j.client_email || !j.private_key) return null;
    // A key pasted into an env var often arrives with its line breaks escaped.
    return { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function fcmConfigured(): boolean {
  return account() !== null;
}

let cached: { token: string; until: number } | null = null;

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && Date.now() < cached.until) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!res.ok || !json?.access_token) throw new Error(`firebase_auth: ${json?.error_description ?? res.status}`);
  cached = { token: json.access_token, until: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 300) * 1000 };
  return json.access_token;
}

export type FcmMessage = {
  title: string;
  body: string;
  imageUrl: string | null;
  /** Small key/value data for the app; values must be strings. */
  data: Record<string, string>;
};

/**
 * One message to many phones. FCM v1 takes one phone per request, so they go
 * out twenty at a time. A token Firebase no longer knows (the app was
 * removed, or the token was replaced) comes back in `dead`.
 */
export async function sendFcm(tokens: string[], m: FcmMessage): Promise<{ ok: number; failed: number; dead: string[]; error: string | null }> {
  const sa = account();
  if (!sa) return { ok: 0, failed: tokens.length, dead: [], error: tokens.length ? "firebase_not_configured" : null };
  let ok = 0;
  let failed = 0;
  let error: string | null = null;
  const dead: string[] = [];

  let token: string;
  try {
    token = await accessToken(sa);
  } catch (e) {
    return { ok: 0, failed: tokens.length, dead, error: e instanceof Error ? e.message : "firebase_auth" };
  }
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const one = async (to: string) => {
    const message = {
      token: to,
      notification: { title: m.title, body: m.body, ...(m.imageUrl ? { image: m.imageUrl } : {}) },
      data: m.data,
      android: { priority: "HIGH", notification: { channel_id: "default", sound: "default" } },
      apns: {
        payload: { aps: { sound: "default", "mutable-content": 1 } },
        ...(m.imageUrl ? { fcm_options: { image: m.imageUrl } } : {}),
      },
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        ok++;
        return;
      }
      failed++;
      const json = (await res.json().catch(() => null)) as {
        error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
      } | null;
      const code = json?.error?.details?.find((d) => d.errorCode)?.errorCode ?? json?.error?.status;
      error = json?.error?.message ?? `fcm_${res.status}`;
      if (code === "UNREGISTERED" || (code === "INVALID_ARGUMENT" && /token/i.test(error ?? ""))) dead.push(to);
    } catch (e) {
      failed++;
      error = e instanceof Error ? e.message : "fcm_unreachable";
    }
  };

  for (let i = 0; i < tokens.length; i += 20) await Promise.all(tokens.slice(i, i + 20).map(one));
  return { ok, failed, dead, error };
}
