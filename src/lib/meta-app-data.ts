import type { AppData } from "@/lib/meta";

/**
 * What Meta needs to accept an event as an app event.
 *
 * A website event is enough on its own; an app event is not. Meta requires
 * `app_data` alongside it — the two tracking-permission flags, and `extinfo`,
 * a fixed-length array describing the device. Send an app event without it and
 * the dataset takes the request and drops the event, which is the worst way to
 * fail: a 200, a rising "events received" count, and no conversions.
 *
 * The phone is the only thing that knows any of this, so the app tells us, in
 * one header. Whatever it does not say stays an empty string — the array's
 * shape is what matters, and inventing a device model to fill it would be
 * making up the data the field exists to report.
 */

/** What the app sends in `x-app-device`, JSON, URL-encoded. */
export type AppDevice = {
  /** "ios" | "android" — anything else is not an app. */
  platform?: string;
  /** The OS version, e.g. "17.4". Meta lists this as required. */
  osVersion?: string;
  bundleId?: string;
  appVersion?: string;
  buildVersion?: string;
  model?: string;
  locale?: string;
  timezone?: string;
  carrier?: string;
  width?: number;
  height?: number;
  density?: number;
  /** iOS 14.5+ App Tracking Transparency: did they allow it? */
  tracking?: boolean;
};

const str = (v: unknown): string =>
  v === null || v === undefined || v === "" ? "" : String(v).slice(0, 120);

/**
 * The header, parsed. Anything malformed is treated as absent: a bad header is
 * not worth failing a sale over, and a half-built extinfo is worth less than
 * an honest empty one.
 */
export function deviceFromHeader(raw: string | null | undefined): AppDevice | null {
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : decodeURIComponent(raw);
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AppDevice) : null;
  } catch {
    return null;
  }
}

/**
 * `app_data`, in the order Meta reads it.
 *
 * The sixteen slots are positional — index 4 is the OS version whether or not
 * anything before it was filled in — so every one of them is written, empty
 * where the app said nothing.
 */
export function appDataFrom(device: AppDevice | null): AppData {
  const d = device ?? {};
  const android = String(d.platform ?? "").toLowerCase() !== "ios";
  const allowed = d.tracking !== false;

  const extinfo: string[] = [
    android ? "a2" : "i2",   //  0  which SDK shape this is
    str(d.bundleId),         //  1  package name
    str(d.buildVersion),     //  2  short version
    str(d.appVersion),       //  3  long version
    str(d.osVersion),        //  4  OS version
    str(d.model),            //  5  device model
    str(d.locale),           //  6  locale
    "",                      //  7  timezone abbreviation
    str(d.carrier),          //  8  carrier
    str(d.width),            //  9  screen width
    str(d.height),           // 10  screen height
    str(d.density),          // 11  screen density
    "",                      // 12  CPU cores
    "",                      // 13  storage size
    "",                      // 14  free storage
    str(d.timezone),         // 15  device timezone
  ];

  return {
    // Both are the person's answer, not the shop's preference: on iOS the
    // first is whether they allowed tracking when asked, and reporting a yes
    // they did not give is exactly what the flag exists to prevent.
    advertiser_tracking_enabled: allowed ? 1 : 0,
    application_tracking_enabled: allowed ? 1 : 0,
    extinfo,
  };
}
