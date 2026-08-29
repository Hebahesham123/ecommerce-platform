"use client";

import { useI18n } from "@/lib/i18n";
import { EmbeddedApp } from "@/components/embedded-app";

// Self-contained customer request widget (its own Supabase project + anon key),
// served as a static page and embedded here. Edit it at public/widgets/requests.html.
const EMBED_URL = "/widgets/requests.html";

export default function RequestsPage() {
  const { t } = useI18n();
  return (
    <EmbeddedApp
      title={t("nav_requests")}
      subtitle={t("requests_subtitle")}
      url={EMBED_URL}
      envVar="—"
    />
  );
}
