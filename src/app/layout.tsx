import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cookies } from "next/headers";
import { LangProvider, type Lang } from "@/lib/i18n";
import { getPixelSnippet } from "@/lib/meta-pixel";
import { getGa4Snippet, getGscMeta } from "@/lib/ga4";

// Tajawal, from files in this repository rather than from Google.
//
// It used to be loaded with next/font/google, which downloads the face while
// the app is being built. That is a network call inside the build, and when
// Vercel's builder could not complete it the whole deploy failed — not with
// a missing font, but with a crash in the font loader. Loading from disk
// removes the only reason the build needed the internet.
//
// Two files per weight because Google cuts arabic and latin separately; the
// browser takes each character from the first face that has it. Weights are
// those Tajawal actually ships (no 600).
const tajawal = localFont({
  src: [
    { path: "./fonts/tajawal-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/tajawal-400-arabic.woff2", weight: "400", style: "normal" },
    { path: "./fonts/tajawal-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/tajawal-500-arabic.woff2", weight: "500", style: "normal" },
    { path: "./fonts/tajawal-700-latin.woff2", weight: "700", style: "normal" },
    { path: "./fonts/tajawal-700-arabic.woff2", weight: "700", style: "normal" },
    { path: "./fonts/tajawal-800-latin.woff2", weight: "800", style: "normal" },
    { path: "./fonts/tajawal-800-arabic.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-app",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

/**
 * The display face for app section titles.
 *
 * The published website is already set in Playfair, and that is most of why
 * the site reads as more expensive than the app. From the repository for the
 * same reason as Tajawal above: the old comment here claimed Next would fall
 * back if Google were unreachable at build time, and that turned out to be
 * wrong — it brought the build down instead.
 */
const playfair = localFont({
  src: [
    { path: "./fonts/playfair-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/playfair-700-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: "BeautyBar · لوحة التحكم",
  description: "BeautyBar commerce admin dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The storefront records the shopper's language in `sf_locale`. Resolving it
  // here means the first paint — html dir/lang included — is already correct,
  // instead of rendering Arabic and correcting it after hydration.
  // No cookie means the admin, which reads English by default; a merchant who
  // switches to Arabic is remembered by that same cookie.
  const locale = (await cookies()).get("sf_locale")?.value;
  const initialLang: Lang | undefined =
    locale === "ar" || locale === "en" ? locale : undefined;
  const lang: Lang = initialLang ?? "en";
  const dir = lang === "ar" ? "rtl" : "ltr";

  // Whichever pixel the merchant configured, or nothing at all. Hardcoding an
  // id here meant a store that pasted its own still fired someone else's.
  const pixel = await getPixelSnippet();

  // Google Analytics 4 + Search Console, configured in Analytics → Website.
  // Read and injected exactly like the pixel — the merchant's own, or nothing.
  const [ga4, gscMeta] = await Promise.all([getGa4Snippet(), getGscMeta()]);

  return (
    <html
      lang={lang}
      dir={dir}
      className={`${tajawal.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the theme before paint to avoid a flash. Light is the default
            everywhere; dark is applied only when the merchant asked for it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* Meta Pixel, as configured in Channels → Meta. It lives at the top of
            the body rather than in <head> because the snippet carries a
            <noscript> image alongside the script, and a <div> is not valid
            inside <head>. */}
        {pixel && <div dangerouslySetInnerHTML={{ __html: pixel }} />}
        {/* Google Analytics 4 (gtag.js) and the Search Console verification
            meta, injected right beside the pixel and for the same reason it is
            here rather than in <head>: a raw multi-tag HTML snippet has no
            neutral wrapper that is valid inside <head>. The gtag loader works
            from the top of the body, and the crawled/verified surface is the
            Liquid storefront, where these land in <head> (theme-render-service). */}
        {ga4 && <div dangerouslySetInnerHTML={{ __html: ga4 }} />}
        {gscMeta && <div dangerouslySetInnerHTML={{ __html: gscMeta }} />}
        <LangProvider initialLang={initialLang}>{children}</LangProvider>
      </body>
    </html>
  );
}
