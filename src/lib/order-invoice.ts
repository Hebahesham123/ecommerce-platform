import "server-only";

import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/phone";
import { sendMail } from "@/lib/mailer";

/**
 * Build and send an order's invoice to the customer, from the shop's mailbox.
 *
 * The recipient is resolved server-side: the customer profile's email (by the
 * order's phone), so nothing the browser sends decides where an invoice goes.
 * The HTML is a plain, table-based invoice that survives every mail client.
 */

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

const egp = (v: number) =>
  `E£${v.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (str: string) =>
  str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function invoiceHtml(order: Row, items: Row[]): string {
  const rows = items
    .map((li) => {
      const name = esc(s(li.product_name));
      const variant = s(li.variant_title) ? ` · ${esc(s(li.variant_title))}` : "";
      const qty = n(li.quantity);
      const price = n(li.price);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;color:#111">${name}<span style="color:#888">${variant}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;color:#555;text-align:center">${qty}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;color:#111;text-align:right">${egp(price * qty)}</td>
      </tr>`;
    })
    .join("");

  const subtotal = n(order.subtotal);
  const shipping = n(order.shipping);
  const discount = n(order.discount_amount);
  const total = n(order.total);
  const paid = n(order.amount_paid);
  const balance = Math.max(0, total - paid);
  const addr = [order.address, order.city, order.governorate].map(s).filter(Boolean).join(", ");

  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;color:#666">${label}</td><td style="padding:4px 0;text-align:right;color:#111;font-weight:${bold ? 700 : 400}">${value}</td></tr>`;

  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
        <tr><td style="background:#111;padding:22px 28px;color:#fff">
          <div style="font-size:20px;font-weight:700;letter-spacing:.04em">BEAUTY BAR</div>
          <div style="opacity:.75;font-size:13px;margin-top:2px">Invoice · Order #${esc(s(order.order_number))}</div>
        </td></tr>
        <tr><td style="padding:24px 28px">
          <p style="margin:0 0 4px;color:#111;font-size:15px">Hi ${esc(s(order.customer_name) || "there")},</p>
          <p style="margin:0 0 18px;color:#555;font-size:14px;line-height:1.5">Here is the invoice for your order placed on ${esc(new Date(s(order.created_at)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
            <tr>
              <th align="left" style="padding:0 0 8px;color:#888;font-weight:600;border-bottom:2px solid #111">Item</th>
              <th align="center" style="padding:0 0 8px;color:#888;font-weight:600;border-bottom:2px solid #111">Qty</th>
              <th align="right" style="padding:0 0 8px;color:#888;font-weight:600;border-bottom:2px solid #111">Amount</th>
            </tr>
            ${rows}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-top:16px">
            ${line("Subtotal", egp(subtotal))}
            ${discount > 0 ? line(`Discount${order.discount_code ? ` (${esc(s(order.discount_code))})` : ""}`, `-${egp(discount)}`) : ""}
            ${line("Shipping", shipping > 0 ? egp(shipping) : "Free")}
            ${line("Total", egp(total), true)}
            ${paid > 0 ? line("Paid", egp(paid)) : ""}
            ${line("Balance due", egp(balance), true)}
          </table>

          ${addr ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;color:#666;font-size:13px"><div style="color:#888;text-transform:uppercase;letter-spacing:.06em;font-size:11px;margin-bottom:4px">Shipping to</div>${esc(s(order.customer_name))}<br>${esc(addr)}</div>` : ""}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafafa;color:#999;font-size:12px;text-align:center">Thank you for shopping with Beauty Bar · بيوتي بار</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

export async function sendOrderInvoiceEmail(
  orderNumber: string,
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "not_configured" };
  try {
    const supabase = getServerSupabase();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("*, store_order_items(*)")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!order) return { ok: false, error: "order_not_found" };

    // Recipient: the customer profile's email, by the order's phone.
    let to = "";
    try {
      const { data: cust } = await supabase
        .from("store_customers")
        .select("email")
        .in("phone", phoneVariants(s(order.phone)))
        .maybeSingle();
      to = s(cust?.email);
    } catch {
      /* no customers table — fall through to the not-found message */
    }
    if (!to || !to.includes("@")) return { ok: false, error: "no_customer_email" };

    const items = (Array.isArray(order.store_order_items) ? order.store_order_items : []) as Row[];
    const html = invoiceHtml(order as Row, items);
    const res = await sendMail({
      to,
      subject: `Invoice for order #${orderNumber} · Beauty Bar`,
      html,
    });
    if (!res.ok) return { ok: false, error: res.error || "send_failed" };
    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
