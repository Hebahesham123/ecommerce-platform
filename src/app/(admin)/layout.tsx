import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPaletteProvider } from "@/components/command-palette";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen bg-surface-page">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-line bg-white lg:block">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
