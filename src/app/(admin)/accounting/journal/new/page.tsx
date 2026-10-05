"use client";

import JournalEntryForm from "@/components/accounting/JournalEntryForm";
import { PageHeader } from "@/components/accounting/ReportToolbar";

export default function NewJournalEntryPage() {
  return (
    <div dir="rtl">
      <PageHeader title="قيد جديد" subtitle="إنشاء قيد يومية جديد" />
      <JournalEntryForm />
    </div>
  );
}
