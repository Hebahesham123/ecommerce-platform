"use client";

import { useI18n } from "@/lib/i18n";
import { EmbeddedApp } from "@/components/embedded-app";

// The standalone Accounting app (accountingsystempro). Set in .env.local:
//   NEXT_PUBLIC_ACCOUNTING_EMBED_URL=http://localhost:3005
const EMBED_URL = process.env.NEXT_PUBLIC_ACCOUNTING_EMBED_URL || "";

export default function AccountingPage() {
  const { t } = useI18n();
  return (
    <EmbeddedApp
      title={t("nav_accounting")}
      subtitle={t("accounting_subtitle")}
      url={EMBED_URL}
      envVar="NEXT_PUBLIC_ACCOUNTING_EMBED_URL"
    />
  );
}
