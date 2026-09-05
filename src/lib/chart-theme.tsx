"use client";

import { useEffect, useState } from "react";

/**
 * The chart palette, shared by every screen that draws one.
 *
 * Four accents, each with a light and a dark step chosen for that surface
 * rather than dimmed from the other. Validated for colour-vision deficiency:
 * every adjacent pair clears the separation floor in both modes, which is why
 * the order matters and why a fifth hue is not simply appended when a fifth
 * series turns up — it gets folded into "other", or the chart gets split.
 *
 * Violet leads, so the same hue means "app" on a chart as it does on a badge.
 */
export const CHART = {
  violet: { light: "#7c3aed", dark: "#8b7cf6" },
  blue: { light: "#2a78d6", dark: "#3987e5" },
  green: { light: "#008300", dark: "#1baf7a" },
  orange: { light: "#eb6834", dark: "#d95926" },
} as const;

export type ChartColor = keyof typeof CHART;

/** Dark mode is a class on <html>, and it can change without a reload. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/** The palette resolved for the mode currently on screen. */
export function useChartColors(): (k: ChartColor) => string {
  const dark = useIsDark();
  return (k: ChartColor) => CHART[k][dark ? "dark" : "light"];
}

/** Grid and axis ink: present enough to read against, quiet enough to ignore. */
export const AXIS_STROKE = "rgba(148,148,168,0.14)";

/**
 * Axis label ink, as a literal colour per mode.
 *
 * Deliberately not a CSS variable: Recharts puts this on the SVG <text> as a
 * presentation attribute, and presentation attributes do not resolve var() —
 * the colour would silently fall back to black and the labels would go loud in
 * dark mode.
 */
export const AXIS_TICK = { light: "#8b8b9c", dark: "#7a7a8c" } as const;

export function useAxisTick(): string {
  return useIsDark() ? AXIS_TICK.dark : AXIS_TICK.light;
}
