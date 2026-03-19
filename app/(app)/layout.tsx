import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Providers from "@/components/Providers";

const APP_VERSION = "MedTrak Pilot v0.9";

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <main className="flex-1 p-8">{children}</main>

          <footer className="border-t border-slate-200 bg-white px-8 py-3 text-xs text-slate-500">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span>{APP_VERSION}</span>
              <span>Ledger-based inventory • Audit-ready transaction history</span>
            </div>
          </footer>
        </div>
      </div>
    </Providers>
  );
}
