"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IcX, IcAlert } from "@/components/icons";
import type { LiveChat } from "@/lib/live-chat";
import { LiveComments } from "@/components/live-comments";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { attachRecordingAction, createRecordingUploadAction } from "./actions";

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
 *
 * It fills the screen. A host watching herself in a postage stamp cannot tell
 * whether she is framed, lit, or in shot at all — the only questions she has
 * while the camera is on — so the picture takes the whole phone and every
 * control floats over it, exactly as the viewers' screen does.
 */

type Phase = "idle" | "starting" | "live" | "ended" | "error";
type Recording = "off" | "on" | "saving" | "saved" | "failed";

/** How big the recording has got, in the unit a phone owner thinks in. */
const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;

export function Broadcast({
  liveId,
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
  liveId: string;
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
  const [recording, setRecording] = useState<Recording>("off");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const paintRef = useRef<number | null>(null);
  const [recordedBytes, setRecordedBytes] = useState(0);
  /** Kept after a failed upload, so an hour of talking is never simply lost. */
  const [rescue, setRescue] = useState<{ url: string; name: string } | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [draft, setDraft] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopPainting = useCallback(() => {
    if (paintRef.current != null) cancelAnimationFrame(paintRef.current);
    paintRef.current = null;
  }, []);

  const stopEverything = useCallback(() => {
    stopPainting();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopPainting]);

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
    stopRecording();
    // Tell Cloudflare the broadcast is over, so the recording closes promptly
    // instead of waiting for the connection to time out.
    const resource = resourceRef.current;
    if (resource) {
      fetch(resource, { method: "DELETE" }).catch(() => {});
      resourceRef.current = null;
    }
    // The camera is released a moment later, so the recorder gets its last
    // frames instead of the tracks being pulled out from under it.
    setTimeout(stopEverything, 400);
    setPhase("ended");
    onEnded();
  }

  /**
   * Keep a copy of what is going out.
   *
   * The provider records what a broadcasting app sends and nothing that comes
   * from a browser, so a browser broadcast that wants a replay has to make one
   * itself.
   *
   * It records through a canvas rather than straight off the camera track. A
   * phone camera hands over a sideways picture and a note saying which way up
   * it goes; the browser reads the note, the recording file has nowhere to put
   * it, and the replay comes back lying on its side and the wrong shape. The
   * canvas is painted with the frame the browser has already turned the right
   * way up, at the size it is really being shown at, so what is saved is what
   * was on screen.
   */
  function bestMimeType(): string {
    const wanted = [
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    if (typeof MediaRecorder === "undefined") return "";
    return wanted.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  }

  /** A stream of upright frames, or null if this browser cannot make one. */
  function uprightStream(camera: MediaStream): MediaStream | null {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    if (!video || typeof canvas.captureStream !== "function") return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 720 on the long edge. Beyond that a phone replay gains nothing a viewer
    // can see and costs megabytes a minute, which is what makes the difference
    // between a file that uploads and one that is refused.
    const fit = (w: number, h: number) => {
      const scale = Math.min(1, 720 / Math.max(w, h));
      // Even numbers: odd dimensions upset some encoders.
      return [Math.round((w * scale) / 2) * 2, Math.round((h * scale) / 2) * 2];
    };

    const [w0, h0] = fit(video.videoWidth || 720, video.videoHeight || 1280);
    canvas.width = w0;
    canvas.height = h0;

    const paint = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        // The phone can be turned over mid-sentence; the canvas follows.
        const [cw, ch] = fit(w, h);
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        ctx.drawImage(video, 0, 0, cw, ch);
      }
      paintRef.current = requestAnimationFrame(paint);
    };
    paint();

    const out = canvas.captureStream(30);
    // The picture is redrawn; the sound is the very same track the viewers
    // are hearing.
    for (const track of camera.getAudioTracks()) out.addTrack(track);
    return out;
  }

  function startRecording() {
    const camera = streamRef.current;
    if (!camera || typeof MediaRecorder === "undefined") {
      setRecording("failed");
      setError(ar ? "هذا المتصفح لا يدعم التسجيل." : "This browser cannot record.");
      return;
    }
    try {
      // Straight off the camera is the fallback: a sideways replay is still
      // better than no replay.
      const source = uprightStream(camera) ?? camera;
      const mimeType = bestMimeType();
      // Left to itself a recorder picks a bitrate for a desktop screen and
      // writes a file too big to upload. This is about nine megabytes a
      // minute, which looks the same on a phone and can actually be sent.
      const rec = new MediaRecorder(source, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_200_000,
        audioBitsPerSecond: 96_000,
      });
      chunksRef.current = [];
      setRecordedBytes(0);
      setRescue(null);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          setRecordedBytes((n) => n + e.data.size);
        }
      };
      rec.onstop = () => {
        stopPainting();
        void saveRecording(rec.mimeType);
      };
      // A chunk a second, so a crash costs a second rather than the lot.
      rec.start(1000);
      recorderRef.current = rec;
      setRecording("on");
    } catch {
      stopPainting();
      setRecording("failed");
    }
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    setRecording("saving");
    rec.stop();
    recorderRef.current = null;
  }

  async function saveRecording(mimeType: string) {
    const parts = chunksRef.current;
    chunksRef.current = [];
    if (!parts.length) {
      setRecording("failed");
      return;
    }
    const blob = new Blob(parts, { type: mimeType || "video/webm" });
    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    try {
      // Straight from here to storage: the file is hundreds of megabytes and
      // a serverless request is capped in single digits.
      const slot = await createRecordingUploadAction(liveId, extension);
      if (!slot.ok) throw new Error(slot.error);
      const { error: upErr } = await getBrowserSupabase()
        .storage.from(slot.data.bucket)
        .uploadToSignedUrl(slot.data.path, slot.data.token, blob, {
          contentType: blob.type,
          // A recording never changes, so it may be cached for as long as the
          // CDN will keep it. The hour it defaults to means the first customer
          // after every lull waits for the origin all over again.
          cacheControl: "31536000",
        });
      if (upErr) throw upErr;
      const attached = await attachRecordingAction(liveId, slot.data.publicUrl);
      if (!attached.ok) throw new Error(attached.error);
      setRecording("saved");
    } catch (e) {
      setRecording("failed");
      const raw = (e as Error).message;
      // A refusal on size is not a bug to report, it is a setting to change,
      // and saying which one is the difference between a fix and a shrug.
      const tooBig = /maximum allowed size|exceeded|too large|413/i.test(raw);
      setError(
        tooBig
          ? ar
            ? "التسجيل أكبر من حد الرفع في Supabase. ارفعي الحد من Storage → Settings، أو احفظي الفيديو على الهاتف من الزر بالأسفل."
            : "The recording is over Supabase's upload limit. Raise it in Storage → Settings, or save the video to this phone with the button below."
          : ar
            ? `تعذّر حفظ التسجيل: ${raw}`
            : `Could not save the recording: ${raw}`,
      );
      // Whatever went wrong up there, the video itself is in hand. Offer it
      // rather than discarding an hour of work on a failed request.
      try {
        setRescue({
          url: URL.createObjectURL(blob),
          name: `live-${liveId}.${extension}`,
        });
      } catch {
        /* nothing more to offer */
      }
    }
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  function leave() {
    if (phase === "live") {
      if (!window.confirm(ar ? "إنهاء البث؟" : "End the broadcast?")) return;
      endBroadcast();
      return;
    }
    // Closing mid-upload would throw the recording away, which is the one
    // thing that cannot be got back.
    if (recording === "on" || recording === "saving") {
      const sure = window.confirm(
        ar ? "التسجيل لم يُحفظ بعد. الخروج؟" : "The recording is not saved yet. Leave anyway?",
      );
      if (!sure) return;
    }
    stopEverything();
    onClose();
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black text-white">
      {/*
        Mirrored, but only here. A face that moves the opposite way to the one
        you moved is useless for checking your own framing, which is why every
        camera app shows you a mirror. What is broadcast and what is recorded
        stay the right way round: this is a CSS transform, and it touches
        nothing but the glass.
      */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Everything below floats over the picture. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        <div className="pointer-events-auto flex items-start gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {phase === "live" ? (
                <>
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold uppercase">
                    {ar ? "مباشر" : "Live"}
                  </span>
                  <span
                    className="rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium backdrop-blur"
                    dir="ltr"
                  >
                    {mmss}
                  </span>
                  <span className="rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
                    👁 {Math.max(watching, viewers)}
                  </span>
                </>
              ) : (
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
                  {phase === "ended" ? (ar ? "انتهى البث" : "Ended") : ar ? "معاينة" : "Preview"}
                </span>
              )}
              {recording === "on" && (
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold">
                  {ar ? "● تسجيل" : "● REC"}
                  {recordedBytes > 0 && <span className="ms-1 font-medium">{mb(recordedBytes)}</span>}
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate text-[15px] font-semibold drop-shadow">{title}</h2>
          </div>

          <button
            onClick={() => {
              const next = facing === "user" ? "environment" : "user";
              setFacing(next);
              openCamera(next);
            }}
            className="shrink-0 rounded-full bg-black/50 px-3 py-2 text-xs font-medium backdrop-blur"
          >
            {ar ? "قلب" : "Flip"}
          </button>
          <button
            onClick={leave}
            className="shrink-0 rounded-full bg-black/50 p-2.5 backdrop-blur"
            aria-label={ar ? "إغلاق" : "Close"}
          >
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1" />

        {/* What the room is saying, over your own picture — all of it,
            scrollable, since the one comment worth answering is usually the
            one that has just been pushed off the bottom. */}
        <div className="px-3 pb-2">
          <LiveComments
            messages={messages}
            ar={ar}
            empty={ar ? "لا توجد تعليقات بعد" : "No comments yet"}
            className="max-h-[32dvh] max-w-[80%]"
          />
        </div>

        <div className="pointer-events-auto bg-gradient-to-t from-black/85 via-black/60 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
          {error && (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-amber-500/95 p-2.5 text-xs text-amber-950">
              <IcAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {rescue && (
            <a
              href={rescue.url}
              download={rescue.name}
              className="mb-2 flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-ink"
            >
              {ar ? `احفظي الفيديو على الهاتف (${mb(recordedBytes)})` : `Save the video to this phone (${mb(recordedBytes)})`}
            </a>
          )}

          {/* Mic, level, record — the three things checked mid-sentence. */}
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur ${
                micOn ? "bg-white/15 text-white" : "bg-rose-600 text-white"
              }`}
            >
              {micOn ? (ar ? "الميكروفون يعمل" : "Mic on") : ar ? "مكتوم" : "Muted"}
            </button>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full rounded-full transition-[width] duration-75 ${
                  !micOn ? "bg-rose-400" : micLevel > 8 ? "bg-emerald-400" : "bg-white/50"
                }`}
                style={{ width: `${micOn ? micLevel : 100}%` }}
              />
            </div>
            <button
              onClick={() => (recording === "on" ? stopRecording() : startRecording())}
              disabled={recording === "saving"}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur ${
                recording === "on"
                  ? "bg-rose-600 text-white"
                  : recording === "saved"
                    ? "bg-emerald-500 text-white"
                    : "bg-white/15 text-white"
              }`}
            >
              {recording === "on"
                ? (ar ? "■ إيقاف" : "■ Stop")
                : recording === "saving"
                  ? (ar ? "جارٍ الحفظ…" : "Saving…")
                  : recording === "saved"
                    ? (ar ? "✓ حُفظ" : "✓ Saved")
                    : ar ? "● تسجيل" : "● Record"}
            </button>
          </div>

          {phase !== "ended" && (
            <div className="mb-2 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && replyOnAir()}
                maxLength={240}
                placeholder={ar ? "ردّي على المشاهدين…" : "Reply to viewers…"}
                className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none backdrop-blur placeholder:text-white/50"
              />
              <button
                onClick={replyOnAir}
                disabled={sendingComment || !draft.trim()}
                className="h-11 shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {ar ? "إرسال" : "Send"}
              </button>
            </div>
          )}

          {phase === "live" ? (
            <button
              onClick={endBroadcast}
              className="h-12 w-full rounded-xl border border-white/30 bg-white/10 text-base font-semibold text-white backdrop-blur"
            >
              {ar ? "إنهاء البث" : "End broadcast"}
            </button>
          ) : phase === "ended" ? (
            <button
              onClick={leave}
              className="h-12 w-full rounded-xl border border-white/30 bg-white/10 text-base font-semibold text-white backdrop-blur"
            >
              {ar ? "إغلاق" : "Close"}
            </button>
          ) : (
            <button
              onClick={goLive}
              disabled={phase === "starting" || phase === "error"}
              className="h-12 w-full rounded-xl bg-rose-600 text-base font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {phase === "starting" ? (ar ? "جارٍ الاتصال…" : "Connecting…") : ar ? "ابدئي البث" : "Go live"}
            </button>
          )}

          <p className="mt-2 text-center text-[11px] text-white/60">
            {recording === "on"
              ? ar
                ? "يجري التسجيل — يُحفظ تلقائياً عند إنهاء البث."
                : "Recording — it saves by itself when you end the broadcast."
              : recording === "saving"
                ? ar
                  ? `جارٍ رفع التسجيل (${mb(recordedBytes)}) — لا تغلقي هذه الصفحة.`
                  : `Uploading the recording (${mb(recordedBytes)}) — keep this page open.`
                : recording === "saved"
                  ? ar
                    ? "التسجيل محفوظ ومتاح كإعادة."
                    : "Saved, and available as the replay."
                  : ar
                    ? `${title} · يظهر المشاهدون بعد ثوانٍ من بدء البث`
                    : `${title} · viewers see you a few seconds after you start`}
          </p>
        </div>
      </div>
    </div>
  );
}
