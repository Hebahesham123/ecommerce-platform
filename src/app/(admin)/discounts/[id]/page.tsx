"use client";

import { use, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Discount } from "@/lib/discounts";
import { getDiscount } from "../actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { DiscountForm } from "@/components/discount-form";

export default function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDiscount(id).then((res) => {
      if (res.ok) setDiscount(res.data);
      else setError(res.error === "not_configured" ? t("supabase_missing") : res.error);
    });
  }, [id, t]);

  return (
    <>
      <PageHeader title={t("edit_discount")} subtitle={t("discounts_subtitle")} />
      {error && (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>
      )}
      {!error && !discount && (
        <Card className="p-12 text-center text-sm text-ink-soft">{t("loading")}</Card>
      )}
      {discount && <DiscountForm mode="edit" initial={discount} />}
    </>
  );
}
