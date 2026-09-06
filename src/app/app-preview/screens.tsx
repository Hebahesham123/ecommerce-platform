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
/**
 * Signing in, in as few steps as the number allows.
 *
 * A number the store has already verified never sees a code screen at all —
 * it is told it is verified and signed straight in. Anything else is asked how
 * it wants the code before one is sent, because offering WhatsApp or SMS after
 * the message has already gone is not offering a choice.
 */
export function SignIn({ ar, onDone }: { ar: boolean; onDone: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "channel" | "code">("phone");
  const [sentVia, setSentVia] = useState<"whatsapp" | "sms" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Sign in a number the store already knows — no code involved.
   *
   * It says so before it does it: signing someone in silently, while they
   * stand there expecting a code, looks identical to nothing happening.
   */
  async function login(p: string) {
    const res = await api.post<{ token: string; phone: string }>("/auth/login", { phone: p });
    if (!res.ok) return setErr(res.error);
    setToken(res.data.token, res.data.phone);
    // Long enough to read, short enough not to feel like a wait.
    setTimeout(() => onDone(res.data.phone), 1000);
  }

  /** Step one: is this number one we know? Nothing is sent here. */
  async function check() {
    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await api.post<{ status: string; phone: string }>("/auth/request-code", { phone });
    setBusy(false);
    if (!res.ok) return setErr(res.error);

    if (res.data.status === "already_verified") {
      setNote(
        ar
          ? "هذا الرقم موثَّق بالفعل — لا حاجة لكود. جارٍ تسجيل دخولك…"
          : "This number is already verified — no code needed. Signing you in…",
      );
      return login(res.data.phone);
    }
    setStage("channel");
  }

  /** Step two: they picked how to receive it, so now send it. */
  async function send(channel: "whatsapp" | "sms") {
    setBusy(true);
    setErr(null);
    setNote(null);
    const res = await api.post<{ status: string; phone: string }>("/auth/request-code", {
      phone,
      channel,
    });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    if (res.data.status === "not_delivered") return setErr("not_delivered");

    setSentVia(channel);
    setNote(
      channel === "sms"
        ? ar ? "أُرسل الكود برسالة نصية." : "Code sent by SMS."
        : ar ? "أُرسل الكود على واتساب." : "Code sent on WhatsApp.",
    );
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

  function restart() {
    setStage("phone");
    setCode("");
    setSentVia(null);
    setErr(null);
    setNote(null);
  }

  const message = (e: string) => {
    if (e === "not_registered")
      return ar
        ? "هذا الرقم غير معروف للمتجر."
        : "The store doesn't know this number.";
    if (e === "not_delivered")
      return ar
        ? "تعذّر إرسال الكود. جرّبي الطريقة الأخرى، أو تحقّقي من خدمة الإرسال."
        : "The code couldn't be sent — the delivery webhook refused it. Try the other channel, or check the OTP service.";
    if (e === "invalid_phone") return ar ? "الرقم غير مكتمل." : "That number isn't complete.";
    if (e === "no_code")
      return ar
        ? "لا يوجد كود لهذا الرقم — اطلبي كوداً جديداً."
        : "There's no code waiting for this number. Ask for a new one.";
    if (e === "wrong_code") return ar ? "الكود غير صحيح." : "That code isn't right.";
    if (e === "expired") return ar ? "انتهت صلاحية الكود." : "That code has expired.";
    return null;
  };

  return (
    <div className="space-y-4">
      <Field
        label={ar ? "رقم الموبايل" : "Phone number"}
        value={phone}
        onChange={setPhone}
        placeholder="01012345678"
        disabled={stage !== "phone"}
        hint={ar ? "‏01… أو ‎+20…‎ — كلاهما يعمل" : "01… or +20… — either works"}
      />

      {stage === "code" && (
        <Field
          label={ar ? "الكود" : "Code"}
          value={code}
          onChange={setCode}
          placeholder="123456"
          hint={
            sentVia === "sms"
              ? ar ? "وصلك برسالة نصية" : "Sent to you by SMS"
              : ar ? "وصلك على واتساب" : "Sent to you on WhatsApp"
          }
        />
      )}

      {note && <Note tone="good">{note}</Note>}
      {err && (
        <Note tone="bad">
          <code className="font-mono text-[11px]">{err}</code>
          {message(err) && <div className="mt-1">{message(err)}</div>}
        </Note>
      )}

      {stage === "phone" && (
        <Btn full onClick={check} disabled={busy || phone.replace(/\D/g, "").length < 10}>
          {busy ? "…" : ar ? "متابعة" : "Continue"}
        </Btn>
      )}

      {stage === "channel" && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {ar ? "كيف تحبّين استلام الكود؟" : "How would you like the code?"}
          </p>
          <Btn full onClick={() => send("whatsapp")} disabled={busy}>
            {ar ? "واتساب" : "WhatsApp"}
          </Btn>
          <Btn full variant="outline" onClick={() => send("sms")} disabled={busy}>
            {ar ? "رسالة نصية" : "SMS"}
          </Btn>
          <Btn full variant="ghost" onClick={restart}>
            {ar ? "تغيير الرقم" : "Change the number"}
          </Btn>
        </div>
      )}

      {stage === "code" && (
        <div className="space-y-2">
          <Btn full onClick={verify} disabled={busy || code.length < 4}>
            {busy ? "…" : ar ? "تأكيد" : "Verify"}
          </Btn>
          <Btn full variant="outline" onClick={() => setStage("channel")} disabled={busy}>
            {ar ? "إرسال الكود مرة أخرى" : "Send the code again"}
          </Btn>
          <Btn full variant="ghost" onClick={restart}>
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
