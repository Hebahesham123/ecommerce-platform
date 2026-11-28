/**
 * The sheet that travels with the parcel.
 *
 * Plain data in, HTML out, so it can be rendered and checked without a
 * browser — the same shape as the invoice builder. The page supplies the two
 * labels it cannot work out for itself (the payment method's wording and the
 * requested delivery), which keeps this file free of both the server actions
 * module and the client components.
 *
 * It answers the two questions its readers actually have. The picker needs
 * the products, their SKUs and the quantities. The courier needs to know what
 * to collect at the door, which is why the payment state is printed in a box
 * rather than left implied: a slip showing only a total invites a courier to
 * collect cash for an order that was already paid online. When nothing is
 * owed, it says so in as many words.
 */
import { feesIn } from "@/lib/order-edit";

export type PackingSlipLine = {
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  price: number;
  quantity: number;
};

export type PackingSlipOrder = {
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string | null;
  city: string | null;
  governorate: string | null;
  note: string | null;
  createdAt: string;
  subtotal: number;
  shipping: number;
  total: number;
  discountAmount: number;
  discountCode: string | null;
  amountPaid: number;
  balance: number;
  items: PackingSlipLine[];
};

const esc = (str: string) =>
  String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const money = (v: number) =>
  `LE ${(Number(v) || 0).toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

export function packingSlipHtml(
  o: PackingSlipOrder,
  ar: boolean,
  labels: { paymentLabel: string; deliveryLabel?: string },
): string {
  const date = day(o.createdAt);
  const totalQty = o.items.reduce((s, li) => s + li.quantity, 0);
  const addr = [o.address, o.city, o.governorate].filter(Boolean).map((x) => esc(String(x))).join("<br>");

  // The same fee carry-over the order editor uses, so the slip adds up to the
  // stored total instead of quietly losing the COD fee or the tax.
  const fees = feesIn({ total: o.total, subtotal: o.subtotal, discount: o.discountAmount, shipping: o.shipping });

  const paid = Math.max(0, o.amountPaid);
  const due = Math.max(0, o.balance);
  const settled = due <= 0;

  const rows = o.items
    .map(
      (li) => `
    <tr>
      <td class="it">${esc(li.productName)}${li.variantTitle ? `<span class="v"> · ${esc(li.variantTitle)}</span>` : ""}</td>
      <td class="sku">${li.sku ? esc(li.sku) : "—"}</td>
      <td class="q">${li.quantity}</td>
      <td class="m">${money(li.price)}</td>
      <td class="m">${money(li.price * li.quantity)}</td>
    </tr>`,
    )
    .join("");

  const sumRow = (k: string, v: string, cls = "") =>
    `<tr class="${cls}"><td class="k">${k}</td><td class="v">${v}</td></tr>`;

  const detail: [string, string][] = [
    [ar ? "طريقة الدفع" : "Payment", esc(labels.paymentLabel)],
    [ar ? "تاريخ الطلب" : "Placed", esc(date)],
  ];
  if (labels.deliveryLabel) detail.push([ar ? "التسليم المطلوب" : "Requested delivery", esc(labels.deliveryLabel)]);


  return `<!doctype html><html lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8">
