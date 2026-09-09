"use client";

import { useEffect, useMemo, useState } from "react";
import type { NudgeCampaign, NudgeEventType, WheelSegment } from "@/lib/nudge";

/**
 * The smart popup, drawn inside the app.
 *
 * The campaign is the same row the web storefront reads, so a wheel built in
 * Marketing - Smart popups is the wheel the app shows: its wording, its
 * colours, its segments and its codes. The app is not given a second popup
 * system of its own, because two of them would answer "what is the offer"
 * differently within a month.
 */

/** Weighted, the same way the web picks: a segment's weight is its share. */
function pickSegment(segments: WheelSegment[]): number {
  const total = segments.reduce((sum, s) => sum + Math.max(0, Number(s.weight) || 0), 0);
  if (total <= 0) return Math.floor(Math.random() * segments.length);
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) {
    r -= Math.max(0, Number(segments[i].weight) || 0);
    if (r <= 0) return i;
  }
  return segments.length - 1;
}

export function AppNudge({
  campaign,
  ar,
  onEvent,
}: {
  campaign: NudgeCampaign | null;
  ar: boolean;
  onEvent?: (type: NudgeEventType, extra?: { code?: string; contact?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [angle, setAngle] = useState(0);
  const [won, setWon] = useState<WheelSegment | null>(null);
  const [contact, setContact] = useState("");

  const wheel = campaign?.style === "wheel" && (campaign.wheelSegments?.length ?? 0) > 1;
  const segments = useMemo(() => campaign?.wheelSegments ?? [], [campaign]);

  // The dwell trigger is the one the app can honour honestly. Exit intent has
  // no meaning without a cursor, and idle and cart belong to screens this
  // overlay does not watch, so they are left to the web rather than faked.
  useEffect(() => {
    if (!campaign || !campaign.enabled || done) return;
    const seconds = campaign.dwellEnabled ? Math.max(1, campaign.dwellSeconds) : 3;
    const t = setTimeout(() => {
      setOpen(true);
      onEvent?.("shown");
    }, seconds * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, done]);

  if (!campaign || !open) return null;

  const accent = campaign.accentColor || "#c1674a";
  const bg = campaign.backgroundColor || "#ffffff";
  const ink = campaign.textColor || "#191614";
  const code = won?.code || campaign.discountCode || "";

  const close = () => {
    setOpen(false);
    setDone(true);
    onEvent?.("dismissed");
  };

  const spin = () => {
    if (won) return;
    const index = pickSegment(segments);
    const slice = 360 / segments.length;
    // Four whole turns so it reads as a spin, then the middle of the winner.
    setAngle(360 * 4 + (360 - (index * slice + slice / 2)));
    setTimeout(() => {
      setWon(segments[index]);
      onEvent?.("claimed", { code: segments[index]?.code });
    }, 4200);
  };

  const claim = () => {
    onEvent?.("claimed", { code: code || undefined, contact: contact || undefined });
    setOpen(false);
    setDone(true);
  };

  const bottom = campaign.position === "bottom-bar";
  const corner = campaign.position === "bottom-right" || campaign.position === "bottom-left";

  return (
    <div
      className={`absolute inset-0 z-40 flex ${
        bottom ? "items-end" : corner ? "items-end" : "items-center"
      } ${campaign.position === "bottom-left" ? "justify-start" : corner ? "justify-end" : "justify-center"} ${
        bottom ? "" : "bg-black/40 p-4"
      }`}
    >
      <div
        className={`relative ${bottom ? "w-full rounded-t-2xl" : "w-full max-w-[280px] rounded-2xl"} p-4 shadow-xl`}
        style={{ background: bg, color: ink }}
      >
        <button
          onClick={close}
          aria-label={ar ? "إغلاق" : "Close"}
          className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[12px]"
          style={{ background: `${accent}1f`, color: accent }}
        >
          ×
        </button>

        {campaign.imageUrl && !wheel && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.imageUrl} alt="" className="mb-2 h-20 w-full rounded-xl object-cover" />
        )}

        {campaign.headline && (
          <div className="pe-6 text-[15px] font-bold leading-snug">{campaign.headline}</div>
        )}
        {campaign.body && (
          <p className="mt-1 text-[11px] leading-relaxed opacity-75">{campaign.body}</p>
        )}

        {wheel && (
          <div className="relative mx-auto mt-3 h-[150px] w-[150px]">
            <div
              className="relative h-full w-full rounded-full border-4 transition-transform duration-[4200ms] ease-out"
              style={{
                borderColor: accent,
                transform: `rotate(${angle}deg)`,
                background: `conic-gradient(${segments
                  .map((seg, i) => {
                    const from = (i * 100) / segments.length;
                    const to = ((i + 1) * 100) / segments.length;
                    return `${i % 2 ? accent : `${accent}55`} ${from}% ${to}%`;
                  })
                  .join(",")})`,
              }}
            >
              {/* Labels ride the wheel, so a shopper can see what they are
                  spinning for rather than watching an anonymous pinwheel. */}
              {segments.map((seg, i) => (
                <span
                  key={`${seg.label}-${i}`}
                  className="absolute left-1/2 top-1/2 h-0 w-0"
                  style={{ transform: `rotate(${(i * 360) / segments.length + 180 / segments.length}deg)` }}
                >
                  <span
                    className="absolute block -translate-x-1/2 -translate-y-[54px] whitespace-nowrap text-[8px] font-bold"
                    style={{ color: i % 2 ? "#ffffff" : ink }}
                  >
                    {seg.label}
                  </span>
                </span>
              ))}
            </div>
            <span
              className="absolute -top-1 left-1/2 -translate-x-1/2 text-[14px]"
              style={{ color: accent }}
            >
              ▼
            </span>
          </div>
        )}

        {won && (
          <div className="mt-2 text-center text-[12px] font-bold" style={{ color: accent }}>
            {won.label}
          </div>
        )}

        {code && (!wheel || won) && (
          <div
            className="mt-3 rounded-xl border border-dashed py-2 text-center font-mono text-[15px] font-bold"
            style={{ borderColor: accent, color: accent }}
          >
            {code}
          </div>
        )}

        {campaign.style === "capture" && (
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={campaign.captureLabel || (ar ? "رقم الموبايل" : "Your phone")}
            className="mt-3 h-9 w-full rounded-xl border px-3 text-[12px] outline-none"
            style={{ borderColor: `${accent}55` }}
          />
        )}

        <button
          onClick={wheel && !won ? spin : claim}
          className="mt-3 w-full rounded-xl py-2.5 text-[12px] font-bold text-white"
          style={{ background: accent }}
        >
          {wheel && !won
            ? campaign.buttonLabel || (ar ? "أديري العجلة" : "Spin")
            : campaign.buttonLabel || (ar ? "خذيه" : "Claim")}
        </button>

        {campaign.dismissLabel && (
          <button onClick={close} className="mt-1.5 w-full py-1 text-[11px] opacity-60">
            {campaign.dismissLabel}
          </button>
        )}
      </div>
    </div>
  );
}
