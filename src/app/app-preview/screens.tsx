"use client";

import { useEffect, useState } from "react";
import {
  api,
  getPhone,
  setToken,
  type Account,
  type MyRequest,
  type ReturnableOrder,
} from "./api";
import { Btn, Empty, Field, money, Note, Sheet, Spinner } from "./ui";

/**
 * Everything behind the Account tab: signing in, order history, returns and
 * enquiries. Split out from the shell purely for length — every screen here
 * talks to the same API client and nothing else.
 */

// ---------------------------------------------------------------- sign in --
export function SignIn({ ar, onDone }: { ar: boolean; onDone: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setErr(null);
    const res = await api.post<{ sent: boolean }>("/auth/request-code", { phone });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setStage("code");
  }

  async function verify() {
    setBusy(true);
    setErr(null);
    const res = await api.post<{ token: string; phone: string }>("/auth/verify", { phone, code });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setToken(res.data.token, res.data.phone);
    onDone(res.data.phone);
  }

  /** The store's own passwordless rule: a number it already knows needs no code. */
  async function quickLogin() {
    setBusy(true);
    setErr(null);
    const res = await api.post<{ token: string; phone: string }>("/auth/login", { phone });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setToken(res.data.token, res.data.phone);
    onDone(res.data.phone);
  }

  return (
    <div className="space-y-4">
      <Field
        label={ar ? "رقم الموبايل" : "Phone number"}
        value={phone}
        onChange={setPhone}
        placeholder="+201000000000"
        hint={ar ? "بصيغة دولية" : "In international format"}
      />

      {stage === "code" && (
        <Field
          label={ar ? "الكود" : "Code"}
          value={code}
          onChange={setCode}
          placeholder="123456"
          hint={ar ? "وصلك على واتساب أو رسالة" : "Sent to you on WhatsApp or SMS"}
        />
      )}

      {err && (
        <Note tone="bad">
          <code className="font-mono">{err}</code>
          {err === "not_registered" &&
            (ar
              ? " — هذا الرقم غير معروف للمتجر. جرّبي رقماً سبق أن طلب منه."
              : " — the store doesn't know this number. Try one that has ordered before.")}
        </Note>
      )}

      {stage === "phone" ? (
        <div className="space-y-2">
          <Btn full onClick={sendCode} disabled={busy || phone.length < 8}>
            {busy ? "…" : ar ? "أرسلي الكود" : "Send me a code"}
          </Btn>
          <Btn full variant="outline" onClick={quickLogin} disabled={busy || phone.length < 8}>
            {ar ? "دخول بدون كود (رقم معروف)" : "Sign in without a code (known number)"}
          </Btn>
        </div>
      ) : (
        <div className="space-y-2">
          <Btn full onClick={verify} disabled={busy || code.length < 4}>
            {busy ? "…" : ar ? "تأكيد" : "Verify"}
          </Btn>
          <Btn full variant="ghost" onClick={() => setStage("phone")}>
            {ar ? "تغيير الرقم" : "Change the number"}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- orders --
export function Orders({ ar, signedIn }: { ar: boolean; signedIn: boolean }) {
  const [orders, setOrders] = useState<Account["orders"] | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    api.get<{ orders: Account["orders"] }>("/orders").then((r) => setOrders(r.ok ? r.data.orders : []));
  }, [signedIn]);

  if (!signedIn) return <Empty>{ar ? "سجّلي الدخول لرؤية طلباتك" : "Sign in to see your orders"}</Empty>;
  if (!orders) return <Spinner />;
  if (!orders.length) return <Empty>{ar ? "لا توجد طلبات بعد" : "No orders yet"}</Empty>;

  const items = Array.isArray(detail?.store_order_items)
    ? (detail!.store_order_items as Record<string, unknown>[])
    : [];

  return (
    <>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.orderNumber}>
            <button
              onClick={async () => {
                const r = await api.get<Record<string, unknown>>(`/orders/${o.orderNumber}`);
                if (r.ok) setDetail(r.data);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-start transition hover:border-violet-300"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-slate-900">
                  #{o.orderNumber}
                </span>
                <span className="text-sm font-bold text-slate-900">{money(o.total, ar)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                  {o.lifecycle}
                </span>
                <span>{o.createdAt.slice(0, 10)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={`#${String(detail?.order_number ?? "")}`}
      >
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="min-w-0 truncate text-slate-700">
                {String(it.product_name ?? "")} × {String(it.quantity ?? "")}
              </span>
              <span className="font-medium text-slate-900">
                {money(Number(it.price ?? 0) * Number(it.quantity ?? 0), ar)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-bold">
          <span>{ar ? "الإجمالي" : "Total"}</span>
          <span>{money(Number(detail?.total ?? 0), ar)}</span>
        </div>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------- returns --
export function Returns({ ar, signedIn }: { ar: boolean; signedIn: boolean }) {
  const [eligible, setEligible] = useState<ReturnableOrder[] | null>(null);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [picked, setPicked] = useState<ReturnableOrder | null>(null);
  const [kind, setKind] = useState<"return" | "exchange">("return");
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [replacementId, setReplacementId] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [e, m] = await Promise.all([
      api.get<{ orders: ReturnableOrder[] }>("/returns/eligible"),
      api.get<{ requests: MyRequest[] }>("/returns"),
    ]);
    setEligible(e.ok ? e.data.orders : []);
    setMine(m.ok ? m.data.requests : []);
  }
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn]);

  async function submit() {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    const res = await api.post<{ reference: string }>("/returns", {
      kind,
      orderId: picked.orderId,
      returnLines: Object.entries(chosen)
        .filter(([, q]) => q > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      replacementLines:
        kind === "exchange" && replacementId ? [{ itemId: replacementId, quantity: 1 }] : [],
      reason,
      note: "",
    });
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "bad", text: res.error });
    setMsg({ tone: "good", text: `${ar ? "تم" : "Opened"} — ${res.data.reference}` });
    setPicked(null);
    setChosen({});
    load();
  }

  if (!signedIn) return <Empty>{ar ? "سجّلي الدخول أولاً" : "Sign in first"}</Empty>;
  if (!eligible) return <Spinner />;

  return (
    <div className="space-y-4">
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {ar ? "يمكن إرجاعها" : "Still returnable"}
        </h4>
        {eligible.length === 0 ? (
          <Empty>{ar ? "لا توجد طلبات داخل المهلة" : "Nothing inside the 14-day window"}</Empty>
        ) : (
          <ul className="mt-2 space-y-2">
            {eligible.map((o) => (
              <li key={o.orderId}>
                <button
                  onClick={() => {
                    setPicked(o);
                    setChosen({});
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-start transition hover:border-violet-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold">#{o.orderNumber}</span>
                    <span className="text-sm font-bold">{money(o.total, ar)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {ar ? "حتى" : "Until"} {o.windowExpiresAt.slice(0, 10)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mine.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {ar ? "طلباتي" : "My requests"}
          </h4>
          <ul className="mt-2 space-y-1.5">
            {mine.map((r) => (
              <li
                key={r.reference}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"
              >
                <span className="font-mono font-semibold">{r.reference}</span>
                <span className="text-slate-500">
                  {r.kind} · {r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Sheet
        open={Boolean(picked)}
        onClose={() => setPicked(null)}
        title={ar ? "استرجاع أو استبدال" : "Return or exchange"}
      >
        <div className="space-y-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(["return", "exchange"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                  kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {k === "return" ? (ar ? "استرجاع" : "Return") : ar ? "استبدال" : "Exchange"}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {(picked?.lines ?? []).map((l) => (
              <li
                key={l.orderItemId}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5"
              >
                <input
                  type="checkbox"
                  checked={Boolean(chosen[l.orderItemId])}
                  onChange={(e) =>
                    setChosen((c) => ({ ...c, [l.orderItemId]: e.target.checked ? l.returnable : 0 }))
                  }
                  className="h-4 w-4 accent-violet-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-900">{l.productName}</div>
                  <div className="text-[11px] text-slate-500">
                    {money(l.price, ar)} · {ar ? "متاح" : "up to"} {l.returnable}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {kind === "exchange" && (
            <Field
              label={ar ? "معرّف المنتج البديل" : "Replacement item id"}
              value={replacementId}
              onChange={setReplacementId}
              hint={
                ar
                  ? "انسخيه من صفحة منتج في تبويب المتجر"
                  : "Copy one from a product in the Shop tab"
              }
            />
          )}

          <Field label={ar ? "السبب" : "Reason"} value={reason} onChange={setReason} />

          <Btn full onClick={submit} disabled={busy}>
            {busy ? "…" : ar ? "إرسال الطلب" : "Send the request"}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

// --------------------------------------------------------------- enquiry ---
export function Enquiry({ ar }: { ar: boolean }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    const form = new FormData();
    form.set("name", name);
    form.set("message", message);
    form.set("phone", getPhone() ?? "");
    if (orderNumber) form.set("orderNumber", orderNumber);
    if (file) form.append("attachments", file);
    const res = await api.postForm<{ reference: string }>("/requests", form);
    setBusy(false);
    if (!res.ok) return setMsg({ tone: "bad", text: res.error });
    setMsg({ tone: "good", text: `${ar ? "تم الإرسال" : "Sent"} — ${res.data.reference}` });
    setMessage("");
    setFile(null);
  }

  return (
    <div className="space-y-3">
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <Field label={ar ? "الاسم" : "Name"} value={name} onChange={setName} />
      <Field
        label={ar ? "رقم الطلب (اختياري)" : "Order number (optional)"}
        value={orderNumber}
        onChange={setOrderNumber}
      />
      <label className="block">
        <span className="text-xs font-medium text-slate-600">{ar ? "الرسالة" : "Message"}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-violet-500"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">
          {ar ? "صورة أو فيديو (اختياري)" : "Photo or video (optional)"}
        </span>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-slate-600 file:me-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
        />
      </label>
      <Btn full onClick={send} disabled={busy || !name || !message}>
        {busy ? "…" : ar ? "إرسال" : "Send"}
      </Btn>
    </div>
  );
}
