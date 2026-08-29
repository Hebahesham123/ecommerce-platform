"use client";

import { useI18n } from "@/lib/i18n";
import { EmbeddedApp } from "@/components/embedded-app";

// Self-contained customer review widget (its own Supabase project + anon key),
// served as a static page and embedded here. Edit it at public/widgets/reviews.html.
const EMBED_URL = "/widgets/reviews.html";

export default function ReviewsPage() {
  const { t } = useI18n();
  return (
    <EmbeddedApp
      title={t("nav_reviews")}
      subtitle={t("reviews_subtitle")}
      url={EMBED_URL}
      envVar="—"
    />
  );
}
