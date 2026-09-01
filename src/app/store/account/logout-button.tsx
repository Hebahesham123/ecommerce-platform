"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { logout } from "../auth-actions";

export default function LogoutButton() {
  const { lang } = useI18n();
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await logout();
        // Home for a shopper is the published theme at /shop — the same place
        // the header logo and checkout go. /store is the bare internal list.
        router.push("/shop");
        router.refresh();
      }}
      className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-hover hover:text-ink"
    >
      {lang === "ar" ? "تسجيل الخروج" : "Log out"}
    </button>
  );
}
