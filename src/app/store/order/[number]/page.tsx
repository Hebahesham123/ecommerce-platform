"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n, egp, num } from "@/lib/i18n";
import { getOrderByNumber } from "../../actions";

type OrderRow = Record<string, unknown>;

export default function OrderConfirmationPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getOrderByNumber(number);
      if (res.ok) setOrder(res.data);
      setLoading(false);
    })();
  }, [number]);

  if (loading) return <div className="py-20 text-center text-ink-soft">{ar ? "جارٍ التحميل…" : "Loading…"}</div>;

  const items = (order?.store_order_items as OrderRow[]) ?? [];
  const total = Number(order?.total ?? 0);

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="rounded-3xl border border-line p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h1 className="mt-4 text-2xl font-bold text-ink">{ar ? "تم استلام طلبك!" : "Order confirmed!"}</h1>
        <p className="mt-1 text-ink-muted">
          {ar ? "رقم الطلب" : "Order number"}: <span className="font-mono font-semibold text-ink">#{number}</span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {ar
            ? "سنتواصل معك لتأكيد الطلب. الدفع عند الاستلام."
            : "We'll contact you to confirm. Payment is cash on delivery."}
        </p>
      </div>

      {order && (
        <div className="mt-4 rounded-2xl border border-line p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">{ar ? "تفاصيل الطلب" : "Order details"}</h2>
          <div className="space-y-3">
            {items.map((i, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-page">
                  {i.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={String(i.image_url)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium text-ink">{String(i.product_name)}</div>
                  <div className="text-xs text-ink-soft">
                    {i.variant_title ? `${i.variant_title} · ` : ""}{num(Number(i.quantity), lang)} ×
                  </div>
                </div>
                <div className="text-sm font-semibold">{egp(Number(i.price) * Number(i.quantity), lang)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-base font-bold">
            <span>{ar ? "الإجمالي" : "Total"}</span>
            <span>{egp(total, lang)}</span>
          </div>
          <div className="mt-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">{String(order.customer_name ?? "")}</span> ·{" "}
            <span dir="ltr">{String(order.phone ?? "")}</span>
            <div className="text-xs text-ink-soft">
              {[order.address, order.city, order.governorate].filter(Boolean).join("، ")}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 text-center">
        <Link href="/store" className="btn-primary inline-flex">{ar ? "متابعة التسوق" : "Continue shopping"}</Link>
      </div>
    </div>
  );
}
