"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SettingsShell } from "@/components/settings-shell";
import { SettingsForm } from "@/components/settings-form";
import { getSection } from "@/lib/settings";

export default function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  const router = useRouter();

  // A section whose answers live somewhere else — Locations, which are rows
  // in the `locations` table — sends the visitor on rather than drawing an
  // empty form over a list it does not own. Covers an old bookmark as well as
  // the card, which already links straight there.
  const target = getSection(section)?.href;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  if (target) return null;

  return (
    <SettingsShell>
      <SettingsForm sectionKey={section} />
    </SettingsShell>
  );
}
