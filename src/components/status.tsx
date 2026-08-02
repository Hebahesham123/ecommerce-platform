"use client";

import { useI18n } from "@/lib/i18n";
import {
  labels,
  lifecycleTone,
  paymentTone,
  fulfillmentTone,
  type Order,
} from "@/lib/data";
import { Badge } from "./ui";

export function LifecycleBadge({ v }: { v: Order["lifecycle"] }) {
  const { t } = useI18n();
  return <Badge className={lifecycleTone[v]}>{t(labels.lifecycleKey[v])}</Badge>;
}

export function PaymentBadge({ v, method }: { v: Order["payment"]; method?: Order["method"] }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge className={paymentTone[v]}>{t(labels.paymentKey[v])}</Badge>
      {method && (
        <span className="text-[11px] font-medium text-ink-soft">
          {t(labels.methodKey[method])}
        </span>
      )}
    </span>
  );
}

export function FulfillmentBadge({ v }: { v: Order["fulfillment"] }) {
  const { t } = useI18n();
  return <Badge className={fulfillmentTone[v]}>{t(labels.fulfillmentKey[v])}</Badge>;
}
