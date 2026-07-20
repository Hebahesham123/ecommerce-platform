"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

/**
 * Bilingual dictionary. Arabic is the primary language (RTL default),
 * English is the optional fallback. Add keys here as new UI strings appear.
 */
const dict = {
  brand: { ar: "متجر الأزياء", en: "Fashion Store" },
  search: { ar: "ابحث عن طلب، منتج، عميل…", en: "Search orders, products, customers…" },
  greeting: { ar: "أهلاً، هبة", en: "Hi, Heba" },

  // Navigation
  nav_overview: { ar: "نظرة عامة", en: "Overview" },
  nav_orders: { ar: "الطلبات", en: "Orders" },
  nav_products: { ar: "المنتجات", en: "Products" },
  nav_customers: { ar: "العملاء", en: "Customers" },
  nav_couriers: { ar: "الشحن والمندوبين", en: "Couriers" },
  nav_inbox: { ar: "المحادثات", en: "Inbox" },
  nav_marketing: { ar: "التسويق", en: "Marketing" },
  nav_settings: { ar: "الإعدادات", en: "Settings" },
  group_store: { ar: "المتجر", en: "Store" },
  group_engage: { ar: "التواصل", en: "Engage" },

  // Overview KPIs
  kpi_revenue: { ar: "الإيرادات", en: "Revenue" },
  kpi_orders: { ar: "الطلبات", en: "Orders" },
  kpi_aov: { ar: "متوسط قيمة الطلب", en: "Avg. order value" },
  kpi_cod_share: { ar: "نسبة الدفع عند الاستلام", en: "COD share" },
  kpi_return_rate: { ar: "نسبة المرتجعات", en: "Return rate" },
  kpi_pending_cod: { ar: "نقدية لم تُحصّل", en: "Uncollected COD" },
  vs_last_week: { ar: "مقارنة بالأسبوع الماضي", en: "vs last week" },

  sales_7d: { ar: "المبيعات آخر ٧ أيام", en: "Sales · last 7 days" },
  orders_by_status: { ar: "الطلبات حسب الحالة", en: "Orders by status" },
  recent_orders: { ar: "أحدث الطلبات", en: "Recent orders" },
  top_products: { ar: "الأكثر مبيعاً", en: "Top products" },
  needs_attention: { ar: "يحتاج انتباهك", en: "Needs attention" },
  view_all: { ar: "عرض الكل", en: "View all" },

  // Order table headers
  col_order: { ar: "الطلب", en: "Order" },
  col_customer: { ar: "العميل", en: "Customer" },
  col_total: { ar: "الإجمالي", en: "Total" },
  col_payment: { ar: "الدفع", en: "Payment" },
  col_fulfillment: { ar: "التنفيذ", en: "Fulfillment" },
  col_lifecycle: { ar: "المرحلة", en: "Stage" },
  col_governorate: { ar: "المحافظة", en: "Governorate" },
  col_date: { ar: "التاريخ", en: "Date" },
  col_courier: { ar: "المندوب", en: "Courier" },
  col_stock: { ar: "المخزون", en: "Stock" },
  col_price: { ar: "السعر", en: "Price" },
  col_status: { ar: "الحالة", en: "Status" },
  col_channel: { ar: "القناة", en: "Channel" },

  // Lifecycle
  s_placed: { ar: "تم الطلب", en: "Placed" },
  s_confirmed: { ar: "مؤكد", en: "Confirmed" },
  s_packed: { ar: "تم التغليف", en: "Packed" },
  s_shipped: { ar: "تم الشحن", en: "Shipped" },
  s_completed: { ar: "مكتمل", en: "Completed" },
  s_cancelled: { ar: "ملغي", en: "Cancelled" },
  // Payment
  p_pending: { ar: "بانتظار الدفع", en: "Pending" },
  p_authorized: { ar: "محجوز", en: "Authorized" },
  p_paid: { ar: "مدفوع", en: "Paid" },
  p_refunded: { ar: "مسترجع", en: "Refunded" },
  // Fulfillment
  f_unfulfilled: { ar: "لم يُنفّذ", en: "Unfulfilled" },
  f_assigned: { ar: "تم التعيين", en: "Assigned" },
  f_out: { ar: "خرج للتوصيل", en: "Out for delivery" },
  f_delivered: { ar: "تم التسليم", en: "Delivered" },
  f_returned: { ar: "مرتجع", en: "Returned" },

  cod: { ar: "عند الاستلام", en: "COD" },
  card: { ar: "بطاقة", en: "Card" },
  wallet: { ar: "محفظة", en: "Wallet" },

  filter_all: { ar: "الكل", en: "All" },
  export: { ar: "تصدير", en: "Export" },
  add_product: { ar: "إضافة منتج", en: "Add product" },
  reply: { ar: "رد", en: "Reply" },
  type_message: { ar: "اكتب رسالة…", en: "Type a message…" },

  // Couriers
  courier_cash: { ar: "نقدية محصّلة", en: "Cash collected" },
  courier_pending: { ar: "بانتظار التحصيل", en: "Pending collection" },
  active_deliveries: { ar: "توصيلات نشطة", en: "Active deliveries" },
  reconcile: { ar: "تسوية النقدية", en: "Reconcile cash" },

  // Marketing
  campaigns: { ar: "الحملات", en: "Campaigns" },
  abandoned_carts: { ar: "السلات المتروكة", en: "Abandoned carts" },
  whatsapp_broadcast: { ar: "رسالة واتساب جماعية", en: "WhatsApp broadcast" },
  quiet_hours: { ar: "ساعات الهدوء فعّالة (٩ص–٩م القاهرة)", en: "Quiet hours on (9am–9pm Cairo)" },

  in_stock: { ar: "متوفر", en: "In stock" },
  low_stock: { ar: "مخزون منخفض", en: "Low" },
  out_stock: { ar: "نفد", en: "Out" },
  unread: { ar: "غير مقروء", en: "Unread" },

  // ---- Discounts ----
  nav_discounts: { ar: "الخصومات", en: "Discounts" },
  discounts_subtitle: { ar: "أكواد الخصم والعروض التلقائية", en: "Discount codes & automatic offers" },
  create_discount: { ar: "إنشاء خصم", en: "Create discount" },
  edit_discount: { ar: "تعديل الخصم", en: "Edit discount" },
  no_discounts: { ar: "لا توجد خصومات بعد", en: "No discounts yet" },
  no_discounts_hint: { ar: "أنشئ أول كود خصم أو عرض تلقائي لمتجرك.", en: "Create your first discount code or automatic offer." },
  delete: { ar: "حذف", en: "Delete" },
  activate: { ar: "تفعيل", en: "Activate" },
  save: { ar: "حفظ", en: "Save" },
  save_discount: { ar: "حفظ الخصم", en: "Save discount" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  discard: { ar: "تجاهل", en: "Discard" },

  // Column headers
  col_title: { ar: "العنوان", en: "Title" },
  col_method: { ar: "الطريقة", en: "Method" },
  col_eligibility: { ar: "الأهلية", en: "Eligibility" },
  col_type: { ar: "النوع", en: "Type" },
  col_combinations: { ar: "الدمج", en: "Combinations" },
  col_used: { ar: "الاستخدام", en: "Used" },

  // Method
  dm_code: { ar: "كود", en: "Code" },
  dm_automatic: { ar: "تلقائي", en: "Automatic" },

  // Types
  dt_amount_products: { ar: "خصم على المنتجات", en: "Amount off products" },
  dt_amount_order: { ar: "خصم على الطلب", en: "Amount off order" },
  dt_bxgy: { ar: "اشترِ X واحصل على Y", en: "Buy X Get Y" },
  dt_free_shipping: { ar: "شحن مجاني", en: "Free shipping" },
  dt_amount_products_desc: { ar: "نسبة أو مبلغ ثابت على منتجات أو مجموعات محددة", en: "Percentage or fixed amount on specific products or collections" },
  dt_amount_order_desc: { ar: "نسبة أو مبلغ ثابت على إجمالي الطلب", en: "Percentage or fixed amount off the order total" },
  dt_bxgy_desc: { ar: "عرض اشترِ كمية واحصل على منتجات مجانية أو مخفّضة", en: "Buy a quantity and get items free or discounted" },
  dt_free_shipping_desc: { ar: "شحن مجاني عند تحقق الشروط", en: "Free shipping when conditions are met" },

  // Status
  ds_active: { ar: "نشط", en: "Active" },
  ds_scheduled: { ar: "مجدول", en: "Scheduled" },
  ds_expired: { ar: "منتهي", en: "Expired" },
  ds_draft: { ar: "مسودة", en: "Draft" },

  // Form sections
  sec_method: { ar: "الطريقة", en: "Method" },
  sec_type: { ar: "نوع الخصم", en: "Discount type" },
  sec_value: { ar: "القيمة", en: "Discount value" },
  sec_applies_to: { ar: "ينطبق على", en: "Applies to" },
  sec_min_req: { ar: "الحد الأدنى للشراء", en: "Minimum purchase requirements" },
  sec_eligibility: { ar: "أهلية العملاء", en: "Customer eligibility" },
  sec_max_uses: { ar: "الحد الأقصى للاستخدام", en: "Maximum discount uses" },
  sec_combinations: { ar: "الدمج مع خصومات أخرى", en: "Combinations" },
  sec_dates: { ar: "تواريخ التفعيل", en: "Active dates" },
  sec_bxgy_buys: { ar: "ما يشتريه العميل", en: "Customer buys" },
  sec_bxgy_gets: { ar: "ما يحصل عليه العميل", en: "Customer gets" },
  sec_countries: { ar: "الدول", en: "Countries" },
  summary: { ar: "الملخص", en: "Summary" },

  // Fields
  fld_code: { ar: "كود الخصم", en: "Discount code" },
  fld_title_auto: { ar: "عنوان الخصم التلقائي", en: "Automatic discount title" },
  fld_generate: { ar: "توليد", en: "Generate" },
  code_hint: { ar: "سيكتب العملاء هذا الكود عند الدفع.", en: "Customers enter this code at checkout." },
  title_hint: { ar: "لن يراه العملاء؛ للاستخدام الداخلي فقط.", en: "Customers won't see this; internal only." },
  percentage: { ar: "نسبة مئوية", en: "Percentage" },
  fixed_amount: { ar: "مبلغ ثابت", en: "Fixed amount" },
  value_label: { ar: "قيمة الخصم", en: "Discount value" },

  applies_all_products: { ar: "كل المنتجات", en: "All products" },
  applies_collections: { ar: "مجموعات محددة", en: "Specific collections" },
  applies_products: { ar: "منتجات محددة", en: "Specific products" },

  min_none: { ar: "بدون حد أدنى", en: "No minimum requirements" },
  min_amount: { ar: "حد أدنى لقيمة الشراء (جنيه)", en: "Minimum purchase amount (EGP)" },
  min_quantity: { ar: "حد أدنى لعدد القطع", en: "Minimum quantity of items" },

  elig_all: { ar: "كل العملاء", en: "All customers" },
  elig_segments: { ar: "شرائح عملاء محددة", en: "Specific customer segments" },
  elig_customers: { ar: "عملاء محددون", en: "Specific customers" },

  limit_total: { ar: "حد إجمالي لعدد مرات الاستخدام", en: "Limit number of times this discount can be used in total" },
  limit_once: { ar: "مرة واحدة لكل عميل", en: "Limit to one use per customer" },

  combine_product: { ar: "خصومات المنتجات", en: "Product discounts" },
  combine_order: { ar: "خصومات الطلب", en: "Order discounts" },
  combine_shipping: { ar: "خصومات الشحن", en: "Shipping discounts" },
  combine_none: { ar: "لا يُدمج", en: "No combinations" },
  combine_hint: { ar: "اختر أنواع الخصومات التي يمكن دمج هذا الخصم معها.", en: "Choose which discount types this can combine with." },

  start_date: { ar: "تاريخ البدء", en: "Start date" },
  end_date: { ar: "تاريخ الانتهاء", en: "End date" },
  set_end_date: { ar: "تحديد تاريخ انتهاء", en: "Set end date" },

  bxgy_min_qty: { ar: "أدنى كمية للشراء", en: "Minimum quantity of items" },
  bxgy_min_amount: { ar: "أدنى قيمة للشراء", en: "Minimum purchase amount" },
  bxgy_gets_qty: { ar: "الكمية المجانية/المخفّضة", en: "Quantity" },
  bxgy_free: { ar: "مجاناً", en: "Free" },

  countries_all: { ar: "كل الدول", en: "All countries" },
  ship_exclude: { ar: "استثناء رسوم الشحن الأعلى من مبلغ معيّن", en: "Exclude shipping rates over a certain amount" },

  saving: { ar: "جارٍ الحفظ…", en: "Saving…" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…" },
  no_value: { ar: "—", en: "—" },
  times: { ar: "مرة", en: "times" },
  supabase_missing: { ar: "لم يتم ربط Supabase. أضِف المفاتيح في ملف .env.local.", en: "Supabase is not connected. Add your keys to .env.local." },
  delete_confirm: { ar: "حذف هذا الخصم نهائياً؟", en: "Permanently delete this discount?" },
  // ---- Content / Files ----
  group_content: { ar: "المحتوى", en: "Content" },
  nav_content: { ar: "المحتوى", en: "Content" },
  nav_files: { ar: "الملفات", en: "Files" },
  files_subtitle: { ar: "مكتبة الوسائط والملفات", en: "Media & file library" },
  upload_files: { ar: "رفع ملفات", en: "Upload files" },
  drop_files_here: { ar: "اسحب وأفلت الملفات هنا", en: "Drag and drop files here" },
  or_browse: { ar: "أو تصفّح من جهازك", en: "or browse from your device" },
  browse: { ar: "تصفّح", en: "Browse" },
  add_from_url: { ar: "إضافة من رابط", en: "Add from URL" },
  url_placeholder: { ar: "https://example.com/image.jpg", en: "https://example.com/image.jpg" },
  add: { ar: "إضافة", en: "Add" },
  uploading: { ar: "جارٍ الرفع…", en: "Uploading…" },
  no_files: { ar: "لا توجد ملفات بعد", en: "No files yet" },
  no_files_hint: { ar: "ارفع صوراً أو فيديوهات أو مستندات لاستخدامها في متجرك.", en: "Upload images, videos, or documents to use across your store." },

  ft_all: { ar: "الكل", en: "All" },
  fk_image: { ar: "صور", en: "Images" },
  fk_video: { ar: "فيديو", en: "Videos" },
  fk_document: { ar: "مستندات", en: "Documents" },
  fk_audio: { ar: "صوت", en: "Audio" },
  fk_other: { ar: "أخرى", en: "Other" },

  sort_newest: { ar: "الأحدث", en: "Newest" },
  sort_oldest: { ar: "الأقدم", en: "Oldest" },
  sort_name: { ar: "الاسم", en: "Name" },
  sort_size: { ar: "الحجم", en: "Size" },
  sort_by: { ar: "ترتيب حسب", en: "Sort by" },

  file_details: { ar: "تفاصيل الملف", en: "File details" },
  file_name: { ar: "اسم الملف", en: "File name" },
  alt_text: { ar: "النص البديل", en: "Alt text" },
  alt_hint: { ar: "يصف الصورة لمحركات البحث وقارئات الشاشة.", en: "Describes the image for SEO and screen readers." },
  copy_url: { ar: "نسخ الرابط", en: "Copy URL" },
  copied: { ar: "تم النسخ", en: "Copied" },
  open_file: { ar: "فتح", en: "Open" },
  download: { ar: "تنزيل", en: "Download" },
  date_added: { ar: "تاريخ الإضافة", en: "Date added" },
  file_size: { ar: "الحجم", en: "Size" },
  dimensions: { ar: "الأبعاد", en: "Dimensions" },
  references: { ar: "مرات الاستخدام", en: "References" },
  file_type: { ar: "النوع", en: "Type" },
  external_file: { ar: "ملف خارجي (رابط)", en: "External (linked) file" },
  delete_file_confirm: { ar: "حذف هذا الملف نهائياً؟", en: "Permanently delete this file?" },
  rename: { ar: "إعادة تسمية", en: "Rename" },
  files_count: { ar: "ملف", en: "files" },

  // ---- Online Store / Themes ----
  group_online_store: { ar: "المتجر الإلكتروني", en: "Online Store" },
  nav_online_store: { ar: "المتجر الإلكتروني", en: "Online Store" },
  nav_themes: { ar: "القوالب", en: "Themes" },
  themes_subtitle: { ar: "ارفع قوالب المتجر وعايِنها وانشرها", en: "Upload, preview & publish store themes" },
  upload_theme: { ar: "رفع قالب", en: "Upload theme" },
  theme_library: { ar: "مكتبة القوالب", en: "Theme library" },
  live_theme: { ar: "القالب الحالي", en: "Current theme" },
  theme_name: { ar: "اسم القالب", en: "Theme name" },
  theme_version: { ar: "الإصدار", en: "Version" },
  drop_theme_here: { ar: "اسحب وأفلت ملف القالب هنا", en: "Drag and drop your theme file here" },
  theme_hint: { ar: "ملف مضغوط .zip يحتوي index.html، أو ملف .html واحد", en: ".zip bundle containing index.html, or a single .html file" },
  theme_uploading: { ar: "جارٍ الرفع والمعالجة…", en: "Uploading & processing…" },
  no_themes: { ar: "لا توجد قوالب بعد", en: "No themes yet" },
  no_themes_hint: { ar: "ارفع أول قالب لمتجرك (zip أو html).", en: "Upload your first store theme (zip or html)." },

  th_published: { ar: "منشور", en: "Published" },
  th_unpublished: { ar: "غير منشور", en: "Unpublished" },
  th_draft: { ar: "مسودة", en: "Draft" },

  publish: { ar: "نشر", en: "Publish" },
  unpublish: { ar: "إلغاء النشر", en: "Unpublish" },
  preview: { ar: "معاينة", en: "Preview" },
  preview_theme: { ar: "معاينة القالب", en: "Preview theme" },
  customize: { ar: "تخصيص", en: "Customize" },
  desktop: { ar: "سطح المكتب", en: "Desktop" },
  mobile: { ar: "الجوال", en: "Mobile" },
  open_new_tab: { ar: "فتح في تبويب جديد", en: "Open in new tab" },
  close: { ar: "إغلاق", en: "Close" },
  delete_theme_confirm: { ar: "حذف هذا القالب نهائياً؟", en: "Permanently delete this theme?" },
  theme_files: { ar: "ملف", en: "files" },
  no_preview: { ar: "لا تتوفر معاينة لهذا القالب", en: "No preview available for this theme" },
  processing: { ar: "جارٍ المعالجة…", en: "Processing…" },

  // ---- Theme inspector ----
  theme_inspector: { ar: "مستكشف القالب", en: "Theme inspector" },
  inspect: { ar: "استكشاف", en: "Inspect" },
  select_a_file: { ar: "اختر ملفاً لمعاينته", en: "Select a file to preview" },
  binary_no_preview: { ar: "لا تتوفر معاينة لهذا الملف", en: "No preview for this file type" },
  theme_settings: { ar: "إعدادات القالب", en: "Theme settings" },
  search_files: { ar: "بحث في الملفات…", en: "Search files…" },
  shopify_theme_note: { ar: "قالب Shopify (Liquid) — يُعرض كمستكشف ملفات لأنه يحتاج محرك Shopify للعرض المباشر.", en: "Shopify (Liquid) theme — shown as a file inspector since live rendering needs Shopify." },

  // ---- Meta (Facebook) integration ----
  group_channels: { ar: "قنوات البيع", en: "Sales channels" },
  nav_meta: { ar: "ميتا (فيسبوك)", en: "Meta (Facebook)" },
  meta_subtitle: { ar: "اربط البيكسل والكتالوج وأحداث الخادم مع ميتا", en: "Connect Pixel, Catalog & server events to Meta" },
  sec_connection: { ar: "الاتصال", en: "Connection" },
  meta_connect: { ar: "ربط فيسبوك", en: "Connect Facebook" },
  meta_reconnect: { ar: "إعادة الربط", en: "Reconnect" },
  meta_disconnect: { ar: "إلغاء الربط", en: "Disconnect" },
  meta_connected: { ar: "متصل", en: "Connected" },
  meta_not_connected: { ar: "غير متصل", en: "Not connected" },
  meta_account: { ar: "الحساب", en: "Account" },
  meta_business: { ar: "النشاط التجاري", en: "Business" },
  meta_app_missing: { ar: "لم يتم ضبط تطبيق ميتا. أضِف META_APP_ID و META_APP_SECRET في ملف .env.local.", en: "Meta app not configured. Add META_APP_ID and META_APP_SECRET to .env.local." },
  meta_connect_hint: { ar: "سجّل الدخول بحساب فيسبوك التجاري للوصول إلى البيكسل والكتالوج.", en: "Sign in with your Facebook business account to access your Pixel and Catalog." },
  token_expires: { ar: "تنتهي صلاحية الإذن", en: "Access expires" },

  sec_pixel: { ar: "بيكسل ميتا", en: "Meta Pixel" },
  pixel_select: { ar: "اختر البيكسل", en: "Select pixel" },
  pixel_id_label: { ar: "معرّف البيكسل", en: "Pixel ID" },
  pixel_enable: { ar: "تفعيل تتبّع البيكسل في المتجر", en: "Enable Pixel tracking on storefront" },
  pixel_inject_hint: { ar: "يُحقن كود البيكسل تلقائياً في معاينة القالب وصفحات المتجر.", en: "Pixel code is injected into the theme preview and storefront pages." },
  pixel_snippet: { ar: "كود البيكسل", en: "Pixel code" },
  copy_snippet: { ar: "نسخ الكود", en: "Copy code" },

  sec_catalog: { ar: "كتالوج المنتجات", en: "Product catalog" },
  catalog_select: { ar: "اختر الكتالوج", en: "Select catalog" },
  sync_catalog: { ar: "مزامنة المنتجات", en: "Sync products" },
  syncing: { ar: "جارٍ المزامنة…", en: "Syncing…" },
  last_sync: { ar: "آخر مزامنة", en: "Last sync" },
  products_synced: { ar: "منتج تمت مزامنته", en: "products synced" },
  no_catalog_selected: { ar: "اختر كتالوجاً أولاً", en: "Select a catalog first" },

  sec_events: { ar: "مدير الأحداث", en: "Events Manager" },
  events_tester: { ar: "اختبار الأحداث", en: "Test events" },
  send_test_event: { ar: "إرسال حدث تجريبي", en: "Send test event" },
  event_type: { ar: "نوع الحدث", en: "Event type" },
  test_event_code: { ar: "كود الاختبار (Test Event Code)", en: "Test Event Code" },
  test_event_code_hint: { ar: "من مدير أحداث ميتا ← اختبار الأحداث. يتيح ظهور الأحداث التجريبية فوراً.", en: "From Meta Events Manager → Test events. Lets test events appear instantly." },
  recent_events: { ar: "أحدث الأحداث المرسلة", en: "Recently sent events" },
  no_events_yet: { ar: "لم تُرسل أحداث بعد", en: "No events sent yet" },
  events_received: { ar: "حدث مُستلم", en: "events received" },
  open_events_manager: { ar: "فتح مدير الأحداث", en: "Open Events Manager" },
  capi_enable: { ar: "تفعيل واجهة التحويلات (الخادم)", en: "Enable Conversions API (server)" },

  ev_pageview: { ar: "زيارة صفحة", en: "PageView" },
  ev_viewcontent: { ar: "عرض محتوى", en: "ViewContent" },
  ev_addtocart: { ar: "إضافة للسلة", en: "AddToCart" },
  ev_purchase: { ar: "شراء", en: "Purchase" },
  status_sent: { ar: "أُرسل", en: "Sent" },
  status_error: { ar: "خطأ", en: "Error" },

} as const;

export type DictKey = keyof typeof dict;

type Ctx = { lang: Lang; dir: "rtl" | "ltr"; t: (k: DictKey) => string; toggle: () => void };

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    const stored = (typeof window !== "undefined" &&
      window.localStorage.getItem("lang")) as Lang | null;
    if (stored === "ar" || stored === "en") setLang(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    window.localStorage.setItem("lang", lang);
  }, [lang]);

  const value: Ctx = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t: (k) => dict[k][lang],
    toggle: () => setLang((l) => (l === "ar" ? "en" : "ar")),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useI18n must be used inside <LangProvider>");
  return ctx;
}

/** Format a number as Egyptian Pounds, locale-aware. */
export function egp(amount: number, lang: Lang = "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function num(n: number, lang: Lang = "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(n);
}
