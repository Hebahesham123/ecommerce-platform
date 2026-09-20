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
 * A black rectangle is the failure this screen has to be good at, because it
 * has several unrelated causes that look identical: a camera the browser never
 * started playing, a camera another app is holding, a shutter over the lens.
 * So it diagnoses rather than just showing nothing — see `diagnosis` below.
 */

type Diagnosis =
  | { kind: "ok" }
  | { kind: "blocked" }        // autoplay refused; needs a click
  | { kind: "no-frames" }      // track present, delivering nothing
  | { kind: "black" };         // frames arriving, every pixel dark

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
  const [track, setTrack] = useState<{ label: string; width: number; height: number } | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis>({ kind: "ok" });

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** Is the picture actually a picture? Sample one frame and look at it. */
  const inspectPicture = useCallback(() => {
    const el = videoRef.current;
    if (!el || el.videoWidth === 0) {
      setDiagnosis({ kind: "no-frames" });
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 18;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let brightest = 0;
      for (let i = 0; i < data.length; i += 4) {
        brightest = Math.max(brightest, data[i], data[i + 1], data[i + 2]);
      }
      // A lens cover still lets a little sensor noise through, so this is a low
      // bar: anything above it means a real, if dim, picture.
      setDiagnosis(brightest < 12 ? { kind: "black" } : { kind: "ok" });
    } catch {
      // A cross-origin taint cannot happen on a camera stream, but a refusal
      // to read pixels is not worth failing the whole panel over.
      setDiagnosis({ kind: "ok" });
    }
  }, []);

  const start = useCallback(
    async (video?: string, audio?: string) => {
      setError(null);
      setDiagnosis({ kind: "ok" });
      setTrack(null);
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video ? { deviceId: { exact: video } } : true,
          audio: audio ? { deviceId: { exact: audio } } : true,
        });
        streamRef.current = stream;

        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          // Set as a property, not only as JSX: an unmuted video is refused
          // autoplay, and the refusal looks exactly like a broken camera.
          el.muted = true;
          el.playsInline = true;
          try {
            await el.play();
          } catch {
            setDiagnosis({ kind: "blocked" });
          }
        }

        // Naming the devices needs permission first, so this runs after.
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
        const videoTrack = stream.getVideoTracks()[0];
        const usedVideo = videoTrack?.getSettings().deviceId ?? "";
        const usedAudio = stream.getAudioTracks()[0]?.getSettings().deviceId ?? "";
        setCameraId(usedVideo);
        setMicId(usedAudio);

        if (videoTrack) {
          const settings = videoTrack.getSettings();
          setTrack({
            label: videoTrack.label || (ar ? "كاميرا" : "Camera"),
            width: settings.width ?? 0,
            height: settings.height ?? 0,
          });
          // A track can be "muted" by the system — held by another app, or cut
          // by an OS privacy switch — while still looking connected here.
          const onMute = () => setDiagnosis({ kind: "no-frames" });
          const onUnmute = () => setDiagnosis({ kind: "ok" });
          videoTrack.addEventListener("mute", onMute);
          videoTrack.addEventListener("unmute", onUnmute);
          if (videoTrack.muted) onMute();
        }

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

        // Give the camera a moment to warm up before judging the picture.
        window.setTimeout(inspectPicture, 1500);
      } catch (e) {
        const err = e as DOMException;
        setError(
          err.name === "NotAllowedError"
            ? ar
              ? "تم رفض إذن الكاميرا أو الميكروفون. اسمحي بهما من إعدادات المتصفح ثم أعيدي المحاولة."
              : "Camera or microphone permission was denied. Allow both in your browser settings and try again."
            : err.name === "NotFoundError"
              ? ar
                ? "لم يتم العثور على كاميرا."
                : "No camera was found on this device."
              : err.name === "NotReadableError"
                ? ar
                  ? "الكاميرا مشغولة بتطبيق آخر. أغلقي Zoom أو Teams أو أي تطبيق يستخدمها ثم أعيدي المحاولة."
                  : "The camera is in use by another app. Close Zoom, Teams or anything else using it, then try again."
                : ar
                  ? "تعذّر فتح الكاميرا."
                  : "Could not open the camera.",
        );
      }
    },
    [ar, stop, inspectPicture],
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

  const hint =
    diagnosis.kind === "blocked"
      ? {
          title: ar ? "المتصفح أوقف تشغيل المعاينة" : "The browser paused the preview",
          body: ar ? "اضغطي لبدء المعاينة." : "Click to start the preview.",
          action: true,
        }
      : diagnosis.kind === "no-frames"
        ? {
            title: ar ? "الكاميرا متصلة لكنها لا ترسل صورة" : "Camera connected, but sending no picture",
            body: ar
              ? "عادةً يكون السبب تطبيقاً آخر يستخدم الكاميرا (Zoom أو Teams)، أو مفتاح الخصوصية في ويندوز."
              : "Usually another app is holding the camera (Zoom, Teams), or Windows camera privacy is switched off.",
            action: false,
          }
        : diagnosis.kind === "black"
          ? {
              title: ar ? "الصورة سوداء تماماً" : "The picture is completely black",
              body: ar
                ? "تأكدي من غطاء العدسة، أو جرّبي كاميرا أخرى من القائمة بالأسفل."
                : "Check for a lens cover or privacy shutter, or pick a different camera below.",
              action: false,
            }
          : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl"
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
            <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
          )}
        </div>

        {hint && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <IcAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <div className="font-semibold">{hint.title}</div>
              <p className="mt-0.5 leading-relaxed">{hint.body}</p>
              <div className="mt-2 flex gap-2">
                {hint.action && (
                  <button
                    onClick={() => {
                      videoRef.current?.play().then(
                        () => {
                          setDiagnosis({ kind: "ok" });
                          window.setTimeout(inspectPicture, 800);
                        },
                        () => {},
                      );
                    }}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    {ar ? "تشغيل المعاينة" : "Start preview"}
                  </button>
                )}
                <button onClick={() => start(cameraId, micId)} className="btn-outline h-8 px-3 text-xs">
                  {ar ? "إعادة المحاولة" : "Try again"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* What the browser says it is actually receiving — the thing that turns
            "it is black" into an answer. */}
        {track && !error && (
          <p className="mt-2 text-xs text-ink-soft">
            {ar ? "الكاميرا المستخدمة" : "Using"}: <span className="text-ink-muted">{track.label}</span>
            {track.width > 0 && ` · ${track.width}×${track.height}`}
          </p>
        )}

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

        {/* Always offered, even with one camera: when the picture is black, the
            first thing wanted is to try a different one. */}
        {(cameras.length > 0 || mics.length > 1) && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cameras.length > 0 && (
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
