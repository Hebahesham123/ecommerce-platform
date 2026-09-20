"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IcX, IcVideo, IcAlert } from "@/components/icons";

/**
 * Camera check — see yourself and watch your own level before going on air.
 *
 * Purely local: the picture never leaves this browser and nothing is sent
 * anywhere. That limitation is the whole point. Every broadcasting tool has
 * this screen because the failures worth catching are the dull ones — the lens
 * cover, the wrong microphone, the lamp behind you — and the worst moment to
 * find them is thirty seconds into a live.
 *
 * It is also not a substitute for broadcasting: seeing yourself here proves the
 * camera works, not that anyone can watch you.
 */
export function CameraCheck({ ar, onClose }: { ar: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>("");
  const [micId, setMicId] = useState<string>("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (video?: string, audio?: string) => {
      setError(null);
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video ? { deviceId: { exact: video } } : true,
          audio: audio ? { deviceId: { exact: audio } } : true,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Naming the devices needs permission first, so this runs after.
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
        const usedVideo = stream.getVideoTracks()[0]?.getSettings().deviceId ?? "";
        const usedAudio = stream.getAudioTracks()[0]?.getSettings().deviceId ?? "";
        setCameraId(usedVideo);
        setMicId(usedAudio);

        // A moving bar answers "is it hearing me?" in a way a device name cannot.
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(100, Math.round((peak / 128) * 140)));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        const err = e as DOMException;
        setError(
          err.name === "NotAllowedError"
            ? ar
              ? "تم رفض إذن الكاميرا أو الميكروفون. اسمحي بهما من إعدادات المتصفح ثم أعيدي المحاولة."
              : "Camera or microphone permission was denied. Allow both in your browser settings and try again."
            : err.name === "NotFoundError"
              ? ar
                ? "لم يتم العثور على كاميرا أو ميكروفون."
                : "No camera or microphone found."
              : ar
                ? "تعذّر فتح الكاميرا."
                : "Could not open the camera.",
        );
      }
    },
    [ar, stop],
  );

  useEffect(() => {
    // getUserMedia needs a secure context: https, or localhost while developing.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(
        ar
          ? "يتطلب فتح الكاميرا اتصالاً آمناً (https)."
          : "Opening the camera needs a secure connection (https).",
      );
      return;
    }
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cameras = devices.filter((d) => d.kind === "videoinput");
  const mics = devices.filter((d) => d.kind === "audioinput");
  const select =
    "h-10 w-full rounded-xl border border-line bg-surface-page px-3 text-sm text-ink outline-none focus:border-brand-600";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <IcVideo className="h-5 w-5 text-brand-600" />
            {ar ? "فحص الكاميرا" : "Camera check"}
          </h2>
          <button onClick={onClose} className="btn-ghost h-8 w-8 p-0">
            <IcX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl bg-black">
          {error ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <IcAlert className="h-6 w-6 text-amber-400" />
              <p className="text-sm text-white/80">{error}</p>
              <button onClick={() => start()} className="btn-outline mt-2 h-9 px-3 text-xs">
                {ar ? "إعادة المحاولة" : "Try again"}
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              // Muted so the room does not feed back into itself.
              muted
              className="aspect-video w-full object-cover"
            />
          )}
        </div>

        {/* The level bar, not a device name, is what proves the mic is hearing you. */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-ink-soft">
            <span>{ar ? "مستوى الصوت" : "Microphone level"}</span>
            <span>{ar ? "تحدثي لترى الشريط يتحرك" : "Talk and watch it move"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-page">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                level > 70 ? "bg-rose-500" : level > 8 ? "bg-emerald-500" : "bg-slate-300"
              }`}
              style={{ width: `${level}%` }}
            />
          </div>
        </div>

        {(cameras.length > 1 || mics.length > 1) && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cameras.length > 1 && (
              <select
                className={select}
                value={cameraId}
                onChange={(e) => {
                  setCameraId(e.target.value);
                  start(e.target.value, micId);
                }}
              >
                {cameras.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${ar ? "كاميرا" : "Camera"} ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            {mics.length > 1 && (
              <select
                className={select}
                value={micId}
                onChange={(e) => {
                  setMicId(e.target.value);
                  start(cameraId, e.target.value);
                }}
              >
                {mics.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${ar ? "ميكروفون" : "Microphone"} ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <p className="mt-4 rounded-xl bg-surface-page p-3 text-xs leading-relaxed text-ink-muted">
          {ar
            ? "هذه معاينة على جهازك فقط — لا يتم بث أي شيء ولا يراكِ أحد. للبث الفعلي يلزم ربط حساب البث ثم استخدام تطبيق بث على الهاتف."
            : "This is a preview on your own device — nothing is broadcast and nobody can see it. Actually going on air needs the streaming account connected, then a broadcasting app on the phone."}
        </p>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn-outline">
            {ar ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
