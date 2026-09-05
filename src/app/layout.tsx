import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { LangProvider, type Lang } from "@/lib/i18n";
import { getPixelSnippet } from "@/lib/meta-pixel";

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
  // No cookie means the admin, which is Arabic-first, so the default stands.
  const locale = (await cookies()).get("sf_locale")?.value;
  const initialLang: Lang | undefined =
    locale === "ar" || locale === "en" ? locale : undefined;
  const lang: Lang = initialLang ?? "ar";
  const dir = lang === "ar" ? "rtl" : "ltr";

  // Whichever pixel the merchant configured, or nothing at all. Hardcoding an
  // id here meant a store that pasted its own still fired someone else's.
  const pixel = await getPixelSnippet();

  return (
    <html lang={lang} dir={dir} className={tajawal.variable} suppressHydrationWarning>
      <head>
        {/* Apply the theme before paint to avoid a flash. Admin defaults to dark
            unless the user picked light; the storefront (/store) stays light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=location.pathname.indexOf('/store')===0;if(!s&&localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* Meta Pixel, as configured in Channels → Meta. It lives at the top of
            the body rather than in <head> because the snippet carries a
            <noscript> image alongside the script, and a <div> is not valid
            inside <head>. */}
        {pixel && <div dangerouslySetInnerHTML={{ __html: pixel }} />}
        <LangProvider initialLang={initialLang}>{children}</LangProvider>
      </body>
    </html>
  );
}
