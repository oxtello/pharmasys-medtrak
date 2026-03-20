"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const baseNavGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", exact: true },
      { href: "/inventory", label: "Inventory", exact: true },
      { href: "/transactions", label: "Transactions", exact: true },
      { href: "/reports", label: "Reports", exact: true },
    ],
  },
  {
    title: "Inventory Actions",
    items: [
      { href: "/inventory/receive", label: "Receive" },
      { href: "/inventory/dispense", label: "Dispense" },
      { href: "/inventory/transfer", label: "Transfer" },
      { href: "/inventory/adjust", label: "Adjust" },
      { href: "/inventory/waste", label: "Waste" },
      { href: "/inventory/dispose", label: "Dispose" },
      { href: "/inventory/cycle-count", label: "Cycle Count" },
    ],
  },
];

const adminNavGroup: NavGroup = {
  title: "Administration",
  items: [
    { href: "/admin", label: "Admin", exact: true },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/medications", label: "Medications" },
    { href: "/admin/barcode-map", label: "Barcode Map" },
  ],
};

function isItemActive(pathname: string | null, item: NavItem) {
  if (!pathname) return false;

  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [logoMissing, setLogoMissing] = useState(false);

  const role = String(
    (session?.user as { role?: string } | undefined)?.role || ""
  ).toUpperCase();

  const navGroups =
    role === "ADMIN" ? [...baseNavGroups, adminNavGroup] : baseNavGroups;

  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-slate-50 lg:block print:hidden">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <Link href="/dashboard" className="block">
            {!logoMissing ? (
              <img
                src="/Logo_Transparent.png"
                alt="PharmaSys MedTrak"
                className="h-16 w-auto"
                onError={() => setLogoMissing(true)}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">
                  PharmaSys MedTrak
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Medication Inventory Command Center
                </p>
              </div>
            )}

            <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Inventory • Compliance • Operations
            </div>
          </Link>
        </div>

        <div className="px-6 pt-4">
          <div className="rounded-[24px] border border-blue-100 bg-blue-50 px-5 py-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              PharmaSys MedTrak
            </div>
            <div className="mt-2 text-xl font-semibold leading-7 text-slate-900">
              Clinical inventory workspace
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Unified barcode, ledger, reconciliation, and reporting system.
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-8">
            {navGroups.map((group) => (
              <div key={group.title}>
                <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {group.title}
                </h2>

                <div className="mt-3 space-y-1.5">
                  {group.items.map((item) => {
                    const active = isItemActive(pathname, item);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
                          active
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </div>
    </aside>
  );
}
