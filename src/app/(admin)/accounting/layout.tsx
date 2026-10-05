"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EntityProvider, useEntity } from "@/components/accounting/EntityContext";
import { Select } from "@/components/accounting/ui";

type NavLink = { href: string; label: string; icon: string };
type NavSep = { type: "sep" };
type NavItem = NavLink | NavSep;

const NAV: NavItem[] = [
  { href: "/accounting", label: "لوحة التحكم", icon: "📊" },
  { href: "/accounting/entities", label: "الكيانات / الشركات", icon: "🏢" },
  { href: "/accounting/accounts", label: "شجرة الحسابات", icon: "🌳" },
  { href: "/accounting/projects", label: "المشاريع", icon: "📁" },
  { href: "/accounting/journal", label: "قيود اليومية", icon: "📝" },
  { type: "sep" },
  { href: "/accounting/reports/general-ledger", label: "دفتر الأستاذ", icon: "📒" },
  { href: "/accounting/reports/trial-balance", label: "ميزان المراجعة", icon: "⚖️" },
  { href: "/accounting/reports/balance-sheet", label: "الميزانية العمومية", icon: "🧾" },
  { href: "/accounting/reports/income-statement", label: "قائمة الدخل", icon: "💰" },
  { href: "/accounting/reports/cash-flow", label: "التدفقات النقدية", icon: "💵" },
  { href: "/accounting/reports/account-reports", label: "تقارير الحسابات", icon: "🔎" },
];

function SubNav() {
  const pathname = usePathname();
  const { entities, entity, setEntityId } = useEntity();

  const isActive = (href: string) =>
    href === "/accounting"
      ? pathname === "/accounting"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="no-print mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            ₪
          </span>
          <span className="text-sm font-bold text-slate-800">نظام المحاسبة</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">الكيان الحالي:</span>
          <div className="w-56">
            <Select value={entity?.id ?? ""} onChange={(e) => setEntityId(e.target.value)}>
              {entities.length === 0 && <option value="">لا يوجد كيان — أضف واحداً</option>}
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <span className="text-xs text-slate-400">{entity?.currency ?? "EGP"}</span>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {NAV.map((item, i) =>
          "type" in item ? (
            <span key={`sep-${i}`} className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        )}
      </nav>
    </div>
  );
}

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntityProvider>
      <div dir="rtl">
        <SubNav />
        {children}
      </div>
    </EntityProvider>
  );
}
