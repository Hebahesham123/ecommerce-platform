"use client";

import { use } from "react";
import { SettingsShell } from "@/components/settings-shell";
import { SettingsForm } from "@/components/settings-form";

export default function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  return (
    <SettingsShell>
      <SettingsForm sectionKey={section} />
    </SettingsShell>
  );
}