<title>${ar ? "قسيمة تغليف" : "Packing slip"} #${esc(o.orderNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;background:#fff}
  .sheet{max-width:720px;margin:0 auto;padding:40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
  .brand{font-size:24px;font-weight:800;letter-spacing:.06em}
  .brand span{font-style:italic;font-weight:600;color:#7a4b27}
  .meta{text-align:right;color:#555;font-size:13px}
  .meta .n{color:#111;font-weight:700;font-size:15px}
  .label{margin:26px 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#888}
  .cols{display:flex;gap:32px;flex-wrap:wrap}
  .cols > div{flex:1 1 240px;min-width:220px}
  .ship{font-size:14px;line-height:1.7}
  .ship .name{font-weight:700}
  .dl{font-size:13px;line-height:1.7}
  .dl .k{color:#888;display:inline-block;min-width:118px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;text-align:left;padding:8px 10px;border-bottom:2px solid #111}
  th.q,td.q{text-align:center;width:56px}
  th.m,td.m{text-align:right;width:104px;white-space:nowrap}
  th.sku,td.sku{width:150px;color:#777}
  td{padding:12px 10px;border-bottom:1px solid #eee;vertical-align:top}
  td.it{font-weight:600}
  td.it .v{font-weight:400;color:#888}
  .sums{margin-top:18px;display:flex;justify-content:flex-end}
  .sums table{width:300px;margin:0}
  .sums td{border:0;padding:4px 0}
  .sums td.k{color:#555}
  .sums td.v{text-align:right;white-space:nowrap}
  .sums tr.tot td{border-top:2px solid #111;padding-top:10px;font-weight:800;font-size:17px}
  .pay{margin-top:22px;border:2px solid #111;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px}
  .pay .k{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#555}
  .pay .v{font-size:20px;font-weight:800}
  .pay.quiet{border-color:#bbb}
  .pay.quiet .v{font-size:15px;font-weight:700;color:#444}
  .count{margin-top:10px;color:#666;font-size:13px}
  .note{margin-top:18px;padding:10px 14px;border:1px solid #ddd;font-size:13px}
  .note .k{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#888;display:block;margin-bottom:2px}
  .thanks{margin-top:36px;text-align:center;color:#777}
  @media print{.sheet{padding:24px}@page{margin:14mm}}
</style></head>
<body onload="window.print()">
  <div class="sheet">
    <div class="top">
      <div class="brand">BEAUTY <span>BAR</span></div>
      <div class="meta"><div class="n">${ar ? "طلب" : "Order"} #${esc(o.orderNumber)}</div><div>${esc(date)}</div></div>
    </div>

    <div class="cols">
      <div>
        <div class="label">${ar ? "الشحن إلى" : "Ship to"}</div>
        <div class="ship" dir="auto">
          <div class="name">${esc(o.customerName || "")}</div>
          ${addr ? `<div>${addr}</div>` : ""}
          <div>${ar ? "مصر" : "Egypt"}</div>
          ${o.phone ? `<div dir="ltr">${esc(o.phone)}</div>` : ""}
        </div>
      </div>
      <div>
        <div class="label">${ar ? "تفاصيل الطلب" : "Order details"}</div>
        <div class="dl" dir="auto">
          ${detail.map(([k, v]) => `<div><span class="k">${k}</span>${v}</div>`).join("")}
        </div>
      </div>
    </div>

    <div class="label">${ar ? "الأصناف" : "Items"}</div>
    <table>
      <thead><tr>
        <th>${ar ? "الصنف" : "Item"}</th>
        <th class="sku">SKU</th>
        <th class="q">${ar ? "الكمية" : "Qty"}</th>
        <th class="m">${ar ? "السعر" : "Price"}</th>
        <th class="m">${ar ? "الإجمالي" : "Total"}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="count">${totalQty} ${ar ? "قطعة في هذا الطلب" : `item${totalQty === 1 ? "" : "s"} in this order`}</div>

    <div class="sums"><table><tbody>
      ${sumRow(ar ? "المجموع" : "Subtotal", money(o.subtotal))}
      ${o.discountAmount > 0
        ? sumRow(
            (ar ? "الخصم" : "Discount") + (o.discountCode ? ` · ${esc(o.discountCode)}` : ""),
            "−" + money(o.discountAmount),
          )
        : ""}
      ${sumRow(ar ? "الشحن" : "Shipping", o.shipping > 0 ? money(o.shipping) : ar ? "مجاني" : "Free")}
      ${fees > 0 ? sumRow(ar ? "رسوم" : "Fees", money(fees)) : ""}
      ${sumRow(ar ? "الإجمالي" : "Total", money(o.total), "tot")}
      ${paid > 0 ? sumRow(ar ? "المدفوع" : "Paid", "−" + money(paid)) : ""}
    </tbody></table></div>

    <div class="pay${settled ? " quiet" : ""}">
      <div class="k">${settled ? (ar ? "مدفوع بالكامل" : "Paid in full") : ar ? "يُحصّل عند التسليم" : "Collect on delivery"}</div>
      <div class="v">${settled ? (ar ? "لا تُحصّل أي مبلغ" : "Collect nothing") : money(due)}</div>
    </div>

    ${o.note ? `<div class="note" dir="auto"><span class="k">${ar ? "ملاحظة العميل" : "Customer note"}</span>${esc(o.note)}</div>` : ""}

    <div class="thanks">${ar ? "شكراً لتسوقك معنا!" : "Thank you for shopping with us!"}</div>
  </div>
</body></html>`;
}
