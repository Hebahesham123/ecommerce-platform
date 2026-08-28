import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { LangProvider, type Lang } from "@/lib/i18n";

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

// Meta Pixel ID — verifying the pixel fires. Move to env/DB once OAuth is wired.
const META_PIXEL_ID = "1042036368209197";

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
        {/* Meta Pixel */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
          }}
        />
      </head>
      <body>
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1" alt="" />`,
          }}
        />
        <LangProvider initialLang={initialLang}>{children}</LangProvider>
      </body>
    </html>
  );
}
