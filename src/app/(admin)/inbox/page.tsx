"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { conversations, sampleThread } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Card, Avatar } from "@/components/ui";
import { IcWhatsApp, IcChat, IcSend } from "@/components/icons";

export default function InboxPage() {
  const { t, lang } = useI18n();
  const [activeId, setActiveId] = useState(conversations[0].id);
  const active = conversations.find((c) => c.id === activeId)!;

  return (
    <>
      <PageHeader
        title={t("nav_inbox")}
        subtitle={lang === "ar" ? "صندوق واحد للواتساب والشات بوت" : "One inbox for WhatsApp + chatbot"}
      />

      <Card className="grid h-[calc(100vh-200px)] grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
        {/* Conversation list */}
        <div className="hidden flex-col border-e border-line md:flex">
          <div className="border-b border-line p-3">
            <input
              placeholder={t("search")}
              className="h-9 w-full rounded-xl border border-line bg-surface-page px-3 text-sm outline-none focus:border-brand-600 focus:bg-white"
            />
          </div>
          <ul className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-3 border-b border-line p-3 text-start transition-colors ${
                    c.id === activeId ? "bg-brand-50" : "hover:bg-surface-page"
                  }`}
                >
                  <Avatar name={c.name} online={c.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                      {c.channel === "whatsapp" ? (
                        <IcWhatsApp className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <IcChat className="h-3.5 w-3.5 text-sky-500" />
                      )}
                    </div>
                    <div className="truncate text-xs text-ink-soft">{c.last}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-ink-soft" dir="ltr">{c.time}</span>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Thread */}
        <div className="flex flex-col bg-surface-page">
          <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
            <Avatar name={active.name} online={active.online} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {active.name}
                {active.channel === "whatsapp" ? (
                  <span className="badge bg-emerald-50 text-emerald-700">
                    <IcWhatsApp className="h-3 w-3" /> WhatsApp
                  </span>
                ) : (
                  <span className="badge bg-sky-50 text-sky-700">
                    <IcChat className="h-3 w-3" /> {lang === "ar" ? "شات المتجر" : "Store chat"}
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-soft" dir="ltr">{active.online ? "online" : "—"}</div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {sampleThread.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.from === "me" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-card ${
                    m.from === "me"
                      ? "bg-brand text-white"
                      : "bg-white text-ink"
                  }`}
                >
                  <p>{m.text}</p>
                  <span
                    className={`mt-1 block text-[10px] ${m.from === "me" ? "text-white/70" : "text-ink-soft"}`}
                    dir="ltr"
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-line bg-white p-3">
            <input
              placeholder={t("type_message")}
              className="h-11 flex-1 rounded-xl border border-line bg-surface-page px-4 text-sm outline-none focus:border-brand-600 focus:bg-white"
            />
            <button className="btn-primary h-11 w-11 p-0">
              <IcSend className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
