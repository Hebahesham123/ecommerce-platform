"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IcX, IcVideo, IcAlert } from "@/components/icons";
import type { LiveChat } from "@/lib/live-chat";

/**
 * Going live from this phone, the way a live is normally done: open it, see
 * yourself, press one button.
 *
 * The video goes straight from this browser to Cloudflare over WebRTC (WHIP),
 * which is an ordinary HTTP exchange — our offer for their answer — so it needs
 * no app installed, no stream key typed, and no library. It lands on the same
 * live input RTMPS would have reached, so viewers, the playback URL and the
 * recording are identical either way. A phone app is still there for anyone who
 * wants one; this is for the host who just wants to start talking.
 */

type Phase = "idle" | "starting" | "live" | "ended" | "error";

export function Broadcast({
  chat,
  watching,
  whipUrl,
  title,
  ar,
  onLive,
  onEnded,
  onClose,
}: {
  /** Shared with the drawer: one connection per live. */
  chat: LiveChat;
  /** Counted from viewer heartbeats. */
  watching: number;
  whipUrl: string;
  title: string;
  ar: boolean;
  /** Fired once video is actually arriving, so the live can be marked on air. */
  onLive: () => void;
  onEnded: () => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const resourceRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [elapsed, setElapsed] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [draft, setDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopEverything = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Show the camera immediately. Seeing yourself before going on air is the
  // whole difference between this and pasting a key into another app.
  const openCamera = useCallback(
    async (which: "user" | "environment") => {
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: which, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          el.muted = true; // never feed the room back into itself
          el.playsInline = true;
          await el.play().catch(() => {});
        }
        // A level that moves is the only proof the microphone is working.
        // Without it, silence at the far end is indistinguishable from a
        // muted mic, a dead mic, or a viewer who never tapped unmute.
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        audioCtxRef.current?.close().catch(() => {});
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setMicLevel(Math.min(100, Math.round((peak / 128) * 140)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();

        // Swapping camera mid-broadcast: hand the new track to the open
        // connection rather than tearing the whole thing down.
        const pc = pcRef.current;
        if (pc) {
          const track = stream.getVideoTracks()[0];
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (track && sender) await sender.replaceTrack(track);
        }
      } catch (e) {
        const err = e as DOMException;
        setError(
          err.name === "NotAllowedError"
            ? ar
              ? "تم رفض إذن الكاميرا أو الميكروفون."
              : "Camera or microphone permission was denied."
            : ar
              ? "تعذّر فتح الكاميرا."
              : "Could not open the camera.",
        );
        setPhase("error");
      }
    },
    [ar],
  );

  useEffect(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(ar ? "يتطلب البث اتصالاً آمناً (https)." : "Broadcasting needs a secure connection (https).");
      setPhase("error");
      return;
    }
    openCamera(facing);
    return stopEverything;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The drawer owns the connection; this reads from it.
  const { messages, viewers, send: sendComment } = chat;

  async function replyOnAir() {
    const body = draft.trim();
    if (!body || sendingComment) return;
    setSendingComment(true);
    const ok = await sendComment({ authorName: ar ? "المضيفة" : "Host", body });
    setSendingComment(false);
    if (ok) setDraft("");
  }

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  async function goLive() {
    const stream = streamRef.current;
    if (!stream || phase === "starting" || phase === "live") return;
    setError(null);
    setPhase("starting");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      });
      pcRef.current = pc;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // WHIP has no signalling channel of its own, so the offer must be
      // complete before it is sent: wait for ICE gathering rather than
      // trickling candidates nobody is listening for.
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const done = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", done);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", done);
        // Some networks never finish gathering; the candidates in hand are
        // usually enough, so do not wait forever.
        setTimeout(resolve, 3000);
      });

      const res = await fetch(whipUrl, {
        method: "POST",
        headers: { "content-type": "application/sdp" },
        body: pc.localDescription?.sdp ?? "",
      });
      if (!res.ok) throw new Error(`whip_${res.status}`);
      resourceRef.current = res.headers.get("location");
      const answer = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "connected") {
          setPhase("live");
          onLive();
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setPhase("error");
          setError(ar ? "انقطع الاتصال بالبث." : "The connection to the stream dropped.");
        }
      });
    } catch (e) {
      setPhase("error");
      setError(
        ar
          ? "تعذّر بدء البث. تأكدي من الاتصال بالإنترنت وحاولي مرة أخرى."
          : `Could not start the broadcast (${(e as Error).message}). Check the connection and try again.`,
      );
    }
  }

  async function endBroadcast() {
    // Tell Cloudflare the broadcast is over, so the recording closes promptly
    // instead of waiting for the connection to time out.
    const resource = resourceRef.current;
    if (resource) {
      fetch(resource, { method: "DELETE" }).catch(() => {});
      resourceRef.current = null;
    }
    stopEverything();
    setPhase("ended");
    onEnded();
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <IcVideo className="h-5 w-5 text-brand-600" />
            {ar ? "البث من هذا الهاتف" : "Broadcast from this phone"}
          </h2>
          <button
            onClick={() => {
              if (phase === "live") {
                if (!window.confirm(ar ? "إنهاء البث؟" : "End the broadcast?")) return;
                endBroadcast();
              }
              stopEverything();
              onClose();
            }}
            className="btn-ghost h-8 w-8 p-0"
          >
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="relative min-h-[200px] flex-1 bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          {phase === "live" && (
            <div className="absolute start-3 top-3 flex items-center gap-2">
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold uppercase text-white">
                {ar ? "مباشر" : "Live"}
              </span>
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white" dir="ltr">
                {mmss}
              </span>
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                👁 {Math.max(watching, viewers)}
              </span>
            </div>
          )}
          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
              {ar ? "جارٍ الاتصال…" : "Connecting…"}
            </div>
          )}
          {/* What the room is saying, over your own picture. */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col gap-1">
            {messages.length === 0 && (
              <div className="w-fit rounded-2xl bg-black/40 px-2.5 py-1 text-[12px] text-white/70 backdrop-blur">
                {ar ? "لا توجد تعليقات بعد" : "No comments yet"}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={m.id}
                style={{ opacity: 0.4 + (0.6 * (i + 1)) / messages.length }}
                className="w-fit max-w-[85%] rounded-2xl bg-black/50 px-2.5 py-1 text-[12px] leading-snug text-white backdrop-blur"
              >
                <span className="font-semibold text-white/80">{m.authorName}</span> {m.body}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const next = facing === "user" ? "environment" : "user";
              setFacing(next);
              openCamera(next);
            }}
            className="absolute end-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white"
          >
            {ar ? "قلب الكاميرا" : "Flip"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 border-b border-line bg-amber-50 p-3 text-xs text-amber-900">
            <IcAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && replyOnAir()}
            maxLength={240}
            placeholder={ar ? "ردّي على المشاهدين…" : "Reply to viewers…"}
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface-page px-3.5 text-sm text-ink outline-none focus:border-brand-600"
          />
          <button
            onClick={replyOnAir}
            disabled={sendingComment || !draft.trim()}
            className="h-10 shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {ar ? "إرسال" : "Send"}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
          <button
            onClick={toggleMic}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              micOn ? "bg-surface-page text-ink" : "bg-rose-100 text-rose-700"
            }`}
          >
            {micOn ? (ar ? "الميكروفون يعمل" : "Mic on") : ar ? "الميكروفون مكتوم" : "Mic muted"}
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-page">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                !micOn ? "bg-rose-400" : micLevel > 8 ? "bg-emerald-500" : "bg-slate-300"
              }`}
              style={{ width: `${micOn ? micLevel : 100}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] text-ink-soft">{ar ? "تحدثي" : "Speak"}</span>
        </div>

        <div className="shrink-0 p-4">
          {phase === "live" ? (
            <button onClick={endBroadcast} className="btn-outline h-12 w-full justify-center text-base">
              {ar ? "إنهاء البث" : "End broadcast"}
            </button>
          ) : phase === "ended" ? (
            <p className="py-2 text-center text-sm text-ink-muted">
              {ar ? "انتهى البث." : "Broadcast ended."}
            </p>
          ) : (
            <button
              onClick={goLive}
              disabled={phase === "starting" || phase === "error"}
              className="h-12 w-full rounded-xl bg-rose-600 text-base font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {phase === "starting" ? (ar ? "جارٍ الاتصال…" : "Connecting…") : ar ? "ابدئي البث" : "Go live"}
            </button>
          )}
          <p className="mt-2 text-center text-[11px] text-ink-soft">
            {ar
              ? `${title} · يظهر المشاهدون بعد ثوانٍ من بدء البث`
              : `${title} · viewers see you a few seconds after you start`}
          </p>
        </div>
      </div>
    </div>
  );
}
