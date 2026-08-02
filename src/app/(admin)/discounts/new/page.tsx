"use client";

import { useI18n } from "@/lib/i18n";
import { emptyDiscount } from "@/lib/discounts";
import { PageHeader } from "@/components/page-header";
import { DiscountForm } from "@/components/discount-form";

export default function NewDiscountPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("create_discount")} subtitle={t("discounts_subtitle")} />
      <DiscountForm mode="create" initial={emptyDiscount()} />
    </>
  );
}
