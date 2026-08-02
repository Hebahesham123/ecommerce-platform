"use client";

import { useI18n } from "@/lib/i18n";
import { EmbeddedApp } from "@/components/embedded-app";

// The standalone Courier / shipping app. Set in .env.local:
//   NEXT_PUBLIC_COURIER_EMBED_URL=http://localhost:3001
const EMBED_URL = process.env.NEXT_PUBLIC_COURIER_EMBED_URL || "";

export default function CourierSystemPage() {
  const { t } = useI18n();
  return (
    <EmbeddedApp
      title={t("nav_courier_system")}
      subtitle={t("courier_system_subtitle")}
      url={EMBED_URL}
      envVar="NEXT_PUBLIC_COURIER_EMBED_URL"
    />
  );
}
