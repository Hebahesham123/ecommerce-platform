"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BlockEditor } from "@/components/email/block-editor";
import { readTemplate, writeTemplate } from "@/lib/email-store";
import type { EmailTemplate } from "@/lib/email";

export default function EmailEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    const t = readTemplate(id);
    if (t) setTemplate(t);
    else setMissing(true);
  }, [id]);

  function onChange(next: EmailTemplate) {
    setTemplate(next);
    setSaved(false);
  }
  function onSave() {
    if (!template) return;
    const next = { ...template, updatedAt: Date.now() };
    writeTemplate(next);
    setTemplate(next);
    setSaved(true);
  }
  function onBack() {
    if (!saved && template) writeTemplate({ ...template, updatedAt: Date.now() });
    router.push("/email?tab=templates");
  }

  if (missing) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="text-lg font-semibold text-ink">Template not found</div>
        <p className="max-w-sm text-sm text-ink-soft">It may have been deleted, or opened in a different browser (templates are saved on this device).</p>
        <button onClick={() => router.push("/email?tab=templates")} className="btn-outline">Back to templates</button>
      </div>
    );
  }
  if (!template) return <div className="py-24 text-center text-sm text-ink-soft">Loading…</div>;

  return <BlockEditor value={template} onChange={onChange} onSave={onSave} onBack={onBack} saved={saved} />;
}
