import type { Bi } from "./pages-catalog";

/**
 * The wording a merchant can change on the pages that are built in React.
 *
 * The Liquid theme's pages are edited in the theme editor and the app's home
 * is edited in the app editor, but login, sign up, the account and checkout
 * were written in code with their wording baked in — which meant the one thing
 * a merchant most often wants to change, the words, was the one thing nobody
 * could change.
 *
 * Every field is two fields, Arabic and English, because the store serves
 * both and a merchant who writes only one should not blank out the other.
 * Empty means "use the wording the page ships with", so a store that never
 * opens this screen loses nothing.
 */

export type CopyField = {
  key: string;
  label: Bi;
  type: "text" | "textarea";
  /** What the page says when this is left empty — shown as the placeholder. */
  fallback: Bi;
};

export type PageCopySpec = {
  /** Its own section inside store_settings. */
  section: string;
  fields: CopyField[];
  /** Something the merchant needs to know before typing. */
  hint?: Bi;
};

export const PAGE_COPY: Record<string, PageCopySpec> = {
  "web-login": {
    section: "page_login",
    fields: [
      {
        key: "heading",
        label: { ar: "العنوان", en: "Heading" },
        type: "text",
        fallback: { ar: "تسجيل الدخول", en: "Log in" },
      },
      {
        key: "subtitle",
        label: { ar: "السطر تحته", en: "Line underneath" },
        type: "textarea",
        fallback: {
          ar: "أدخلي رقم هاتفك للدخول إلى حسابك.",
          en: "Enter your phone number to access your account.",
        },
      },
      {
        key: "phonePlaceholder",
        label: { ar: "نص خانة الهاتف", en: "Phone field placeholder" },
        type: "text",
        fallback: { ar: "رقم الهاتف", en: "Phone number" },
      },
      {
        key: "submit",
        label: { ar: "زر الدخول", en: "Button" },
        type: "text",
        fallback: { ar: "دخول", en: "Log in" },
      },
      {
        key: "signupPrompt",
        label: { ar: "سطر إنشاء الحساب", en: "Sign-up line" },
        type: "text",
        fallback: { ar: "ليس لديك حساب؟", en: "No account yet?" },
      },
      {
        key: "signupLink",
        label: { ar: "رابط إنشاء الحساب", en: "Sign-up link" },
        type: "text",
        fallback: { ar: "إنشاء حساب", en: "Sign up" },
      },
    ],
  },

  "web-signup": {
    section: "page_signup",
    fields: [
      {
        key: "heading",
        label: { ar: "العنوان", en: "Heading" },
        type: "text",
        fallback: { ar: "إنشاء حساب", en: "Create an account" },
      },
      {
        key: "subtitle",
        label: { ar: "السطر تحته", en: "Line underneath" },
        type: "textarea",
        fallback: {
          ar: "سنرسل لك كود تحقق لتأكيد رقمك.",
          en: "We'll send you a code to confirm your number.",
        },
      },
      {
        key: "submit",
        label: { ar: "زر إرسال الكود", en: "Send-code button" },
        type: "text",
        fallback: { ar: "إرسال الكود", en: "Send code" },
      },
      {
        key: "loginPrompt",
        label: { ar: "سطر تسجيل الدخول", en: "Log-in line" },
        type: "text",
        fallback: { ar: "لديك حساب بالفعل؟", en: "Already have an account?" },
      },
    ],
  },

  "web-checkout": {
    section: "page_checkout",
    // Checkout is deliberately served in English to every shopper, so the
    // Arabic boxes here are kept for the day that changes.
    hint: {
      ar: "الدفع يُعرض بالإنجليزية لكل العملاء حاليًا، فالنص الإنجليزي هو الظاهر.",
      en: "Checkout is served in English to every shopper today, so the English wording is what shows.",
    },
    fields: [
      {
        key: "contactHeading",
        label: { ar: "عنوان التواصل", en: "Contact heading" },
        type: "text",
        fallback: { ar: "معلومات التواصل", en: "Contact" },
      },
      {
        key: "deliveryHeading",
        label: { ar: "عنوان التوصيل", en: "Delivery heading" },
        type: "text",
        fallback: { ar: "التوصيل", en: "Delivery" },
      },
      {
        key: "paymentHeading",
        label: { ar: "عنوان الدفع", en: "Payment heading" },
        type: "text",
        fallback: { ar: "الدفع", en: "Payment" },
      },
      {
        key: "codLabel",
        label: { ar: "اسم طريقة الدفع", en: "Payment method label" },
        type: "text",
        fallback: { ar: "الدفع عند الاستلام (COD)", en: "Cash on Delivery (COD)" },
      },
      {
        key: "submit",
        label: { ar: "زر إتمام الطلب", en: "Place-order button" },
        type: "text",
        fallback: { ar: "إتمام الطلب", en: "Complete order" },
      },
    ],
  },

  "web-account": {
    section: "page_account",
    fields: [
      {
        key: "greeting",
        label: { ar: "التحية", en: "Greeting" },
        type: "text",
        fallback: { ar: "أهلًا", en: "Hello" },
      },
      {
        key: "welcome",
        label: { ar: "سطر الترحيب", en: "Welcome line" },
        type: "textarea",
        fallback: {
          ar: "طلباتك ونقاطك وعناوينك في مكان واحد.",
          en: "Your orders, points and addresses in one place.",
        },
      },
    ],
  },
};

/** What a page is handed: the merchant's wording, per language, or nothing. */
export type Copy = Record<string, string>;

/**
 * One field's wording in the language being served, or "" for the page's own.
 *
 * Arabic and English are stored apart so a merchant can rewrite one without
 * silently blanking the other, and neither falls back to the other: a shopper
 * reading Arabic should never be shown English wording because someone filled
 * in only the English box.
 */
export function say(copy: Copy | null | undefined, key: string, ar: boolean): string {
  const v = copy?.[`${key}_${ar ? "ar" : "en"}`];
  return typeof v === "string" ? v.trim() : "";
}
