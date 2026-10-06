import type { Metadata } from "next";
import { Tajawal, Playfair_Display } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { LangProvider, type Lang } from "@/lib/i18n";
import { getPixelSnippet } from "@/lib/meta-pixel";
import { getGa4Snippet, getGscMeta } from "@/lib/ga4";

// Self-hosted Tajawal (bundled with the app) so an ad/privacy blocker or a
// flaky network can never stop the font from loading — which used to break the
// whole UI's type and spacing. Exposes the family as the --font-app CSS
// variable. Weights are those Tajawal actually ships (no 600).
const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-app",
  display: "swap",
});

/**
 * The display face for app section titles.
 *
 * The published website is already set in Playfair, and that is most of why
 * the site reads as more expensive than the app. Loaded here so the editor's
 * phone and the preview show the real thing; if Google is unreachable at build
 * time Next falls back and nothing breaks.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
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
