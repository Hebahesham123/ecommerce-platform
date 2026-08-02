import type { Lang } from "./i18n";

export type Bi = { ar: string; en: string };
export const tr = (b: Bi, lang: Lang) => b[lang];

export type FieldType =
  | "text" | "email" | "tel" | "number" | "textarea" | "select" | "toggle";

export type Field = {
  key: string;
  label: Bi;
  type: FieldType;
  options?: { value: string; label: Bi }[];
  placeholder?: string;
  help?: Bi;
  half?: boolean; // render half-width
};

export type ListSpec = {
  key: string;
  label: Bi;
  addLabel: Bi;
  itemFields: Field[];
};

export type Section = {
  key: string;
  label: Bi;
  desc: Bi;
  icon: string; // maps to an icon component
  fields?: Field[];
  lists?: ListSpec[];
};

const sel = (...pairs: [string, string, string][]) =>
  pairs.map(([value, ar, en]) => ({ value, label: { ar, en } }));

export const SECTIONS: Section[] = [
  {
    key: "general",
    label: { ar: "عام", en: "General" },
    desc: { ar: "تفاصيل المتجر والعنوان والعملة", en: "Store details, address & currency" },
    icon: "settings",
    fields: [
      { key: "store_name", label: { ar: "اسم المتجر", en: "Store name" }, type: "text", half: true },
      { key: "legal_name", label: { ar: "الاسم القانوني", en: "Legal business name" }, type: "text", half: true },
      { key: "store_email", label: { ar: "بريد المتجر", en: "Store email" }, type: "email", half: true },
      { key: "store_phone", label: { ar: "هاتف المتجر", en: "Store phone" }, type: "tel", half: true },
      { key: "address1", label: { ar: "العنوان", en: "Address" }, type: "text" },
      { key: "city", label: { ar: "المدينة", en: "City" }, type: "text", half: true },
      { key: "governorate", label: { ar: "المحافظة", en: "Governorate / State" }, type: "text", half: true },
      { key: "zip", label: { ar: "الرمز البريدي", en: "ZIP / Postal code" }, type: "text", half: true },
      { key: "country", label: { ar: "الدولة", en: "Country" }, type: "text", half: true },
      { key: "currency", label: { ar: "العملة", en: "Store currency" }, type: "select", half: true,
        options: sel(["EGP","جنيه مصري","EGP — Egyptian Pound"],["USD","دولار","USD — US Dollar"],["EUR","يورو","EUR — Euro"],["SAR","ريال","SAR — Saudi Riyal"],["AED","درهم","AED — UAE Dirham"]) },
      { key: "timezone", label: { ar: "المنطقة الزمنية", en: "Timezone" }, type: "select", half: true,
        options: sel(["Africa/Cairo","القاهرة (GMT+2)","(GMT+2) Cairo"],["Asia/Riyadh","الرياض (GMT+3)","(GMT+3) Riyadh"],["Asia/Dubai","دبي (GMT+4)","(GMT+4) Dubai"],["UTC","UTC","UTC"]) },
      { key: "unit_system", label: { ar: "نظام الوحدات", en: "Unit system" }, type: "select", half: true,
        options: sel(["metric","متري","Metric"],["imperial","إمبراطوري","Imperial"]) },
      { key: "weight_unit", label: { ar: "وحدة الوزن", en: "Default weight unit" }, type: "select", half: true,
        options: sel(["kg","كجم","Kilograms (kg)"],["g","جم","Grams (g)"],["lb","رطل","Pounds (lb)"]) },
      { key: "order_prefix", label: { ar: "بادئة رقم الطلب", en: "Order ID prefix" }, type: "text", half: true, placeholder: "#" },
      { key: "order_suffix", label: { ar: "لاحقة رقم الطلب", en: "Order ID suffix" }, type: "text", half: true },
    ],
  },
  {
    key: "plan",
    label: { ar: "الخطة", en: "Plan" },
    desc: { ar: "خطة الاشتراك والحالة", en: "Subscription plan & status" },
    icon: "overview",
    fields: [
      { key: "plan_name", label: { ar: "الخطة الحالية", en: "Current plan" }, type: "select", half: true,
        options: sel(["basic","أساسية","Basic"],["shopify","شوبيفاي","Shopify"],["advanced","متقدمة","Advanced"],["plus","بلس","Plus"]) },
      { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", half: true,
        options: sel(["active","نشطة","Active"],["trial","تجريبية","Trial"],["paused","موقوفة","Paused"]) },
      { key: "trial_ends", label: { ar: "انتهاء التجربة", en: "Trial ends" }, type: "text", half: true, placeholder: "YYYY-MM-DD" },
    ],
  },
  {
    key: "billing",
    label: { ar: "الفوترة", en: "Billing" },
    desc: { ar: "معلومات الدفع والفواتير", en: "Payment method & invoices" },
    icon: "cash",
    fields: [
      { key: "billing_email", label: { ar: "بريد الفوترة", en: "Billing email" }, type: "email", half: true },
      { key: "tax_id", label: { ar: "الرقم الضريبي", en: "Tax ID" }, type: "text", half: true },
      { key: "payment_method", label: { ar: "طريقة الدفع", en: "Payment method" }, type: "text" },
      { key: "billing_address", label: { ar: "عنوان الفوترة", en: "Billing address" }, type: "textarea" },
    ],
  },
  {
    key: "users",
    label: { ar: "المستخدمون والصلاحيات", en: "Users and permissions" },
    desc: { ar: "أعضاء الفريق وأدوارهم", en: "Staff members & roles" },
    icon: "customers",
    fields: [
      { key: "require_2fa", label: { ar: "طلب المصادقة الثنائية", en: "Require two-step authentication" }, type: "toggle" },
    ],
    lists: [
      { key: "staff", label: { ar: "أعضاء الفريق", en: "Staff members" }, addLabel: { ar: "إضافة عضو", en: "Add staff" },
        itemFields: [
          { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", half: true },
          { key: "email", label: { ar: "البريد", en: "Email" }, type: "email", half: true },
          { key: "role", label: { ar: "الدور", en: "Role" }, type: "select", half: true,
            options: sel(["owner","مالك","Owner"],["admin","مدير","Admin"],["staff","موظف","Staff"],["limited","محدود","Limited"]) },
        ] },
    ],
  },
  {
    key: "payments",
    label: { ar: "المدفوعات", en: "Payments" },
    desc: { ar: "طرق الدفع المقبولة", en: "Accepted payment methods" },
    icon: "cash",
    fields: [
      { key: "cod_enabled", label: { ar: "الدفع عند الاستلام", en: "Cash on delivery (COD)" }, type: "toggle" },
      { key: "cod_fee", label: { ar: "رسوم الدفع عند الاستلام", en: "COD fee" }, type: "number", half: true },
      { key: "card_enabled", label: { ar: "الدفع بالبطاقة", en: "Card payments" }, type: "toggle" },
      { key: "wallet_enabled", label: { ar: "المحافظ الإلكترونية", en: "Wallets (InstaPay / Vodafone Cash)" }, type: "toggle" },
      { key: "capture", label: { ar: "تحصيل الدفع", en: "Payment capture" }, type: "select", half: true,
        options: sel(["automatic","تلقائي","Automatic"],["manual","يدوي","Manual"]) },
    ],
    lists: [
      { key: "manual_methods", label: { ar: "طرق دفع يدوية", en: "Manual payment methods" }, addLabel: { ar: "إضافة طريقة", en: "Add method" },
        itemFields: [
          { key: "name", label: { ar: "الاسم", en: "Name" }, type: "text", half: true },
          { key: "instructions", label: { ar: "التعليمات", en: "Instructions" }, type: "text", half: true },
        ] },
    ],
  },
  {
    key: "checkout",
    label: { ar: "الدفع (Checkout)", en: "Checkout" },
    desc: { ar: "إعدادات صفحة الدفع وحسابات العملاء", en: "Checkout & customer accounts" },
    icon: "orders",
    fields: [
      { key: "customer_accounts", label: { ar: "حسابات العملاء", en: "Customer accounts" }, type: "select", half: true,
        options: sel(["disabled","معطّلة","Don't use accounts"],["optional","اختيارية","Optional"],["required","إلزامية","Required"]) },
      { key: "require_phone", label: { ar: "طلب رقم الهاتف", en: "Require phone number at checkout" }, type: "toggle" },
      { key: "marketing_opt_in", label: { ar: "الاشتراك التسويقي مُفعّل مسبقاً", en: "Pre-check marketing opt-in" }, type: "toggle" },
      { key: "tipping", label: { ar: "إظهار الإكرامية", en: "Show tipping options" }, type: "toggle" },
      { key: "abandoned_checkout", label: { ar: "إشعارات السلات المتروكة", en: "Send abandoned checkout emails" }, type: "toggle" },
      { key: "abandoned_delay", label: { ar: "مهلة السلة المتروكة", en: "Abandoned checkout delay" }, type: "select", half: true,
        options: sel(["1h","ساعة","1 hour"],["6h","٦ ساعات","6 hours"],["10h","١٠ ساعات","10 hours"],["24h","٢٤ ساعة","24 hours"]) },
    ],
  },
  {
    key: "shipping",
    label: { ar: "الشحن والتوصيل", en: "Shipping and delivery" },
    desc: { ar: "مناطق الشحن والأسعار", en: "Shipping zones & rates" },
    icon: "courier",
    fields: [
      { key: "free_shipping_enabled", label: { ar: "شحن مجاني فوق مبلغ", en: "Free shipping over a threshold" }, type: "toggle" },
      { key: "free_shipping_threshold", label: { ar: "حد الشحن المجاني", en: "Free shipping threshold" }, type: "number", half: true },
    ],
    lists: [
      { key: "zones", label: { ar: "مناطق الشحن", en: "Shipping zones" }, addLabel: { ar: "إضافة منطقة", en: "Add zone" },
        itemFields: [
          { key: "name", label: { ar: "اسم المنطقة", en: "Zone name" }, type: "text", half: true },
          { key: "areas", label: { ar: "المناطق/المحافظات", en: "Governorates / areas" }, type: "text", half: true },
          { key: "rate_name", label: { ar: "اسم التعريفة", en: "Rate name" }, type: "text", half: true },
          { key: "rate_price", label: { ar: "السعر", en: "Price" }, type: "number", half: true },
        ] },
    ],
  },
  {
    key: "taxes",
    label: { ar: "الضرائب", en: "Taxes and duties" },
    desc: { ar: "معدلات الضريبة حسب المنطقة", en: "Tax rates by region" },
    icon: "discount",
    fields: [
      { key: "prices_include_tax", label: { ar: "الأسعار تشمل الضريبة", en: "All prices include tax" }, type: "toggle" },
      { key: "tax_on_shipping", label: { ar: "احتساب الضريبة على الشحن", en: "Charge tax on shipping" }, type: "toggle" },
    ],
    lists: [
      { key: "regions", label: { ar: "معدلات الضريبة", en: "Tax regions" }, addLabel: { ar: "إضافة معدل", en: "Add rate" },
        itemFields: [
          { key: "region", label: { ar: "المنطقة", en: "Region" }, type: "text", half: true },
          { key: "rate", label: { ar: "النسبة %", en: "Rate %" }, type: "number", half: true },
        ] },
    ],
  },
  {
    key: "locations",
    label: { ar: "المواقع", en: "Locations" },
    desc: { ar: "مواقع المخزون والتنفيذ", en: "Inventory & fulfillment locations" },
    icon: "courier",
    lists: [
      { key: "locations", label: { ar: "المواقع", en: "Locations" }, addLabel: { ar: "إضافة موقع", en: "Add location" },
        itemFields: [
          { key: "name", label: { ar: "اسم الموقع", en: "Location name" }, type: "text", half: true },
          { key: "address", label: { ar: "العنوان", en: "Address" }, type: "text", half: true },
          { key: "fulfills_online", label: { ar: "ينفّذ الطلبات الإلكترونية", en: "Fulfills online orders" }, type: "toggle" },
        ] },
    ],
  },
  {
    key: "notifications",
    label: { ar: "الإشعارات", en: "Notifications" },
    desc: { ar: "إشعارات البريد للعملاء والفريق", en: "Customer & staff email notifications" },
    icon: "bell",
    fields: [
      { key: "sender_email", label: { ar: "بريد المُرسِل", en: "Sender email" }, type: "email" },
      { key: "order_confirmation", label: { ar: "تأكيد الطلب", en: "Order confirmation" }, type: "toggle" },
      { key: "order_cancelled", label: { ar: "إلغاء الطلب", en: "Order cancelled" }, type: "toggle" },
      { key: "shipping_confirmation", label: { ar: "تأكيد الشحن", en: "Shipping confirmation" }, type: "toggle" },
      { key: "out_for_delivery", label: { ar: "خرج للتوصيل", en: "Out for delivery" }, type: "toggle" },
      { key: "delivered", label: { ar: "تم التسليم", en: "Delivered" }, type: "toggle" },
      { key: "low_stock", label: { ar: "تنبيه انخفاض المخزون", en: "Low stock alert" }, type: "toggle" },
      { key: "low_stock_threshold", label: { ar: "حد انخفاض المخزون", en: "Low stock threshold" }, type: "number", half: true },
    ],
  },
  {
    key: "markets",
    label: { ar: "الأسواق", en: "Markets" },
    desc: { ar: "البيع لدول ومناطق مختلفة", en: "Sell to different countries & regions" },
    icon: "globe",
    lists: [
      { key: "markets", label: { ar: "الأسواق", en: "Markets" }, addLabel: { ar: "إضافة سوق", en: "Add market" },
        itemFields: [
          { key: "name", label: { ar: "اسم السوق", en: "Market name" }, type: "text", half: true },
          { key: "countries", label: { ar: "الدول", en: "Countries" }, type: "text", half: true },
          { key: "currency", label: { ar: "العملة", en: "Currency" }, type: "text", half: true },
          { key: "status", label: { ar: "الحالة", en: "Status" }, type: "select", half: true,
            options: sel(["active","نشط","Active"],["draft","مسودة","Draft"]) },
        ] },
    ],
  },
  {
    key: "domains",
    label: { ar: "النطاقات", en: "Domains" },
    desc: { ar: "نطاقات المتجر و SSL", en: "Store domains & SSL" },
    icon: "globe",
    fields: [
      { key: "primary_domain", label: { ar: "النطاق الأساسي", en: "Primary domain" }, type: "text" },
    ],
    lists: [
      { key: "domains", label: { ar: "النطاقات", en: "Domains" }, addLabel: { ar: "إضافة نطاق", en: "Add domain" },
        itemFields: [
          { key: "domain", label: { ar: "النطاق", en: "Domain" }, type: "text", half: true },
          { key: "redirect", label: { ar: "توجيه للأساسي", en: "Redirect to primary" }, type: "toggle" },
        ] },
    ],
  },
  {
    key: "languages",
    label: { ar: "اللغات", en: "Languages" },
    desc: { ar: "لغات المتجر", en: "Store languages" },
    icon: "globe",
    fields: [
      { key: "default_language", label: { ar: "اللغة الافتراضية", en: "Default language" }, type: "select", half: true,
        options: sel(["ar","العربية","Arabic"],["en","الإنجليزية","English"]) },
    ],
    lists: [
      { key: "published", label: { ar: "اللغات المنشورة", en: "Published languages" }, addLabel: { ar: "إضافة لغة", en: "Add language" },
        itemFields: [
          { key: "language", label: { ar: "اللغة", en: "Language" }, type: "text", half: true },
          { key: "published", label: { ar: "منشورة", en: "Published" }, type: "toggle" },
        ] },
    ],
  },
  {
    key: "policies",
    label: { ar: "السياسات", en: "Policies" },
    desc: { ar: "سياسات المتجر القانونية", en: "Legal store policies" },
    icon: "content",
    fields: [
      { key: "refund", label: { ar: "سياسة الاسترجاع", en: "Refund policy" }, type: "textarea" },
      { key: "privacy", label: { ar: "سياسة الخصوصية", en: "Privacy policy" }, type: "textarea" },
      { key: "terms", label: { ar: "شروط الخدمة", en: "Terms of service" }, type: "textarea" },
      { key: "shipping_policy", label: { ar: "سياسة الشحن", en: "Shipping policy" }, type: "textarea" },
      { key: "contact", label: { ar: "معلومات التواصل", en: "Contact information" }, type: "textarea" },
    ],
  },
  {
    key: "gift_cards",
    label: { ar: "بطاقات الهدايا", en: "Gift cards" },
    desc: { ar: "إعدادات بطاقات الهدايا", en: "Gift card settings" },
    icon: "discount",
    fields: [
      { key: "enabled", label: { ar: "تفعيل بطاقات الهدايا", en: "Enable gift cards" }, type: "toggle" },
      { key: "default_value", label: { ar: "القيمة الافتراضية", en: "Default value" }, type: "number", half: true },
      { key: "expiry", label: { ar: "الصلاحية", en: "Expiry" }, type: "select", half: true,
        options: sel(["never","لا تنتهي","Never"],["1y","سنة","1 year"],["2y","سنتان","2 years"],["5y","٥ سنوات","5 years"]) },
    ],
  },
];

export function getSection(key: string): Section | undefined {
  return SECTIONS.find((s) => s.key === key);
}
