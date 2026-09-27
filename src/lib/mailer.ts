import "server-only";

import nodemailer from "nodemailer";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Transactional email over SMTP — used to send an order's invoice from the
 * shop's own mailbox (an Outlook / Microsoft 365 account, per the merchant).
 *
 * Config comes from the Settings row (store_settings.data.smtp) first, so the
 * merchant sets it from the admin without a redeploy, and falls back to env
 * vars (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM / SMTP_FROM_NAME).
 * Outlook defaults are baked in: smtp.office365.com:587 with STARTTLS.
 *
 * Nothing here throws to the caller: a mailbox that isn't set up yet returns
 * `smtp_not_configured`, and the order action turns that into a plain message.
 */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

const s = (v: unknown): string => (v == null ? "" : String(v));

async function readSmtp(): Promise<SmtpConfig | null> {
  const env = process.env;
  let cfg: Record<string, unknown> = {};
  if (isSupabaseConfigured()) {
    try {
      const { data } = await getServerSupabase()
        .from("store_settings")
        .select("data")
        .eq("id", "default")
        .maybeSingle();
      cfg = ((data?.data as Record<string, unknown>)?.smtp as Record<string, unknown>) ?? {};
    } catch {
      /* fall through to env */
    }
  }

  const host = s(cfg.host) || env.SMTP_HOST || "smtp.office365.com";
  const port = Number(s(cfg.port) || env.SMTP_PORT || 587);
  const user = s(cfg.user) || env.SMTP_USER || "";
  const pass = s(cfg.pass) || env.SMTP_PASS || "";
  const fromEmail = s(cfg.fromEmail) || env.SMTP_FROM || user;
  const fromName = s(cfg.fromName) || env.SMTP_FROM_NAME || "";
  if (!user || !pass) return null; // not set up yet

  return { host, port, secure: port === 465, user, pass, fromEmail, fromName };
}

/** Is a mailbox configured? Lets the UI disable "Send invoice" with a reason. */
export async function isMailerReady(): Promise<boolean> {
  return (await readSmtp()) != null;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = await readSmtp();
  if (!cfg) return { ok: false, error: "smtp_not_configured" };
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure, // 465 = implicit TLS; 587 = STARTTLS (upgraded automatically)
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail;
    await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
