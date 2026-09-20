import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { CommandPaletteProvider } from "@/components/command-palette";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen bg-surface-page">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-line bg-surface lg:block">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* Room at the foot of a phone for the bottom bar, and for a page's
              own main action sitting above it. */}
          <main className="flex-1 px-4 py-5 pb-32 md:px-6 md:py-6 lg:pb-6">{children}</main>
        </div>
        <BottomNav />
      </div>
    </CommandPaletteProvider>
  );
}
